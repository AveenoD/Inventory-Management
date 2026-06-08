"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  REPAIR_STATUS_LABELS,
  repairCountsInProfit,
  type RepairJobDto,
  type RepairJobStatus,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Calendar, Clock, IndianRupee, Search, Trash2, Wrench } from "lucide-react";
import { formatMoney, parseMoneyInput } from "@/lib/format";

type Tab = "all" | "active" | "pending" | "delivered" | "unrepairable";

const PART_OTHER = "__other__";

function moneyFieldValue(amount: string | undefined) {
  const n = parseMoneyInput(amount || "");
  return n > 0 ? String(n) : "";
}

const TABS: { key: Tab; label: string; status?: RepairJobStatus }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In shop" },
  { key: "pending", label: "Pending pickup", status: "REPAIRED_PENDING_PICKUP" },
  { key: "delivered", label: "Delivered", status: "DELIVERED" },
  { key: "unrepairable", label: "Unrepairable", status: "UNREPAIRABLE_RETURNED" },
];

function statusBadgeClass(status: string) {
  if (status === "REPAIRED_PENDING_PICKUP") return "badge warning";
  if (status === "DELIVERED") return "badge ok";
  if (status === "UNREPAIRABLE_RETURNED") return "badge";
  return "badge";
}

export default function RepairPage() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<Tab>("all");
  const [filterDate, setFilterDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [actionJob, setActionJob] = useState<RepairJobDto | null>(null);
  const [actionKind, setActionKind] = useState<
    "complete" | "deliver" | null
  >(null);

  const [date, setDate] = useState(today);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [device, setDevice] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [intakeRepairCost, setIntakeRepairCost] = useState("");
  const [intakeCustomerCharge, setIntakeCustomerCharge] = useState("");

  const [repairCost, setRepairCost] = useState("");
  const [customerCharge, setCustomerCharge] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [otherPartName, setOtherPartName] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(today);
  const [deleteTarget, setDeleteTarget] = useState<RepairJobDto | null>(null);

  const tabDef = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    if (searchParams.get("intake") !== "1") return;
    setIntakeOpen(true);
    router.replace("/repair", { scroll: false });
  }, [searchParams, router]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["repair-jobs", monthId, tabDef.status ?? "all", filterDate],
    queryFn: () =>
      api.getRepairJobs(monthId!, 1, {
        ...(tabDef.status && { status: tabDef.status }),
        ...(filterDate && { date: filterDate }),
      }),
    enabled: !!monthId,
  });

  const { data: repairPartsData } = useQuery({
    queryKey: ["products", "REPAIR_PART"],
    queryFn: () => api.getProducts(1, undefined, "REPAIR_PART", 100),
  });

  const repairParts = repairPartsData?.data ?? [];

  const { data: todayData } = useQuery({
    queryKey: ["today"],
    queryFn: () => api.getToday(),
    enabled: !!monthId,
  });

  const jobs: RepairJobDto[] = data?.data ?? [];
  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (tab === "active") {
      list = list.filter((j) => j.status === "RECEIVED" || j.status === "IN_PROGRESS");
    }
    if (customerSearchDebounced) {
      list = list.filter((j) =>
        (j.customerName ?? "").toLowerCase().includes(customerSearchDebounced),
      );
    }
    return list;
  }, [jobs, tab, customerSearchDebounced]);

  const hasActiveFilters = !!filterDate || customerSearchDebounced.length > 0;

  const pendingSummary = useMemo(
    () => ({
      count: todayData?.repairPendingCount ?? 0,
      balance: parseMoneyInput(todayData?.repairPendingBalance ?? "0"),
    }),
    [todayData],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repair-jobs", monthId] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["today"] });
    qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
  };

  const intake = useMutation({
    mutationFn: () =>
      api.createRepairIntake(monthId!, {
        date,
        customerName,
        customerPhone: customerPhone || undefined,
        device,
        issueDescription,
        repairCost: parseMoneyInput(intakeRepairCost),
        customerCharge: parseMoneyInput(intakeCustomerCharge),
      }),
    onSuccess: () => {
      invalidate();
      setIntakeOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setDevice("");
      setIssueDescription("");
      setIntakeRepairCost("");
      setIntakeCustomerCharge("");
    },
  });

  const removeJob = useMutation({
    mutationFn: (jobId: string) => api.deleteRepairJob(monthId!, jobId),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: (payload: {
      jobId: string;
      status: RepairJobStatus;
      repairCost?: number;
      customerCharge?: number;
      partsUsed?: Array<{ productId: string; quantity: number }>;
      otherPartUsed?: string;
      deliveredAt?: string;
    }) =>
      api.updateRepairJob(monthId!, payload.jobId, {
        status: payload.status,
        repairCost: payload.repairCost,
        customerCharge: payload.customerCharge,
        partsUsed: payload.partsUsed,
        otherPartUsed: payload.otherPartUsed,
        deliveredAt: payload.deliveredAt,
      }),
    onSuccess: () => {
      invalidate();
      setActionJob(null);
      setActionKind(null);
      setRepairCost("");
      setCustomerCharge("");
      setSelectedPartId("");
      setOtherPartName("");
    },
  });

  function openComplete(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("complete");
    setRepairCost(moneyFieldValue(job.repairCost));
    setCustomerCharge(moneyFieldValue(job.customerCharge || job.salePrice));
    if (job.otherPartUsed) {
      setSelectedPartId(PART_OTHER);
      setOtherPartName(job.otherPartUsed);
    } else {
      setSelectedPartId(job.partsUsed?.[0]?.productId ?? "");
      setOtherPartName("");
    }
  }

  function handlePartChange(partId: string) {
    setSelectedPartId(partId);
    if (partId === PART_OTHER) return;
    if (!partId) {
      setOtherPartName("");
      return;
    }
    setOtherPartName("");
    const part = repairParts.find((p) => p.id === partId);
    if (part) {
      setRepairCost(moneyFieldValue(part.buyPrice));
    }
  }

  function openDeliver(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("deliver");
    setDeliveredAt(today);
  }

  return (
    <MonthGate>
      <div className="repair-page">
        <PageHeader
          title="Repair"
          subtitle="Intake → repair → pickup → profit on delivery"
          action={
            <div className="repair-top-actions">
              <div className="recharge-search repair-search">
                <Search size={16} />
                <input
                  placeholder="Search customer…"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  aria-label="Search by customer name"
                />
              </div>
              <button type="button" onClick={() => setIntakeOpen(true)}>
                + New intake
              </button>
            </div>
          }
        />

        <div className="recharge-stats repair-stats">
          <div className="recharge-stat card amber">
            <div className="recharge-stat-icon amber">
              <Clock size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Pending pickup</div>
              <div className="stat-value">{pendingSummary.count}</div>
              <div className="muted">Ready for customer</div>
            </div>
          </div>

          <div className="recharge-stat card purple">
            <div className="recharge-stat-icon purple">
              <IndianRupee size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Pending balance</div>
              <div className="stat-value">{formatMoney(String(pendingSummary.balance))}</div>
              <div className="muted">To collect on pickup</div>
            </div>
          </div>

          <div className="recharge-stat card green">
            <div className="recharge-stat-icon green">
              <Wrench size={18} />
            </div>
            <div className="recharge-stat-body">
              <div className="stat-label">Today&apos;s profit</div>
              <div className="stat-value positive">
                {formatMoney(todayData?.repairProfit ?? "0")}
              </div>
              <div className="muted">
                {todayData?.repairDelivered ?? 0} delivered today
              </div>
            </div>
          </div>
        </div>

        <div className="repair-filter-card card">
          <div className="inventory-tabs repair-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={tab === t.key ? "tab active" : "tab"}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="repair-filter-date">
            <div className="recharge-date">
              <span className="recharge-date-icon" aria-hidden="true">
                <Calendar size={16} />
              </span>
              <input
                id="repair-filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                aria-label="Filter by date"
              />
            </div>
            {filterDate ? (
              <button
                type="button"
                className="secondary repair-clear-date"
                onClick={() => setFilterDate("")}
              >
                All dates
              </button>
            ) : null}
          </div>
        </div>

        {isLoading && <PageLoader message="Loading jobs…" />}
        {error && (
          <div className="card error-card">
            <p className="error">{(error as Error).message}</p>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && filteredJobs.length === 0 && (
          <EmptyState
            title={hasActiveFilters ? "No matching jobs" : "No repair jobs"}
            description={
              hasActiveFilters
                ? "Try a different date or customer name, or clear filters."
                : "Register a phone when the customer drops it off for repair."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setFilterDate("");
                    setCustomerSearch("");
                  }}
                >
                  Clear filters
                </button>
              ) : (
                <button type="button" onClick={() => setIntakeOpen(true)}>
                  New intake
                </button>
              )
            }
          />
        )}
        {!isLoading && !error && filteredJobs.length > 0 && (
          <div className="data-table-wrap repair-table-wrap">
            <table className="data-list repair-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Issue</th>
                  <th>Part used</th>
                  <th>Repair cost</th>
                  <th>Customer charge</th>
                  <th>Profit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td>
                      <span className={statusBadgeClass(r.status)}>
                        {REPAIR_STATUS_LABELS[r.status as RepairJobStatus] ?? r.status}
                      </span>
                    </td>
                    <td>
                      <div className="repair-customer">{r.customerName ?? "—"}</div>
                      {r.customerPhone ? (
                        <div className="repair-customer-phone muted">{r.customerPhone}</div>
                      ) : null}
                    </td>
                    <td className="repair-device">{r.device ?? "—"}</td>
                    <td className="repair-issue">{r.issueDescription ?? "—"}</td>
                    <td>
                      {r.partsUsed?.length
                        ? r.partsUsed.map((p) => p.productName).join(", ")
                        : r.otherPartUsed
                          ? `${r.otherPartUsed} (other)`
                          : "—"}
                    </td>
                    <td>
                      {r.status === "UNREPAIRABLE_RETURNED" ? "—" : formatMoney(r.repairCost)}
                    </td>
                    <td>
                      {r.status === "UNREPAIRABLE_RETURNED"
                        ? "—"
                        : formatMoney(r.customerCharge || r.salePrice)}
                    </td>
                    <td className={repairCountsInProfit(r.status as RepairJobStatus) ? "positive" : ""}>
                      {repairCountsInProfit(r.status as RepairJobStatus)
                        ? formatMoney(r.profit)
                        : r.status === "REPAIRED_PENDING_PICKUP"
                          ? "On pickup"
                          : "—"}
                    </td>
                    <td>
                      <div className="repair-row-actions">
                        {r.status === "RECEIVED" && (
                          <>
                            <button
                              type="button"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                updateStatus.mutate({ jobId: r.id, status: "IN_PROGRESS" })
                              }
                            >
                              Start repair
                            </button>
                            <button
                              type="button"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                updateStatus.mutate({
                                  jobId: r.id,
                                  status: "UNREPAIRABLE_RETURNED",
                                })
                              }
                            >
                              Unrepairable
                            </button>
                          </>
                        )}
                        {r.status === "IN_PROGRESS" && (
                          <>
                            <button
                              type="button"
                              onClick={() => openComplete(r)}
                            >
                              Repair done
                            </button>
                            <button
                              type="button"
                              disabled={updateStatus.isPending}
                              onClick={() =>
                                updateStatus.mutate({
                                  jobId: r.id,
                                  status: "UNREPAIRABLE_RETURNED",
                                })
                              }
                            >
                              Unrepairable
                            </button>
                          </>
                        )}
                        {r.status === "REPAIRED_PENDING_PICKUP" && (
                          <button
                            type="button"
                            className="btn-sm"
                            onClick={() => openDeliver(r)}
                          >
                            Customer picked up
                          </button>
                        )}
                        <button
                          type="button"
                          className="inventory-stock-btn danger"
                          title="Delete job"
                          aria-label="Delete repair job"
                          onClick={() => setDeleteTarget(r)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <FormModal
          open={intakeOpen}
          title="New repair intake"
          subtitle="Register a device dropped off for repair."
          size="lg"
          onClose={() => setIntakeOpen(false)}
        >
          <form
            className="modal-form"
            onSubmit={(e) => {
              e.preventDefault();
              intake.mutate();
            }}
          >
            <section className="form-step">
              <div className="form-step__head">
                <span className="form-step__num">1</span>
                <span className="form-step__title">Customer</span>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label className="form-field__label" htmlFor="intake-date">
                    Date received
                  </label>
                  <input
                    id="intake-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="intake-phone">
                    Phone <span className="form-field__optional">(optional)</span>
                  </label>
                  <input
                    id="intake-phone"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="e.g. 98765 43210"
                  />
                </div>
              </div>
              <div className="form-field" style={{ marginTop: "0.85rem" }}>
                <label className="form-field__label" htmlFor="intake-customer">
                  Customer name
                </label>
                <input
                  id="intake-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                />
              </div>
            </section>

            <section className="form-step">
              <div className="form-step__head">
                <span className="form-step__num">2</span>
                <span className="form-step__title">Device & issue</span>
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="intake-device">
                  Device / model
                </label>
                <input
                  id="intake-device"
                  value={device}
                  onChange={(e) => setDevice(e.target.value)}
                  placeholder="e.g. Redmi Note 13, iPhone 12"
                  required
                />
              </div>
              <div className="form-field" style={{ marginTop: "0.85rem" }}>
                <label className="form-field__label" htmlFor="intake-issue">
                  Issue description
                </label>
                <textarea
                  id="intake-issue"
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  rows={3}
                  placeholder="Display broken, battery drain, charging issue…"
                  required
                />
              </div>
            </section>

            <section className="form-step">
              <div className="form-step__head">
                <span className="form-step__num">3</span>
                <span className="form-step__title">Pricing</span>
              </div>
              <p className="muted form-step__hint" style={{ marginTop: 0 }}>
                Estimate now — exact part & cost update when repair is done.
              </p>
              <div className="form-row" style={{ marginTop: "0.85rem" }}>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="intake-repair-cost">
                    Repair cost (your cost)
                  </label>
                  <input
                    id="intake-repair-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={intakeRepairCost}
                    onChange={(e) => setIntakeRepairCost(e.target.value)}
                    placeholder="e.g. 500"
                  />
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="intake-customer-charge">
                    Customer charge
                  </label>
                  <input
                    id="intake-customer-charge"
                    type="number"
                    step="0.01"
                    min="0"
                    value={intakeCustomerCharge}
                    onChange={(e) => setIntakeCustomerCharge(e.target.value)}
                    placeholder="e.g. 1200"
                  />
                </div>
              </div>
            </section>

            {intake.error && <p className="error">{(intake.error as Error).message}</p>}
            <div className="modal-footer">
              <button type="button" className="secondary" onClick={() => setIntakeOpen(false)}>
                Cancel
              </button>
              <button type="submit" disabled={intake.isPending}>
                {intake.isPending ? "Saving…" : "Save intake"}
              </button>
            </div>
          </form>
        </FormModal>

        <FormModal
          open={!!actionJob && actionKind === "complete"}
          title="Repair completed"
          subtitle="Mark ready for customer pickup."
          size="lg"
          onClose={() => {
            setActionJob(null);
            setActionKind(null);
          }}
        >
          {actionJob && (
            <form
              className="modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                const isOther = selectedPartId === PART_OTHER;
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "REPAIRED_PENDING_PICKUP",
                  repairCost: parseMoneyInput(repairCost),
                  customerCharge: parseMoneyInput(customerCharge),
                  partsUsed:
                    selectedPartId && !isOther
                      ? [{ productId: selectedPartId, quantity: 1 }]
                      : [],
                  otherPartUsed: isOther ? otherPartName.trim() : undefined,
                });
              }}
            >
              <p className="dash-hint" style={{ margin: 0 }}>
                <strong>{actionJob.device}</strong> — {actionJob.customerName}. Profit counts only
                after pickup.
              </p>

              <section className="form-step">
                <div className="form-step__head">
                  <span className="form-step__num">1</span>
                  <span className="form-step__title">Part used</span>
                </div>
                <div className="form-field">
                  <label className="form-field__label" htmlFor="complete-part">
                    Select from inventory
                  </label>
                  <select
                    id="complete-part"
                    value={selectedPartId}
                    onChange={(e) => handlePartChange(e.target.value)}
                  >
                    <option value="">None — no part from stock</option>
                    {repairParts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.stockQty} in stock · cost {formatMoney(p.buyPrice)})
                      </option>
                    ))}
                    <option value={PART_OTHER}>Other — part ordered / not in stock</option>
                  </select>
                </div>
                {selectedPartId === PART_OTHER && (
                  <div className="form-field" style={{ marginTop: "0.85rem" }}>
                    <label className="form-field__label" htmlFor="complete-other-part">
                      What part was used?
                    </label>
                    <input
                      id="complete-other-part"
                      value={otherPartName}
                      onChange={(e) => setOtherPartName(e.target.value)}
                      placeholder="e.g. Charging flex cable, back glass"
                      required
                    />
                    <p className="muted form-step__hint">
                      Not from shop inventory — stock will not change.
                    </p>
                  </div>
                )}
                {repairParts.length === 0 && selectedPartId !== PART_OTHER && (
                  <p className="muted form-step__hint">
                    No repair parts in inventory. Add under Inventory → Add product → Repair Part,
                    or choose Other.
                  </p>
                )}
                {selectedPartId && selectedPartId !== PART_OTHER && (
                  <p className="muted form-step__hint">
                    Stock will reduce by 1 when you save.
                  </p>
                )}
              </section>

              <section className="form-step">
                <div className="form-step__head">
                  <span className="form-step__num">2</span>
                  <span className="form-step__title">Final pricing</span>
                </div>
                <div className="form-row">
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="complete-repair-cost">
                      Repair cost (your cost)
                    </label>
                    <input
                      id="complete-repair-cost"
                      type="number"
                      step="0.01"
                      min="0"
                      value={repairCost}
                      onChange={(e) => setRepairCost(e.target.value)}
                      placeholder="e.g. 500"
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="complete-customer-charge">
                      Customer charge
                    </label>
                    <input
                      id="complete-customer-charge"
                      type="number"
                      step="0.01"
                      min="0"
                      value={customerCharge}
                      onChange={(e) => setCustomerCharge(e.target.value)}
                      placeholder="e.g. 1200"
                      required
                    />
                  </div>
                </div>
              </section>

              {updateStatus.error && (
                <p className="error">{(updateStatus.error as Error).message}</p>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setActionJob(null);
                    setActionKind(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={updateStatus.isPending}>
                  {updateStatus.isPending ? "Saving…" : "Mark ready for pickup"}
                </button>
              </div>
            </form>
          )}
        </FormModal>

        <FormModal
          open={!!actionJob && actionKind === "deliver"}
          title="Customer picked up"
          subtitle="Record delivery and count profit."
          onClose={() => {
            setActionJob(null);
            setActionKind(null);
          }}
        >
          {actionJob && (
            <form
              className="modal-form"
              onSubmit={(e) => {
                e.preventDefault();
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "DELIVERED",
                  deliveredAt,
                });
              }}
            >
              <p className="dash-hint" style={{ margin: 0 }}>
                Charge <strong>{formatMoney(actionJob.customerCharge || actionJob.salePrice)}</strong>{" "}
                will count in today&apos;s repair profit and monthly net profit.
              </p>

              <div className="form-field">
                <label className="form-field__label" htmlFor="deliver-date">
                  Delivery date
                </label>
                <input
                  id="deliver-date"
                  type="date"
                  value={deliveredAt}
                  onChange={(e) => setDeliveredAt(e.target.value)}
                  required
                />
              </div>

              {updateStatus.error && (
                <p className="error">{(updateStatus.error as Error).message}</p>
              )}
              <div className="modal-footer">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setActionJob(null);
                    setActionKind(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" disabled={updateStatus.isPending}>
                  {updateStatus.isPending ? "Saving…" : "Mark delivered"}
                </button>
              </div>
            </form>
          )}
        </FormModal>

        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete repair job?"
          message={
            deleteTarget
              ? `Remove repair for ${deleteTarget.device ?? "this device"} permanently? Used parts will be returned to stock.`
              : ""
          }
          loading={removeJob.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && removeJob.mutate(deleteTarget.id)}
        />
      </div>
    </MonthGate>
  );
}
