"use client";

import { useMemo, useState } from "react";
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
import { StatCard } from "@/components/ui/stat-card";
import { formatMoney } from "@/lib/format";

type Tab = "all" | "active" | "pending" | "delivered" | "unrepairable";

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
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState<Tab>("all");
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
  const [intakeRepairCost, setIntakeRepairCost] = useState("0");
  const [intakeCustomerCharge, setIntakeCustomerCharge] = useState("0");

  const [repairCost, setRepairCost] = useState("0");
  const [customerCharge, setCustomerCharge] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(today);

  const tabDef = TABS.find((t) => t.key === tab)!;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["repair-jobs", monthId, tabDef.status ?? "all"],
    queryFn: () =>
      api.getRepairJobs(monthId!, 1, tabDef.status ? { status: tabDef.status } : undefined),
    enabled: !!monthId,
  });

  const { data: pendingData } = useQuery({
    queryKey: ["repair-jobs", monthId, "REPAIRED_PENDING_PICKUP"],
    queryFn: () =>
      api.getRepairJobs(monthId!, 1, { status: "REPAIRED_PENDING_PICKUP" }),
    enabled: !!monthId,
  });

  const jobs: RepairJobDto[] = data?.data ?? [];
  const filteredJobs = useMemo(() => {
    if (tab !== "active") return jobs;
    return jobs.filter(
      (j) => j.status === "RECEIVED" || j.status === "IN_PROGRESS",
    );
  }, [jobs, tab]);

  const pendingSummary = useMemo(() => {
    const pending = pendingData?.data ?? [];
    const balance = pending.reduce(
      (s, j) => s + parseFloat(j.customerCharge || j.salePrice || "0"),
      0,
    );
    return { count: pending.length, balance };
  }, [pendingData]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repair-jobs", monthId] });
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
        repairCost: parseFloat(intakeRepairCost) || 0,
        customerCharge: parseFloat(intakeCustomerCharge) || 0,
      }),
    onSuccess: () => {
      invalidate();
      setIntakeOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setDevice("");
      setIssueDescription("");
      setIntakeRepairCost("0");
      setIntakeCustomerCharge("0");
    },
  });

  const updateStatus = useMutation({
    mutationFn: (payload: {
      jobId: string;
      status: RepairJobStatus;
      repairCost?: number;
      customerCharge?: number;
      deliveredAt?: string;
    }) =>
      api.updateRepairJob(monthId!, payload.jobId, {
        status: payload.status,
        repairCost: payload.repairCost,
        customerCharge: payload.customerCharge,
        deliveredAt: payload.deliveredAt,
      }),
    onSuccess: () => {
      invalidate();
      setActionJob(null);
      setActionKind(null);
      setRepairCost("0");
      setCustomerCharge("");
    },
  });

  function openComplete(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("complete");
    setRepairCost(job.repairCost || "0");
    setCustomerCharge(job.customerCharge || job.salePrice || "");
  }

  function openDeliver(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("deliver");
    setDeliveredAt(today);
  }

  return (
    <MonthGate>
      <div>
        <PageHeader
          title="Repair"
          subtitle="Intake → repair → pickup → profit on delivery"
          action={
            <button type="button" onClick={() => setIntakeOpen(true)}>
              + New intake
            </button>
          }
        />

        <div className="grid-cards" style={{ marginBottom: "1rem" }}>
          <StatCard
            label="Pending pickup"
            value={pendingSummary.count}
            tone={pendingSummary.count > 0 ? "warning" : undefined}
          />
          <StatCard
            label="Pending balance"
            value={formatMoney(String(pendingSummary.balance))}
            tone={pendingSummary.balance > 0 ? "warning" : undefined}
          />
        </div>

        <div className="inventory-tabs" style={{ marginBottom: "1rem" }}>
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
            title="No repair jobs"
            description="Register a phone when the customer drops it off for repair."
            action={
              <button type="button" onClick={() => setIntakeOpen(true)}>
                New intake
              </button>
            }
          />
        )}
        {!isLoading && !error && filteredJobs.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-list">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Customer</th>
                  <th>Device</th>
                  <th>Issue</th>
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
                      {r.customerName ?? "—"}
                      {r.customerPhone ? (
                        <div className="muted" style={{ fontSize: "0.85em" }}>
                          {r.customerPhone}
                        </div>
                      ) : null}
                    </td>
                    <td>{r.device ?? "—"}</td>
                    <td style={{ maxWidth: 180 }}>{r.issueDescription ?? "—"}</td>
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
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <FormModal open={intakeOpen} title="New repair intake" onClose={() => setIntakeOpen(false)}>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              intake.mutate();
            }}
          >
            <label className="stat-label">Date received</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <label className="stat-label">Customer name</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            <label className="stat-label">Phone (optional)</label>
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
            <label className="stat-label">Device / model</label>
            <input value={device} onChange={(e) => setDevice(e.target.value)} required />
            <label className="stat-label">Issue description</label>
            <textarea
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              rows={3}
              required
            />
            <label className="stat-label">Repair cost (your cost)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={intakeRepairCost}
              onChange={(e) => setIntakeRepairCost(e.target.value)}
              placeholder="Parts, labour, etc."
            />
            <label className="stat-label">Customer charge</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={intakeCustomerCharge}
              onChange={(e) => setIntakeCustomerCharge(e.target.value)}
              placeholder="Amount customer will pay"
            />
            {intake.error && <p className="error">{(intake.error as Error).message}</p>}
            <button type="submit" disabled={intake.isPending}>
              {intake.isPending ? "Saving…" : "Save intake"}
            </button>
          </form>
        </FormModal>

        <FormModal
          open={!!actionJob && actionKind === "complete"}
          title="Repair completed — pending pickup"
          onClose={() => {
            setActionJob(null);
            setActionKind(null);
          }}
        >
          {actionJob && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "REPAIRED_PENDING_PICKUP",
                  repairCost: parseFloat(repairCost) || 0,
                  customerCharge: parseFloat(customerCharge) || 0,
                });
              }}
            >
              <p className="muted">
                {actionJob.device} — {actionJob.customerName}. Profit is recorded only after the
                customer picks up the phone.
              </p>
              <label className="stat-label">Repair cost (your cost)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={repairCost}
                onChange={(e) => setRepairCost(e.target.value)}
              />
              <label className="stat-label">Customer charge</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customerCharge}
                onChange={(e) => setCustomerCharge(e.target.value)}
                required
              />
              {updateStatus.error && (
                <p className="error">{(updateStatus.error as Error).message}</p>
              )}
              <button type="submit" disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "Saving…" : "Mark ready for pickup"}
              </button>
            </form>
          )}
        </FormModal>

        <FormModal
          open={!!actionJob && actionKind === "deliver"}
          title="Customer picked up"
          onClose={() => {
            setActionJob(null);
            setActionKind(null);
          }}
        >
          {actionJob && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "DELIVERED",
                  deliveredAt,
                });
              }}
            >
              <p className="muted">
                Charge {formatMoney(actionJob.customerCharge || actionJob.salePrice)} will count in
                today&apos;s repair profit
                and monthly net profit.
              </p>
              <label className="stat-label">Delivery date</label>
              <input
                type="date"
                value={deliveredAt}
                onChange={(e) => setDeliveredAt(e.target.value)}
                required
              />
              {updateStatus.error && (
                <p className="error">{(updateStatus.error as Error).message}</p>
              )}
              <button type="submit" disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "Saving…" : "Mark delivered"}
              </button>
            </form>
          )}
        </FormModal>
      </div>
    </MonthGate>
  );
}
