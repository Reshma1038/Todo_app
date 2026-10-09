import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getDueState } from "../utils/due";
import { formatDate, formatDateOnly, REPEAT_LABELS } from "../utils/format";
import { PriorityBadge, StatusBadge } from "./Badges";

/**
 * A draggable todo card showing the essential task information,
 * with quick actions: view more, toggle status, edit, delete.
 *
 * The whole card acts as the drag surface (mouse). The grip handle keeps
 * `touch-action: none` so touch users can drag without scrolling the page.
 * Clicking buttons still works because the pointer sensor only activates
 * after the pointer moves a few pixels.
 */
export default function TodoCard({ todo, onView, onEdit, onDelete, onToggleStatus }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: todo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDone = todo.status === "completed";
  const dueState = getDueState(todo); // "overdue" | "today" | null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:border-brand-200 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "z-10 opacity-70 shadow-lg ring-2 ring-brand-300" : ""
      }`}
    >
      {/* Drag handle (visual affordance + touch drag surface) */}
      <span
        className="touch-none self-start rounded p-1 text-slate-300"
        aria-hidden="true"
        title="Drag to reorder"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 11.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zM7 19a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm6 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3
            className={`font-medium text-slate-800 ${isDone ? "line-through decoration-slate-400" : ""}`}
          >
            {todo.title}
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={todo.status} />
            <PriorityBadge priority={todo.priority} />
            {todo.category && (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                {todo.category}
              </span>
            )}
            {todo.repeat && todo.repeat !== "none" && (
              <span
                title="Repeating task — completing it schedules the next occurrence"
                className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700"
              >
                <span aria-hidden="true">🔁</span>
                {REPEAT_LABELS[todo.repeat] || todo.repeat}
              </span>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4">
          <span>
            <span className="font-medium text-slate-600">Assigned:</span>{" "}
            {todo.assigned_to_user?.name || "Unassigned"}
          </span>
          <span>
            <span className="font-medium text-slate-600">Created by:</span>{" "}
            {todo.created_by_user?.name || "—"}
          </span>
          <span>
            <span className="font-medium text-slate-600">Updated by:</span>{" "}
            {todo.updated_by_user?.name || "—"}
          </span>
          <span>
            <span className="font-medium text-slate-600">Updated:</span>{" "}
            {formatDate(todo.updated_at)}
          </span>
        </div>

        {todo.due_date && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium text-slate-600">Due:</span>{" "}
            <span
              className={
                dueState === "overdue"
                  ? "font-semibold text-red-600"
                  : dueState === "today"
                    ? "font-semibold text-amber-700"
                    : "text-slate-500"
              }
            >
              {formatDateOnly(todo.due_date)}
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
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onView(todo)}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            View More
          </button>
          <button
            onClick={() => onToggleStatus(todo)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium ${
              isDone
                ? "border-amber-300 text-amber-700 hover:bg-amber-50"
                : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            {isDone ? "Mark Pending" : "Mark Completed"}
          </button>
          <button
            onClick={() => onEdit(todo)}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(todo)}
            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
