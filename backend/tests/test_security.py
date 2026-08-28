import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.config import settings
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_hash_password_verifies_matching_secret() -> None:
    encoded = hash_password("SenhaForte@123")

    assert encoded != "SenhaForte@123"
    assert verify_password("SenhaForte@123", encoded)
    assert not verify_password("outra-senha", encoded)


def test_access_token_roundtrip_keeps_subject_and_organization() -> None:
    user_id = str(uuid.uuid4())
    organization_id = str(uuid.uuid4())

    payload = decode_access_token(create_access_token(user_id, organization_id))

    assert payload["sub"] == user_id
    assert payload["organization_id"] == organization_id


def test_decode_access_token_rejects_tampered_and_expired_tokens() -> None:
    with pytest.raises(ValueError, match="Invalid access token"):
        decode_access_token("token-invalido")

    expired = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "organization_id": str(uuid.uuid4()),
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
        },
        settings.jwt_secret,
        algorithm="HS256",
    )
    with pytest.raises(ValueError, match="Invalid access token"):
        decode_access_token(expired)
