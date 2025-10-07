from __future__ import annotations

import io
import json
import logging
from typing import List, Optional

import orjson
import requests
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi import Response
from fastapi import status
from sqlalchemy.orm import Session

from ..agent.graph import parse_graph, refine_graph, summary_graph
from ..parsing import parse_with_docling, parse_any
from ..llm import llm_client
from ..cache import cache_json_get, cache_json_set, cache_delete
from ..config import settings
from ..db import get_db
from ..models import BlogPost
from ..schemas import (
    ExternalLinkCreate,
    ParsedBundle,
    PostCreate,
    PostOut,
    SectionRefineRequest,
    SectionRefineResponse,
)
from ..utils import make_slug, save_upload, unique_slug

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api", tags=["posts"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/posts", response_model=List[PostOut])
def list_posts(db: Session = Depends(get_db)):
    cache_key = "blog:list"
    cached = cache_json_get(cache_key)
    if cached:
        return cached
    rows = db.query(BlogPost).order_by(BlogPost.created_at.desc()).limit(100).all()
    out = []
    for r in rows:
        meta = r.meta or {}
        summary = meta.get("summary") if isinstance(meta, dict) else None
        out.append({
            "id": r.id,
            "title": r.title,
            "slug": r.slug,
            "content_text": r.content_text,
            "content_html": r.content_html,
            "images": r.images or [],
            "tables": r.tables or [],
            "source_type": r.source_type,
            "source_url": r.source_url,
            "meta": meta,
            "summary": summary,
        })
    cache_json_set(cache_key, out)
    return out


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: str, db: Session = Depends(get_db)):
    row = db.get(BlogPost, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@router.get("/posts/slug/{slug}", response_model=PostOut)
def get_post_by_slug(slug: str, db: Session = Depends(get_db)):
    cache_key = f"blog:slug:{slug}"
    cached = cache_json_get(cache_key)
    if cached:
        return cached
    row = db.query(BlogPost).filter(BlogPost.slug == slug).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    obj = {
        "id": row.id,
        "title": row.title,
        "slug": row.slug,
        "content_text": row.content_text,
        "content_html": row.content_html,
        "images": row.images or [],
        "tables": row.tables or [],
        "source_type": row.source_type,
        "source_url": row.source_url,
        "meta": row.meta or {},
        "summary": (row.meta or {}).get("summary") if isinstance(row.meta, dict) else None,
    }
    cache_json_set(cache_key, obj)
    return obj


@router.post("/posts/external", response_model=PostOut)
def add_external_link(payload: ExternalLinkCreate, db: Session = Depends(get_db)):
    slug = make_slug(payload.title)
    post = BlogPost(
        title=payload.title,
        slug=slug,
        source_type="external",
        source_url=payload.url,
        meta=payload.meta or {},
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.post("/posts/parse", response_model=ParsedBundle)
async def parse_post(
    file: Optional[UploadFile] = File(default=None),
    refine_with_llm: bool = Form(default=True),
    url: Optional[str] = Form(default=None),
):
    if (file is None or file.filename is None) and not url:
        raise HTTPException(status_code=400, detail="Provide a file or url")
    # Compute filename and bytes consistently
    if file and file.filename:
        filename = file.filename
        data_bytes = await file.read()
        if data_bytes is None or len(data_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty upload")
    elif url:
        filename = (url.split("/")[-1] or "content")
        try:
            resp = requests.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
                timeout=30,
            )
            resp.raise_for_status()
            data_bytes = resp.content
            # Infer extension from content-type if missing
            if "." not in filename or filename.endswith("/"):
                ctype = resp.headers.get("Content-Type", "").split(";")[0].strip()
                ext = {
                    "text/html": ".html",
                    "text/plain": ".txt",
                    "text/markdown": ".md",
                    "text/csv": ".csv",
                    "application/json": ".json",
                    "application/pdf": ".pdf",
                    "application/vnd.ms-excel": ".xls",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
                    "image/png": ".png",
                    "image/jpeg": ".jpg",
                    "image/webp": ".webp",
                    "image/tiff": ".tiff",
                    "image/bmp": ".bmp",
                    "image/gif": ".gif",
                }.get(ctype)
                if ext:
                    filename = f"{filename}{ext}" if not filename.endswith(ext) else filename
        except Exception as e:  # noqa: BLE001
            raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")
    else:
        # Should not happen due to guard above
        raise HTTPException(status_code=400, detail="Invalid request")

    # Cache key (hash of content + refine flag)
    import hashlib as _hashlib
    h = _hashlib.sha256(data_bytes).hexdigest()
    cache_key = f"parse:{h}:{int(refine_with_llm)}"
    cached = cache_json_get(cache_key)
    if cached:
        return cached

    state = {
        "filename": filename,
        "data": data_bytes,
        "options": {"refine_with_llm": refine_with_llm},
    }
    try:
        result = parse_graph.invoke(state)
    except Exception as e:  # noqa: BLE001
        logger.warning("parse_graph invocation failed, using fallback: %s", e)
        result = None

    parsed: ParsedBundle | None = None
    aligned_text: str | None = None
    refined_text: str | None = None
    errors: list[str] = []
    if isinstance(result, dict):
        parsed = result.get("parsed")
        aligned_text = result.get("aligned_text")
        refined_text = result.get("refined_text")
        if result.get("errors"):
            errors = list(result.get("errors"))

    if parsed is None:
        # Fallback without graph
        parsed = parse_with_docling(filename, data_bytes) or parse_any(filename, data_bytes)

    # Fallback media alignment if graph failed to produce it
    if aligned_text is None and (refine_with_llm or settings.llm_parse_mode == "require"):
        has_media = bool((parsed.images or []) or (parsed.tables or []))
        base_text = (parsed.text or parsed.html or "").strip()
        if has_media and base_text:
            lines: list[str] = []
            if parsed.images:
                for i, im in enumerate(parsed.images, start=1):
                    alt = (im.get("alt") if isinstance(im, dict) else getattr(im, "alt", None)) or ""
                    url = (im.get("url") if isinstance(im, dict) else getattr(im, "url", None)) or ""
                    if url:
                        lines.append(f"IMAGE {i}: url={url} alt={alt}")
            if parsed.tables:
                for j, tb in enumerate(parsed.tables, start=1):
                    if isinstance(tb, dict):
                        has_html = bool(tb.get("html"))
                        has_data = bool(tb.get("data"))
                    else:
                        has_html = bool(getattr(tb, "html", None))
                        has_data = bool(getattr(tb, "data", None))
                    lines.append(f"TABLE {j}: html={has_html} data={has_data}")
            manifest = "\n".join(lines)
            system = (
                "You are aligning extracted media with text. Insert Markdown image tags (e.g., ![alt](URL))"
                " at the most contextually appropriate positions within the provided content."
                " If a table has data or HTML, insert a best-effort Markdown table or a placeholder like [Table N]"
                " where it fits. Do not invent content; preserve order and meaning. Return ONLY Markdown."
            )
            user = (
                "Content to align (Markdown or plaintext):\n\n" + base_text +
                "\n\nMedia manifest:\n" + manifest
            )
            aligned_text = llm_client.chat([
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ])

    # Fallback refine if not produced by graph
    if refined_text is None and (refine_with_llm or settings.llm_parse_mode == "require"):
        base_text = (aligned_text or parsed.text or parsed.html or "").strip()
        if base_text:
            system = (
                "You are a meticulous technical editor. Clean and structure the text into well-formed Markdown,"
                " preserving headings, lists, code blocks, and image references."
                " Ensure any table content is represented as valid GitHub Flavored Markdown tables using pipe syntax."
            )
            user = (
                "Refine the following extracted text for a blog post."
                " Make it clean, readable, and structured, without adding new content.\n\n" + base_text
            )
            refined_text = llm_client.chat([
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ])

    # Commit text in priority: refined > aligned > original parsed
    final_text = refined_text or aligned_text
    if final_text:
        original_text = parsed.text
        parsed.meta = {"original_text_excerpt": (original_text or "")[:2000]}
        parsed.text = final_text

    # attach pipeline errors if any
    if errors:
        meta = parsed.meta or {}
        meta["pipeline_errors"] = errors
        parsed.meta = meta

    cache_json_set(cache_key, json.loads(parsed.model_dump_json()))
    return parsed


@router.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, db: Session = Depends(get_db)):
    # Ensure unique slug
    base_slug = payload.slug or make_slug(payload.title or "Untitled")
    slug = unique_slug(db, base_slug)
    meta = payload.meta or {}
    post = BlogPost(
        title=payload.title or "Untitled",
        slug=slug,
        content_text=payload.content_text,
        content_html=payload.content_html,
        images=[img.model_dump() for img in payload.images],
        tables=[tbl.model_dump() for tbl in payload.tables],
        source_type=payload.source_type,
        source_url=payload.source_url,
        meta=meta,
    )
    db.add(post)
    db.commit()
    db.refresh(post)

    # Generate summary and store in meta
    try:
        text_for_summary = (post.content_text or post.content_html or "")[:8000]
        if text_for_summary:
            res = summary_graph.invoke({"input_text": text_for_summary})
            summary = res.get("summary") if isinstance(res, dict) else None
            if summary:
                post.meta = {**(post.meta or {}), "summary": summary}
                db.add(post)
                db.commit()
                db.refresh(post)
    except Exception as e:  # noqa: BLE001
        logger.warning("summary generation failed: %s", e)

    # Cache post and invalidate list cache
    post_obj = {
        "id": post.id,
        "title": post.title,
        "slug": post.slug,
        "content_text": post.content_text,
        "content_html": post.content_html,
        "images": post.images or [],
        "tables": post.tables or [],
        "source_type": post.source_type,
        "source_url": post.source_url,
        "meta": post.meta or {},
        "summary": (post.meta or {}).get("summary") if isinstance(post.meta, dict) else None,
    }
    cache_json_set(f"blog:slug:{post.slug}", post_obj)
    cache_delete("blog:list")
    return post_obj


@router.post("/assets")
async def upload_asset(file: UploadFile = File(...)):
    # Used by Excalidraw image export or manual image uploads
    url, _ = save_upload(file.file, file.filename)
    return {"url": url}


@router.post("/refine/section", response_model=SectionRefineResponse)
def refine_section(req: SectionRefineRequest):
    text = (req.text or "").strip()
    instructions = (req.instructions or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    import hashlib as _hashlib
    h = _hashlib.sha256((text + "\n\n#instr:\n" + instructions).encode()).hexdigest()
    cache_key = f"refine:section:{h}"
    cached = cache_json_get(cache_key)
    if cached and isinstance(cached, dict) and "refined" in cached:
        return cached

    try:
        res = refine_graph.invoke({"input_text": text, "instructions": instructions})
        refined = res.get("refined") if isinstance(res, dict) else None
    except Exception as e:  # noqa: BLE001
        logger.warning("refine_graph failed, using direct LLM: %s", e)
        refined = None

    if not refined:
        system = (
            "You are a meticulous technical editor. Clean and structure the text into well-formed Markdown,"
            " preserving headings, lists, code blocks, and image references."
            " Ensure any table content is represented as valid GitHub Flavored Markdown tables using pipe syntax."
            " Do not change meaning or introduce new facts. Return ONLY Markdown."
        )
        if instructions:
            system = system + " Additional user instructions (follow strictly): " + instructions
        refined = llm_client.chat([
            {"role": "system", "content": system},
            {"role": "user", "content": text},
        ])

    resp = {"refined": refined}
    cache_json_set(cache_key, resp)
    return resp


def _delete_post_by_id(db: Session, post_id: str):
    row = db.get(BlogPost, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    slug = row.slug
    db.delete(row)
    db.commit()
    cache_delete("blog:list")
    if slug:
        cache_delete(f"blog:slug:{slug}")


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: str, db: Session = Depends(get_db)):
    _delete_post_by_id(db, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/posts/{post_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_post_method(post_id: str, db: Session = Depends(get_db)):
    """Convenience endpoint for clients that prefer POST over DELETE."""
    _delete_post_by_id(db, post_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
