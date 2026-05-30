"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AuthGuard } from "@/components/auth-guard";
import { MonthProvider } from "@/contexts/month-context";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  return (
    <AuthGuard>
      <MonthProvider>
        <div className="app-shell">
          {sidebarOpen && (
            <button
              type="button"
              className="sidebar-backdrop"
              aria-label="Close menu"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          <div className="app-content">
            <header className="mobile-topbar">
              <button
                type="button"
                className="mobile-menu-btn secondary"
                aria-label="Open menu"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div className="mobile-topbar-title">
                <strong>SK Mobile Shop</strong>
                <span>Shop Management</span>
              </div>
            </header>

            <main className="app-main">{children}</main>
          </div>
        </div>
      </MonthProvider>
    </AuthGuard>
  );
}
