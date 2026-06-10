"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TRANSFER_CATEGORIES,
  TRANSFER_SERVICES,
  getTransferLabel,
  getCategoryForKey,
  getSubServicesForCategory,
  type TransferCategoryId,
  type TransferServiceKey,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowActionMenu } from "@/components/ui/row-action-menu";
import { formatMoney, parseMoneyInput, sumMoney } from "@/lib/format";
import { Calendar, Download, Search } from "lucide-react";

type TransferRow = {
  id: string;
  date: string;
  serviceKey: string;
  amount: string;
  note?: string | null;
};

const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_CATEGORY: TransferCategoryId = "dmt99";

type EditDraft = {
  date: string;
  categoryId: TransferCategoryId;
  serviceKey: TransferServiceKey;
  amount: string;
  note: string;
};

function rowToEditDraft(row: TransferRow): EditDraft {
  const categoryId = getCategoryForKey(row.serviceKey) ?? DEFAULT_CATEGORY;
  return {
    date: row.date,
    categoryId,
    serviceKey: row.serviceKey as TransferServiceKey,
    amount: row.amount,
    note: row.note ?? "",
  };
}

function emptyAmountsFor(categoryId: TransferCategoryId): Record<string, string> {
  return Object.fromEntries(
    getSubServicesForCategory(categoryId).map((sub) => [sub.key, ""]),
  );
}

