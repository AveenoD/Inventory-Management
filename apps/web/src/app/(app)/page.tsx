"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  CircleDollarSign,
  Package,
  Pencil,
  Smartphone,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { NotificationInbox } from "@/components/ui/notification-inbox";
import { getToken } from "@/lib/auth";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { PageLoader } from "@/components/ui/page-loader";
import { FormModal } from "@/components/ui/form-modal";

function openingDismissKey(year: number, month: number) {
  return `sk-opening-dismissed-${year}-${month}`;
}

export default function TodayPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false);
  const [editOpeningOpen, setEditOpeningOpen] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [day1PromptOpen, setDay1PromptOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getToday(date),
    enabled: !!getToken(),
    retry: 1,
  });

  const updateOpening = useMutation({
    mutationFn: (amount: number) => {
      if (!data?.monthId) throw new Error("Month not loaded");
      return api.updateMonth(data.monthId, { openingBalance: amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today"] });
      setEditOpeningOpen(false);
      setDay1PromptOpen(false);
      if (data) {
        localStorage.setItem(openingDismissKey(data.year, data.month), "1");
      }
    },
  });

  useEffect(() => {
    if (!data) return;
    if (!data.isFirstDayOfMonth) {
      setDay1PromptOpen(false);
      return;
    }
    const dismissed = localStorage.getItem(openingDismissKey(data.year, data.month));
    if (dismissed) return;
    if (data.showOpeningBalancePrompt || data.openingBalance === "0.00") {
      setOpeningInput(data.suggestedOpeningBalance ?? data.openingBalance);
      setDay1PromptOpen(true);
    }
  }, [data]);

  const chartData = useMemo(
    () =>
      (data?.salesLast7Days ?? []).map((d) => ({
        date: d.date.slice(5),
        total: Number(d.total) || 0,
        profit: Number(d.profit) || 0,
      })),
    [data?.salesLast7Days],
  );

  const showLoader = isLoading || (isFetching && !data);

  if (showLoader) return <PageLoader message="Loading dashboard…" />;
  if (error) {
    const msg = (error as Error).message;
    const timedOut = msg.toLowerCase().includes("timed out");
    return (
      <div className="card error-card">
        <h3>Could not load dashboard</h3>
        <p className="error">{msg}</p>
        {timedOut && (
          <p className="muted">
            API may be waking up (Render free tier). Wait a moment and retry.
          </p>
        )}
        <button type="button" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const monthLabel = new Date(data.year, data.month - 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });

  function openEditOpening() {
    setOpeningInput(data!.openingBalance);
    setEditOpeningOpen(true);
  }

  function saveOpeningBalance() {
    const amount = parseMoneyInput(openingInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    updateOpening.mutate(amount);
  }

  function dismissDay1Prompt() {
    if (!data) return;
    localStorage.setItem(openingDismissKey(data.year, data.month), "1");
    setDay1PromptOpen(false);
  }

  return (
    <div className="dash">
      <FormModal
        open={editOpeningOpen}
        title="Edit Opening Balance"
        onClose={() => setEditOpeningOpen(false)}
      >
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          Opening balance for {monthLabel}. This affects cash balance and net profit.
        </p>
        <label>
          Amount (₹)
          <input
            type="number"
            min={0}
            step="0.01"
            value={openingInput}
            onChange={(e) => setOpeningInput(e.target.value)}
          />
        </label>
        {updateOpening.error && (
          <p className="error">{(updateOpening.error as Error).message}</p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={() => setEditOpeningOpen(false)}>
            Cancel
          </button>
          <button type="button" onClick={saveOpeningBalance} disabled={updateOpening.isPending}>
            {updateOpening.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </FormModal>

      <FormModal
        open={day1PromptOpen}
        title="Set Opening Balance"
        onClose={dismissDay1Prompt}
      >
        <p className="muted" style={{ marginBottom: "0.75rem" }}>
          New month started ({monthLabel}). Set your opening cash balance.
        </p>
        {data.suggestedOpeningBalance && (
          <p className="dash-hint">
            Previous month closing balance:{" "}
            <strong>{formatMoney(data.suggestedOpeningBalance)}</strong>
          </p>
        )}
        <label>
          Opening Balance (₹)
          <input
            type="number"
            min={0}
            step="0.01"
            value={openingInput}
            onChange={(e) => setOpeningInput(e.target.value)}
          />
        </label>
        {updateOpening.error && (
          <p className="error">{(updateOpening.error as Error).message}</p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={dismissDay1Prompt}>
            Later
          </button>
          <button type="button" onClick={saveOpeningBalance} disabled={updateOpening.isPending}>
            {updateOpening.isPending ? "Saving…" : "Set Balance"}
          </button>
        </div>
      </FormModal>

      <div className="dash-topbar">
        <div>
          <div className="dash-title">Dashboard</div>
          <div className="dash-subtitle">
            {monthLabel}
          </div>
        </div>

        <div className="dash-topbar-right">
          <div className="dash-date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <Link href="/sales/new" className="dash-topbar-action blue">
            + Add Sale
          </Link>
          <Link href="/repair?intake=1" className="dash-topbar-action orange">
            + Repair
          </Link>

          <NotificationInbox />
        </div>
      </div>

      <div className="dash-section-label">Today — {data.date}</div>
      <div className="dash-metrics dash-metrics-6">
        <MetricCard
          icon={<CircleDollarSign size={18} />}
          label="Today's Sales"
          value={formatMoney(data.salesTotal)}
          sub={`${data.salesCount} bills`}
          tone="blue"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Today's Profit"
          value={formatMoney(data.salesProfit)}
          sub="Sales profit"
          tone="green"
        />
        <MetricCard
          icon={<Wrench size={18} />}
          label="Today's Repair Profit"
          value={formatMoney(data.repairProfit)}
          sub={`${data.repairDelivered} delivered · ${data.repairUndeliveredCount} undelivered`}
          tone="orange"
        />
        <MetricCard
          icon={<Smartphone size={18} />}
          label="Today's Recharge"
          value={formatMoney(data.rechargeTotal)}
          sub="Recharge income"
          tone="purple"
        />
        <MetricCard
          icon={<ArrowLeftRight size={18} />}
          label="Today's Transfer"
          value={formatMoney(data.transferTotal)}
          sub="Money transfer income"
          tone="teal"
        />
        <MetricCard
          icon={<TrendingUp size={18} />}
          label="Total Profit Today"
          value={formatMoney(data.todayTotalProfit)}
          sub="Sales + recharge + transfer + repair"
          tone="purple"
        />
      </div>

      <button
        type="button"
        className={`dash-summary-toggle ${monthSummaryOpen ? "open" : ""}`}
        onClick={() => setMonthSummaryOpen((v) => !v)}
        aria-expanded={monthSummaryOpen}
      >
        <span>{monthSummaryOpen ? "Hide month summary" : "View month summary"}</span>
        <span className="dash-summary-toggle-meta">{monthLabel}</span>
        <ChevronDown size={16} className="dash-summary-chevron" />
      </button>

      {monthSummaryOpen && (
        <div className="dash-month-summary">
          <div className="dash-metrics dash-metrics-6">
            <MetricCard
              icon={<CircleDollarSign size={18} />}
              label="Total Sales"
              value={formatMoney(data.monthSalesTotal)}
              sub="Mobile & accessories"
              tone="blue"
            />
            <MetricCard
              icon={<Smartphone size={18} />}
              label="Recharge + Transfer"
              value={formatMoney(data.monthRechargeTransferTotal)}
              sub="Month recharge & money transfer"
              tone="green"
            />
            <MetricCard
              icon={<Wrench size={18} />}
              label="Repair Profit"
              value={formatMoney(data.monthRepairProfit)}
              sub="Delivered repairs"
              subExtra={
                data.repairPendingCount > 0
                  ? `Undelivered: ${formatMoney(data.repairPendingBalance)} (${data.repairPendingCount})`
                  : "No undelivered repairs"
              }
              tone="orange"
            />
            <MetricCard
              icon={<Package size={18} />}
              label="Stock Value"
              value={formatMoney(data.stockValue)}
              tone="purple"
            />
            <MetricCard
              icon={<Wallet size={18} />}
              label="Opening Balance"
              value={formatMoney(data.openingBalance)}
              sub="Tap edit to change"
              tone="teal"
              action={
                <button
                  type="button"
                  className="dash-metric-edit"
                  onClick={openEditOpening}
                  aria-label="Edit opening balance"
                >
                  <Pencil size={12} />
                  Edit
                </button>
              }
            />
            <MetricCard
              icon={<Banknote size={18} />}
              label="Month Total Profit"
              value={formatMoney(data.monthNetProfit)}
              sub="All income minus expenses"
              tone="blue"
            />
          </div>
        </div>
      )}

      <div className="dash-grid">
        <div className="dash-card dash-quick">
          <div className="dash-card-header">
            <div>
              <div className="dash-card-title">Quick Actions</div>
              <div className="dash-card-subtitle">Shortcuts for common tasks</div>
            </div>
          </div>
          <div className="dash-actions">
            <ActionLink href="/sales/new" title="+ New Sale" subtitle="Create invoice" variant="blue" />
            <ActionLink href="/recharge" title="+ Recharge" subtitle="Add recharge" variant="green" />
            <ActionLink href="/repair?intake=1" title="+ Repair" subtitle="Add repair job" variant="orange" />
            <ActionLink href="/inventory/new" title="+ Add Product" subtitle="New product" variant="purple" />
            <ActionLink href="/money-transfer" title="+ Money Transfer" subtitle="Add transfer" variant="teal" />
          </div>
        </div>

        <div className="dash-card dash-activity">
          <div className="dash-card-header">
            <div className="dash-card-title">Today&apos;s Activity</div>
            <Link className="dash-link" href="/sales">
              View all
            </Link>
          </div>
          <div className="dash-activity-list">
            {(data.recentActivity ?? []).map((a) => (
              <div key={a.id} className="dash-activity-item">
                <div className={`dash-dot ${a.type.toLowerCase()}`} />
                <div className="dash-activity-text">
                  <div className="dash-activity-title">{a.title}</div>
                  {a.subtitle && <div className="dash-activity-sub">{a.subtitle}</div>}
                </div>
                <div className="dash-activity-right">
                  {a.amount ? <div className="dash-amount">{formatMoney(a.amount)}</div> : null}
                </div>
              </div>
            ))}
            {data.recentActivity?.length === 0 && (
              <div className="dash-empty">No activity today yet</div>
            )}
          </div>
        </div>

        <div className="dash-card dash-lowstock">
          <div className="dash-card-header">
            <div className="dash-card-title">Low Stock Alerts</div>
            <Link className="dash-link" href="/inventory">
              View all
            </Link>
          </div>
          <div className="dash-list">
            {(data.lowStockItems ?? []).map((p) => (
              <div key={p.id} className="dash-list-item">
                <div className="dash-list-left">
                  <div className="dash-list-title">{p.name}</div>
                  <div className="dash-list-sub">Min {p.minStock}</div>
                </div>
                <div className={`dash-badge ${p.stockQty <= 0 ? "danger" : "warn"}`}>
                  {p.stockQty <= 0 ? "Out of stock" : `${p.stockQty} left`}
                </div>
              </div>
            ))}
            {data.lowStockItems?.length === 0 && (
              <div className="dash-empty">
                <AlertTriangle size={16} /> No low stock items
              </div>
            )}
          </div>
        </div>

        <div className="dash-card dash-chart">
          <div className="dash-card-header">
            <div>
              <div className="dash-card-title">Sales Overview</div>
              <div className="dash-card-subtitle">Last 7 days</div>
            </div>
            <div className="dash-pill">₹ Total</div>
          </div>
          <div className="dash-chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(59,130,246,0.55)" />
                    <stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    color: "#0f172a",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                  }}
                  labelStyle={{ color: "#64748b" }}
                  formatter={(value) =>
                    formatMoney(typeof value === "number" ? value : Number(value ?? 0))
                  }
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#salesFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  subExtra,
  tone,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  subExtra?: string;
  tone: "blue" | "green" | "orange" | "purple" | "red" | "teal";
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      className={`dash-metric ${tone}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <div className="dash-metric-top">
        <div className="dash-metric-icon">{icon}</div>
        {action}
      </div>
      <div className="dash-metric-label">{label}</div>
      <div className="dash-metric-value">{value}</div>
      {sub && <div className="dash-metric-sub">{sub}</div>}
      {subExtra && <div className="dash-metric-sub-extra">{subExtra}</div>}
    </motion.div>
  );
}

function ActionLink({
  href,
  title,
  subtitle,
  variant,
}: {
  href: string;
  title: string;
  subtitle: string;
  variant: "blue" | "green" | "orange" | "purple" | "teal";
}) {
  return (
    <Link href={href} className={`dash-action ${variant}`}>
      <div className="dash-action-title">{title}</div>
      <div className="dash-action-sub">{subtitle}</div>
    </Link>
  );
}
