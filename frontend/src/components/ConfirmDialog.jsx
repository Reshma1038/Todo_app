import Modal from "./Modal";
import { Spinner } from "./Spinner";

/**
 * Confirmation dialog for destructive actions.
 */
export default function ConfirmDialog({
  title = "Are you sure?",
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  loading = false,
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={onCancel}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {loading && <Spinner className="h-4 w-4" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
