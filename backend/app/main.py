from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from app.api import auth, products
from app.config import settings

project_root = Path(__file__).resolve().parents[2]
frontend_dir = Path(settings.frontend_dir) if settings.frontend_dir else project_root

app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(auth.router)
app.include_router(products.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def login_page() -> FileResponse:
    return FileResponse(frontend_dir / "LoginGestorIA.html")


@app.get("/dashboard", include_in_schema=False)
def dashboard_page() -> FileResponse:
    return FileResponse(frontend_dir / "startup-main" / "dashboard.html")


@app.get("/assets/loginStyle.css", include_in_schema=False)
def login_styles() -> FileResponse:
    return FileResponse(frontend_dir / "loginStyle.css", media_type="text/css")


@app.get("/assets/startup-main/styleDashboard.css", include_in_schema=False)
def dashboard_styles() -> FileResponse:
    return FileResponse(
        frontend_dir / "startup-main" / "styleDashboard.css", media_type="text/css"
    )
