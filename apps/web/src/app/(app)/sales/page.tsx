"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Calendar, IndianRupee, Package, Search, ShoppingBag, Trash2 } from "lucide-react";
import type { SaleDto } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAYMENT_FILTERS = ["ALL", "CASH", "UPI", "CARD"] as const;

function paymentBadgeClass(method: string) {
  if (method === "CASH") return "badge ok";
  if (method === "UPI") return "badge sales-pay-upi";
  if (method === "CARD") return "badge sales-pay-card";
  return "badge";
}

function paymentLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "Card";
  return method;
}

function formatSaleProducts(lines: SaleDto["lines"]) {
  if (!lines.length) return "—";
  return lines
    .map((l) => (l.quantity > 1 ? `${l.productName} ×${l.quantity}` : l.productName))
    .join(", ");
}

function formatDateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function SalesPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(today);
  const [deleteTarget, setDeleteTarget] = useState<SaleDto | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["sales", dateFilter],
    queryFn: () => api.getSales(1, dateFilter),
  });

  const removeSale = useMutation({
    mutationFn: (saleId: string) => api.deleteSale(saleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTarget(null);
    },
  });

  const sales = data?.data ?? [];

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (paymentFilter !== "ALL" && s.paymentMethod !== paymentFilter) return false;
      if (!searchDebounced) return true;
      const hay = [
        s.customerName ?? "walk-in",
        formatSaleProducts(s.lines),
        s.paymentMethod,
        s.subtotal,
        s.discount,
        s.total,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [sales, paymentFilter, searchDebounced]);

  const summary = useMemo(() => {
    const revenue = filteredSales.reduce((sum, s) => sum + parseMoneyInput(s.total), 0);
    const items = filteredSales.reduce((sum, s) => sum + s.lines.length, 0);
    return { count: filteredSales.length, revenue, items };
  }, [filteredSales]);

  const hasActiveFilters =
    paymentFilter !== "ALL" || searchDebounced.length > 0 || dateFilter !== today;

  function clearFilters() {
    setDateFilter(today);
    setPaymentFilter("ALL");
    setSearch("");
  }

  return (
    <div className="sales-page">
      <PageHeader
        title="Sales"
        subtitle={formatDateLabel(dateFilter)}
        action={
          <div className="sales-top-actions">
            <div className="recharge-search sales-search">
              <Search size={16} />
              <input
                placeholder="Search customer, product, amount…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link href="/sales/new" className="sales-add-link">
              <button type="button">+ New sale</button>
            </Link>
          </div>
        }
      />

      {!isLoading && !error && (
        <div className="recharge-stats sales-stats">
          <div className="recharge-stat card blue sales-stat">
            <div className="recharge-stat-icon blue">
              <ShoppingBag size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Sales</div>
              <div className="stat-value">{summary.count}</div>
              <div className="muted">
                {hasActiveFilters ? "Matching filter" : "On selected date"}
              </div>
            </div>
          </div>

          <div className="recharge-stat card green sales-stat">
            <div className="recharge-stat-icon green">
              <IndianRupee size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Revenue</div>
              <div className="stat-value positive">{formatMoney(String(summary.revenue))}</div>
              <div className="muted">Total collected</div>
            </div>
          </div>

          <div className="recharge-stat card purple sales-stat">
            <div className="recharge-stat-icon purple">
              <Package size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Line items</div>
              <div className="stat-value">{summary.items}</div>
              <div className="muted">Products in sales</div>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <div className="sales-filter-card card">
          <div className="sales-filter-label">Filter</div>
          <div className="recharge-toolbar" style={{ marginBottom: 0 }}>
            <div className="recharge-toolbar-left">
              <div className="recharge-date">
                <span className="recharge-date-icon" aria-hidden="true">
                  <Calendar size={16} />
                </span>
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                />
                {dateFilter !== today && (
                  <button type="button" className="secondary" onClick={() => setDateFilter(today)}>
                    Today
                  </button>
                )}
              </div>

              <select
                className="recharge-select"
                value={paymentFilter}
                onChange={(e) =>
                  setPaymentFilter(e.target.value as (typeof PAYMENT_FILTERS)[number])
                }
              >
                {PAYMENT_FILTERS.map((p) => (
                  <option key={p} value={p}>
                    {p === "ALL" ? "All payments" : paymentLabel(p)}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button type="button" className="secondary" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading && <PageLoader message="Loading sales…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
        </div>
      )}
      {!isLoading && !error && sales.length === 0 && (
        <EmptyState
          title={`No sales on ${formatDateLabel(dateFilter)}`}
          description="Record a sale when a customer buys from your shop."
          action={
            <Link href="/sales/new">
              <button type="button">+ New sale</button>
            </Link>
          }
        />
      )}
      {!isLoading && !error && sales.length > 0 && filteredSales.length === 0 && (
        <EmptyState
          title="No matching sales"
          description="Try a different search term or clear your filters."
          action={
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          }
        />
      )}
      {!isLoading && !error && filteredSales.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-list sales-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Products</th>
                <th>Subtotal</th>
                <th>Discount</th>
                <th>Total</th>
                <th>Payment</th>
                <th className="col-action" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((s) => (
                <tr key={s.id}>
                  <td className="sales-date">{s.date}</td>
                  <td>
                    <span className="sales-customer">{s.customerName ?? "Walk-in"}</span>
                  </td>
                  <td className="sales-products" title={formatSaleProducts(s.lines)}>
                    {formatSaleProducts(s.lines)}
                  </td>
                  <td className="sales-money">{formatMoney(s.subtotal)}</td>
                  <td className="sales-money sales-discount">
                    {parseFloat(s.discount) > 0 ? formatMoney(s.discount) : "—"}
                  </td>
                  <td className="sales-total">{formatMoney(s.total)}</td>
                  <td>
                    <span className={paymentBadgeClass(s.paymentMethod)}>
                      {paymentLabel(s.paymentMethod)}
                    </span>
                  </td>
                  <td className="col-action">
                    <button
                      type="button"
                      className="inventory-stock-btn danger"
                      title="Delete sale"
                      aria-label="Delete sale"
                      onClick={() => setDeleteTarget(s)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete sale?"
        message={
          deleteTarget
            ? `Remove this sale (${formatMoney(deleteTarget.total)}) permanently? Stock will be restored.`
            : ""
        }
        loading={removeSale.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeSale.mutate(deleteTarget.id)}
      />
    </div>
  );
}