export default function MoneyTransferPage() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState<TransferCategoryId>(DEFAULT_CATEGORY);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    emptyAmountsFor(DEFAULT_CATEGORY),
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [dateFilter, setDateFilter] = useState<string | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const amountFields = getSubServicesForCategory(categoryId);
  const filterSubServices =
    categoryFilter === "ALL"
      ? TRANSFER_SERVICES
      : getSubServicesForCategory(categoryFilter as TransferCategoryId).map((sub) => {
          const cat = TRANSFER_CATEGORIES.find((c) => c.id === categoryFilter)!;
          return { key: sub.key, label: `${cat.label} — ${sub.label}` };
        });

  function handleCategoryChange(nextCategory: TransferCategoryId) {
    setCategoryId(nextCategory);
    setAmounts(emptyAmountsFor(nextCategory));
  }

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["transfer-entries", monthId, page, dateFilter],
    queryFn: () => api.getTransferEntries(monthId!, page, dateFilter || undefined),
    enabled: !!monthId,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const entries = (data?.data ?? []) as TransferRow[];
  const meta = data?.meta;
  const totalTx = meta?.total ?? entries.length;

  const create = useMutation({
    mutationFn: async () => {
      const subs = getSubServicesForCategory(categoryId);
      const payloads = subs
        .map((sub) => ({
          serviceKey: sub.key as TransferServiceKey,
          amount: parseMoneyInput(amounts[sub.key] ?? ""),
        }))
        .filter((p) => p.amount > 0);

      if (payloads.length === 0) {
        throw new Error("Enter at least one amount greater than 0");
      }

      for (const p of payloads) {
        await api.createTransferEntry(monthId!, { date, serviceKey: p.serviceKey, amount: p.amount });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setOpen(false);
      setAmounts(emptyAmountsFor(categoryId));
    },
  });

  const update = useMutation({
    mutationFn: ({ entryId, draft }: { entryId: string; draft: EditDraft }) =>
      api.updateTransferEntry(monthId!, entryId, {
        date: draft.date,
        serviceKey: draft.serviceKey,
        amount: parseMoneyInput(draft.amount),
        note: draft.note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditingId(null);
      setEditDraft(null);
      update.reset();
    },
  });

  const del = useMutation({
    mutationFn: (entryId: string) => api.deleteTransferEntry(monthId!, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTargetId(null);
      setOpenMenuId(null);
    },
  });

  function startEdit(row: TransferRow) {
    setEditingId(row.id);
    setEditDraft(rowToEditDraft(row));
    setOpenMenuId(null);
  }

  function closeEdit() {
    setEditingId(null);
    setEditDraft(null);
    update.reset();
  }

  function handleEditCategoryChange(nextCategory: TransferCategoryId) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const subs = getSubServicesForCategory(nextCategory);
      return {
        ...prev,
        categoryId: nextCategory,
        serviceKey: (subs[0]?.key ?? prev.serviceKey) as TransferServiceKey,
      };
    });
  }

  const editSubServices = useMemo(() => {
    if (!editDraft) return [];
    const subs = getSubServicesForCategory(editDraft.categoryId);
    if (subs.some((s) => s.key === editDraft.serviceKey)) return subs;
    return [
      ...subs,
      {
        key: editDraft.serviceKey,
        label: getTransferLabel(editDraft.serviceKey).replace(/^[^—]+ — /, ""),
      },
    ];
  }, [editDraft]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const entryCategory = getCategoryForKey(e.serviceKey);
      if (categoryFilter !== "ALL" && entryCategory !== categoryFilter) return false;
      if (subFilter !== "ALL" && e.serviceKey !== subFilter) return false;
      if (!searchDebounced) return true;
      const hay = `${e.serviceKey} ${getTransferLabel(e.serviceKey)} ${e.amount} ${e.date}`.toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [entries, categoryFilter, subFilter, searchDebounced]);

  const pageTotal = sumMoney(filteredEntries.map((r) => r.amount));
  const todayTotal = sumMoney(
    filteredEntries.filter((r) => r.date === today).map((r) => r.amount),
  );

  const localTotalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  const safePage = Math.min(page, localTotalPages);
  const paged = filteredEntries.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showingFrom = Math.min((safePage - 1) * pageSize + 1, filteredEntries.length || 0);
  const showingTo = Math.min(safePage * pageSize, filteredEntries.length || 0);

  function openAddModal() {
    setDate(today);
    setCategoryId(DEFAULT_CATEGORY);
    setAmounts(emptyAmountsFor(DEFAULT_CATEGORY));
    setOpen(true);
  }

  return (
    <MonthGate>
    <div className="money-transfer-page">
      <PageHeader
        title="Money Transfer"
        subtitle="DMT 99, DMT 86, and IME transfer services"
        action={
          <div className="transfer-top-actions">
            <div className="transfer-search">
              <Search size={16} />
              <input
                placeholder="Search by service or amount…"
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
        <div className="transfer-stats">
          <div className="transfer-stat card blue">
            <div className="transfer-stat-icon blue" aria-hidden="true">⇄</div>
            <div className="transfer-stat-body">
              <div className="stat-label">Today&apos;s Transfer</div>
              <div className="stat-value">{formatMoney(todayTotal)}</div>
              <div className="muted">{filteredEntries.filter((r) => r.date === today).length} Transaction</div>
            </div>
          </div>

          <div className="transfer-stat card green">
            <div className="transfer-stat-icon green" aria-hidden="true">↗</div>
            <div className="transfer-stat-body">
              <div className="stat-label">Filtered Total</div>
              <div className="stat-value">{formatMoney(pageTotal)}</div>
              <div className="muted">{totalTx} Transaction</div>
            </div>
          </div>
        </div>
      )}

      <div className="transfer-card card">
        <div className="transfer-toolbar">
          <div className="transfer-toolbar-left">
            <div className="transfer-date">
              <span className="transfer-date-icon" aria-hidden="true">
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
              className="transfer-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setSubFilter("ALL");
                setPage(1);
              }}
            >
              <option value="ALL">All Services</option>
              {TRANSFER_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            <select
              className="transfer-select"
              value={subFilter}
              onChange={(e) => {
                setSubFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">All Sub-types</option>
              {filterSubServices.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          <div className="transfer-card-actions">
            <button type="button" className="secondary" onClick={() => {}} title="Export (coming soon)">
              <Download size={16} /> Export
            </button>
            <button type="button" onClick={openAddModal}>
              + Create Transfer
            </button>
          </div>
        </div>

        {isLoading && <PageLoader message="Loading entries…" />}
        {error && (
          <div className="card error-card">
            <p className="error">{(error as Error).message}</p>
            <button type="button" onClick={() => refetch()}>Retry</button>
          </div>
        )}

        {!isLoading && !error && data && filteredEntries.length === 0 && !isFetching && (
          <EmptyState
            title="No transfer entries found"
            description="Try clearing filters or use Create Transfer above."
          />
        )}

        {!isLoading && !error && (
          <div className="transfer-table-desktop data-table-wrap">
            <table className="data-list transfer-table">
              <colgroup>
                <col className="col-date" />
                <col className="col-service" />
                <col className="col-subtype" />
                <col className="col-amount" />
                <col className="col-status" />
                <col className="col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-date">Date</th>
                  <th className="col-service">Service</th>
                  <th className="col-subtype">Sub-type</th>
                  <th className="col-amount">Amount (₹)</th>
                  <th className="col-status">Status</th>
                  <th className="col-action">Action</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => {
                  const catId = getCategoryForKey(r.serviceKey);
                  const catLabel = TRANSFER_CATEGORIES.find((c) => c.id === catId)?.label ?? "—";
                  const subLabel =
                    TRANSFER_SERVICES.find((s) => s.key === r.serviceKey)?.subLabel ??
                    getTransferLabel(r.serviceKey);
                  return (
                    <tr key={r.id}>
                      <td className="col-date">
                        <div className="transfer-datecell-date">{r.date}</div>
                      </td>
                      <td className="col-service">
                        <span className="transfer-service-name">{catLabel}</span>
                      </td>
                      <td className="col-subtype muted">{subLabel}</td>
                      <td className="col-amount">{formatMoney(r.amount)}</td>
                      <td className="col-status">
                        <span className="transfer-status">
                          <span className="transfer-status-dot" aria-hidden="true" />
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
                              onClick: () => {
                                setOpenMenuId(null);
                                setDeleteTargetId(r.id);
                              },
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && (
          <div className="transfer-card-list">
            {paged.map((r) => {
              const catId = getCategoryForKey(r.serviceKey);
              const catLabel = TRANSFER_CATEGORIES.find((c) => c.id === catId)?.label ?? "—";
              const subLabel =
                TRANSFER_SERVICES.find((s) => s.key === r.serviceKey)?.subLabel ??
                getTransferLabel(r.serviceKey);
              return (
                <article key={r.id} className="transfer-entry-card">
                  <div className="transfer-entry-card__head">
                    <div>
                      <div className="transfer-service-name">{catLabel}</div>
                      <div className="muted transfer-entry-card__sub">{subLabel}</div>
                    </div>
                    <strong>{formatMoney(r.amount)}</strong>
                  </div>
                  <div className="transfer-entry-card__foot">
                    <span className="transfer-status">
                      <span className="transfer-status-dot" aria-hidden="true" />
                      <span className="ok">Success</span>
                    </span>
                    <span className="muted">{r.date}</span>
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
                          onClick: () => {
                            setOpenMenuId(null);
                            setDeleteTargetId(r.id);
                          },
                        },
                      ]}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="transfer-footer">
          <div className="transfer-footer-left muted">
            Showing {filteredEntries.length ? `${showingFrom}-${showingTo}` : "0"} of {filteredEntries.length}
          </div>
          <div className="transfer-footer-right">
            <div className="transfer-pages muted" style={{ fontSize: 12 }}>
              Page {safePage} / {localTotalPages}
            </div>
            <div className="transfer-pages">
              <button
                type="button"
                className="secondary"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                className="secondary"
                disabled={safePage >= localTotalPages}
                onClick={() => setPage((p) => Math.min(localTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
            <select
              className="transfer-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value) as (typeof PAGE_SIZES)[number]);
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>{s} / page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <FormModal open={!!editingId && !!editDraft} title="Edit money transfer" onClose={closeEdit}>
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
              onChange={(e) =>
                setEditDraft((prev) => (prev ? { ...prev, date: e.target.value } : prev))
              }
            />

            <label className="stat-label">Service</label>
            <select
              value={editDraft.categoryId}
              onChange={(e) => handleEditCategoryChange(e.target.value as TransferCategoryId)}
            >
              {TRANSFER_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

            <label className="stat-label">Sub-type</label>
            <select
              value={editDraft.serviceKey}
              onChange={(e) =>
                setEditDraft((prev) =>
                  prev ? { ...prev, serviceKey: e.target.value as TransferServiceKey } : prev,
                )
              }
            >
              {editSubServices.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>

            <label className="stat-label">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={editDraft.amount}
              onChange={(e) =>
                setEditDraft((prev) => (prev ? { ...prev, amount: e.target.value } : prev))
              }
              required
            />

            <label className="stat-label">Note (optional)</label>
            <input
              value={editDraft.note}
              onChange={(e) =>
                setEditDraft((prev) => (prev ? { ...prev, note: e.target.value } : prev))
              }
            />

            {update.error && <p className="error">{(update.error as Error).message}</p>}
            <button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FormModal>

      <FormModal open={open} title="Add money transfer" onClose={() => setOpen(false)}>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <label className="stat-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

          <label className="stat-label">Service</label>
          <select
            value={categoryId}
            onChange={(e) => handleCategoryChange(e.target.value as TransferCategoryId)}
          >
            {TRANSFER_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>

          <div className="stat-label">Amount (₹) — leave blank for 0</div>
          <div className="recharge-amount-grid">
            {amountFields.map((field) => (
              <label key={field.key} className="recharge-amount-field">
                <span>{field.label}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0"
                  value={amounts[field.key] ?? ""}
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
        title="Delete transfer?"
        message="Remove this money transfer entry permanently? This cannot be undone."
        error={del.error ? (del.error as Error).message : null}
        loading={del.isPending}
        onCancel={() => {
          setDeleteTargetId(null);
          del.reset();
        }}
        onConfirm={() => deleteTargetId && del.mutate(deleteTargetId)}
      />
    </div>
    </MonthGate>
  );
}
