import { applySortRules, defaultDirFor } from "./src/utils/sort.js";
import { getDueState } from "./src/utils/due.js";

const T = (id, o) => ({ id, position: 0, status: "pending", priority: "medium", ...o });
const names = (list) => list.map((t) => t.title).join(", ");
let failed = 0;
const check = (name, cond) => {
  console.log((cond ? "PASS: " : "FAIL: ") + name);
  if (!cond) failed++;
};

const tasks = [
  T("1", { title: "banana", priority: "low", created_at: "2026-10-01T10:00:00+00:00", due_date: null, position: 0 }),
  T("2", { title: "Apple", priority: "high", created_at: "2026-10-03T10:00:00+00:00", due_date: "2026-10-20", position: 1 }),
  T("3", { title: "cherry", priority: "medium", created_at: "2026-10-02T10:00:00+00:00", due_date: "2026-10-10", position: 2 }),
  T("4", { title: "apple pie", priority: "high", created_at: "2026-10-04T10:00:00+00:00", due_date: "2026-10-05", position: 3 }),
];

// manual order untouched when no rules
check("no rules -> manual order", names(applySortRules(tasks, [])) === "banana, Apple, cherry, apple pie");

// importance: high first (and both highs keep relative manual order)
check(
  "importance High->Low",
  names(applySortRules(tasks, [{ key: "importance", dir: "asc" }])) === "Apple, apple pie, cherry, banana"
);

// creation date newest first
check(
  "created newest first",
  names(applySortRules(tasks, [{ key: "created", dir: "desc" }])) === "apple pie, Apple, cherry, banana"
);

// due date earliest first, no-due-date last
check(
  "due earliest first, no-date last",
  names(applySortRules(tasks, [{ key: "due", dir: "asc" }])) === "apple pie, cherry, Apple, banana"
);

// due date latest first, no-date STILL last
check(
  "due latest first, no-date still last",
  names(applySortRules(tasks, [{ key: "due", dir: "desc" }])) === "Apple, cherry, apple pie, banana"
);

// alphabetical A->Z case-insensitive
check(
  "alphabetical A->Z",
  names(applySortRules(tasks, [{ key: "alpha", dir: "asc" }])) === "Apple, apple pie, banana, cherry"
);

// multi-rule: importance THEN due date (highs ordered by due date)
check(
  "multi-rule importance+due",
  names(applySortRules(tasks, [
    { key: "importance", dir: "asc" },
    { key: "due", dir: "asc" },
  ])) === "apple pie, Apple, cherry, banana"
);

// multi-rule: importance THEN alphabetical (highs ordered A->Z)
check(
  "multi-rule importance+alpha",
  names(applySortRules(tasks, [
    { key: "importance", dir: "asc" },
    { key: "alpha", dir: "asc" },
  ])) === "Apple, apple pie, cherry, banana"
);

// default directions
check("default dir created=desc", defaultDirFor("created") === "desc");
check("default dir importance=asc", defaultDirFor("importance") === "asc");

// due-state classification (today = 2026-10-07)
const today = "2026-10-07";
check("overdue", getDueState(T("x", { due_date: "2026-10-06" }), today) === "overdue");
check("due today", getDueState(T("x", { due_date: "2026-10-07" }), today) === "today");
check("future -> null", getDueState(T("x", { due_date: "2026-10-09" }), today) === null);
check("completed overdue -> null", getDueState(T("x", { due_date: "2026-10-01", status: "completed" }), today) === null);
check("no due date -> null", getDueState(T("x", {}), today) === null);

console.log(failed === 0 ? "\nALL SORT/DUE CHECKS PASSED" : `\n${failed} FAILED`);
process.exit(failed);
