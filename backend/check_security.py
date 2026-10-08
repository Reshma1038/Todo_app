"""One-off verification of the new direct-bcrypt security module."""
import sys

import bcrypt as _bcrypt

from app.core.security import hash_password, verify_password
from pymongo import MongoClient

print(f"python: {sys.executable}")
print(f"bcrypt version: {_bcrypt.__version__}")

# 1. round trip
h = hash_password("secret123")
assert h.startswith("$2"), "not a bcrypt hash"
assert verify_password("secret123", h) is True
assert verify_password("wrong", h) is False
print("round trip (hash/verify/wrong-password): OK")

# 2. >72-byte password edge case (bcrypt 5.x used to crash passlib here)
long_pw = "x" * 200
h2 = hash_password(long_pw)
assert verify_password(long_pw, h2) is True
assert verify_password(long_pw[:71], h2) is False
print("200-char password (>72 bytes): OK")

# 3. existing hashes created earlier by passlib must still verify
db = MongoClient("mongodb://localhost:27017")["todo_app"]
checked = 0
for u in db["users"].find({"email": {"$regex": "^(dnd|cors|ui|owner)_"}}):
    # my automated tests all used this password
    if verify_password("secret123", u["password_hash"]):
        checked += 1
print(f"old passlib-created hashes still verify: {checked} user(s)")
assert checked >= 1, "no legacy hash verified!"
print("ALL SECURITY CHECKS PASSED")
