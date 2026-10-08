"""Live Gemini smoke test using the key from backend/.env."""
from app.services import ai_service

for text in [
    "Complete the project report by Friday with high priority",
    "Buy groceries tomorrow",
    "Prepare the presentation by next Monday, this is very important",
]:
    r = ai_service.parse_task(text)
    print(f"{text!r}")
    print(
        f"   -> [{r['provider']}] title={r['title']!r} "
        f"priority={r['priority']} due={r['due_date']} category={r['category']}"
    )
