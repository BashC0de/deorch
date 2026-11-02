"""Credential encryption service using AES-256-GCM.

Encrypts integration credentials before database persistence.
Uses org_id as associated data to prevent cross-org credential theft.
Supports key versioning for safe key rotation.
"""
from __future__ import annotations

import base64
import hashlib
import os
import struct

import structlog

from deorch_api.config import get_settings

log = structlog.get_logger(__name__)

# Key version tracks which key encrypted the data
# Version 1: Initial AES-256-GCM
# Format: key_version(1) + nonce(12) + ciphertext(N) + tag(16)
CURRENT_KEY_VERSION = 1


def _get_key(version: int = CURRENT_KEY_VERSION) -> bytes:
    """Get the encryption key for a given version."""
    settings = get_settings()
    key_str = settings.encryption_key

    if not key_str:
        if settings.environment == "production":
            raise RuntimeError(
                "ENCRYPTION_KEY must be set in production. "
                "Generate with: python -c \"import os,base64; print(base64.b64encode(os.urandom(32)).decode())\""
            )
        # Development fallback — derive from secret key
        log.warning("crypto_using_dev_fallback", env=settings.environment)
        return hashlib.sha256(settings.deorch_secret_key.encode()).digest()

    try:
        raw = base64.b64decode(key_str)
        if len(raw) == 32:
            return raw
    except Exception:
        pass

    return hashlib.sha256(key_str.encode()).digest()


def validate_crypto_config() -> None:
    """Validate encryption configuration at startup. Raises RuntimeError in production if misconfigured."""
    settings = get_settings()
    if settings.environment == "production" and not settings.encryption_key:
        raise RuntimeError("ENCRYPTION_KEY is required in production")
    # Verify key derivation works
    _get_key()


def encrypt(plaintext: str, org_id: str) -> str:
    """Encrypt a credential string with AES-256-GCM + org_id AAD."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key = _get_key()
    nonce = os.urandom(12)
    aad = org_id.encode()

    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), aad)

    packed = struct.pack("B", CURRENT_KEY_VERSION) + nonce + ciphertext
    return base64.b64encode(packed).decode()


def decrypt(encrypted: str, org_id: str) -> str:
    """Decrypt a credential string. Supports multiple key versions for rotation."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = base64.b64decode(encrypted)
    version = struct.unpack("B", raw[:1])[0]

    key = _get_key(version)
    nonce = raw[1:13]
    ciphertext = raw[13:]
    aad = org_id.encode()

    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, aad).decode()


def re_encrypt(encrypted: str, org_id: str) -> str | None:
    """Re-encrypt with the current key version if needed. Returns None if already current."""
    raw = base64.b64decode(encrypted)
    version = struct.unpack("B", raw[:1])[0]
    if version == CURRENT_KEY_VERSION:
        return None  # Already current
    plaintext = decrypt(encrypted, org_id)
    return encrypt(plaintext, org_id)


def is_encrypted(value: str | None) -> bool:
    """Check if a value was encrypted by this service."""
    if not value:
        return False
    try:
        raw = base64.b64decode(value)
        if len(raw) < 14:
            return False
        version = struct.unpack("B", raw[:1])[0]
        return version >= 1
    except Exception:
        return False
