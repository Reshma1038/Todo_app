import { useState } from "react";
import { authApi } from "../api/authApi";
import { getErrorMessage } from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Avatar, { AVATARS } from "./Avatar";
import Modal from "./Modal";
import { Spinner } from "./Spinner";

/**
 * Avatar gallery with male and female styles. Used on the register page
 * (optional) and from the navbar to change the avatar later.
 */
export function AvatarGrid({ selected, onSelect }) {
  return (
    <div className="mx-auto grid max-w-xs grid-cols-4 gap-3 sm:grid-cols-4">
      {AVATARS.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a.id === selected ? null : a.id)}
          title={`${a.label} (${a.gender})`}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 transition ${
            selected === a.id
              ? "border-brand-500 bg-brand-50 shadow-sm"
              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
          }`}
        >
          <Avatar avatarId={a.id} size={48} />
          <span className="text-[10px] font-medium text-slate-500">{a.label}</span>
        </button>
      ))}
    </div>
  );
}

export default function AvatarPickerModal({ onClose }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [selected, setSelected] = useState(user?.avatar || null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const res = await authApi.updateAvatar(selected);
      updateUser(res.data);
      toast.success("Avatar updated.");
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not update the avatar."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Choose your avatar" onClose={onClose}>
      <AvatarGrid selected={selected} onSelect={setSelected} />
      <p className="mt-3 text-xs text-slate-400">
        Male and female styles are available — pick whichever you like.
      </p>
      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button onClick={save} disabled={saving || !selected} className="btn-primary">
          {saving && <Spinner className="h-4 w-4" />}
          Save Avatar
        </button>
      </div>
    </Modal>
  );
}
