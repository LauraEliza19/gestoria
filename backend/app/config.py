from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GestorIA API"
    database_url: str = (
        "postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria"
    )
    jwt_secret: str = "change-this-development-secret-before-deployment"
    jwt_expire_minutes: int = 480
    business_timezone: str = "America/Sao_Paulo"
    frontend_dir: str | None = None
    # JSON keyring containing 32-byte keys encoded as 64 hexadecimal characters.
    # No development fallback: protected operations fail closed without a key.
    operation_signing_keys: str = Field(default="", repr=False)
    operation_active_key_id: str = "v1"
    operation_ttl_seconds: int = Field(default=300, ge=30, le=3600)

    demo_organization: str = "Empresa Demo GestorIA"
    demo_email: str = "admin@gestoria.dev"
    demo_password: str = "GestorIA@123"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
