from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    app_name: str = Field(default="ai-blog-platform", alias="APP_NAME")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    database_url: str = Field(default="sqlite:///./data.db", alias="DATABASE_URL")

    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_cache_ttl_seconds: int = Field(default=86400, alias="REDIS_CACHE_TTL_SECONDS")
    # Binary assets (images/uploads) in Redis: 0 = no expiry
    redis_binary_ttl_seconds: int = Field(default=0, alias="REDIS_BINARY_TTL_SECONDS")

    groq_api_key: str | None = Field(default=None, alias="GROQ_API_KEY")
    groq_model: str = Field(default="llama3-8b-8192", alias="GROQ_MODEL")
    # Empty by default so cloud deployments don't try to hit localhost
    ollama_base_url: str | None = Field(default=None, alias="OLLAMA_BASE_URL")
    ollama_model: str = Field(default="gpt-oss-20b", alias="OLLAMA_MODEL")
    llm_parse_mode: str = Field(default="require", alias="LLM_PARSE_MODE")  # require|prefer|off

    storage_dir: str = Field(default="server/storage", alias="STORAGE_DIR")

    backend_cors_origins: str = Field(default="http://localhost:3000,http://localhost:3001,https://eclectic-elf-45002c.netlify.app", alias="BACKEND_CORS_ORIGINS")
    backend_cors_regex: str | None = Field(default=r"^https?://(localhost|127\.0\.0\.1|eclectic-elf-45002c\.netlify\.app)(:\d+)?$", alias="BACKEND_CORS_REGEX")
    site_base_url: str = Field(default="https://eclectic-elf-45002c.netlify.app", alias="SITE_BASE_URL")

    def model_post_init(self, __context) -> None:  # type: ignore[override]
        def _clean(v: str | None, lower: bool = False) -> str | None:
            if v is None:
                return None
            s = v.strip()
            if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
                s = s[1:-1].strip()
            # Treat empty strings as unset so env vars like GROQ_API_KEY="" don't disable cloud keys
            if s == "":
                return None
            return s.lower() if lower else s

        # Normalize common string envs (handles quoted values in .env)
        self.groq_api_key = _clean(self.groq_api_key)  # type: ignore[assignment]
        # Ensure model always has a valid default if env/.env is empty
        self.groq_model = _clean(self.groq_model) or "llama3-8b-8192"  # type: ignore[assignment]
        self.ollama_base_url = _clean(self.ollama_base_url)  # type: ignore[assignment]
        self.ollama_model = _clean(self.ollama_model)  # type: ignore[assignment]
        self.llm_parse_mode = _clean(self.llm_parse_mode, lower=True) or "require"  # type: ignore[assignment]
        self.backend_cors_origins = _clean(self.backend_cors_origins) or "http://localhost:3000,http://localhost:3001"  # type: ignore[assignment]
        self.backend_cors_regex = _clean(self.backend_cors_regex)  # type: ignore[assignment]
        self.site_base_url = _clean(self.site_base_url) or "http://localhost:3001"  # type: ignore[assignment]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()  # singleton
