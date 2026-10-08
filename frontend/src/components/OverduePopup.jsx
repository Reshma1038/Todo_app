import { useEffect } from "react";
import { formatDateOnly } from "../utils/format";

/**
 * 💛 Gentle overdue feedback — encouraging, not negative.
 * Shows once per page visit when overdue incomplete tasks exist.
 * Auto-hides after a while; offers an "Update Due Date" shortcut.
 */
export default function OverduePopup({ todo, count, onUpdateDueDate, onDismiss, autoHideMs = 9000 }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timer);
  }, [onDismiss, autoHideMs]);

  return (
    <div className="fixed bottom-4 left-1/2 z-[80] w-full max-w-md -translate-x-1/2 px-4 sm:left-auto sm:right-4 sm:translate-x-0 sm:px-0">
      <div className="animate-fade-in-up rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="text-3xl">😔</div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-800">
              This task is still incomplete
            </h3>
            <p className="mt-0.5 text-sm text-slate-600">
              Don't worry, you can finish it! 💛
            </p>
            <p className="mt-1 truncate text-xs font-medium text-amber-700">
              “{todo.title}”
            </p>
            <p className="text-xs text-red-500">
              Overdue since {formatDateOnly(todo.due_date)}
              {count > 1 ? ` · +${count - 1} more overdue` : ""}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={onUpdateDueDate}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Update Due Date
              </button>
              <button
                onClick={onDismiss}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                I'll get to it 💪
              </button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-slate-300 hover:bg-slate-100 hover:text-slate-500"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
