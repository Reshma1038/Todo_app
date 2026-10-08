import { useEffect, useState } from "react";
import { analyticsApi } from "../api/analyticsApi";
import { getErrorMessage } from "../api/axios";
import Layout from "../components/Layout";
import { Spinner } from "../components/Spinner";

function StatCard({ label, value, sub, icon, tone = "brand" }) {
  const tones = {
    brand: "from-brand-500 to-indigo-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-red-500",
    sky: "from-sky-500 to-cyan-500",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-lg text-white shadow-sm ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-1 text-3xl font-bold text-slate-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function BarRow({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((100 * count) / max) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 truncate text-xs font-medium text-slate-600">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold text-slate-600">{count}</span>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    analyticsApi
      .summary()
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err, "Could not load analytics.")));
  }, []);

  const maxDay = data ? Math.max(1, ...data.completed_per_day.map((d) => d.count)) : 1;
  const maxPriority = data ? Math.max(1, data.by_priority.high, data.by_priority.medium, data.by_priority.low) : 1;
  const maxCategory = data ? Math.max(1, ...data.by_category.map((c) => c.count)) : 1;

  return (
    <Layout title="Performance Analytics">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-800">Your Performance</h2>
        <p className="text-sm text-slate-500">Across all pages you own or belong to.</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {!data && !error && (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {data && (
        <div className="animate-fade-in-up space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total Tasks" value={data.total_tasks} icon="📋" tone="brand" sub={`${data.open_tasks} still open`} />
            <StatCard label="Completed" value={data.completed} icon="✅" tone="emerald" sub={`${data.completion_rate}% completion rate`} />
            <StatCard label="Due Today" value={data.due_today} icon="📅" tone="sky" sub={`${data.in_progress} in progress`} />
            <StatCard label="Overdue" value={data.overdue} icon="⏰" tone={data.overdue > 0 ? "rose" : "amber"} sub={data.overdue > 0 ? "needs attention" : "all on track"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* 14-day completion chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Tasks completed — last 14 days</h3>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {data.completed_this_week} this week 🔥
                </span>
              </div>
              <div className="flex h-40 items-end gap-1.5">
                {data.completed_per_day.map((d) => {
                  const day = new Date(d.date + "T00:00:00");
                  const isToday = d.date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">
                        {d.count}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-all duration-500 ${
                          isToday ? "bg-gradient-to-t from-brand-500 to-indigo-400" : "bg-gradient-to-t from-emerald-500 to-teal-400"
                        } ${d.count === 0 ? "bg-slate-100 from-slate-100 to-slate-100" : ""}`}
                        style={{ height: `${Math.max(4, Math.round((d.count / maxDay) * 100))}%` }}
                        title={`${d.date}: ${d.count} completed`}
                      />
                      <span className={`text-[9px] ${isToday ? "font-bold text-brand-600" : "text-slate-400"}`}>
                        {day.toLocaleDateString(undefined, { weekday: "narrow" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority + category */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Open tasks by priority</h3>
                <div className="space-y-3">
                  <BarRow label="High" count={data.by_priority.high} max={maxPriority} color="bg-rose-400" />
                  <BarRow label="Medium" count={data.by_priority.medium} max={maxPriority} color="bg-indigo-400" />
                  <BarRow label="Low" count={data.by_priority.low} max={maxPriority} color="bg-slate-300" />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Tasks by category</h3>
                {data.by_category.length === 0 ? (
                  <p className="text-xs text-slate-400">No tasks yet.</p>
                ) : (
                  <div className="space-y-3">
                    {data.by_category.map((c) => (
                      <BarRow key={c.category} label={c.category} count={c.count} max={maxCategory} color="bg-violet-400" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Completion rate ring */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-600 to-indigo-600 p-5 text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">Completion rate</h3>
                <p className="mt-1 text-3xl font-bold">{data.completion_rate}%</p>
                <p className="mt-0.5 text-sm text-white/70">
                  {data.completed} of {data.total_tasks} tasks done
                </p>
              </div>
              <div className="text-5xl">{data.completion_rate >= 80 ? "🏆" : data.completion_rate >= 50 ? "🚀" : "🌱"}</div>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${data.completion_rate}%` }} />
            </div>
            <p className="mt-2 text-xs text-white/70">
              {data.completion_rate >= 80
                ? "Outstanding! You're crushing it."
                : data.completion_rate >= 50
                  ? "Great momentum — keep going!"
                  : "Every task completed is progress. You've got this!"}
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}
