import { PRIORITY_LABELS, STATUS_LABELS } from "../utils/format";

const STATUS_STYLES = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-sky-100 text-sky-800 border-sky-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  medium: "bg-indigo-100 text-indigo-700 border-indigo-200",
  high: "bg-rose-100 text-rose-700 border-rose-200",
};

export function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.medium}`}
    >
      {PRIORITY_LABELS[priority] || priority}
    </span>
  );
}
