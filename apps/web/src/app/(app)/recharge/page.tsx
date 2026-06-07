"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowActionMenu } from "@/components/ui/row-action-menu";
import {
  RECHARGE_OPERATORS,
  RECHARGE_AMOUNT_FIELDS,
  formatRechargeTypeLabel,
  getRechargeBreakdownParts,
  rechargeEntryHasType,
  type RechargeOperator,
} from "@sk-mobile/shared";
import { formatMoney, parseMoneyInput, sumMoney } from "@/lib/format";
import {
  Calendar,
  Download,
  Search,
  Smartphone,
  Zap,
} from "lucide-react";

type RechargeRow = {
  id: string;
  date: string;
  operator: string;
  entryType: string;
  amount: string;
  rechargeAmount?: string | null;
  note?: string | null;
  saleProfit?: string | null;
  chillar?: string | null;
  act?: string | null;
  mnp?: string | null;
};

function formatProfitBreakdown(row: RechargeRow): string {
  const parts = getRechargeBreakdownParts(row);
  if (parts.length === 0) return "";
  if (parts.length === 1) return formatMoney(parts[0]!.amount);
  return parts.map((p) => formatMoney(p.amount)).join(" + ");
}

const PAGE_SIZES = [10, 25, 50] as const;

const EMPTY_AMOUNTS = {
  saleProfit: "",
  chillar: "",
  act: "",
  mnp: "",
};

type EditDraft = {
  date: string;
  operator: RechargeOperator;
  rechargeAmount: string;
  saleProfit: string;
  chillar: string;
  act: string;
  mnp: string;
};

function rowToDraft(row: RechargeRow): EditDraft {
  return {
    date: row.date,
    operator: row.operator as RechargeOperator,
    rechargeAmount: row.rechargeAmount ?? "",
    saleProfit: row.saleProfit ?? "",
    chillar: row.chillar ?? "",
    act: row.act ?? "",
    mnp: row.mnp ?? "",
  };
}

type OperatorKey = RechargeOperator;

const OPERATOR_LOGOS: Record<OperatorKey, { primary: string; fallback: string | null; alt: string }> = {
  AIRTEL: {
    primary: "https://logo.clearbit.com/airtel.in",
    fallback: "https://www.google.com/s2/favicons?domain=airtel.in&sz=64",
    alt: "Airtel",
  },
  JIO: {
    primary: "https://logo.clearbit.com/jio.com",
    fallback: "https://www.google.com/s2/favicons?domain=jio.com&sz=64",
    alt: "Jio",
  },
  VI: {
    primary: "https://logo.clearbit.com/myvi.in",
    fallback: "https://www.google.com/s2/favicons?domain=myvi.in&sz=64",
    alt: "VI",
  },
  BSNL: {
    primary: "https://logo.clearbit.com/bsnl.co.in",
    fallback: "https://www.google.com/s2/favicons?domain=bsnl.co.in&sz=64",
    alt: "BSNL",
  },
  ALL_IN_ONE: {
    primary: "https://www.google.com/s2/favicons?domain=paytm.com&sz=64",
    fallback: null,
    alt: "All-in-one",
  },
};

function OperatorLogo({ operator }: { operator: OperatorKey }) {
  const [src, setSrc] = useState(OPERATOR_LOGOS[operator].primary);
  const meta = OPERATOR_LOGOS[operator];

  return (
    <img
      className="operator-logo"
      src={src}
      alt={meta.alt}
      width={26}
      height={26}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => {
        if (src !== meta.fallback && meta.fallback) setSrc(meta.fallback);
      }}
    />
  );
}

