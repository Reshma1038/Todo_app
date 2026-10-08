import { useState } from "react";
import { getErrorMessage } from "../api/axios";
import { pageApi } from "../api/pageApi";
import { useToast } from "../context/ToastContext";
import { isValidEmail } from "../utils/format";
import Avatar from "./Avatar";
import Modal from "./Modal";
import { Spinner } from "./Spinner";

/**
 * Owner-only dialog: invite an existing registered user by email and
 * manage the current member list.
 */
export default function InviteMemberModal({ page, onClose, onMembersChanged }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  const members = page.members || [];

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setAdding(true);
    try {
      const res = await pageApi.addMember(page.id, email.trim());
      toast.success(`${email.trim()} was added to the page.`);
      setEmail("");
      onMembersChanged(res.data);
    } catch (err) {
      setError(getErrorMessage(err, "Could not add the member."));
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (member) => {
    setRemovingId(member.id);
    try {
      const res = await pageApi.removeMember(page.id, member.id);
      toast.success(`${member.name} was removed from the page.`);
      onMembersChanged(res.data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not remove the member."));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal title="Share Page" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-500">
        Invite people who already have a TaskFlow account. Only registered
        emails can be added.
      </p>

      <form onSubmit={submit} className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          autoFocus
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {adding && <Spinner className="h-4 w-4" />}
          Add
        </button>
      </form>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <h3 className="mt-6 mb-2 text-sm font-semibold text-slate-700">
        Members ({members.length})
      </h3>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar avatarId={m.avatar} name={m.name} size={32} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-800">{m.name}</p>
              <p className="truncate text-xs text-slate-500">{m.email}</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                m.role === "owner"
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {m.role === "owner" ? "Owner" : "Member"}
            </span>
            {m.role !== "owner" && (
              <button
                onClick={() => removeMember(m)}
                disabled={removingId === m.id}
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${m.name}`}
                title="Remove member"
              >
                {removingId === m.id ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
                  </svg>
                )}
              </button>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
