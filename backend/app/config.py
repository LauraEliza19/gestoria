from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "GestorIA API"
    database_url: str = (
        "postgresql+psycopg://gestoria:gestoria_dev@localhost:5432/gestoria"
    )
    jwt_secret: str = "change-this-development-secret-before-deployment"
    jwt_expire_minutes: int = 480
    frontend_dir: str | None = None

    demo_organization: str = "Empresa Demo GestorIA"
    demo_email: str = "admin@gestoria.dev"
    demo_password: str = "GestorIA@123"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
