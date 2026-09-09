"""Server-owned, versioned JSON contract. This is not RFC 8785 / HTTP Signatures.

Signed plans use strings for UUIDs, timestamps and decimal amounts, and only
integer schema versions. Signing never delegates to a browser or language model.
"""

import hashlib
import hmac
import json
import re


def canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
        allow_nan=False,
    ).encode("utf-8")


def content_hash(value: object) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def parse_keyring(raw: str) -> dict[str, bytes]:
    try:
        values = json.loads(raw or "{}")
        if not isinstance(values, dict):
            raise TypeError()
        keys = {}
        for key_id, value in values.items():
            if not re.fullmatch(r"[a-zA-Z0-9_-]{1,32}", key_id):
                raise ValueError()
            if not isinstance(value, str) or not re.fullmatch(
                r"[a-fA-F0-9]{64}", value
            ):
                raise ValueError()
            keys[key_id] = bytes.fromhex(value)
        return keys
    except (ValueError, TypeError) as exc:
        raise ValueError("Configuração das chaves de operações inválida.") from exc


def sign_document(document: dict, key: bytes, purpose: str) -> str:
    message = (
        b"gestoria:" + purpose.encode("ascii") + b":v1\x00" + canonical_bytes(document)
    )
    return hmac.digest(key, message, "sha256").hex()


def seal(document: dict, key_id: str, key: bytes, purpose: str) -> dict:
    signed = {**document, "key_id": key_id, "algorithm": "HMAC-SHA256"}
    return {**signed, "signature": sign_document(signed, key, purpose)}


def verify(document: dict, keys: dict[str, bytes], purpose: str) -> bool:
    if not isinstance(document, dict):
        return False
    unsigned = {k: v for k, v in document.items() if k != "signature"}
    signature = document.get("signature")
    key_id = document.get("key_id")
    if not isinstance(key_id, str) or key_id not in keys:
        return False
    if document.get("algorithm") != "HMAC-SHA256":
        return False
    if not isinstance(signature, str) or not re.fullmatch(r"[a-f0-9]{64}", signature):
        return False
    try:
        expected = sign_document(unsigned, keys[key_id], purpose)
        return hmac.compare_digest(expected, signature)
    except (ValueError, TypeError, RecursionError):
        return False
