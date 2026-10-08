"""One-off data-integrity check for the todo_app database."""
from datetime import datetime

from pymongo import MongoClient

db = MongoClient("mongodb://localhost:27017")["todo_app"]
issues = []

print("=== 1. USERS schema check ===")
users = list(db["users"].find())
for u in users:
    missing = [f for f in ("name", "email", "password_hash", "created_at", "updated_at") if f not in u]
    if missing:
        issues.append(f"user {u['_id']} missing {missing}")
    if "password" in u:
        issues.append(f"user {u['_id']} stores a PLAIN password field!")
    if "password_hash" in u and not str(u["password_hash"]).startswith("$2"):
        issues.append(f"user {u['_id']} password_hash is not bcrypt")
    if not isinstance(u.get("created_at"), datetime):
        issues.append(f"user {u['_id']} created_at is not a datetime")
print(f"  {len(users)} users — fields, bcrypt hashes, datetime types")

print("=== 2. PAGES schema + reference check ===")
user_ids = {u["_id"] for u in users}
pages = list(db["todo_pages"].find())
for p in pages:
    for f in ("title", "owner_id", "member_ids", "created_at", "updated_at"):
        if f not in p:
            issues.append(f"page {p['_id']} missing field {f}")
    if p["owner_id"] not in user_ids:
        issues.append(f"page {p['_id']} owner does not exist")
    if len(p["member_ids"]) != len(set(p["member_ids"])):
        issues.append(f"page {p['_id']} has duplicate members")
    if p["owner_id"] in p["member_ids"]:
        issues.append(f"page {p['_id']} owner is also in member_ids")
    for m in p["member_ids"]:
        if m not in user_ids:
            issues.append(f"page {p['_id']} member {m} is not a registered user")
    if not isinstance(p.get("created_at"), datetime):
        issues.append(f"page {p['_id']} created_at is not a datetime")
print(f"  {len(pages)} pages — owner/member references valid, no duplicates")

print("=== 3. TODOS schema + reference + ordering check ===")
page_ids = {p["_id"] for p in pages}
todos = list(db["todos"].find())
for t in todos:
    for f in ("page_id", "title", "status", "priority", "position",
              "created_by", "updated_by", "created_at", "updated_at"):
        if f not in t:
            issues.append(f"todo {t['_id']} missing field {f}")
    if t["page_id"] not in page_ids:
        issues.append(f"todo {t['_id']} belongs to a missing page")
    if t["created_by"] not in user_ids:
        issues.append(f"todo {t['_id']} creator does not exist")
    if t.get("assigned_to") is not None and t["assigned_to"] not in user_ids:
        issues.append(f"todo {t['_id']} assignee does not exist")
    if t.get("status") not in ("pending", "in_progress", "completed"):
        issues.append(f"todo {t['_id']} invalid status {t.get('status')!r}")
    if t.get("priority") not in ("low", "medium", "high"):
        issues.append(f"todo {t['_id']} invalid priority {t.get('priority')!r}")
    if not isinstance(t.get("position"), int):
        issues.append(f"todo {t['_id']} position is not an int")
    if not isinstance(t.get("created_at"), datetime):
        issues.append(f"todo {t['_id']} created_at is not a datetime")

for pid in page_ids:
    positions = [t["position"] for t in db["todos"].find({"page_id": pid}).sort("position", 1)]
    if positions != list(range(len(positions))):
        issues.append(f"page {pid} positions not sequential: {positions}")
print(f"  {len(todos)} todos — references, enums, types, sequential positions")

print("=== 4. INDEXES ===")
for coll in ("users", "todo_pages", "todos"):
    names = [ix["name"] for ix in db[coll].list_indexes()]
    print(f"  {coll}: {names}")

print()
if issues:
    print(f"RESULT: {len(issues)} ISSUE(S) FOUND")
    for i in issues:
        print("  -", i)
else:
    print("RESULT: ALL CHECKS PASSED — data is consistent")
