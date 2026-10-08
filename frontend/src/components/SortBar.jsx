import { useEffect, useRef, useState } from "react";
import { defaultDirFor, DIR_LABELS, SORT_OPTIONS } from "../utils/sort";

/**
 * Screenshot-style "↑↓ Sort" dropdown: pick Importance / Due date /
 * Alphabetically / Creation date. Clicking the active option again toggles
 * its direction. The "＋" on a row appends it as an extra condition, so
 * multiple rules can be stacked (chips below manage those).
 *
 * An empty rule list means "manual order" (drag & drop active).
 */

const OPTION_ICONS = {
  importance: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  due: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  alpha: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
    </svg>
  ),
  created: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function SortBar({ rules, onChange }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const primary = rules[0];
  const labelFor = (key) => SORT_OPTIONS.find((o) => o.key === key)?.label || key;

  const selectPrimary = (key) => {
    if (primary?.key === key) {
      // re-click toggles direction of the primary rule
      onChange(
        rules.map((r, i) => (i === 0 ? { ...r, dir: r.dir === "asc" ? "desc" : "asc" } : r))
      );
    } else {
      onChange([{ key, dir: defaultDirFor(key) }]);
    }
  };

  const addSecondary = (key, e) => {
    e.stopPropagation();
    if (rules.some((r) => r.key === key)) return;
    onChange([...rules, { key, dir: defaultDirFor(key) }]);
  };

  const toggleDir = (key) =>
    onChange(
      rules.map((r) => (r.key === key ? { ...r, dir: r.dir === "asc" ? "desc" : "asc" } : r))
    );

  const removeRule = (key) => onChange(rules.filter((r) => r.key !== key));

  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {/* Dropdown trigger */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
            </svg>
            Sort
            {primary && (
              <span className="text-brand-600">· {labelFor(primary.key)}</span>
            )}
          </button>

          {open && (
            <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg">
              <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Sort by
              </p>
              {SORT_OPTIONS.map((o) => {
                const isPrimary = primary?.key === o.key;
                const alreadyUsed = rules.some((r) => r.key === o.key);
                return (
                  <div key={o.key} className="flex items-center pr-1">
                    <button
                      onClick={() => selectPrimary(o.key)}
                      className={`flex flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm ${
                        isPrimary
                          ? "font-medium text-brand-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className={isPrimary ? "text-brand-500" : "text-slate-400"}>
                        {OPTION_ICONS[o.key]}
                      </span>
                      <span className="flex-1">{o.label}</span>
                      {isPrimary && (
                        <span className="text-xs font-semibold text-brand-600">
                          ✓ {DIR_LABELS[o.key]?.[primary.dir]}
                        </span>
                      )}
                    </button>
                    {rules.length > 0 && !alreadyUsed && (
                      <button
                        onClick={(e) => addSecondary(o.key, e)}
                        title="Add as secondary condition"
                        className="rounded-md px-2 py-1 text-sm font-semibold text-slate-400 hover:bg-brand-50 hover:text-brand-600"
                      >
                        ＋
                      </button>
                    )}
                  </div>
                );
              })}
              {rules.length > 0 && (
                <>
                  <div className="my-1 border-t border-slate-100" />
                  <button
                    onClick={() => {
                      onChange([]);
                      setOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50"
                  >
                    Reset to manual order
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {rules.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            Reset
          </button>
        )}
      </div>

      {rules.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {rules.map((r, i) => (
            <span
              key={r.key}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
            >
              <span className="text-brand-500">{i + 1}.</span> {labelFor(r.key)}
              <button
                onClick={() => toggleDir(r.key)}
                title="Toggle direction"
                className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-brand-600 hover:bg-brand-100"
              >
                {DIR_LABELS[r.key]?.[r.dir] || r.dir}
              </button>
              <button
                onClick={() => removeRule(r.key)}
                className="rounded px-1 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
                aria-label={`Remove ${labelFor(r.key)} sort`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

    </div>
  );
}
