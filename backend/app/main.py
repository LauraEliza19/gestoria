from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import auth, customers, orders, products
from app.config import settings

project_root = Path(__file__).resolve().parents[2]


def resolve_frontend_dir() -> Path:
    candidates: list[Path] = []
    if settings.frontend_dir:
        configured = Path(settings.frontend_dir)
        candidates.extend([configured, configured / "frontend"])
    candidates.append(project_root / "frontend")

    for candidate in candidates:
        if (candidate / "views").is_dir() and (candidate / "static").is_dir():
            return candidate

    raise RuntimeError("Pasta do frontend não encontrada (views/ e static/).")


frontend_dir = resolve_frontend_dir()

app = FastAPI(title=settings.app_name, version="0.1.0")
app.include_router(auth.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/", include_in_schema=False)
def login_page() -> FileResponse:
    return FileResponse(frontend_dir / "views" / "login.html")


@app.get("/dashboard", include_in_schema=False)
def dashboard_page() -> FileResponse:
    return FileResponse(frontend_dir / "views" / "dashboard.html")


app.mount(
    "/static",
    StaticFiles(directory=frontend_dir / "static"),
    name="static",
)