export default function RechargePage() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [dateFilter, setDateFilter] = useState<string | "">("");
  const [operatorFilter, setOperatorFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [operator, setOperator] = useState<RechargeOperator>("AIRTEL");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [amounts, setAmounts] = useState(EMPTY_AMOUNTS);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["recharge-entries", monthId, page, pageSize, dateFilter],
    queryFn: () => api.getRechargeEntries(monthId!, page, dateFilter || undefined, pageSize),
    enabled: !!monthId,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const entries = (data?.data ?? []) as RechargeRow[];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const totalTx = meta?.total ?? entries.length;

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (operatorFilter !== "ALL" && e.operator !== operatorFilter) return false;
      if (typeFilter !== "ALL" && !rechargeEntryHasType(e, typeFilter)) return false;
      if (!searchDebounced) return true;
      const hay = `${e.operator} ${formatRechargeTypeLabel(e)} ${e.amount} ${e.date} ${e.note ?? ""}`.toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [entries, operatorFilter, typeFilter, searchDebounced]);

  const pageTotal = sumMoney(filteredEntries.map((r) => r.amount));
  const todayTotal = sumMoney(
    filteredEntries.filter((r) => r.date === today).map((r) => r.amount),
  );

  const showingFrom = Math.min((page - 1) * pageSize + 1, totalTx || 0);
  const showingTo = Math.min(page * pageSize, totalTx || 0);

  const create = useMutation({
    mutationFn: () =>
      api.createRechargeEntry(monthId!, {
        date,
        operator,
        rechargeAmount: parseMoneyInput(rechargeAmount),
        saleProfit: parseMoneyInput(amounts.saleProfit),
        chillar: parseMoneyInput(amounts.chillar),
        act: parseMoneyInput(amounts.act),
        mnp: parseMoneyInput(amounts.mnp),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setOpen(false);
      setRechargeAmount("");
      setAmounts(EMPTY_AMOUNTS);
    },
  });

  const update = useMutation({
    mutationFn: ({ entryId, draft }: { entryId: string; draft: EditDraft }) =>
      api.updateRechargeEntry(monthId!, entryId, {
        date: draft.date,
        operator: draft.operator,
        rechargeAmount: parseMoneyInput(draft.rechargeAmount),
        saleProfit: parseMoneyInput(draft.saleProfit),
        chillar: parseMoneyInput(draft.chillar),
        act: parseMoneyInput(draft.act),
        mnp: parseMoneyInput(draft.mnp),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditingId(null);
      setEditDraft(null);
      update.reset();
    },
  });

  const del = useMutation({
    mutationFn: (entryId: string) => api.deleteRechargeEntry(monthId!, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTargetId(null);
      setOpenMenuId(null);
    },
  });

  const startEdit = (row: RechargeRow) => {
    setEditingId(row.id);
    setEditDraft(rowToDraft(row));
    setOpenMenuId(null);
  };

  const closeEdit = () => {
    setEditingId(null);
    setEditDraft(null);
    update.reset();
  };

  return (
    <MonthGate>
    <div className="recharge-page">
      <PageHeader
        title="Recharge"
        subtitle="Manage recharge transactions"
        action={
          <div className="recharge-top-actions">
            <div className="recharge-search">
              <Search size={16} />
              <input
                placeholder="Search by operator / type / note / amount…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      />

      {!isLoading && !error && (
        <div className="recharge-stats">
          <div className="recharge-stat card blue">
            <div className="recharge-stat-icon blue">
              <Smartphone size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Today’s Recharge</div>
              <div className="stat-value">{formatMoney(String(todayTotal))}</div>
              <div className="muted">{filteredEntries.filter((r) => r.date === today).length} Transactions</div>
            </div>
          </div>

          <div className="recharge-stat card green">
            <div className="recharge-stat-icon green">
              <Zap size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">This Month</div>
              <div className="stat-value">{formatMoney(String(pageTotal))}</div>
              <div className="muted">{totalTx} Transactions</div>
            </div>
          </div>

        </div>
      )}

      <div className="recharge-card card">
        <div className="recharge-toolbar">
          <div className="recharge-toolbar-left">
            <div className="recharge-date">
              <span className="recharge-date-icon" aria-hidden="true">
                <Calendar size={16} />
              </span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value);
                  setPage(1);
                }}
              />
              {dateFilter && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setDateFilter("");
                    setPage(1);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <select
              className="recharge-select"
              value={operatorFilter}
              onChange={(e) => {
                setOperatorFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Operators</option>
              {RECHARGE_OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <select
              className="recharge-select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Types</option>
              {RECHARGE_AMOUNT_FIELDS.map((t) => (
                <option key={t.entryType} value={t.entryType}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="recharge-card-actions">
            <button type="button" className="secondary" onClick={() => {}} title="Export (coming soon)">
              <Download size={16} /> Export
            </button>
            <button
              type="button"
              onClick={() => {
                setRechargeAmount("");
                setAmounts(EMPTY_AMOUNTS);
                setOpen(true);
              }}
            >
              + Create Recharge
            </button>
          </div>
        </div>
      {isLoading && <PageLoader message="Loading entries…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && data && filteredEntries.length === 0 && !isFetching && (
        <EmptyState
          title="No recharge entries found"
          description="Try clearing filters or use Create Recharge above."
        />
      )}

      {!isLoading && !error && (
        <div className="data-table-wrap">
          <table className="data-list recharge-table">
            <colgroup>
              <col className="col-date" />
              <col className="col-operator" />
              <col className="col-type" />
              <col className="col-recharge" />
              <col className="col-profit" />
              <col className="col-status" />
              <col className="col-action" />
            </colgroup>
            <thead>
              <tr>
                <th className="col-date">Date</th>
                <th className="col-operator">Operator</th>
                <th className="col-type">Type</th>
                <th className="col-recharge">Recharge</th>
                <th className="col-profit">Profit / Chillar</th>
                <th className="col-status">Status</th>
                <th className="col-action">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((r) => (
                <tr key={r.id}>
                  <td className="col-date">
                    <div className="recharge-datecell-date">{r.date}</div>
                  </td>
                  <td className="col-operator">
                    <div className="recharge-operator">
                      {RECHARGE_OPERATORS.includes(r.operator as OperatorKey) ? (
                        <OperatorLogo operator={r.operator as OperatorKey} />
                      ) : (
                        <span
                          className={`recharge-op-bubble op-${String(r.operator).toLowerCase()}`}
                          aria-hidden="true"
                        />
                      )}
                      <span>{r.operator}</span>
                    </div>
                  </td>
                  <td className="col-type">
                    <span className="badge recharge-type">{formatRechargeTypeLabel(r)}</span>
                  </td>
                  <td className="col-recharge">
                    {r.rechargeAmount ? formatMoney(r.rechargeAmount) : ""}
                  </td>
                  <td className="col-profit">{formatProfitBreakdown(r)}</td>
                  <td className="col-status">
                    <span className="recharge-status">
                      <span className="recharge-status-dot" aria-hidden="true" />
                      <span className="ok">Success</span>
                    </span>
                  </td>
                  <td className="col-action">
                    <RowActionMenu
                      open={openMenuId === r.id}
                      disabled={del.isPending || update.isPending}
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
                          onClick: () => setDeleteTargetId(r.id),
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

      <div className="recharge-footer">
        <div className="recharge-footer-left muted">
          Showing {totalTx ? `${showingFrom}-${showingTo}` : "0"} of {totalTx}
        </div>
        <div className="recharge-footer-right">
          <div className="recharge-pages muted" style={{ fontSize: 12 }}>
            Page {page} / {totalPages}
          </div>
          <div className="recharge-pages">
            <button
              type="button"
              className="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <button
              type="button"
              className="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
          <select
            className="recharge-page-size"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
              setPage(1);
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / page
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
      <p className="muted">
        <Link href={`/months`} className="link-muted">Advanced: month grid</Link>
      </p>
      <FormModal open={!!editingId && !!editDraft} title="Edit recharge" onClose={closeEdit}>
        {editDraft && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (editingId) update.mutate({ entryId: editingId, draft: editDraft });
            }}
          >
            <label className="stat-label">Date</label>
            <input
              type="date"
              value={editDraft.date}
              onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, date: e.target.value } : prev))}
            />

            <label className="stat-label">Operator</label>
            <select
              value={editDraft.operator}
              onChange={(e) =>
                setEditDraft((prev) =>
                  prev ? { ...prev, operator: e.target.value as RechargeOperator } : prev,
                )
              }
            >
              {RECHARGE_OPERATORS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            <label className="stat-label">Recharge Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="e.g. 249 or 299"
              value={editDraft.rechargeAmount}
              onChange={(e) =>
                setEditDraft((prev) => (prev ? { ...prev, rechargeAmount: e.target.value } : prev))
              }
              required
            />

            <div className="stat-label">Income (₹) — leave blank for 0</div>
            <div className="recharge-amount-grid">
              {RECHARGE_AMOUNT_FIELDS.map((field) => (
                <label key={field.key} className="recharge-amount-field">
                  <span>{field.label}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={editDraft[field.key]}
                    onChange={(e) =>
                      setEditDraft((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))
                    }
                  />
                </label>
              ))}
            </div>

            {update.error && <p className="error">{(update.error as Error).message}</p>}
            <button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FormModal>

      <FormModal open={open} title="Add recharge" onClose={() => setOpen(false)}>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="stat-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label className="stat-label">Operator</label>
          <select value={operator} onChange={(e) => setOperator(e.target.value as RechargeOperator)}>
            {RECHARGE_OPERATORS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <label className="stat-label">Recharge Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            placeholder="e.g. 249 or 299"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(e.target.value)}
            required
          />

          <div className="stat-label">Income (₹) — leave blank for 0</div>
          <div className="recharge-amount-grid">
            {RECHARGE_AMOUNT_FIELDS.map((field) => (
              <label key={field.key} className="recharge-amount-field">
                <span>{field.label}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={amounts[field.key]}
                  onChange={(e) =>
                    setAmounts((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>

          {create.error && <p className="error">{(create.error as Error).message}</p>}
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </button>
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!deleteTargetId}
        title="Remove recharge?"
        message="Remove this recharge from the list? Past totals will be updated. The record is kept hidden, not permanently erased."
        loading={del.isPending}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && del.mutate(deleteTargetId)}
        confirmLabel="Remove"
      />

    </div>
    </MonthGate>
  );
}
