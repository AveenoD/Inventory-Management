"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/format";

export default function SalesPage() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading, error } = useQuery({
    queryKey: ["sales", today],
    queryFn: () => api.getSales(1, today),
  });

  const sales = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle={`Today: ${today}`}
        action={
          <Link href="/sales/new">
            <button type="button">+ New sale</button>
          </Link>
        }
      />
      {isLoading && <p className="muted">Loading…</p>}
      {error && <p className="error">{(error as Error).message}</p>}
      <div className="data-table-wrap">
        <table className="data-list">
          <thead>
            <tr>
              <th>Time</th>
              <th>Customer</th>
              <th>Items</th>
              <th>Subtotal</th>
              <th>Discount</th>
              <th>Total</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{s.customerName ?? "Walk-in"}</td>
                <td>{s.lines.length}</td>
                <td>{formatMoney(s.subtotal)}</td>
                <td>{parseFloat(s.discount) > 0 ? formatMoney(s.discount) : "—"}</td>
                <td>{formatMoney(s.total)}</td>
                <td>{s.paymentMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
