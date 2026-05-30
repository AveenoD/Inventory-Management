"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CreditCard,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  Users,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { clearToken } from "@/lib/auth";

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ href: string; label: string; icon: React.ReactNode }>;
}> = [
  {
    title: "Overview",
    items: [{ href: "/", label: "Dashboard", icon: <LayoutDashboard size={18} /> }],
  },
  {
    title: "Operations",
    items: [
      { href: "/sales", label: "Sales (POS)", icon: <CreditCard size={18} /> },
      { href: "/inventory", label: "Inventory", icon: <Package size={18} /> },
    ],
  },
  {
    title: "Services",
    items: [
      { href: "/recharge", label: "Recharge", icon: <Zap size={18} /> },
      { href: "/money-transfer", label: "Money Transfer", icon: <ArrowLeftRight size={18} /> },
      { href: "/repair", label: "Repairs", icon: <Wrench size={18} /> },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/reports", label: "Reports", icon: <BarChart3 size={18} /> },
      { href: "/expenses", label: "Expenses", icon: <FileText size={18} /> },
      { href: "/parties", label: "Parties", icon: <Users size={18} /> },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/months", label: "Business Months", icon: <Calendar size={18} /> },
      { href: "/settings", label: "Settings", icon: <Settings size={18} /> },
    ],
  },
];

type SidebarProps = {
  open?: boolean;
  onClose?: () => void;
};

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-row">
          <div className="sidebar-app-icon" aria-hidden="true" />
          <div className="sidebar-brand-text">
            <strong>SK Mobile Shop</strong>
            <span>Shop Management System</span>
          </div>
          <button
            type="button"
            className="sidebar-close secondary"
            aria-label="Close menu"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="sidebar-group">
            <div className="sidebar-group-title">{group.title}</div>
            <div className="sidebar-group-items">
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? "sidebar-link active" : "sidebar-link"}
                    onClick={onClose}
                  >
                    <span className="sidebar-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <button
        type="button"
        className="secondary sidebar-logout"
        onClick={() => {
          clearToken();
          router.push("/login");
        }}
      >
        Logout
      </button>
    </aside>
  );
}
