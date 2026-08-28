from pathlib import Path

import pytest

from app import main
from app.config import settings
from app.main import resolve_frontend_dir


def test_resolve_frontend_dir_finds_project_frontend() -> None:
    frontend = resolve_frontend_dir()

    assert frontend.name == "frontend"
    assert (frontend / "views" / "login.html").is_file()
    assert (frontend / "static" / "css" / "app.css").is_file()


def test_resolve_frontend_dir_accepts_parent_of_frontend(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    nested = tmp_path / "frontend"
    (nested / "views").mkdir(parents=True)
    (nested / "static").mkdir()
    monkeypatch.setattr(settings, "frontend_dir", str(tmp_path))

    assert resolve_frontend_dir() == nested


def test_resolve_frontend_dir_raises_when_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "frontend_dir", str(tmp_path))
    monkeypatch.setattr(main, "project_root", tmp_path)

    with pytest.raises(RuntimeError, match="frontend"):
        resolve_frontend_dir()
