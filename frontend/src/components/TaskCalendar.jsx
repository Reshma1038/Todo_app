import { useMemo, useState } from "react";
import { getDueState, toDateOnlyString } from "../utils/due";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Month calendar: tasks are placed on their due date. Click a task chip to
 * open its details. Overdue incomplete tasks are highlighted in red.
 */
export default function TaskCalendar({ todos, onViewTask }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const byDate = useMemo(() => {
    const map = {};
    for (const t of todos) {
      if (!t.due_date) continue;
      (map[t.due_date] = map[t.due_date] || []).push(t);
    }
    return map;
  }, [todos]);

  const noDueCount = todos.filter((t) => !t.due_date).length;
  const todayStr = toDateOnlyString();

  const { year, month } = cursor;
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month, d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta) => {
    const next = new Date(year, month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  };

  const chipColor = (t) => {
    const due = getDueState(t, todayStr);
    if (t.status === "completed") return "bg-emerald-100 text-emerald-700 line-through";
    if (due === "overdue") return "bg-red-100 text-red-700 font-semibold";
    if (due === "today") return "bg-amber-100 text-amber-800";
    if (t.priority === "high") return "bg-rose-50 text-rose-700";
    return "bg-brand-50 text-brand-700";
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => move(-1)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          ← Prev
        </button>
        <h3 className="text-sm font-bold text-slate-800">
          {firstOfMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Today
          </button>
          <button
            onClick={() => move(1)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={i} className="min-h-[70px] rounded-lg bg-slate-50/50" />;
          const dateStr = toDateOnlyString(cell);
          const dayTodos = byDate[dateStr] || [];
          const isToday = dateStr === todayStr;
          return (
            <div
              key={i}
              className={`min-h-[70px] rounded-lg border p-1 ${
                isToday ? "border-brand-400 bg-brand-50/50" : "border-slate-100 bg-white"
              }`}
            >
              <div className={`mb-0.5 text-right text-[11px] font-semibold ${isToday ? "text-brand-600" : "text-slate-400"}`}>
                {cell.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTodos.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onViewTask(t)}
                    title={t.title}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] ${chipColor(t)}`}
                  >
                    {t.title}
                  </button>
                ))}
                {dayTodos.length > 3 && (
                  <p className="px-1 text-[9px] font-medium text-slate-400">+{dayTodos.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-red-200" /> Overdue</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-amber-200" /> Due today</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-brand-200" /> Upcoming</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded bg-emerald-200" /> Completed</span>
        {noDueCount > 0 && <span className="ml-auto">{noDueCount} task(s) without a due date are not shown</span>}
      </div>
    </div>
  );
}
