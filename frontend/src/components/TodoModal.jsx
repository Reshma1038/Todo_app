import { useState } from "react";
import { getErrorMessage } from "../api/axios";
import { todoApi } from "../api/todoApi";
import { useToast } from "../context/ToastContext";
import { getDueState } from "../utils/due";
import { formatDate, formatDateOnly, STATUS_LABELS, PRIORITY_LABELS } from "../utils/format";
import { PriorityBadge, StatusBadge } from "./Badges";
import Modal from "./Modal";
import { Spinner } from "./Spinner";
import TodoFormFields, { formToPayload, todoToForm } from "./TodoFormFields";

/**
 * "View More" detail panel for a todo. Shows every field and supports
 * switching into edit mode.
 */
export default function TodoModal({ todo, members, startInEdit = false, onClose, onUpdated }) {
  const toast = useToast();
  const [editing, setEditing] = useState(startInEdit);
  const [form, setForm] = useState(() => todoToForm(todo));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await todoApi.update(todo.id, formToPayload(form));
      toast.success("Task updated.");
      onUpdated(res.data);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, "Could not update the task."));
    } finally {
      setSaving(false);
    }
  };

  const detailRow = (label, value) => (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-700">{value || "—"}</dd>
    </div>
  );

  const dueState = getDueState(todo);
  const dueDateRow = (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Due Date</dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-sm">
        <span
          className={
            dueState === "overdue"
              ? "font-semibold text-red-600"
              : dueState === "today"
                ? "font-semibold text-amber-700"
                : "text-slate-700"
          }
        >
          {todo.due_date ? formatDateOnly(todo.due_date) : "—"}
        </span>
        {dueState === "overdue" && (
          <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
            Overdue
          </span>
        )}
        {dueState === "today" && (
          <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
            Due Today
          </span>
        )}
      </dd>
    </div>
  );

  return (
    <Modal
      title={editing ? "Edit Task" : "Task Details"}
      onClose={onClose}
      wide
    >
      {editing ? (
        <form onSubmit={save}>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <TodoFormFields values={form} onChange={setForm} members={members} />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving && <Spinner className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </form>
      ) : (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-800">{todo.title}</h3>
            <div className="flex items-center gap-1.5">
              <StatusBadge status={todo.status} />
              <PriorityBadge priority={todo.priority} />
            </div>
          </div>

          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {todo.description || "No description provided."}
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {detailRow("Status", STATUS_LABELS[todo.status])}
            {detailRow("Priority", PRIORITY_LABELS[todo.priority])}
            {dueDateRow}
            {detailRow("Category", todo.category)}
            {detailRow("Created By", todo.created_by_user?.name)}
            {detailRow("Assigned To", todo.assigned_to_user?.name || "Unassigned")}
            {detailRow("Updated By", todo.updated_by_user?.name)}
            {detailRow("Created", formatDate(todo.created_at))}
            {detailRow("Updated", formatDate(todo.updated_at))}
            {detailRow("Position", `#${todo.position + 1}`)}
          </dl>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Edit Task
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
