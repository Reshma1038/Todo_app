import Modal from "./Modal";
import { PriorityBadge, StatusBadge } from "./Badges";
import { formatDateOnly } from "../utils/format";

/**
 * Shows the AI recommendation for which pending task to do first,
 * with the score breakdown and a couple of alternatives.
 */
export default function NextTaskModal({ data, onClose, onViewTask, onComplete }) {
  const { suggestion, alternatives = [], analyzed = 0, provider, message } = data || {};

  const providerLabel =
    provider === "gemini"
      ? "Gemini AI ✦"
      : "Smart engine (priority + due date + urgency)";

  const TaskRow = ({ item, highlight }) => (
    <div
      className={`rounded-xl border p-4 ${
        highlight
          ? "border-violet-300 bg-violet-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-medium ${highlight ? "text-violet-900" : "text-slate-800"}`}>
            {item.todo.title}
          </p>
          {item.todo.page_title && (
            <p className="text-xs text-slate-500">in {item.todo.page_title}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={item.todo.status} />
          <PriorityBadge priority={item.todo.priority} />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
            score {item.score}
          </span>
        </div>
      </div>

      {item.todo.due_date && (
        <p className="mt-1 text-xs text-slate-500">Due: {formatDateOnly(item.todo.due_date)}</p>
      )}

      {item.explanation && (
        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-violet-800">
          💡 {item.explanation}
        </p>
      )}

      <ul className="mt-2 space-y-0.5">
        {item.reasons.map((r, i) => (
          <li key={i} className="text-xs text-slate-500">• {r}</li>
        ))}
      </ul>

      {highlight && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => onViewTask(item.todo)}
            className="rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100"
          >
            View Task
          </button>
          <button
            onClick={() => onComplete(item.todo)}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Mark Completed
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Modal title="✨ What should I do first?" onClose={onClose} wide>
      {!suggestion ? (
        <p className="py-6 text-center text-sm text-slate-500">
          {message || "No pending tasks to analyze."}
        </p>
      ) : (
        <div>
          <p className="mb-3 text-xs text-slate-400">
            Analyzed {analyzed} pending task{analyzed === 1 ? "" : "s"} · {providerLabel}
          </p>
          <TaskRow item={suggestion} highlight />
          {alternatives.length > 0 && (
            <>
              <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Up next
              </p>
              <div className="space-y-3">
                {alternatives.map((item) => (
                  <TaskRow key={item.todo.id} item={item} highlight={false} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
