import pytest
from app.api.dependencies import require_role
from app.services import authenticate
from fastapi import HTTPException
from sqlalchemy.orm import Session


def test_require_role_allows_owner_and_forbids_member(db: Session) -> None:
    owner = authenticate(db, "lucas@gestoria.dev", "SenhaForte@123")
    member = authenticate(db, "membro@gestoria.dev", "SenhaForte@123")
    assert owner is not None and member is not None

    require_role(owner, {"owner", "admin"})

    with pytest.raises(HTTPException) as exc:
        require_role(member, {"owner", "admin"})
    assert exc.value.status_code == 403
