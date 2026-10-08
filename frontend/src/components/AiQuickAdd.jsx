import { useEffect, useRef, useState } from "react";
import { aiApi } from "../api/aiApi";
import { getErrorMessage } from "../api/axios";
import { todoApi } from "../api/todoApi";
import { useToast } from "../context/ToastContext";
import { PRIORITY_LABELS } from "../utils/format";
import { Spinner } from "./Spinner";

export const SparkleIcon = ({ className = "h-4 w-4" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
  </svg>
);

const SUGGESTION_CHIPS = [
  "What should I do first?",
  "What's due today?",
  "Any overdue tasks?",
  "Complete the project report by Friday, this is very important",
];

/**
 * AI Assistant panel. Understands intent:
 *  - a QUESTION ("what's due today?") → answers using your real task data
 *  - a TASK statement ("buy milk tomorrow") → parses fields and offers an
 *    editable preview to create the task
 */
export default function AiQuickAdd({ pageId, onCreated }) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [parsed, setParsed] = useState(null); // latest parsed task (editable)
  const [creating, setCreating] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [history, parsed]);

  const push = (...msgs) => setHistory((h) => [...h, ...msgs].slice(-12));

  const send = async (e) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await aiApi.assistant(value, pageId);
      const d = res.data;
      if (d.kind === "answer") {
        push({ role: "user", text: value }, { role: "ai", text: d.answer, provider: d.provider });
      } else {
        setParsed(d.parsed);
        push(
          { role: "user", text: value },
          { role: "ai", parsedSummary: d.parsed, provider: d.provider }
        );
      }
    } catch (err) {
      push({ role: "user", text: value });
      toast.error(getErrorMessage(err, "The assistant is unavailable right now."));
    } finally {
      setSending(false);
    }
  };

  const create = async () => {
    if (!parsed?.title?.trim() || creating) return;
    setCreating(true);
    try {
      const res = await todoApi.create(pageId, {
        title: parsed.title.trim(),
        description: "",
        status: "pending",
        priority: parsed.priority || "medium",
        due_date: parsed.due_date || null,
        category: parsed.category || null,
        assigned_to: null,
      });
      toast.success("Task created with AI.");
      push({ role: "ai", text: `✅ Task added: "${res.data.title}"` });
      onCreated(res.data);
      setParsed(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the task."));
    } finally {
      setCreating(false);
    }
  };

  const PROVIDER_LABELS = {
    gemini: "Gemini AI ✦",
    rules: "Smart engine",
  };

  const ProviderBadge = ({ provider }) => (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        provider === "rules" ? "bg-slate-100 text-slate-500" : "bg-violet-100 text-violet-700"
      }`}
    >
      {PROVIDER_LABELS[provider] || "Smart engine"}
    </span>
  );

  return (
    <div className="mb-4 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-sm">
          <SparkleIcon className="h-5 w-5" />
        </span>
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold text-slate-800">AI Assistant</p>
          <p className="text-xs text-slate-400">Ask a question, or describe a task to add it</p>
        </div>
        {history.length > 0 && (
          <button
            onClick={() => {
              setHistory([]);
              setParsed(null);
            }}
            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-white hover:text-slate-600"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Conversation */}
      {history.length > 0 && (
        <div ref={scrollRef} className="mb-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {history.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-700 px-3.5 py-2 text-sm text-white shadow-sm">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-violet-100 bg-white px-3.5 py-2 text-sm text-slate-700 shadow-sm">
                  {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                  {m.parsedSummary && (
                    <div>
                      <p className="mb-1.5 font-medium text-slate-800">
                        Got it — I prepared this task:
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-slate-700">
                          {m.parsedSummary.title}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                          {PRIORITY_LABELS[m.parsedSummary.priority] || "Medium"}
                        </span>
                        {m.parsedSummary.due_date && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                            due {m.parsedSummary.due_date}
                          </span>
                        )}
                        {m.parsedSummary.category && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                            {m.parsedSummary.category}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-violet-500">Review &amp; add it below ↓</p>
                    </div>
                  )}
                </div>
              </div>
            )
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-violet-100 bg-white px-3.5 py-2 text-sm text-slate-400 shadow-sm">
                <Spinner className="h-4 w-4" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Suggestion chips */}
      {history.length === 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setText(chip)}
              className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs text-violet-600 transition hover:border-violet-300 hover:bg-violet-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={send} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400">
            <SparkleIcon />
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='Ask "what should I do first?" or describe a task…'
            className="w-full rounded-xl border border-violet-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-violet-700 hover:to-indigo-700 hover:shadow disabled:opacity-50"
        >
          {sending ? <Spinner className="h-4 w-4" /> : <SparkleIcon />}
          Send
        </button>
      </form>

      {/* Editable parsed preview */}
      {parsed && (
        <div className="mt-3 rounded-xl border border-violet-100 bg-white p-3 shadow-sm animate-fade-in-up">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Review &amp; add
            </p>
            <ProviderBadge provider={parsed.provider} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-slate-500">Title</label>
              <input
                type="text"
                value={parsed.title}
                onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">Priority</label>
              <select
                value={parsed.priority || "medium"}
                onChange={(e) => setParsed({ ...parsed, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs font-medium text-slate-500">Due date</label>
              <input
                type="date"
                value={parsed.due_date || ""}
                onChange={(e) => setParsed({ ...parsed, due_date: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-0.5 block text-xs font-medium text-slate-500">Category</label>
              <input
                type="text"
                value={parsed.category || ""}
                onChange={(e) => setParsed({ ...parsed, category: e.target.value || null })}
                placeholder="None detected"
                className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>

          {parsed.signals?.length > 0 && (
            <ul className="mt-2 space-y-0.5">
              {parsed.signals.map((s, i) => (
                <li key={i} className="text-xs text-slate-400">• {s}</li>
              ))}
            </ul>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setParsed(null)}
              disabled={creating}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={create}
              disabled={creating || !parsed.title?.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50"
            >
              {creating && <Spinner className="h-4 w-4" />}
              Add Task
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
