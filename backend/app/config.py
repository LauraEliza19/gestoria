import json
from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    app_name: str = "GestorIA API"
    app_env: Literal["development", "test", "production"] = "development"
    database_url: str = Field(
        default="postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria",
        repr=False,
    )
    business_timezone: str = "America/Sao_Paulo"
    frontend_dir: str | None = None
    cookie_secure: bool = False
    allowed_origins: list[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    allowed_hosts: list[str] = ["localhost", "127.0.0.1", "testserver"]
    session_access_minutes: int = Field(default=30, ge=1, le=120)
    session_hours: int = Field(default=12, ge=1, le=48)
    session_remember_days: int = Field(default=30, ge=1, le=90)
    login_window_seconds: int = Field(default=900, ge=60, le=3600)
    login_ip_limit: int = Field(default=30, ge=1, le=1000)
    login_account_limit: int = Field(default=10, ge=1, le=100)
    operation_signing_keys: str = Field(default="", repr=False)
    operation_active_key_id: str = "v1"
    operation_ttl_seconds: int = Field(default=300, ge=30, le=3600)
    demo_enabled: bool = False
    demo_organization: str = "Empresa Demo GestorIA"
    demo_email: str = "admin@gestoria.dev"
    demo_password: str = Field(default="", repr=False)

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def session_cookie_name(self) -> str:
        return "__Host-gestoria_session" if self.cookie_secure else "gestoria_session"

    @model_validator(mode="after")
    def validate_production(self):
        if self.app_env != "production":
            return self
        if not self.cookie_secure or self.demo_enabled or self.demo_password:
            raise ValueError(
                "Produção exige COOKIE_SECURE=true e demo desabilitado, sem DEMO_PASSWORD."
            )
        if not self.allowed_hosts or any(
            "*" in h or h in {"localhost", "127.0.0.1", "testserver"}
            for h in self.allowed_hosts
        ):
            raise ValueError(
                "Configure ALLOWED_HOSTS com os domínios exatos de produção."
            )
        if not self.allowed_origins:
            raise ValueError("Configure ALLOWED_ORIGINS.")
        for origin in self.allowed_origins:
            url = urlsplit(origin)
            if (
                url.scheme != "https"
                or url.hostname not in self.allowed_hosts
                or url.path
                or url.query
                or url.fragment
                or url.username
            ):
                raise ValueError(
                    "ALLOWED_ORIGINS deve conter origens HTTPS exatas, sem caminho."
                )
        db = make_url(self.database_url)
        if (
            db.get_backend_name() != "postgresql"
            or not db.password
            or len(db.password) < 24
            or db.password in {"gestoria_dev", "change-me"}
        ):
            raise ValueError(
                "Produção exige PostgreSQL e senha exclusiva com pelo menos 24 caracteres."
            )
        try:
            keys = json.loads(self.operation_signing_keys)
            active = bytes.fromhex(keys[self.operation_active_key_id])
            if len(active) != 32 or len(set(active)) < 8:
                raise ValueError()
        except (ValueError, KeyError, TypeError):
            raise ValueError(
                "Configure uma chave aleatória de operações com 32 bytes."
            ) from None
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
