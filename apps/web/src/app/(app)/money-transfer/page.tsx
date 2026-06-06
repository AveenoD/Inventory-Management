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
import { formatMoney, parseMoneyInput, sumMoney } from "@/lib/format";
import { Calendar, Download, MoreVertical, Search } from "lucide-react";

type TransferRow = {
  id: string;
  date: string;
  serviceKey: string;
  amount: string;
  note?: string | null;
};

const PAGE_SIZES = [10, 25, 50] as const;
const DEFAULT_CATEGORY: TransferCategoryId = "dmt99";

export default function MoneyTransferPage() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState<TransferCategoryId>(DEFAULT_CATEGORY);
  const [serviceKey, setServiceKey] = useState<TransferServiceKey>(
    getSubServicesForCategory(DEFAULT_CATEGORY)[0]!.key,
  );
  const [amount, setAmount] = useState("");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10);
  const [dateFilter, setDateFilter] = useState<string | "">("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [subFilter, setSubFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const subServices = getSubServicesForCategory(categoryId);
  const filterSubServices =
    categoryFilter === "ALL"
      ? TRANSFER_SERVICES
      : getSubServicesForCategory(categoryFilter as TransferCategoryId).map((sub) => {
          const cat = TRANSFER_CATEGORIES.find((c) => c.id === categoryFilter)!;
          return { key: sub.key, label: `${cat.label} — ${sub.label}` };
        });

  function handleCategoryChange(nextCategory: TransferCategoryId) {
    setCategoryId(nextCategory);
    const subs = getSubServicesForCategory(nextCategory);
    if (subs[0]) setServiceKey(subs[0].key);
  }

  function handleSubServiceChange(nextKey: TransferServiceKey) {
    setServiceKey(nextKey);
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
    mutationFn: () =>
      api.createTransferEntry(monthId!, {
        date,
        serviceKey,
        amount: parseMoneyInput(amount),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setOpen(false);
      setAmount("");
    },
  });

  const del = useMutation({
    mutationFn: (entryId: string) => api.deleteTransferEntry(monthId!, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
    },
  });

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
    setCategoryId(DEFAULT_CATEGORY);
    setServiceKey(getSubServicesForCategory(DEFAULT_CATEGORY)[0]!.key);
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
            <button type="button" className="transfer-add-btn" onClick={openAddModal}>
              + Add Transfer
            </button>
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

      {isLoading && <PageLoader message="Loading entries…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && filteredEntries.length === 0 && !isFetching && (
        <EmptyState
          title="No transfer entries yet"
          description="Add DMT, AEPS, or other money transfer records for this month."
          action={
            <button type="button" onClick={openAddModal}>
              Add transfer
            </button>
          }
        />
      )}

      {!isLoading && !error && filteredEntries.length > 0 && (
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
            </div>
          </div>

          <div className="transfer-table-desktop data-table-wrap">
            <table className="data-list transfer-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Service</th>
                  <th>Sub-type</th>
                  <th className="right">Amount (₹)</th>
                  <th className="right">Action</th>
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
                      <td>{r.date}</td>
                      <td><span className="transfer-service-name">{catLabel}</span></td>
                      <td className="muted">{subLabel}</td>
                      <td className="right">{formatMoney(r.amount)}</td>
                      <td className="right">
                        <button
                          type="button"
                          className="icon-btn"
                          title="Delete"
                          disabled={del.isPending}
                          onClick={() => del.mutate(r.id)}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
                    <span className="muted">{r.date}</span>
                    <button
                      type="button"
                      className="secondary transfer-entry-card__delete"
                      disabled={del.isPending}
                      onClick={() => del.mutate(r.id)}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

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
      )}

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

          <label className="stat-label">Sub-type</label>
          <select
            value={serviceKey}
            onChange={(e) => handleSubServiceChange(e.target.value as TransferServiceKey)}
          >
            {subServices.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <label className="stat-label">Amount (₹)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />

          {create.error && <p className="error">{(create.error as Error).message}</p>}
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </button>
        </form>
      </FormModal>
    </div>
    </MonthGate>
  );
}
