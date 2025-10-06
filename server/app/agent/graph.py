from __future__ import annotations

import logging
from typing import Any, Dict

from langgraph.graph import StateGraph, END
from langchain_core.runnables import RunnableLambda
from bs4 import BeautifulSoup

from ..config import settings
from ..llm import llm_client
from ..parsing.parser import parse_any, parse_with_docling
from ..schemas import ParsedBundle

logger = logging.getLogger(__name__)


class ParseState(Dict[str, Any]):
    """State for parsing/refinement graph.

    keys:
      - filename: str
      - data: bytes
      - options: dict (refine_with_llm: bool)
      - parsed: ParsedBundle | None
      - refined_text: str | None
      - aligned_text: str | None
    """


def node_try_docling(state: ParseState) -> ParseState:
    filename = state.get("filename")
    data = state.get("data")
    if not filename or data is None:
        # Incomplete input; skip docling and let basic parser decide
        return {"parsed": None}
    parsed = parse_with_docling(filename, data)
    return {"parsed": parsed}


def node_basic_parse(state: ParseState) -> ParseState:
    if state.get("parsed") is None:
        filename = state.get("filename") or "content.bin"
        data = state.get("data") or b""
        return {"parsed": parse_any(filename, data)}
    return {}


def node_align_media(state: ParseState) -> ParseState:
    opts = state.get("options") or {}
    # Align when refinement is requested or required globally
    if not (opts.get("refine_with_llm", True) or settings.llm_parse_mode == "require"):
        return {}
    parsed: ParsedBundle | None = state.get("parsed")
    if not parsed:
        return {}
    # Build base text (prefer text, fallback to plaintext from html)
    base_text = (parsed.text or "").strip()
    if not base_text and parsed.html:
        try:
            soup = BeautifulSoup(parsed.html, "html.parser")
            base_text = soup.get_text("\n", strip=True)
        except Exception:
            base_text = parsed.html or ""
    if not base_text:
        return {}
    has_media = bool((parsed.images or []) or (parsed.tables or []))
    if not has_media:
        return {}

    # Prepare a concise media manifest for the LLM
    lines: list[str] = []
    if parsed.images:
        for i, im in enumerate(parsed.images, start=1):
            alt = getattr(im, "alt", None) or ""
            url = getattr(im, "url", None) or ""
            if not url:
                continue
            lines.append(f"IMAGE {i}: url={url} alt={alt}")
    if parsed.tables:
        for j, tb in enumerate(parsed.tables, start=1):
            has_html = bool(getattr(tb, "html", None))
            has_data = bool(getattr(tb, "data", None))
            lines.append(f"TABLE {j}: html={has_html} data={has_data}")
    manifest = "\n".join(lines)

    system = (
        "You are aligning extracted media with text. Insert Markdown image tags (e.g., ![alt](URL))"
        " at the most contextually appropriate positions within the provided content."
        " If a table has data or HTML, render it as a valid GitHub Flavored Markdown table using pipe syntax"
        " (include a header row and separator), otherwise insert a [Table N] placeholder."
        " Do not invent content; preserve order and meaning. Return ONLY Markdown."
    )
    user = (
        "Content to align (Markdown or plaintext):\n\n" + base_text +
        "\n\nMedia manifest:\n" + manifest
    )
    try:
        aligned = llm_client.chat([
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ])
        return {"aligned_text": aligned}
    except Exception:
        return {}


def node_refine_llm(state: ParseState) -> ParseState:
    opts = state.get("options") or {}
    if not opts.get("refine_with_llm", True) and settings.llm_parse_mode != "require":
        return {}
    parsed: ParsedBundle | None = state.get("parsed")
    if not parsed:
        return {}
    # Prefer aligned_text from previous node; else parsed.text; else derive from HTML
    text = (state.get("aligned_text") or parsed.text or "").strip()
    if not text and parsed.html:
        try:
            soup = BeautifulSoup(parsed.html, "html.parser")
            text = soup.get_text("\n", strip=True)
        except Exception:
            text = parsed.html
    if not text:
        return {}
    system = (
        "You are a meticulous technical editor. Clean and structure the text into well-formed Markdown,"
        " preserving headings, lists, code blocks, and image references."
        " Ensure any table content is represented as valid GitHub Flavored Markdown tables using pipe syntax."
    )
    user = (
        "Refine the following extracted content for a blog post. Convert any HTML fragments to clean Markdown."
        " Make it clean, readable, and structured, without adding new content.\n\n" + text
    )
    content = llm_client.chat([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    return {"refined_text": content}


def build_parse_graph():
    g = StateGraph(ParseState)
    g.add_node("try_docling", RunnableLambda(node_try_docling))
    g.add_node("basic_parse", RunnableLambda(node_basic_parse))
    g.add_node("align_media", RunnableLambda(node_align_media))
    g.add_node("refine_llm", RunnableLambda(node_refine_llm))

    g.set_entry_point("try_docling")
    g.add_edge("try_docling", "basic_parse")
    g.add_edge("basic_parse", "align_media")
    g.add_edge("align_media", "refine_llm")
    g.add_edge("refine_llm", END)
    return g.compile()


parse_graph = build_parse_graph()


# Section refiner: refine arbitrary markdown/plaintext
def node_section_refiner(state: Dict[str, Any]) -> Dict[str, Any]:
    text = (state.get("input_text") or "").strip()
    instructions = (state.get("instructions") or "").strip()
    if not text:
        return {"refined": ""}
    system = (
        "You are a meticulous technical editor. Clean and structure the text into well-formed Markdown,"
        " preserving headings, lists, code blocks, tables (as Markdown), and image references."
        " Do not introduce new facts. You may polish tone for clarity and professionalism. "
        "Return ONLY Markdown."
    )
    if instructions:
        system = system + " Additional user instructions (follow strictly): " + instructions
    user = text
    refined = llm_client.chat([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    return {"refined": refined}


def build_refine_graph():
    g = StateGraph(dict)
    g.add_node("section_refiner", RunnableLambda(node_section_refiner))
    g.set_entry_point("section_refiner")
    g.add_edge("section_refiner", END)
    return g.compile()


refine_graph = build_refine_graph()


# Blog summary graph
def node_blog_summary(state: Dict[str, Any]) -> Dict[str, Any]:
    text = (state.get("input_text") or "").strip()
    if not text:
        return {"summary": ""}
    system = (
        "You are a helpful writing assistant. Summarize the following blog content in 2-4 concise sentences,"
        " capturing the main points and takeaways. Avoid marketing fluff."
    )
    user = text
    summary = llm_client.chat([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    return {"summary": summary}


def build_summary_graph():
    g = StateGraph(dict)
    g.add_node("blog_summary", RunnableLambda(node_blog_summary))
    g.set_entry_point("blog_summary")
    g.add_edge("blog_summary", END)
    return g.compile()


summary_graph = build_summary_graph()
