import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";
import AvatarPickerModal from "./AvatarPickerModal";

/**
 * Top bar: mobile menu toggle, current section title, user info,
 * browser-notification toggle for due-date reminders, logout.
 */
export default function Navbar({ title, onMenuToggle }) {
  const { user, logout } = useAuth();
  const [avatarOpen, setAvatarOpen] = useState(false);

  const notifSupported = typeof window !== "undefined" && "Notification" in window;
  const [notifPerm, setNotifPerm] = useState(
    notifSupported ? Notification.permission : "unsupported"
  );

  const enableNotifications = async () => {
    try {
      setNotifPerm(await Notification.requestPermission());
    } catch {
      /* browser blocked the request */
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMenuToggle}
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
        aria-label="Open menu"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="flex-1 truncate text-lg font-semibold text-slate-800">
        {title}
      </h1>

      {/* Due-date reminder notifications toggle */}
      {notifPerm === "default" && (
        <button
          onClick={enableNotifications}
          title="Enable browser notifications for due-date reminders"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="hidden sm:inline">Reminders</span>
        </button>
      )}
      {notifPerm === "granted" && (
        <span
          title="Due-date reminders: browser notifications enabled"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="hidden sm:inline">Reminders on</span>
        </span>
      )}

      <div className="hidden items-center gap-3 sm:flex">
        <button
          onClick={() => setAvatarOpen(true)}
          title="Change avatar"
          className="rounded-full transition hover:ring-2 hover:ring-brand-300"
        >
          <Avatar avatarId={user?.avatar} name={user?.name} size={38} />
        </button>
        <div className="leading-tight">
          <p className="text-sm font-medium text-slate-800">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
        </div>
      </div>

      <button
        onClick={logout}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Logout
      </button>

      {avatarOpen && <AvatarPickerModal onClose={() => setAvatarOpen(false)} />}
    </header>
  );
}
