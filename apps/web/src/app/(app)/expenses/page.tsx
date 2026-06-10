"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  EXPENSE_CATEGORIES,
  buildExpenseLineItems,
  type ExpenseCategoryKey,
  type ExpenseLineItem,
} from "@sk-mobile/shared";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowActionMenu } from "@/components/ui/row-action-menu";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { api } from "@/lib/api";
import { Calendar, Download, Filter, Plus } from "lucide-react";

type EditDraft = {
  date: string;
  categoryKey: ExpenseCategoryKey | "WITHDRAWAL";
  amount: string;
  description: string;
};

function lineToEditDraft(row: ExpenseLineItem): EditDraft {
  const label = row.type;
  const desc =
    row.description && row.description !== label ? row.description : "";
  return {
    date: row.date,
    categoryKey: row.categoryKey,
    amount: String(row.amount),
    description: desc,
  };
}

export default function ExpensesPage() {
  const { year, month, monthId } = useMonthContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}-01`,
    [year, month],
  );
  const [tab, setTab] = useState<"shop" | "ledger">("shop");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [category, setCategory] = useState<"ALL" | "SHOP_EXPENSE" | "DAMAGE" | "WITHDRAWAL">("ALL");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategoryKey>("SHOP");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseError, setExpenseError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ExpenseLineItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseLineItem | null>(null);

  useEffect(() => {
    setFrom(monthStart);
  }, [monthStart]);

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
    enabled: !!monthId,
  });

  const tx = useMemo(() => {
    if (tab !== "shop") return [];
    return buildExpenseLineItems(
      (shopExpenses?.data ?? []) as Array<Record<string, unknown>>,
      (damages?.data ?? []) as Array<Record<string, unknown>>,
      (withdrawals?.data ?? []) as Array<Record<string, unknown>>,
    );
  }, [tab, shopExpenses?.data, damages?.data, withdrawals?.data]);

  const filteredTx = useMemo(() => {
    if (category === "ALL") return tx;
    return tx.filter((t) => t.lineCategory === category);
  }, [tx, category]);

  const totals = useMemo(() => {
    const totalExpenses = filteredTx
      .filter((t) => t.lineCategory === "SHOP_EXPENSE")
      .reduce((a, t) => a + (t.amount || 0), 0);
    const totalDamage = filteredTx
      .filter((t) => t.lineCategory === "DAMAGE")
      .reduce((a, t) => a + (t.amount || 0), 0);
    return { totalExpenses, totalDamage, txCount: filteredTx.length };
  }, [filteredTx]);

  function invalidateExpenseQueries() {
    queryClient.invalidateQueries({ queryKey: ["dashboard", monthId] });
    queryClient.invalidateQueries({ queryKey: ["shop-expenses", monthId] });
    queryClient.invalidateQueries({ queryKey: ["damages", monthId] });
    queryClient.invalidateQueries({ queryKey: ["withdrawals", monthId] });
    queryClient.invalidateQueries({ queryKey: ["today"] });
  }

  const showLoader =
    dashLoading ||
    (tab === "shop" && (shopLoading || damageLoading || withdrawalLoading)) ||
    (tab === "ledger" && withdrawalLoading);

  const err = dashError || shopError || damageError || withdrawalError;

  const availableProfit = Number(dashboard?.netProfit ?? 0) || 0;

  const createExpense = useMutation({
    mutationFn: () => {
      if (!monthId) throw new Error("Month not loaded");
      const amount = parseMoneyInput(expenseAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount greater than zero.");
      }
      return api.createExpenseEntry(monthId, {
        date: expenseDate,
        category: expenseCategory,
        amount,
        description: expenseDescription.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setExpenseOpen(false);
      setExpenseAmount("");
      setExpenseDescription("");
      setExpenseError("");
    },
    onError: (e: Error) => {
      setExpenseError(e.message);
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: (amount: number) => {
      if (!monthId) throw new Error("Month not loaded");
      return api.createWithdrawal(monthId, { date: today, amount });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setWithdrawError("");
    },
    onError: (e: Error) => {
      setWithdrawError(e.message);
    },
  });

  function openAddExpenseModal() {
    setExpenseDate(today);
    setExpenseCategory("SHOP");
    setExpenseAmount("");
    setExpenseDescription("");
    setExpenseError("");
    setExpenseOpen(true);
  }

  function submitExpense() {
    const amount = parseMoneyInput(expenseAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setExpenseError("Enter a valid amount greater than zero.");
      return;
    }
    setExpenseError("");
    createExpense.mutate();
  }

  function openWithdrawModal() {
    setWithdrawAmount("");
    setWithdrawError("");
    setWithdrawOpen(true);
  }

  const updateLine = useMutation({
    mutationFn: async ({ row, draft }: { row: ExpenseLineItem; draft: EditDraft }) => {
      if (!monthId) throw new Error("Month not loaded");
      const amount = parseMoneyInput(draft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount greater than zero.");
      }

      if (row.lineCategory === "WITHDRAWAL") {
        if (!row.withdrawalId) throw new Error("Cannot edit this withdrawal.");
        if (amount > availableProfit + row.amount) {
          throw new Error(
            `Insufficient profit. Available: ${formatMoney(availableProfit + row.amount)}.`,
          );
        }
        return api.updateWithdrawal(monthId, row.withdrawalId, {
          date: draft.date,
          amount,
          description: draft.description.trim() || undefined,
        });
      }

      const cat = row.categoryKey as ExpenseCategoryKey;
      const moved = draft.date !== row.date;
      if (moved) {
        await api.deleteExpenseEntry(monthId, { date: row.date, category: cat });
      }
      return api.updateExpenseEntry(monthId, {
        date: draft.date,
        category: cat,
        amount,
        description: draft.description.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setEditingRow(null);
      setEditDraft(null);
      setOpenMenuId(null);
      updateLine.reset();
    },
  });

  const deleteLine = useMutation({
    mutationFn: async (row: ExpenseLineItem) => {
      if (!monthId) throw new Error("Month not loaded");
      if (row.lineCategory === "WITHDRAWAL") {
        if (!row.withdrawalId) throw new Error("Cannot delete this withdrawal.");
        return api.deleteWithdrawal(monthId, row.withdrawalId);
      }
      return api.deleteExpenseEntry(monthId, {
        date: row.date,
        category: row.categoryKey as ExpenseCategoryKey,
      });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setDeleteTarget(null);
      setOpenMenuId(null);
    },
  });

  function startEdit(row: ExpenseLineItem) {
    setEditingRow(row);
    setEditDraft(lineToEditDraft(row));
    setOpenMenuId(null);
  }

  function closeEdit() {
    setEditingRow(null);
    setEditDraft(null);
    updateLine.reset();
  }

  function submitEdit() {
    if (!editingRow || !editDraft) return;
    const amount = parseMoneyInput(editDraft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    updateLine.mutate({ row: editingRow, draft: editDraft });
  }

  function submitWithdraw() {
    const amount = parseMoneyInput(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setWithdrawError("Enter a valid withdrawal amount greater than zero.");
      return;
    }
    if (amount > availableProfit) {
      setWithdrawError(
        `Insufficient profit. Available: ${formatMoney(availableProfit)}. You cannot withdraw more than the current month profit.`,
      );
      return;
    }
    setWithdrawError("");
    withdrawMutation.mutate(amount);
  }

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
                className="secondary"
                onClick={openWithdrawModal}
                disabled={!monthId || !dashboard}
              >
                Withdraw
              </button>
              <button type="button" onClick={openAddExpenseModal} disabled={!monthId}>
                <Plus size={16} /> Add Expense
              </button>
            </div>
          }
        />

        <FormModal open={expenseOpen} title="Add Expense" onClose={() => setExpenseOpen(false)}>
          <div className="form-stack" style={{ maxWidth: "100%" }}>
            <label>
              Date
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value as ExpenseCategoryKey)}
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Enter expense amount"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </label>
            <label>
              Description (optional)
              <input
                type="text"
                placeholder="e.g. Shop rent, broken screen, staff salary"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
              />
            </label>
          </div>
          {expenseError && <p className="error">{expenseError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setExpenseOpen(false)}>
              Cancel
            </button>
            <button type="button" onClick={submitExpense} disabled={createExpense.isPending}>
              {createExpense.isPending ? "Saving…" : "Save Expense"}
            </button>
          </div>
        </FormModal>

        <FormModal open={withdrawOpen} title="Withdraw from Profit" onClose={() => setWithdrawOpen(false)}>
          <p className="muted" style={{ marginBottom: "0.75rem" }}>
            Enter how much you want to withdraw from this month&apos;s profit.
          </p>
          {dashboard && (
            <p className="dash-hint" style={{ marginBottom: "0.75rem" }}>
              Available month profit: <strong>{formatMoney(dashboard.netProfit)}</strong>
            </p>
          )}
          <label>
            Withdrawal Amount (₹)
            <input
              type="number"
              min={0}
              step="0.01"
              placeholder="How much do you want to withdraw?"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </label>
          {withdrawError && <p className="error">{withdrawError}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={() => setWithdrawOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submitWithdraw}
              disabled={withdrawMutation.isPending || availableProfit <= 0}
            >
              {withdrawMutation.isPending ? "Processing…" : "Confirm Withdrawal"}
            </button>
          </div>
        </FormModal>

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
                  <div className="muted">{filteredTx.filter((t) => t.lineCategory === "DAMAGE").length} Transactions</div>
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
                    <option value="WITHDRAWAL">Withdraw</option>
                  </select>
                </div>
                <div className="expenses-toolbar-right">
                  <button type="button" className="secondary" onClick={() => {}} title="Export (coming soon)">
                    <Download size={16} /> Export
                  </button>
                  <button type="button" onClick={openAddExpenseModal}>
                    <Plus size={16} /> Add Expense
                  </button>
                </div>
              </div>

              {filteredTx.length === 0 ? (
                <EmptyState
                  title="No transactions found"
                  description="Try changing the date range or category."
                  action={
                    <button type="button" onClick={openAddExpenseModal}>
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
                        <th className="col-action">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTx.map((r) => (
                        <tr key={r.id}>
                          <td>{r.date}</td>
                          <td>
                            <span
                              className={`expenses-pill ${
                                r.lineCategory === "DAMAGE"
                                  ? "damage"
                                  : r.lineCategory === "WITHDRAWAL"
                                    ? "withdraw"
                                    : "shop"
                              }`}
                            >
                              {r.lineCategory === "DAMAGE"
                                ? "Damage"
                                : r.lineCategory === "WITHDRAWAL"
                                  ? "Withdraw"
                                  : "Shop Expense"}
                            </span>
                          </td>
                          <td
                            className={
                              r.lineCategory === "DAMAGE" || r.lineCategory === "WITHDRAWAL"
                                ? "negative"
                                : ""
                            }
                          >
                            {r.type}
                          </td>
                          <td>{r.description}</td>
                          <td className="right">{formatMoney(String(r.amount))}</td>
                          <td className="muted">{r.paymentMethod}</td>
                          <td className="col-action">
                            <RowActionMenu
                              open={openMenuId === r.id}
                              disabled={
                                deleteLine.isPending ||
                                updateLine.isPending ||
                                (r.lineCategory === "WITHDRAWAL" && !r.withdrawalId)
                              }
                              onToggle={() => setOpenMenuId((id) => (id === r.id ? null : r.id))}
                              onClose={() => setOpenMenuId(null)}
                              items={[
                                {
                                  key: "edit",
                                  label: "Edit",
                                  onClick: () => startEdit(r),
                                },
                                {
                                  key: "delete",
                                  label: "Delete",
                                  danger: true,
                                  onClick: () => {
                                    setOpenMenuId(null);
                                    setDeleteTarget(r);
                                  },
                                },
                              ]}
                            />
                          </td>
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

        <FormModal open={!!editingRow && !!editDraft} title="Edit transaction" onClose={closeEdit}>
          {editDraft && editingRow && (
            <div className="form-stack" style={{ maxWidth: "100%" }}>
              <label>
                Date
                <input
                  type="date"
                  value={editDraft.date}
                  onChange={(e) =>
                    setEditDraft((prev) => (prev ? { ...prev, date: e.target.value } : prev))
                  }
                />
              </label>
              {editingRow.lineCategory !== "WITHDRAWAL" ? (
                <label>
                  Category
                  <input type="text" value={editingRow.type} disabled />
                </label>
              ) : null}
              <label>
                Amount (₹)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editDraft.amount}
                  onChange={(e) =>
                    setEditDraft((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
                  }
                />
              </label>
              <label>
                Description (optional)
                <input
                  type="text"
                  value={editDraft.description}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, description: e.target.value } : prev,
                    )
                  }
                />
              </label>
            </div>
          )}
          {updateLine.error && <p className="error">{(updateLine.error as Error).message}</p>}
          <div className="modal-actions">
            <button type="button" className="secondary" onClick={closeEdit}>
              Cancel
            </button>
            <button type="button" onClick={submitEdit} disabled={updateLine.isPending}>
              {updateLine.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </FormModal>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete transaction?"
          message={
            deleteTarget
              ? `Remove this ${deleteTarget.lineCategory === "WITHDRAWAL" ? "withdrawal" : "expense"} permanently? This cannot be undone.`
              : ""
          }
          error={deleteLine.error ? (deleteLine.error as Error).message : null}
          loading={deleteLine.isPending}
          onCancel={() => {
            setDeleteTarget(null);
            deleteLine.reset();
          }}
          onConfirm={() => deleteTarget && deleteLine.mutate(deleteTarget)}
        />
      </div>
    </MonthGate>
  );
}

function avgDaily(totalExpense: string) {
  const v = Number(totalExpense) || 0;
  // rough 30-day month average; accurate daily avg needs per-day data
  return String(v / 30);
}
