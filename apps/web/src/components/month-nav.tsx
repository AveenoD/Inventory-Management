"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { monthLabel } from "@/lib/format";

const LINKS = [
  { href: "", label: "Dashboard" },
  { href: "/money-transfer", label: "Money Transfer" },
  { href: "/recharge", label: "Recharge" },
  { href: "/repair-mobile", label: "Repair & Mobile" },
  { href: "/expenses", label: "Expenses" },
  { href: "/ledger", label: "Ledger" },
];

export function MonthNav({
  year,
  month,
  monthId,
}: {
  year: number;
  month: number;
  monthId: string;
}) {
  const pathname = usePathname();
  const base = `/months/${year}/${month}`;

  return (
    <nav className="nav">
      <strong>{monthLabel(year, month)}</strong>
      {LINKS.map((l) => {
        const href = `${base}${l.href}`;
        const active = l.href === "" ? pathname === base : pathname?.startsWith(href);
        return (
          <Link key={l.href} href={href} className={active ? "active" : ""}>
            {l.label}
          </Link>
        );
      })}
      <Link href="/months" style={{ marginLeft: "auto" }}>
        All months
      </Link>
    </nav>
  );
}
