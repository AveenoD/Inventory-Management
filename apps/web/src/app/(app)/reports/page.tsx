"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { formatMoney } from "@/lib/format";
import { Calendar, Download } from "lucide-react";

export default function ReportsPage() {
  const { monthId, year, month } = useMonthContext();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [serviceFilter, setServiceFilter] = useState<
    "ALL" | "SALE" | "RECHARGE" | "TRANSFER" | "REPAIR"
  >("ALL");

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => api.getDashboard(monthId!),
    enabled: !!monthId,
  });

  const {
    data: todayData,
    isLoading: todayLoading,
    error: todayError,
  } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getToday(date),
    enabled: true,
    retry: false,
  });

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Opening Balance", data.openingBalance],
      ["Total Income", data.totalIncome],
      ["Total Expense", data.totalExpense],
      ["Net Profit", data.netProfit],
      ["Recharge+Transfer", data.serviceWise.rechargeTransferProfit],
      ["Repair Profit", data.serviceWise.repairProfit],
      ["Mobile Profit", data.serviceWise.mobileProfit],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sk-mobile-report-${year}-${month}.csv`;
    a.click();
  }

  const chartData = useMemo(
    () =>
      (todayData?.salesLast7Days ?? []).map((d) => ({
        date: d.date.slice(5),
        sales: Number(d.total) || 0,
        profit: Number(d.profit) || 0,
      })),
    [todayData?.salesLast7Days],
  );

  const breakdown = useMemo(() => {
    if (!data) return [];
    const items = [
      {
        name: "Recharge + Transfer",
        value: Number(data.serviceWise.rechargeTransferProfit) || 0,
        color: "#22c55e",
      },
      { name: "Repairs", value: Number(data.serviceWise.repairProfit) || 0, color: "#a855f7" },
      { name: "Mobile & Accessories", value: Number(data.serviceWise.mobileProfit) || 0, color: "#3b82f6" },
      { name: "Extra Income", value: Number(data.serviceWise.extraIncome) || 0, color: "#f59e0b" },
    ];
    return items.filter((i) => i.value > 0);
  }, [data]);

  const recent = useMemo(() => {
    const items = todayData?.recentActivity ?? [];
    if (serviceFilter === "ALL") return items;
    return items.filter((a) => a.type === serviceFilter);
  }, [todayData?.recentActivity, serviceFilter]);

  return (
    <MonthGate>
    <div>
      <PageHeader
        title="Reports"
        subtitle="Business summary and detailed reports"
        action={
          <div className="reports-actions">
            <div className="reports-date">
              <span className="reports-date-icon" aria-hidden="true">
                <Calendar size={16} />
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <select
              className="reports-select"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value as typeof serviceFilter)}
            >
              <option value="ALL">All Services</option>
              <option value="SALE">Sales</option>
              <option value="RECHARGE">Recharge</option>
              <option value="TRANSFER">Money Transfer</option>
              <option value="REPAIR">Repairs</option>
            </select>
            <button type="button" className="secondary" onClick={exportCsv} disabled={!data}>
              <Download size={16} /> Export
            </button>
          </div>
        }
      />
      {isLoading && <PageLoader message="Loading report…" />}
      {error && <p className="error">{(error as Error).message}</p>}
      {todayLoading && <PageLoader message="Loading activity…" />}
      {todayError && <p className="error">{(todayError as Error).message}</p>}

      {data && (
        <div className="reports">
          <div className="reports-metrics">
            <MetricCard label="Total Income" value={formatMoney(data.totalIncome)} sub="This month" tone="blue" />
            <MetricCard
              label="Service Income"
              value={formatMoney(data.serviceWise.rechargeTransferProfit)}
              sub="Recharge + Transfer"
              tone="green"
            />
            <MetricCard
              label="Repair Income"
              value={formatMoney(data.serviceWise.repairProfit)}
              sub={`${data.totals.repairJobs} Jobs`}
              tone="purple"
            />
            <MetricCard label="Total Expenses" value={formatMoney(data.totalExpense)} sub="This month" tone="orange" />
            <MetricCard
              label="Net Profit"
              value={formatMoney(data.netProfit)}
              sub={`Profit Margin: ${calcMargin(data.netProfit, data.totalIncome)}`}
              tone="green"
            />
          </div>

          <div className="reports-grid">
            <div className="reports-card">
              <div className="reports-card-header">
                <div className="reports-card-title">Income Overview</div>
                <div className="reports-card-subtitle muted">Last 7 days (Sales)</div>
              </div>
              <div className="reports-chart">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59,130,246,0.55)" />
                        <stop offset="100%" stopColor="rgba(59,130,246,0.05)" />
                      </linearGradient>
                      <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(34,197,94,0.45)" />
                        <stop offset="100%" stopColor="rgba(34,197,94,0.05)" />
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
                      formatter={(value) => formatMoney(typeof value === "number" ? value : Number(value ?? 0))}
                    />
                    <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} fill="url(#salesFill)" dot={false} />
                    <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#profitFill)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="reports-card">
              <div className="reports-card-header">
                <div>
                  <div className="reports-card-title">Income Breakdown</div>
                  <div className="reports-card-subtitle muted">By service type (profit)</div>
                </div>
                <Link className="reports-link secondary" href={`/months/${year}/${month}`}>
                  View Detailed
                </Link>
              </div>
              <div className="reports-breakdown">
                <div className="reports-donut">
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={breakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={2}
                        stroke="#ffffff"
                      >
                        {breakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: 10,
                          color: "#0f172a",
                          boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                        }}
                        formatter={(value) => formatMoney(typeof value === "number" ? value : Number(value ?? 0))}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="reports-breakdown-list">
                  {breakdown.map((b) => (
                    <div key={b.name} className="reports-breakdown-row">
                      <div className="reports-breakdown-left">
                        <span className="reports-dot" style={{ background: b.color }} />
                        <span className="reports-breakdown-name">{b.name}</span>
                      </div>
                      <div className="reports-breakdown-right">
                        <span className="reports-breakdown-amt">{formatMoney(String(b.value))}</span>
                      </div>
                    </div>
                  ))}
                  <div className="reports-breakdown-total">
                    <span className="muted">Total Income</span>
                    <span className="reports-breakdown-amt">{formatMoney(data.totalIncome)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="reports-card reports-transactions">
              <div className="reports-card-header">
                <div>
                  <div className="reports-card-title">Recent Transactions</div>
                  <div className="reports-card-subtitle muted">Latest activity for selected day</div>
                </div>
                <Link className="reports-link secondary" href="/sales">
                  View All
                </Link>
              </div>
              <div className="data-table-wrap">
                <table className="data-list reports-table">
                  <thead>
                    <tr>
                      <th>Date &amp; Time</th>
                      <th>Type</th>
                      <th>Details</th>
                      <th>Reference</th>
                      <th className="right">Amount (₹)</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((a) => (
                      <tr key={`${a.at}-${a.type}-${a.title}`}>
                        <td>{new Date(a.at).toLocaleString()}</td>
                        <td>
                          <span className={`reports-pill ${a.type.toLowerCase()}`}>{labelType(a.type)}</span>
                        </td>
                        <td>{a.title}</td>
                        <td className="muted">{a.subtitle ?? "—"}</td>
                        <td className="right">{a.amount ? formatMoney(a.amount) : "—"}</td>
                        <td>
                          <span className="reports-status">
                            <span className="reports-status-dot" aria-hidden="true" />
                            <span className="ok">Completed</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {recent.length === 0 && (
                      <tr>
                        <td colSpan={6} className="muted">
                          No activity for selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </MonthGate>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "blue" | "green" | "orange" | "purple";
}) {
  return (
    <div className={`reports-metric ${tone}`}>
      <div className="reports-metric-label">{label}</div>
      <div className="reports-metric-value">{value}</div>
      {sub && <div className="reports-metric-sub">{sub}</div>}
    </div>
  );
}

function labelType(t: "SALE" | "RECHARGE" | "TRANSFER" | "REPAIR") {
  if (t === "SALE") return "Sale";
  if (t === "RECHARGE") return "Recharge";
  if (t === "TRANSFER") return "Money Transfer";
  return "Repair";
}

function calcMargin(netProfit: string, totalIncome: string) {
  const p = Number(netProfit) || 0;
  const i = Number(totalIncome) || 0;
  if (!i) return "—";
  return `${((p / i) * 100).toFixed(2)}%`;
}
