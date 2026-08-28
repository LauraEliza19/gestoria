import uuid

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user, require_role
from app.security import create_access_token
from app.services import authenticate


def test_require_role_allows_owner_and_forbids_member(db: Session) -> None:
    owner = authenticate(db, "lucas@gestoria.dev", "SenhaForte@123")
    member = authenticate(db, "membro@gestoria.dev", "SenhaForte@123")
    assert owner is not None and member is not None

    require_role(owner, {"owner", "admin"})

    with pytest.raises(HTTPException) as exc:
        require_role(member, {"owner", "admin"})
    assert exc.value.status_code == 403


def test_get_current_user_rejects_missing_and_invalid_tokens(db: Session) -> None:
    with pytest.raises(HTTPException) as exc:
        get_current_user(db, None)
    assert exc.value.status_code == 401

    with pytest.raises(HTTPException) as invalid:
        get_current_user(
            db,
            HTTPAuthorizationCredentials(scheme="Bearer", credentials="abc"),
        )
    assert invalid.value.status_code == 401


def test_get_current_user_returns_authenticated_session(db: Session) -> None:
    owner = authenticate(db, "lucas@gestoria.dev", "SenhaForte@123")
    assert owner is not None
    token = create_access_token(str(owner.user.id), str(owner.organization.id))

    current = get_current_user(
        db,
        HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
    )

    assert current.user.id == owner.user.id
    assert current.organization.slug == "empresa-a"
    assert current.membership.role == "owner"


def test_get_current_user_rejects_token_for_unknown_user(db: Session) -> None:
    token = create_access_token(str(uuid.uuid4()), str(uuid.uuid4()))

    with pytest.raises(HTTPException) as exc:
        get_current_user(
            db,
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
        )
    assert exc.value.status_code == 401
