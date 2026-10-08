/**
 * Due-date helpers. Due dates are stored as local "YYYY-MM-DD" strings,
 * so plain string comparison against "today" works without timezone traps.
 */

export function toDateOnlyString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Classify a todo's due state:
 *   "overdue"  — due date is before today and the task is not completed
 *   "today"    — due date is today and the task is not completed
 *   null       — no due date, completed, or due in the future
 */
export function getDueState(todo, todayStr = toDateOnlyString()) {
  if (!todo?.due_date || todo.status === "completed") return null;
  if (todo.due_date < todayStr) return "overdue";
  if (todo.due_date === todayStr) return "today";
  return null;
}
