from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.mongodb import users_collection
from app.models import utcnow


def register_user(name: str, email: str, password: str, avatar: Optional[str] = None) -> Dict[str, Any]:
    """Create a new user with a unique email and a hashed password."""
    email = email.strip().lower()
    if users_collection.find_one({"email": email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    now = utcnow()
    doc = {
        "name": name.strip(),
        "email": email,
        "password_hash": hash_password(password),
        "auth_provider": "password",
        "avatar": avatar,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = users_collection.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    doc["_id"] = result.inserted_id
    return doc


def authenticate_user(email: str, password: str) -> Dict[str, Any]:
    """Verify credentials. Raises 401 on any failure (no info leakage)."""
    user = users_collection.find_one({"email": email.strip().lower()})
    if user and not user.get("password_hash"):
        # Account was created via Google and has no password set.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account uses Google sign-in. Please continue with Google.",
        )
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return user


def authenticate_google(credential: str) -> Dict[str, Any]:
    """Verify a Google ID token and find-or-create the local account.

    The token is verified against Google's public keys and our configured
    GOOGLE_CLIENT_ID (audience check) — we never trust the client.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google sign-in is not configured on the server.",
        )

    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token

        info = google_id_token.verify_oauth2_token(
            credential, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google token.",
        )

    email = (info.get("email") or "").strip().lower()
    if not email or not info.get("email_verified", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google account email is not verified.",
        )

    # Existing account (either provider) — Google already verified the email.
    user = users_collection.find_one({"email": email})
    if user:
        return user

    # First Google sign-in: create a passwordless account.
    now = utcnow()
    doc = {
        "name": (info.get("name") or email.split("@")[0]).strip(),
        "email": email,
        "password_hash": None,  # Google-only account
        "auth_provider": "google",
        "avatar": None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        result = users_collection.insert_one(doc)
    except DuplicateKeyError:
        # Registered concurrently — just load it.
        return users_collection.find_one({"email": email})
    doc["_id"] = result.inserted_id
    return doc
