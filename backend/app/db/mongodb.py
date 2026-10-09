from pymongo import ASCENDING, MongoClient
from pymongo.errors import OperationFailure

from app.core.config import settings

# Single shared client. MongoClient is thread-safe and manages a connection pool.
client = MongoClient(settings.MONGODB_URI)
db = client[settings.MONGODB_DB]

users_collection = db["users"]
todo_pages_collection = db["todo_pages"]
todos_collection = db["todos"]


def _safe_create_index(collection, keys, **kwargs) -> None:
    """Create an index, tolerating an equivalent pre-existing index.

    MongoDB raises IndexOptionsConflict (code 85) when an index on the same
    keys already exists under a different name -- in that case the existing
    index already serves the purpose, so we simply keep it.
    """
    try:
        collection.create_index(keys, **kwargs)
    except OperationFailure as exc:
        if exc.code in (85, 86):  # IndexOptionsConflict / IndexKeySpecsConflict
            print(f"NOTE: keeping existing index on {collection.name} {dict(keys)} ({exc.details.get('errmsg', exc)})")
        else:
            raise


def create_indexes() -> None:
    """Create the MongoDB indexes required by the application (idempotent)."""
    _safe_create_index(
        users_collection, [("email", ASCENDING)], unique=True, name="uq_users_email"
    )
    _safe_create_index(
        todo_pages_collection, [("owner_id", ASCENDING)], name="ix_pages_owner_id"
    )
    _safe_create_index(
        todo_pages_collection, [("member_ids", ASCENDING)], name="ix_pages_member_ids"
    )
    _safe_create_index(
        todos_collection, [("page_id", ASCENDING)], name="ix_todos_page_id"
    )
    _safe_create_index(
        todos_collection,
        [("page_id", ASCENDING), ("position", ASCENDING)],
        name="ix_todos_page_position",
    )
    _safe_create_index(
        todos_collection, [("series_id", ASCENDING)], name="ix_todos_series_id"
    )


def ping() -> bool:
    """Return True when the MongoDB server answers a ping."""
    try:
        client.admin.command("ping")
        return True
    except Exception:
        return False
