from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _find_env_file() -> str:
    """Find .env file — check CWD, then walk up to repo root."""
    from pathlib import Path
    for d in [Path.cwd(), *Path.cwd().parents]:
        candidate = d / ".env"
        if candidate.is_file():
            return str(candidate)
        if (d / ".gitignore").is_file():
            break
    return ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_find_env_file(), env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "DeOrch API"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "production", "test"] = "development"
    deorch_secret_key: str = Field(min_length=16)
    encryption_key: str = Field(default="", min_length=0)  # Base64-encoded 32-byte key for credential encryption

    # Database
    database_url: str = "postgresql+asyncpg://deorch:deorch@localhost:5432/deorch"
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # JWT
    jwt_secret_key: str = Field(min_length=16)
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    # Device pairing
    device_pairing_token_expire_seconds: int = 300
    device_pairing_max_attempts: int = 5

    # WebSocket
    ws_heartbeat_interval_seconds: int = 30
    ws_message_max_size_bytes: int = 1_048_576  # 1 MB

    # Approval requests
    approval_request_default_ttl_seconds: int = 300
    approval_request_max_ttl_seconds: int = 3600

    # CORS (comma-separated string from .env)
    cors_origins: str = "http://localhost:3000"

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "json"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
