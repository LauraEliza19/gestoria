from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from app.api import auth, customers, organization, orders, products, quotes
from app.api import order_operations

from app.config import settings

project_root = Path(__file__).resolve().parents[2]


def resolve_frontend_dir() -> Path:
    candidates: list[Path] = []
    if settings.frontend_dir:
        configured = Path(settings.frontend_dir)
        candidates.extend([configured, configured / "frontend"])
    candidates.append(project_root / "frontend")

    for candidate in candidates:
        if (candidate / "dist" / "index.html").is_file():
            return candidate

    raise RuntimeError("Build do frontend não encontrado (dist/index.html).")


frontend_dir = resolve_frontend_dir()

app = FastAPI(title=settings.app_name, version="0.2.0-security.1")
app.include_router(auth.router)
app.include_router(order_operations.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(quotes.router)
app.include_router(organization.router)


@app.get("/api/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


def react_index() -> FileResponse:
    return FileResponse(frontend_dir / "dist" / "index.html")


@app.get("/", include_in_schema=False)
def react_root() -> FileResponse:
    return react_index()


app.mount("/assets", StaticFiles(directory=frontend_dir / "dist" / "assets"), name="assets")


@app.get("/{path:path}", include_in_schema=False)
def react_route(path: str) -> FileResponse:
    if path.startswith("api/") or path.startswith("assets/"):
        raise HTTPException(status_code=404, detail="Recurso não encontrado.")
    return react_index()
