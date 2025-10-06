import os
import logging

from .config import settings

logger = logging.getLogger(__name__)


def enable_langsmith_tracing() -> None:
    """Enable LangSmith tracing if API key or LangChain v2 tracing is configured.

    Honors existing env values; sets sane defaults if missing.
    """
    # Prefer explicit LANGCHAIN_TRACING_V2 true when API key exists
    if os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY"):
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        # If user put LangSmith endpoint in env, use it, else keep default.
        if os.getenv("LANGSMITH_ENDPOINT") and not os.getenv("LANGCHAIN_ENDPOINT"):
            os.environ.setdefault("LANGCHAIN_ENDPOINT", os.environ["LANGSMITH_ENDPOINT"])
        # Project
        if os.getenv("LANGSMITH_PROJECT") and not os.getenv("LANGCHAIN_PROJECT"):
            os.environ.setdefault("LANGCHAIN_PROJECT", os.environ["LANGSMITH_PROJECT"])
        logger.info("LangSmith/Chain tracing enabled (v2)")
    else:
        logger.info("LangSmith tracing not enabled; no API key present")

