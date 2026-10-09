import { useState } from "react";
import { aiApi } from "../api/aiApi";
import { getErrorMessage } from "../api/axios";
import { useToast } from "../context/ToastContext";
import { PRIORITY_LABELS, REPEAT_LABELS, STATUS_LABELS } from "../utils/format";
import { Spinner } from "./Spinner";

const CATEGORY_SUGGESTIONS = [
  "Work", "Personal", "Shopping", "Health", "Finance", "Study", "Home", "General",
];

/**
 * Shared form fields used by both the create-todo modal and the
 * edit mode of the todo detail modal. Includes the AI priority
 * suggestion button.
 */
export default function TodoFormFields({ values, onChange, members, autoFocus = false }) {
  const toast = useToast();
  const [suggesting, setSuggesting] = useState(false);
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  const suggestPriority = async () => {
    if (!values.title.trim() || suggesting) return;
    setSuggesting(true);
    try {
      const res = await aiApi.suggestPriority(values.title.trim(), values.description || "");
      onChange({ ...values, priority: res.data.priority });
      toast.info(
        `AI suggests ${res.data.priority.toUpperCase()} priority — ${res.data.reasons.join("; ")}`
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not suggest a priority."));
    } finally {
      setSuggesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={values.title}
          onChange={set("title")}
          autoFocus={autoFocus}
          placeholder="e.g. Implement the login API"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          value={values.description}
          onChange={set("description")}
          rows={4}
          placeholder="Add more details about this task…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
          <select
            value={values.status}
            onChange={set("status")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-slate-700">Priority</label>
            <button
              type="button"
              onClick={suggestPriority}
              disabled={suggesting || !values.title.trim()}
              title="Let AI suggest the priority from the title & description"
              className="inline-flex items-center gap-1 rounded-md border border-violet-200 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {suggesting ? <Spinner className="h-3 w-3" /> : "✨"}
              AI suggest
            </button>
          </div>
          <select
            value={values.priority}
            onChange={set("priority")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Due date</label>
          <input
            type="date"
            value={values.due_date || ""}
            onChange={set("due_date")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Category</label>
          <input
            type="text"
            value={values.category || ""}
            onChange={set("category")}
            placeholder="e.g. Work, Personal…"
            list="category-suggestions"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <datalist id="category-suggestions">
            {CATEGORY_SUGGESTIONS.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Repeat</label>
          <select
            value={values.repeat || "none"}
            onChange={set("repeat")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            {Object.entries(REPEAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-400">
            Completing a repeating task schedules its next occurrence.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Assign to</label>          <select
            value={values.assigned_to || ""}
            onChange={set("assigned_to")}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.email})
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export const EMPTY_TODO_FORM = {
  title: "",
  description: "",
  status: "pending",
  priority: "medium",
  due_date: "",
  category: "",
  repeat: "none",
  assigned_to: "",
};

export function todoToForm(todo) {
  return {
    title: todo.title || "",
    description: todo.description || "",
    status: todo.status || "pending",
    priority: todo.priority || "medium",
    due_date: todo.due_date || "",
    category: todo.category || "",
    repeat: todo.repeat || "none",
    assigned_to: todo.assigned_to || "",
  };
}

export function formToPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    status: form.status,
    priority: form.priority,
    due_date: form.due_date || null,
    category: form.category?.trim() || null,
    repeat: form.repeat || "none",
    assigned_to: form.assigned_to || null,
  };
}
