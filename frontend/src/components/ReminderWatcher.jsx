import { useEffect, useRef } from "react";
import { todoApi } from "../api/todoApi";
import { useToast } from "../context/ToastContext";
import { getDueState, toDateOnlyString } from "../utils/due";
import { formatDateOnly } from "../utils/format";

const POLL_INTERVAL_MS = 60_000; // re-check every minute

/**
 * Background due-date reminder engine. Mounted once for authenticated
 * users; polls the backend so reminders fire without the user manually
 * checking any page. Notifies via in-app toasts always, and via browser
 * notifications when permission was granted (bell icon in the navbar).
 *
 * Each task is reminded at most once per (id, due_date, status) per
 * browser session to avoid notification spam.
 */
export default function ReminderWatcher() {
  const toast = useToast();
  const reminded = useRef(new Set());

  useEffect(() => {
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
        for (const todo of res.data) {
          const state = getDueState(todo, today);
          if (!state) continue; // future due dates stay quiet
          const key = `${todo.id}|${todo.due_date}|${todo.status}`;
          if (reminded.current.has(key)) continue;
          reminded.current.add(key);

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

    check(); // immediately on mount / login
    const intervalId = setInterval(check, POLL_INTERVAL_MS);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [toast]);

  return null; // purely behavioral component
}
