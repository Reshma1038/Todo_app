/**
 * Multi-rule task sorting.
 *
 * A sort rule is { key, dir } where key is one of SORT_OPTIONS keys and
 * dir is "asc" | "desc". Rules apply in order; ties fall through to the
 * next rule, and finally to the manual (drag & drop) position.
 */

export const SORT_OPTIONS = [
  { key: "importance", label: "Importance" },
  { key: "created", label: "Creation Date" },
  { key: "due", label: "Due Date" },
  { key: "alpha", label: "Alphabetical" },
];

export const DIR_LABELS = {
  importance: { asc: "High → Low", desc: "Low → High" },
  created: { asc: "Oldest first", desc: "Newest first" },
  due: { asc: "Earliest first", desc: "Latest first" },
  alpha: { asc: "A → Z", desc: "Z → A" },
};

const IMPORTANCE_RANK = { high: 0, medium: 1, low: 2 };

export function defaultDirFor(key) {
  // Sensible defaults: most important first, newest first, earliest due first.
  return key === "created" ? "desc" : "asc";
}

function compareBy(rule, a, b) {
  let result = 0;
  switch (rule.key) {
    case "importance":
      result = (IMPORTANCE_RANK[a.priority] ?? 1) - (IMPORTANCE_RANK[b.priority] ?? 1);
      break;
    case "created":
      result = new Date(a.created_at || 0) - new Date(b.created_at || 0);
      break;
    case "due": {
      // Tasks without a due date always sink to the bottom, both directions.
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      result = a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
      break;
    }
    case "alpha":
      result = (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
      });
      break;
    default:
      result = 0;
  }
  return rule.dir === "desc" ? -result : result;
}

export function applySortRules(todos, rules) {
  if (!rules || rules.length === 0) return todos;
  return [...todos].sort((a, b) => {
    for (const rule of rules) {
      const r = compareBy(rule, a, b);
      if (r !== 0) return r;
    }
    return (a.position ?? 0) - (b.position ?? 0);
  });
}
