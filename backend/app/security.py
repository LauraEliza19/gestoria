from hashlib import sha256

from pwdlib import PasswordHash

password_hash = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, encoded_password: str) -> bool:
    return password_hash.verify(password, encoded_password)


def hash_session_token(token: str) -> str:
    return sha256(token.encode()).hexdigest()
