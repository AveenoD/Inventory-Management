"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Bell,
  CircleDollarSign,
  Package,
  Search,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { PageLoader } from "@/components/ui/page-loader";

export default function TodayPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState("");

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getToday(date),
    enabled: !!getToken(),
    retry: false,
  });

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

  if (showLoader) return <PageLoader message="Loading today…" />;
  if (error) {
    const msg = (error as Error).message;
    const timedOut = msg.toLowerCase().includes("timed out");
    return (
      <div className="card error-card">
        <h3>Could not load dashboard</h3>
        <p className="error">{msg}</p>
        {timedOut && (
          <p className="muted">
            The API or database is slow or unreachable. Confirm Supabase is online and{" "}
            <code>npm run dev:api</code> is running on port 4000.
          </p>
        )}
        <button type="button" onClick={() => refetch()}>Retry</button>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="dash">
      <div className="dash-topbar">
        <div>
          <div className="dash-title">Dashboard</div>
          <div className="dash-subtitle">Welcome back! Here's what's happening in your shop today.</div>
        </div>

        <div className="dash-topbar-right">
          <div className="dash-date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="dash-search">
            <Search size={16} />
            <input
              placeholder="Search anything…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button type="button" className="dash-icon-btn secondary" aria-label="Notifications">
            <Bell size={16} />
          </button>
        </div>
      </div>

      <div className="dash-metrics">
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
          sub="Sales Profit"
          tone="green"
        />
        <MetricCard
          icon={<Wrench size={18} />}
          label="Active Repairs"
          value={data.activeRepairs}
          sub={`${data.repairPendingCount} pending pickup`}
          tone="orange"
        />
        <MetricCard
          icon={<ArrowLeftRight size={18} />}
          label="Service Income"
          value={formatMoney((Number(data.rechargeTotal) || 0) + (Number(data.transferTotal) || 0))}
          sub="Recharge + Transfer"
          tone="purple"
        />
        <MetricCard
          icon={<Package size={18} />}
          label="Low Stock Items"
          value={data.lowStockCount}
          sub={data.lowStockCount > 0 ? "Needs attention" : "All good"}
          tone={data.lowStockCount > 0 ? "red" : "blue"}
        />
      </div>

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
            <ActionLink href="/repair" title="+ Repair" subtitle="Add repair job" variant="orange" />
            <ActionLink href="/inventory/new" title="+ Add Product" subtitle="New product" variant="purple" />
            <ActionLink href="/money-transfer" title="+ Money Transfer" subtitle="Add transfer" variant="teal" />
          </div>
        </div>

        <div className="dash-card dash-activity">
          <div className="dash-card-header">
            <div className="dash-card-title">Today's Activity</div>
            <Link className="dash-link" href="/sales">
              View all
            </Link>
          </div>
          <div className="dash-activity-list">
            {(data.recentActivity ?? []).map((a) => (
              <div key={`${a.at}-${a.type}-${a.title}`} className="dash-activity-item">
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
                <CartesianGrid stroke="rgba(45,58,79,0.55)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8b9cb3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8b9cb3", fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#101827",
                    border: "1px solid #2d3a4f",
                    borderRadius: 10,
                    color: "#e8eef7",
                  }}
                  labelStyle={{ color: "#8b9cb3" }}
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
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: "blue" | "green" | "orange" | "purple" | "red" | "teal";
}) {
  return (
    <motion.div
      className={`dash-metric ${tone}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <div className="dash-metric-icon">{icon}</div>
      <div className="dash-metric-label">{label}</div>
      <div className="dash-metric-value">{value}</div>
      {sub && <div className="dash-metric-sub">{sub}</div>}
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
