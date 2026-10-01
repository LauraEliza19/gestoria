from app.security import hash_password, verify_password


def test_hash_password_verifies_matching_secret() -> None:
    encoded = hash_password("SenhaForte@123")

    assert encoded != "SenhaForte@123"
    assert verify_password("SenhaForte@123", encoded)
    assert not verify_password("outra-senha", encoded)
