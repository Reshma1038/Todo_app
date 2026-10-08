from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt operates on at most 72 bytes of password material.
_MAX_BCRYPT_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    """Encode a password for bcrypt, truncated deterministically to 72 bytes.

    The same truncation is applied for hashing and verification, so the two
    always agree. bcrypt 4.x truncated silently; 5.x raises -- doing it
    explicitly keeps behaviour identical across versions.
    """
    return password.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt. Plain text is never stored."""
    hashed = bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Check a plain-text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            _to_bcrypt_bytes(plain_password), password_hash.encode("utf-8")
        )
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    """Create a signed JWT access token whose `sub` claim is the user id."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT. Returns the payload, or None if invalid/expired."""
    try:
        return jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None
