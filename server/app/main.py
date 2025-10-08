from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi import Request
from fastapi.responses import Response
import mimetypes

from .config import settings
from .db import Base, engine
from .routers import posts
from .observability import enable_langsmith_tracing
from .utils import ensure_storage


logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO))
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.app_name)

cors_kwargs = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
origins = [o.strip() for o in settings.backend_cors_origins.split(",") if o.strip()]
if settings.backend_cors_regex:
    app.add_middleware(CORSMiddleware, allow_origin_regex=settings.backend_cors_regex, **cors_kwargs)
else:
    app.add_middleware(CORSMiddleware, allow_origins=origins, **cors_kwargs)

app.include_router(posts.router)


@app.on_event("startup")
def on_startup():
    enable_langsmith_tracing()
    ensure_storage()
    Base.metadata.create_all(bind=engine)
    static_dir = Path(settings.storage_dir)
    app.mount("/static", StaticFiles(directory=static_dir, html=False), name="static")

    # Serve binary assets from Redis at /static-redis/{key}
    from .cache import cache_bytes_get, cache_bytes_set

    @app.get("/static-redis/{key:path}")
    def get_static_redis(key: str, request: Request):
        data = cache_bytes_get(key)
        if data is None:
            # Lazy-migrate legacy disk files into Redis for backward compatibility
            try:
                prefix, name = (key.split(":", 1) + [""])[:2]
                base_dir = static_dir / ("images" if prefix == "image" else "uploads")
                cand = base_dir / name
                if cand.exists() and cand.is_file():
                    data = cand.read_bytes()
                    cache_bytes_set(key, data)
                else:
                    return Response(status_code=404)
            except Exception:
                return Response(status_code=404)
        ctype, _ = mimetypes.guess_type(key)
        return Response(content=data, media_type=ctype or "application/octet-stream")


@app.get("/")
def root():
    return {"service": settings.app_name, "status": "ok"}
