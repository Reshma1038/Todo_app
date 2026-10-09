import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { aiApi } from "../api/aiApi";
import { getErrorMessage } from "../api/axios";
import { pageApi } from "../api/pageApi";
import { todoApi } from "../api/todoApi";
import AiQuickAdd from "../components/AiQuickAdd";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import CreateTodoModal from "../components/CreateTodoModal";
import InviteMemberModal from "../components/InviteMemberModal";
import Layout from "../components/Layout";
import NextTaskModal from "../components/NextTaskModal";
import OverduePopup from "../components/OverduePopup";
import TaskCalendar from "../components/TaskCalendar";
import SortBar from "../components/SortBar";
import { Spinner } from "../components/Spinner";
import StatusPopup from "../components/StatusPopup";
import TodoCard from "../components/TodoCard";
import TodoModal from "../components/TodoModal";
import { useToast } from "../context/ToastContext";
import { getDueState, toDateOnlyString } from "../utils/due";
import { applySortRules } from "../utils/sort";

export default function TodoPage() {
  const { pageId } = useParams();
  const toast = useToast();

  const [page, setPage] = useState(null);
  const [todos, setTodos] = useState(null);
  const [error, setError] = useState("");
  // [] = manual (drag & drop) order; otherwise a list of { key, dir } rules
  const [sortRules, setSortRules] = useState([]);
  // null = no unsaved drag & drop changes; otherwise an array of todo ids
  // representing the locally rearranged (not yet saved) order
  const [pendingIds, setPendingIds] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [viewTodo, setViewTodo] = useState(null); // detail modal (view mode)
  const [editTodo, setEditTodo] = useState(null); // detail modal (edit mode)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [nextTaskData, setNextTaskData] = useState(null); // AI suggestion response
  const [nextLoading, setNextLoading] = useState(false);
  const [viewMode, setViewMode] = useState("list"); // "list" | "calendar"
  const [statusPopup, setStatusPopup] = useState(null); // { variant, title }
  const [overdueNudge, setOverdueNudge] = useState(null); // 💛 overdue feedback
  const overdueShown = useRef(false);
  const dismissStatusPopup = useCallback(() => setStatusPopup(null), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    try {
      const [pageRes, todosRes] = await Promise.all([
        pageApi.get(pageId),
        todoApi.list(pageId),
      ]);
      setPage(pageRes.data);
      setTodos(todosRes.data);

      // Gentle overdue feedback: at most once per task per day per session.
      if (!overdueShown.current) {
        const today = toDateOnlyString();
        const overdue = todosRes.data
          .filter((t) => getDueState(t, today) === "overdue")
          .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));
        if (overdue.length > 0) {
          const nudgeKey = `overdue_nudge:${pageId}:${today}:${overdue[0].id}`;
          try {
            if (!sessionStorage.getItem(nudgeKey)) {
              sessionStorage.setItem(nudgeKey, "1");
              overdueShown.current = true;
              setOverdueNudge({ todo: overdue[0], count: overdue.length });
            }
          } catch {
            overdueShown.current = true;
            setOverdueNudge({ todo: overdue[0], count: overdue.length });
          }
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, "Could not load this page."));
    }
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  // Lightweight list refresh (no page reload). Used after a recurring task
  // completes so the freshly scheduled next occurrence appears immediately.
  const refreshTodos = async () => {
    try {
      const res = await todoApi.list(pageId);
      setTodos(res.data);
    } catch {
      /* non-critical: keep the current list on failure */
    }
  };

  // ---------------------------------------------------------------
  // Drag & drop: rearrange locally, then persist explicitly via
  // the "Save Order" button (with a Discard option).
  // ---------------------------------------------------------------
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = displayTodos.findIndex((t) => t.id === active.id);
    const newIndex = displayTodos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(displayTodos, oldIndex, newIndex);
    setPendingIds(reordered.map((t) => t.id));
  };

  const saveOrder = async () => {
    if (!pendingIds) return;
    setSavingOrder(true);
    try {
      const res = await todoApi.reorder(
        pageId,
        displayTodos.map((t) => t.id)
      );
      setTodos(res.data);
      setPendingIds(null);
      toast.success("Task order saved.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not save the new order."));
    } finally {
      setSavingOrder(false);
    }
  };

  const discardOrder = () => setPendingIds(null);

  const toggleStatus = async (todo) => {
    const next = todo.status === "completed" ? "pending" : "completed";
    try {
      const res = await todoApi.update(todo.id, { status: next });
      setTodos((list) => list.map((t) => (t.id === todo.id ? res.data : t)));
      setStatusPopup({
        variant: next === "completed" ? "success" : "pending",
        title: todo.title,
      });
      // A completed recurring task spawns its next occurrence server-side;
      // refresh so it shows up right away.
      if (next === "completed" && res.data.repeat && res.data.repeat !== "none") {
        await refreshTodos();
        toast.info("Next occurrence scheduled 🔁");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the task."));
    }
  };

  const applyUpdated = async (updated) => {
    const before = (todos || []).find((t) => t.id === updated.id);
    if (before) {
      if (before.status !== "completed" && updated.status === "completed") {
        setStatusPopup({ variant: "success", title: updated.title });
        if (updated.repeat && updated.repeat !== "none") {
          setTodos((list) => list.map((t) => (t.id === updated.id ? updated : t)));
          await refreshTodos();
          toast.info("Next occurrence scheduled 🔁");
          return;
        }
      } else if (before.status === "completed" && updated.status !== "completed") {
        setStatusPopup({ variant: "pending", title: updated.title });
      }
    }
    setTodos((list) => list.map((t) => (t.id === updated.id ? updated : t)));
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await todoApi.remove(deleteTarget.id);
      setTodos((list) => list.filter((t) => t.id !== deleteTarget.id));
      toast.success("Task deleted.");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the task."));
    } finally {
      setDeleting(false);
    }
  };

  const onMembersChanged = async () => {
    const res = await pageApi.get(pageId);
    setPage(res.data);
  };

  // AI: analyze this page's pending tasks and recommend what to do first.
  const suggestNext = async () => {
    setNextLoading(true);
    try {
      const res = await aiApi.nextTask(pageId);
      setNextTaskData(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not analyze the tasks."));
    } finally {
      setNextLoading(false);
    }
  };

  const completeSuggested = async (todo) => {
    try {
      const res = await todoApi.update(todo.id, { status: "completed" });
      setTodos((list) => list.map((t) => (t.id === todo.id ? res.data : t)));
      setNextTaskData(null);
      setStatusPopup({ variant: "success", title: todo.title });
      if (res.data.repeat && res.data.repeat !== "none") {
        await refreshTodos();
        toast.info("Next occurrence scheduled 🔁");
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the task."));
    }
  };

  const isOwner = page?.role === "owner";
  const members = page?.members || [];

  const sortingActive = sortRules.length > 0;
  const displayTodos = useMemo(() => {
    const list = todos || [];
    if (sortRules.length > 0) return applySortRules(list, sortRules);
    if (!pendingIds) return list;
    // show the locally rearranged order; tasks created afterwards go last
    const byId = new Map(list.map((t) => [t.id, t]));
    const ordered = pendingIds.map((id) => byId.get(id)).filter(Boolean);
    const inPending = new Set(pendingIds);
    for (const t of list) if (!inPending.has(t.id)) ordered.push(t);
    return ordered;
  }, [todos, sortRules, pendingIds]);

  if (error) {
    return (
      <Layout title="Todo Page">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700">
          <p>{error}</p>
          <Link to="/" className="mt-3 inline-block font-medium text-brand-600 hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  if (!page || todos === null) {
    return (
      <Layout title="Todo Page">
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={page.title}>
      {/* Page header */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link to="/" className="text-xs font-medium text-brand-600 hover:underline">
              ← Dashboard
            </Link>
            <h2 className="mt-1 truncate text-xl font-bold text-slate-800">
              {page.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Owned by <span className="font-medium">{page.owner?.name}</span>
              {isOwner && " (you)"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Member avatars */}
            <div className="mr-1 flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <span key={m.id} title={`${m.name} (${m.role})`}>
                  <Avatar avatarId={m.avatar} name={m.name} size={32} />
                </span>
              ))}
              {members.length > 5 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-600">
                  +{members.length - 5}
                </div>
              )}
            </div>

            {isOwner && (
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Invite
              </button>
            )}
            <button
              onClick={suggestNext}
              disabled={nextLoading}
              title="AI analyzes your pending tasks and recommends what to do first"
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50"
            >
              {nextLoading ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                </svg>
              )}
              Suggest Next
            </button>
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Task
            </button>
          </div>
        </div>
      </div>

      {/* AI natural-language task creation */}
      <AiQuickAdd
        pageId={pageId}
        onCreated={(todo) => setTodos((list) => [...(list || []), todo])}
      />

      {/* List / Calendar view toggle */}
      {todos.length > 0 && (
        <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {[
            { key: "list", label: "☰ List" },
            { key: "calendar", label: "📅 Calendar" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setViewMode(tab.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                viewMode === tab.key
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Task list with sorting + drag & drop, or calendar view */}
      {todos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-slate-700">No tasks yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create the first task for this page.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add a Task
          </button>
        </div>
      ) : viewMode === "calendar" ? (
        <TaskCalendar todos={todos} onViewTask={setViewTodo} />
      ) : (
        <>
          <SortBar rules={sortRules} onChange={setSortRules} />

          {sortingActive ? (
            /* Custom sort active: drag & drop paused, list rendered in sorted order */
            <div className="space-y-3">
              {displayTodos.map((todo) => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  onView={setViewTodo}
                  onEdit={setEditTodo}
                  onDelete={setDeleteTarget}
                  onToggleStatus={toggleStatus}
                />
              ))}
            </div>
          ) : (
            /* Manual order: drag & drop reordering + explicit Save button */
            <>
              {pendingIds && (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-sm">
                  <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-sm font-medium text-amber-800">
                    You have unsaved order changes.
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={discardOrder}
                      disabled={savingOrder}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Discard
                    </button>
                    <button
                      onClick={saveOrder}
                      disabled={savingOrder}
                      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {savingOrder && <Spinner className="h-4 w-4" />}
                      Save Order
                    </button>
                  </div>
                </div>
              )}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayTodos.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {displayTodos.map((todo) => (
                    <TodoCard
                      key={todo.id}
                      todo={todo}
                      onView={setViewTodo}
                      onEdit={setEditTodo}
                      onDelete={setDeleteTarget}
                      onToggleStatus={toggleStatus}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            </>
          )}
        </>
      )}

      {/* Modals */}
      {createOpen && (
        <CreateTodoModal
          pageId={pageId}
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(todo) => {
            setTodos((list) => [...list, todo]);
            setCreateOpen(false);
          }}
        />
      )}

      {inviteOpen && isOwner && (
        <InviteMemberModal
          page={page}
          onClose={() => setInviteOpen(false)}
          onMembersChanged={onMembersChanged}
        />
      )}

      {viewTodo && (
        <TodoModal
          todo={viewTodo}
          members={members}
          onClose={() => setViewTodo(null)}
          onUpdated={applyUpdated}
        />
      )}

      {editTodo && (
        <TodoModal
          todo={editTodo}
          members={members}
          startInEdit
          onClose={() => setEditTodo(null)}
          onUpdated={applyUpdated}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Task"
          message={`Delete "${deleteTarget.title}"? This action cannot be undone.`}
          confirmLabel="Delete Task"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {nextTaskData && (
        <NextTaskModal
          data={nextTaskData}
          onClose={() => setNextTaskData(null)}
          onViewTask={(todo) => {
            setNextTaskData(null);
            setViewTodo(todo);
          }}
          onComplete={completeSuggested}
        />
      )}

      {/* 🎉 / 😔 status popup (auto-hides after 3s) */}
      {statusPopup && (
        <StatusPopup
          variant={statusPopup.variant}
          taskTitle={statusPopup.title}
          onDone={dismissStatusPopup}
        />
      )}

      {/* 💛 gentle overdue feedback (once per visit) */}
      {overdueNudge && (
        <OverduePopup
          todo={overdueNudge.todo}
          count={overdueNudge.count}
          onUpdateDueDate={() => {
            setEditTodo(overdueNudge.todo);
            setOverdueNudge(null);
          }}
          onDismiss={() => setOverdueNudge(null)}
        />
      )}
    </Layout>
  );
}
