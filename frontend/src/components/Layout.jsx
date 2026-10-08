import { useState } from "react";
import Navbar from "./Navbar";
import ReminderWatcher from "./ReminderWatcher";
import Sidebar from "./Sidebar";

/**
 * Authenticated app shell: sidebar + top navbar + page content.
 * ReminderWatcher runs in the background on every authenticated page.
 */
export default function Layout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <ReminderWatcher />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="md:pl-64">
        <Navbar title={title} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
