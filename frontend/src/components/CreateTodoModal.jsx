import { useState } from "react";
import { getErrorMessage } from "../api/axios";
import { todoApi } from "../api/todoApi";
import { useToast } from "../context/ToastContext";
import { isPastDate, PAST_DUE_MESSAGE } from "../utils/due";
import Modal from "./Modal";
import { Spinner } from "./Spinner";
import TodoFormFields, { EMPTY_TODO_FORM, formToPayload } from "./TodoFormFields";

export default function CreateTodoModal({ pageId, members, onClose, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_TODO_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (isPastDate(form.due_date)) {
      setError(PAST_DUE_MESSAGE);
      return;
    }
    setSaving(true);
    try {
      const res = await todoApi.create(pageId, formToPayload(form));
      toast.success("Task created.");
      onCreated(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not create the task."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Task" onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <TodoFormFields values={form} onChange={setForm} members={members} autoFocus />
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Create Task
          </button>
        </div>
      </form>
    </Modal>
  );
}
