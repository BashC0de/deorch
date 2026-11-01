from __future__ import annotations

import hashlib
import secrets
import uuid
from base64 import urlsafe_b64encode
from datetime import UTC, datetime, timedelta

import bcrypt

from deorch_api.config import get_settings

settings = get_settings()


def generate_pairing_challenge() -> tuple[str, str, datetime]:
    """
    Returns (challenge_token, challenge_hash, expires_at).
    Store only the hash; show the token to the user once.
    """
    raw = secrets.token_bytes(32)
    token = urlsafe_b64encode(raw).rstrip(b"=").decode()
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.now(UTC) + timedelta(
        seconds=settings.device_pairing_token_expire_seconds
    )
    return token, token_hash, expires_at


def verify_challenge_token(token: str, stored_hash: str) -> bool:
    computed = hashlib.sha256(token.encode()).hexdigest()
    return secrets.compare_digest(computed, stored_hash)


def generate_device_secret() -> tuple[str, str]:
    """
    Returns (device_secret, device_secret_hash).
    Show device_secret once; store only the hash.
    """
    raw = secrets.token_bytes(32)
    secret = urlsafe_b64encode(raw).rstrip(b"=").decode()
    secret_hash = bcrypt.hashpw(secret.encode(), bcrypt.gensalt()).decode()
    return secret, secret_hash


def verify_device_secret(secret: str, stored_hash: str) -> bool:
    return bcrypt.checkpw(secret.encode(), stored_hash.encode())


def parse_device_credentials(auth_header: str) -> tuple[uuid.UUID, str]:
    """
    Parse 'Bearer <device_id>:<device_secret>' header.
    Returns (device_id, device_secret).
    Raises ValueError on malformed input.
    """
    if not auth_header.startswith("Bearer "):
        raise ValueError("Missing Bearer prefix")
    credentials = auth_header[7:]
    parts = credentials.split(":", 1)
    if len(parts) != 2:
        raise ValueError("Expected device_id:device_secret format")
    try:
        device_id = uuid.UUID(parts[0])
    except ValueError as e:
        raise ValueError(f"Invalid device_id UUID: {e}") from e
    return device_id, parts[1]
