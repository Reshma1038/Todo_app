/**
 * Due-date helpers. Due dates are stored as local "YYYY-MM-DD" strings,
 * so plain string comparison against "today" works without timezone traps.
 */

export const PAST_DUE_MESSAGE =
  "Due date cannot be in the past. Please choose today or a future date.";

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

/**
 * True when the given YYYY-MM-DD string is before today.
 * Used to block past due dates at submit time (the date picker's `min`
 * handles the calendar UI, but typed entries can bypass it).
 */
export function isPastDate(dateStr, todayStr = toDateOnlyString()) {
  if (!dateStr) return false;
  return dateStr < todayStr;
}
