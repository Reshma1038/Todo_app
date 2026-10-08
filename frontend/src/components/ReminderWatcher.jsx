import { useEffect } from "react";
import { todoApi } from "../api/todoApi";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { getDueState, toDateOnlyString } from "../utils/due";
import { formatDateOnly } from "../utils/format";

const POLL_INTERVAL_MS = 60_000; // re-check every minute

/**
 * Background due-date reminder engine.
 *
 * Fires ONLY when a task is actually due today or overdue — and each
 * reminder is shown at most ONCE PER LOGIN SESSION: shown reminders are
 * tracked in sessionStorage, so page loads/refreshes never re-show them.
 * (sessionStorage survives refresh within the tab and clears when the tab
 * or the session ends; logout clears it too.)
 */
export default function ReminderWatcher() {
  const toast = useToast();
  const { user } = useAuth();
  const storageKey = user?.id ? `reminded:${user.id}` : null;

  const loadShown = () => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(storageKey) || "[]"));
    } catch {
      return new Set();
    }
  };

  const saveShown = (set) => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify([...set].slice(-200)));
    } catch {
      /* storage full — reminders still work via the in-session window */
    }
  };

  useEffect(() => {
    if (!storageKey) return undefined;
    let cancelled = false;

    const browserNotify = (title, body) => {
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          new Notification(title, { body });
        } catch {
          /* some browsers require a service worker; toasts still cover us */
        }
      }
    };

    const check = async () => {
      try {
        const res = await todoApi.due();
        if (cancelled) return;
        const today = toDateOnlyString();
        const shown = loadShown(); // fresh read — respects other tabs too
        for (const todo of res.data) {
          const state = getDueState(todo, today);
          if (!state) continue; // future due dates stay quiet
          const key = `${todo.id}|${todo.due_date}|${todo.status}`;
          if (shown.has(key)) continue; // already reminded this session
          shown.add(key);
          saveShown(shown);

          const where = todo.page_title ? ` — ${todo.page_title}` : "";
          if (state === "overdue") {
            toast.error(
              `Overdue: "${todo.title}" was due ${formatDateOnly(todo.due_date)}${where}`
            );
            browserNotify(
              "Task overdue",
              `"${todo.title}" was due ${formatDateOnly(todo.due_date)}${where}`
            );
          } else {
            toast.info(`Due today: "${todo.title}"${where}`);
            browserNotify("Task due today", `"${todo.title}" is due today${where}`);
          }
        }
      } catch {
        /* reminders must never break the app */
      }
    };

    check(); // on mount — only fires for reminders not yet shown this session
    const intervalId = setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, toast]);

  return null; // purely behavioral component
}
