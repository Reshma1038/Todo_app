import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getErrorMessage } from "../api/axios";
import { pageApi } from "../api/pageApi";
import Avatar from "../components/Avatar";
import ConfirmDialog from "../components/ConfirmDialog";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { Spinner } from "../components/Spinner";
import { useToast } from "../context/ToastContext";
import { formatDate } from "../utils/format";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [pages, setPages] = useState(null);
  const [error, setError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const [renameTarget, setRenameTarget] = useState(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadPages = async () => {
    try {
      const res = await pageApi.list();
      setPages(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your pages."));
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  const createPage = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await pageApi.create({ title: newTitle.trim() });
      toast.success("Todo page created.");
      setCreateOpen(false);
      setNewTitle("");
      navigate(`/pages/${res.data.id}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not create the page."));
    } finally {
      setCreating(false);
    }
  };

  const renamePage = async (e) => {
    e.preventDefault();
    if (!renameTitle.trim()) return;
    setRenaming(true);
    try {
      await pageApi.rename(renameTarget.id, { title: renameTitle.trim() });
      toast.success("Page renamed.");
      setRenameTarget(null);
      loadPages();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not rename the page."));
    } finally {
      setRenaming(false);
    }
  };

  const deletePage = async () => {
    setDeleting(true);
    try {
      await pageApi.remove(deleteTarget.id);
      toast.success("Page deleted.");
      setDeleteTarget(null);
      loadPages();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not delete the page."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout title="Dashboard">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">My Todo Pages</h2>
          <p className="text-sm text-slate-500">
            Pages you own and pages shared with you.
          </p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Page
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {pages === null && !error && (
        <div className="flex justify-center py-16 text-slate-400">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {pages !== null && pages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <svg className="mx-auto h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-slate-700">No todo pages yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create your first page to start organizing tasks.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Create a Page
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(pages || []).map((page) => (
          <div
            key={page.id}
            onClick={() => navigate(`/pages/${page.id}`)}
            className="group cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm card-hover"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-slate-800 group-hover:text-brand-700">
                {page.title}
              </h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  page.role === "owner"
                    ? "bg-violet-100 text-violet-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {page.role === "owner" ? "Owner" : "Member"}
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Avatar avatarId={page.owner?.avatar} name={page.owner?.name} size={24} />
              <span className="truncate">{page.owner?.name}</span>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
              <span>
                {(page.members?.length || 0)} member{page.members?.length === 1 ? "" : "s"} ·{" "}
                {page.todo_count ?? 0} task{page.todo_count === 1 ? "" : "s"}
              </span>
              <span>{formatDate(page.updated_at)}</span>
            </div>

            {page.role === "owner" && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameTarget(page);
                    setRenameTitle(page.title);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(page);
                  }}
                  className="rounded-lg border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {createOpen && (
        <Modal title="Create Todo Page" onClose={() => setCreateOpen(false)}>
          <form onSubmit={createPage}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Page title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder='e.g. "My Project Tasks"'
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newTitle.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {creating && <Spinner className="h-4 w-4" />}
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}

      {renameTarget && (
        <Modal title="Rename Page" onClose={() => setRenameTarget(null)}>
          <form onSubmit={renamePage}>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              New title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={renameTitle}
              onChange={(e) => setRenameTitle(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                disabled={renaming}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={renaming || !renameTitle.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {renaming && <Spinner className="h-4 w-4" />}
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Todo Page"
          message={`Delete "${deleteTarget.title}" and all of its tasks? This action cannot be undone.`}
          confirmLabel="Delete Page"
          onConfirm={deletePage}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
    </Layout>
  );
}
