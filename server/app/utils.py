from __future__ import annotations

import os
import secrets
import shutil
from pathlib import Path
from typing import Tuple

from slugify import slugify

from .config import settings
from .cache import cache_bytes_get, cache_bytes_set


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
    # Store raw bytes in Redis under a unique key; serve via /static-redis/
    data = fileobj.read()
    key = f"upload:{safe_filename(filename)}"
    cache_bytes_set(key, data)
    return f"/static-redis/{key}", Path(key)


def save_image_bytes(content: bytes, original_name: str) -> str:
    key = f"image:{safe_filename(original_name)}"
    cache_bytes_set(key, content)
    return f"/static-redis/{key}"


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
