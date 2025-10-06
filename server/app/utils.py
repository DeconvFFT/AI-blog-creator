from __future__ import annotations

import os
import secrets
import shutil
from pathlib import Path
from typing import Tuple

from slugify import slugify

from .config import settings


def ensure_storage() -> Path:
    p = Path(settings.storage_dir)
    p.mkdir(parents=True, exist_ok=True)
    (p / "images").mkdir(parents=True, exist_ok=True)
    (p / "uploads").mkdir(parents=True, exist_ok=True)
    return p


def safe_filename(name: str) -> str:
    base = slugify(Path(name).stem) or "file"
    ext = Path(name).suffix
    return f"{base}-{secrets.token_hex(4)}{ext}"


def save_upload(fileobj, filename: str) -> Tuple[str, Path]:
    ensure_storage()
    fname = safe_filename(filename)
    dest = Path(settings.storage_dir) / "uploads" / fname
    with open(dest, "wb") as f:
        shutil.copyfileobj(fileobj, f)
    return f"/static/uploads/{fname}", dest


def save_image_bytes(content: bytes, original_name: str) -> str:
    ensure_storage()
    fname = safe_filename(original_name)
    dest = Path(settings.storage_dir) / "images" / fname
    with open(dest, "wb") as f:
        f.write(content)
    return f"/static/images/{fname}"


def make_slug(title: str) -> str:
    s = slugify(title)
    return s or f"post-{secrets.token_hex(3)}"


def unique_slug(db, base: str) -> str:
    """Ensure slug is unique by appending a numeric suffix if needed."""
    slug = base
    i = 2
    from .models import BlogPost  # local import to avoid cycles
    exists = lambda s: db.query(BlogPost).filter(BlogPost.slug == s).first() is not None
    while exists(slug):
        slug = f"{base}-{i}"
        i += 1
        if i > 1000:
            slug = f"{base}-{secrets.token_hex(3)}"
            break
    return slug
