import os

# Expose FastAPI app for platforms that auto-detect it
from server.app.main import app  # noqa: F401


if __name__ == "__main__":
    import uvicorn

    port_str = os.environ.get("PORT") or os.environ.get("API_PORT") or "8000"
    try:
        port = int(port_str)
    except Exception:
        port = 8000
    uvicorn.run(app, host="0.0.0.0", port=port)


