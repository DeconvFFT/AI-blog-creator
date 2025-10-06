from __future__ import annotations

from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ImageRef(BaseModel):
    url: str
    alt: Optional[str] = None


class TableRef(BaseModel):
    html: Optional[str] = None
    data: Optional[Any] = None


class ParsedBundle(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    images: List[ImageRef] = Field(default_factory=list)
    tables: List[TableRef] = Field(default_factory=list)
    meta: Optional[Any] = None


class PostCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    content_text: Optional[str] = None
    content_html: Optional[str] = None
    images: List[ImageRef] = Field(default_factory=list)
    tables: List[TableRef] = Field(default_factory=list)
    source_type: str = "upload"
    source_url: Optional[str] = None
    meta: Optional[Any] = None


class PostOut(BaseModel):
    id: str
    title: str
    slug: str
    content_text: Optional[str] = None
    content_html: Optional[str] = None
    images: List[ImageRef] = Field(default_factory=list)
    tables: List[TableRef] = Field(default_factory=list)
    source_type: str
    source_url: Optional[str] = None
    meta: Optional[Any] = None
    summary: Optional[str] = None

    class Config:
        from_attributes = True


class ExternalLinkCreate(BaseModel):
    title: str
    url: str
    meta: Optional[Any] = None


class ParseOptions(BaseModel):
    refine_with_llm: bool = True
    overwrite: bool = False  # if False, append


class SectionRefineRequest(BaseModel):
    text: str
    instructions: str | None = None


class SectionRefineResponse(BaseModel):
    refined: str
