"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";
import { api } from "@/lib/api";
import { Calendar, Download, Filter } from "lucide-react";

export default function ExpensesPage() {
  const { year, month, monthId } = useMonthContext();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<"shop" | "ledger">("shop");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState<"ALL" | "SHOP_EXPENSE" | "DAMAGE">("ALL");

  const { data: dashboard, isLoading: dashLoading, error: dashError } = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => api.getDashboard(monthId!),
    enabled: !!monthId,
  });

  const {
    data: shopExpenses,
    isLoading: shopLoading,
    error: shopError,
  } = useQuery({
    queryKey: ["shop-expenses", monthId, from, to],
    queryFn: () => api.getShopExpenses(monthId!, 1, 31, from, to),
    enabled: !!monthId && tab === "shop",
  });

  const {
    data: damages,
    isLoading: damageLoading,
    error: damageError,
  } = useQuery({
    queryKey: ["damages", monthId, from, to],
    queryFn: () => api.getDamages(monthId!, 1, 31, from, to),
    enabled: !!monthId && tab === "shop",
  });

  const {
    data: withdrawals,
    isLoading: withdrawalLoading,
    error: withdrawalError,
  } = useQuery({
    queryKey: ["withdrawals", monthId, from, to],
    queryFn: () => api.getWithdrawals(monthId!, 1, 31, from, to),
    enabled: !!monthId && tab === "ledger",
  });

  const tx = useMemo(() => {
    if (tab !== "shop") return [];
    const shop = (shopExpenses?.data ?? []) as Array<{
      date: string;
      salaryDescription?: string | null;
      salaryAmount?: string | number;
      teaDescription?: string | null;
      teaAmount?: string | number;
      shopExpDescription?: string | null;
      shopExpAmount?: string | number;
    }>;
    const dmg = (damages?.data ?? []) as Array<{
      date: string;
      accessoriesDescription?: string | null;
      accessoriesAmount?: string | number;
      repairingDescription?: string | null;
      repairingAmount?: string | number;
    }>;

    const rows: Array<{
      at: string;
      category: "SHOP_EXPENSE" | "DAMAGE";
      type: "Expense" | "Damage";
      description: string;
      amount: number;
      paymentMethod: string;
    }> = [];

    for (const d of shop) {
      const date = d.date;
      const salary = Number(d.salaryAmount ?? 0);
      if (salary > 0 || (d.salaryDescription ?? "").trim()) {
        rows.push({
          at: `${date} 10:30 AM`,
          category: "SHOP_EXPENSE",
          type: "Expense",
          description: d.salaryDescription?.trim() || "Salary",
          amount: salary,
          paymentMethod: "Cash",
        });
      }
      const tea = Number(d.teaAmount ?? 0);
      if (tea > 0 || (d.teaDescription ?? "").trim()) {
        rows.push({
          at: `${date} 09:45 AM`,
          category: "SHOP_EXPENSE",
          type: "Expense",
          description: d.teaDescription?.trim() || "Tea",
          amount: tea,
          paymentMethod: "Cash",
        });
      }
      const shopExp = Number(d.shopExpAmount ?? 0);
      if (shopExp > 0 || (d.shopExpDescription ?? "").trim()) {
        rows.push({
          at: `${date} 08:20 AM`,
          category: "SHOP_EXPENSE",
          type: "Expense",
          description: d.shopExpDescription?.trim() || "Shop Expense",
          amount: shopExp,
          paymentMethod: "Cash",
        });
      }
    }

    for (const d of dmg) {
      const date = d.date;
      const acc = Number(d.accessoriesAmount ?? 0);
      if (acc > 0 || (d.accessoriesDescription ?? "").trim()) {
        rows.push({
          at: `${date} 11:15 AM`,
          category: "DAMAGE",
          type: "Damage",
          description: d.accessoriesDescription?.trim() || "Accessories Damage",
          amount: acc,
          paymentMethod: "—",
        });
      }
      const rep = Number(d.repairingAmount ?? 0);
      if (rep > 0 || (d.repairingDescription ?? "").trim()) {
        rows.push({
          at: `${date} 12:05 PM`,
          category: "DAMAGE",
          type: "Damage",
          description: d.repairingDescription?.trim() || "Repairing Damage",
          amount: rep,
          paymentMethod: "—",
        });
      }
    }

    rows.sort((a, b) => (a.at < b.at ? 1 : -1));
    return rows;
  }, [tab, shopExpenses?.data, damages?.data]);

  const filteredTx = useMemo(() => {
    if (category === "ALL") return tx;
    return tx.filter((t) => t.category === category);
  }, [tx, category]);

  const totals = useMemo(() => {
    const totalExpenses = filteredTx
      .filter((t) => t.category === "SHOP_EXPENSE")
      .reduce((a, t) => a + (t.amount || 0), 0);
    const totalDamage = filteredTx
      .filter((t) => t.category === "DAMAGE")
      .reduce((a, t) => a + (t.amount || 0), 0);
    return { totalExpenses, totalDamage, txCount: filteredTx.length };
  }, [filteredTx]);

  const showLoader =
    dashLoading ||
    (tab === "shop" && (shopLoading || damageLoading)) ||
    (tab === "ledger" && withdrawalLoading);

  const err = dashError || shopError || damageError || withdrawalError;

  return (
    <MonthGate>
      <div>
        <PageHeader
          title="Expenses"
          subtitle="Manage shop expenses, damage, withdrawals"
          action={
            <div className="expenses-actions">
              <button type="button" className="expenses-range secondary" aria-label="Date range">
                <Calendar size={16} />
                <span>
                  {from} - {to}
                </span>
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  // placeholder for advanced filters
                }}
              >
                <Filter size={16} /> Filter
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push(`/months/${year}/${month}/expenses`);
                }}
                disabled={!monthId}
              >
                + Add Expense
              </button>
            </div>
          }
        />

        {!monthId && (
          <p className="muted">Create a business month first from the Months page.</p>
        )}

        {monthId && (
          <div className="expenses-tabs">
            <button
              type="button"
              className={tab === "shop" ? "expenses-tab active" : "expenses-tab"}
              onClick={() => setTab("shop")}
            >
              <div className="expenses-tab-title">Shop expenses &amp; damage</div>
              <div className="expenses-tab-sub muted">Daily shop expenses and damages</div>
            </button>
            <button
              type="button"
              className={tab === "ledger" ? "expenses-tab active" : "expenses-tab"}
              onClick={() => setTab("ledger")}
            >
              <div className="expenses-tab-title">Udhhar &amp; bank ledger</div>
              <div className="expenses-tab-sub muted">Money withdrawn or bank transactions</div>
            </button>
          </div>
        )}

        {showLoader && <PageLoader message="Loading expenses…" />}
        {err && <p className="error">{(err as Error).message}</p>}

        {monthId && dashboard && tab === "shop" && !showLoader && !err && (
          <>
            <div className="expenses-metrics">
              <div className="expenses-metric card blue">
                <div className="expenses-metric-icon blue">₹</div>
                <div>
                  <div className="stat-label">Total Expenses</div>
                  <div className="stat-value">{formatMoney(String(totals.totalExpenses))}</div>
                  <div className="muted">{totals.txCount} Transactions</div>
                </div>
              </div>
              <div className="expenses-metric card orange">
                <div className="expenses-metric-icon orange">⧗</div>
                <div>
                  <div className="stat-label">Total Damage</div>
                  <div className="stat-value">{formatMoney(String(totals.totalDamage))}</div>
                  <div className="muted">{filteredTx.filter((t) => t.category === "DAMAGE").length} Transactions</div>
                </div>
              </div>
              <div className="expenses-metric card green">
                <div className="expenses-metric-icon green">⛩</div>
                <div>
                  <div className="stat-label">Total Amount</div>
                  <div className="stat-value">{formatMoney(dashboard.totalExpense)}</div>
                  <div className="muted">This month</div>
                </div>
              </div>
              <div className="expenses-metric card purple">
                <div className="expenses-metric-icon purple">↗</div>
                <div>
                  <div className="stat-label">Avg. Daily Expense</div>
                  <div className="stat-value">{formatMoney(avgDaily(dashboard.totalExpense))}</div>
                  <div className="muted">This month</div>
                </div>
              </div>
            </div>

            <div className="expenses-card card">
              <div className="expenses-toolbar">
                <div className="expenses-toolbar-left">
                  <div className="expenses-date">
                    <span className="expenses-date-icon" aria-hidden="true">
                      <Calendar size={16} />
                    </span>
                    <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                    <span className="muted">-</span>
                    <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                  </div>
                  <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
                    <option value="ALL">All Categories</option>
                    <option value="SHOP_EXPENSE">Shop Expense</option>
                    <option value="DAMAGE">Damage</option>
                  </select>
                </div>
                <div className="expenses-toolbar-right">
                  <button type="button" className="secondary" onClick={() => {}} title="Export (coming soon)">
                    <Download size={16} /> Export
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/months/${year}/${month}/expenses`)}
                  >
                    + Add Expense
                  </button>
                </div>
              </div>

              {filteredTx.length === 0 ? (
                <EmptyState
                  title="No expenses found"
                  description="Try changing the date range or category."
                  action={
                    <button type="button" onClick={() => router.push(`/months/${year}/${month}/expenses`)}>
                      Add expense
                    </button>
                  }
                />
              ) : (
                <div className="data-table-wrap">
                  <table className="data-list expenses-table">
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th className="right">Amount (₹)</th>
                        <th>Payment Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.map((r, idx) => (
                        <tr key={`${r.at}-${idx}`}>
                          <td>{r.at}</td>
                          <td>
                            <span className={`expenses-pill ${r.category === "DAMAGE" ? "damage" : "shop"}`}>
                              {r.category === "DAMAGE" ? "Damage" : "Shop Expense"}
                            </span>
                          </td>
                          <td className={r.category === "DAMAGE" ? "negative" : ""}>{r.type}</td>
                          <td>{r.description}</td>
                          <td className="right">{formatMoney(String(r.amount))}</td>
                          <td className="muted">{r.paymentMethod}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="expenses-footer muted">
                Showing 1 to {Math.min(filteredTx.length, 6)} of {filteredTx.length} transactions
              </div>
            </div>
          </>
        )}

        {monthId && tab === "ledger" && !showLoader && !err && (
          <div className="expenses-card card">
            <div className="expenses-ledger-head">
              <div>
                <div className="expenses-ledger-title">Udhhar &amp; bank ledger</div>
                <div className="muted">Track money withdrawn from shop or bank transactions</div>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => router.push(`/months/${year}/${month}/ledger`)}
              >
                View Ledger
              </button>
            </div>

            <div className="data-table-wrap">
              <table className="data-list expenses-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="right">Cash</th>
                    <th className="right">Bank</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {((withdrawals?.data ?? []) as Array<{ date: string; description?: string | null; cash: string; bank: string; total: string }>).map((w, idx) => (
                    <tr key={`${w.date}-${idx}`}>
                      <td>{w.date}</td>
                      <td className="muted">{w.description ?? "—"}</td>
                      <td className="right">{formatMoney(w.cash)}</td>
                      <td className="right">{formatMoney(w.bank)}</td>
                      <td className="right">{formatMoney(w.total)}</td>
                    </tr>
                  ))}
                  {(!withdrawals?.data || withdrawals.data.length === 0) && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No ledger entries for selected range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </MonthGate>
  );
}

function avgDaily(totalExpense: string) {
  const v = Number(totalExpense) || 0;
  // rough 30-day month average; accurate daily avg needs per-day data
  return String(v / 30);
}
