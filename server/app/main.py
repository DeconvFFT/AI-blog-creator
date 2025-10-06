from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

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


@app.get("/")
def root():
    return {"service": settings.app_name, "status": "ok"}
