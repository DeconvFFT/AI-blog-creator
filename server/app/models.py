from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Optional

from sqlalchemy import JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(512))
    slug: Mapped[str] = mapped_column(String(512), unique=True, index=True)

    source_type: Mapped[str] = mapped_column(String(32))  # upload|external|manual
    source_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    content_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_html: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    images: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)  # list of {url, alt}
    tables: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)  # list of HTML strings or JSON tables
    meta: Mapped[Optional[Any]] = mapped_column(JSON, nullable=True)

    created_at: Mapped[dt.datetime] = mapped_column(default=lambda: dt.datetime.utcnow())
    updated_at: Mapped[dt.datetime] = mapped_column(default=lambda: dt.datetime.utcnow(), onupdate=lambda: dt.datetime.utcnow())

