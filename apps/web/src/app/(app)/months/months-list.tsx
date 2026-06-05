"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { monthLabel, formatMoney, parseMoneyInput } from "@/lib/format";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";

type MonthRow = {
  id: string;
  year: number;
  month: number;
  openingBalance: string;
};

export function MonthsList() {
  const router = useRouter();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [opening, setOpening] = useState("0");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["months", "list"],
    queryFn: () => api.getMonths(),
  });

  const months = (data?.data ?? []) as MonthRow[];

  const createMutation = useMutation({
    mutationFn: () =>
      api.createMonth({ year, month, openingBalance: parseMoneyInput(opening) }),
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: ["months"] });
      qc.invalidateQueries({ queryKey: ["months", "context"] });
      setShowCreate(false);
      router.push(`/months/${m.year}/${m.month}`);
    },
  });

  return (
    <div className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Business Months</h1>
        <button type="button" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "New month"}
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "1rem" }}>
            <div>
              <label className="stat-label">Year</label>
              <input type="number" value={year} onChange={(e) => setYear(+e.target.value)} />
            </div>
            <div>
              <label className="stat-label">Month</label>
              <input
                type="number"
                min={1}
                max={12}
                value={month}
                onChange={(e) => setMonth(+e.target.value)}
              />
            </div>
            <div>
              <label className="stat-label">Opening balance</label>
              <input
                type="number"
                value={opening}
                onChange={(e) => setOpening(e.target.value)}
              />
            </div>
            <button
              type="button"
              style={{ alignSelf: "end" }}
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              Create
            </button>
          </div>
        </div>
      )}

      {isLoading && <PageLoader message="Loading months…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && months.length === 0 && (
        <EmptyState
          title="No business months yet"
          description="Create a month to start tracking recharge, sales, and expenses."
          action={
            <button type="button" onClick={() => setShowCreate(true)}>
              New month
            </button>
          }
        />
      )}
      {!isLoading && !error && months.length > 0 && (
      <div className="grid-cards" style={{ marginTop: "1.5rem" }}>
        {months.map((m) => (
          <Link key={m.id} href={`/months/${m.year}/${m.month}`} className="card">
            <div className="stat-label">{monthLabel(m.year, m.month)}</div>
            <div className="stat-value">{formatMoney(m.openingBalance)}</div>
            <div className="stat-label">Opening balance</div>
          </Link>
        ))}
      </div>
      )}
    </div>
  );
}
