import json
import logging
from typing import Any, Optional

import redis

from .config import settings

logger = logging.getLogger(__name__)


_redis: Optional[redis.Redis] = None
_redis_bytes: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def get_redis_bytes() -> redis.Redis:
    """Redis connection for binary payloads (no unicode decoding)."""
    global _redis_bytes
    if _redis_bytes is None:
        _redis_bytes = redis.from_url(settings.redis_url, decode_responses=False)
    return _redis_bytes


def cache_get(key: str) -> Optional[str]:
    try:
        r = get_redis()
        return r.get(key)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache_get error: %s", e)
        return None


def cache_set(key: str, value: str, ttl: Optional[int] = None) -> None:
    try:
        r = get_redis()
        r.set(key, value, ex=ttl or settings.redis_cache_ttl_seconds)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache_set error: %s", e)


def cache_json_get(key: str) -> Optional[Any]:
    s = cache_get(key)
    if not s:
        return None
    try:
        return json.loads(s)
    except Exception:  # noqa: BLE001
        return None


def cache_json_set(key: str, obj: Any, ttl: Optional[int] = None) -> None:
    cache_set(key, json.dumps(obj), ttl)


def cache_delete(key: str) -> None:
    try:
        r = get_redis()
        r.delete(key)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache_delete error: %s", e)


# Binary helpers -------------------------------------------------------------
def cache_bytes_get(key: str) -> Optional[bytes]:
    try:
        r = get_redis_bytes()
        return r.get(key)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache_bytes_get error: %s", e)
        return None


def cache_bytes_set(key: str, value: bytes, ttl: Optional[int] = None) -> None:
    try:
        r = get_redis_bytes()
        r.set(key, value, ex=ttl or settings.redis_cache_ttl_seconds)
    except Exception as e:  # noqa: BLE001
        logger.debug("cache_bytes_set error: %s", e)
