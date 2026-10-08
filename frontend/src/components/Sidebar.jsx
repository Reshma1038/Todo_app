import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Avatar from "./Avatar";

/**
 * Responsive sidebar: static on desktop, slide-over drawer on mobile.
 */
export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();

  const navContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-indigo-600 text-white shadow-sm">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="text-lg font-bold text-slate-800">TaskFlow</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
          </svg>
          Dashboard
        </NavLink>

        <NavLink
          to="/analytics"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
              isActive
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
          </svg>
          Analytics
        </NavLink>
      </nav>

      <div className="border-t border-slate-200 p-4 sm:hidden">
        <div className="flex items-center gap-3">
          <Avatar avatarId={user?.avatar} name={user?.name} size={36} />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white md:block">
        {navContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
