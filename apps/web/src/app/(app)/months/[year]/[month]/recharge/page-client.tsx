"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { daysInMonth } from "@/lib/days";
import { EditableGrid } from "@/components/editable-grid";

type Row = {
  date: string;
  airtelSaleProfit: number;
  airtelChillar: number;
  airtelAct: number;
  airtelMnp: number;
  jioSaleProfit: number;
  jioChillar: number;
  jioAct: number;
  jioMnp: number;
  viSaleProfit: number;
  viChillar: number;
  viAct: number;
  viMnp: number;
  bsnlSaleProfit: number;
  bsnlChillar: number;
  bsnlAct: number;
  bsnlMnp: number;
  allInOneSaleProfit: number;
  allInOneChillar: number;
};

const COLS = [
  { key: "airtelSaleProfit", label: "Airtel S&P" },
  { key: "airtelChillar", label: "Airtel Chillar" },
  { key: "airtelAct", label: "Airtel ACT" },
  { key: "airtelMnp", label: "Airtel MNP" },
  { key: "jioSaleProfit", label: "Jio S&P" },
  { key: "jioChillar", label: "Jio Chillar" },
  { key: "jioAct", label: "Jio ACT" },
  { key: "jioMnp", label: "Jio MNP" },
  { key: "viSaleProfit", label: "VI S&P" },
  { key: "viChillar", label: "VI Chillar" },
  { key: "viAct", label: "VI ACT" },
  { key: "viMnp", label: "VI MNP" },
  { key: "bsnlSaleProfit", label: "BSNL S&P" },
  { key: "bsnlChillar", label: "BSNL Chillar" },
  { key: "bsnlAct", label: "BSNL ACT" },
  { key: "bsnlMnp", label: "BSNL MNP" },
  { key: "allInOneSaleProfit", label: "All-in-1 S&P" },
  { key: "allInOneChillar", label: "All-in-1 Chillar" },
] as const;

export default function RechargePage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);
  const qc = useQueryClient();
  const dates = daysInMonth(year, monthNum);

  const { data } = useQuery({
    queryKey: ["recharges", monthId],
    queryFn: () => api.getRecharges(monthId!, 1, 31),
    enabled: !!monthId,
  });

  const save = useMutation({
    mutationFn: (rows: Row[]) => api.bulkRecharge(monthId!, rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharges", monthId] });
      qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
    },
  });

  if (!monthId) return <p>Month not found</p>;

  return (
    <div>
      <h2>Recharge Reports</h2>
      <EditableGrid
        dates={dates}
        columns={COLS.map((c) => ({ key: c.key, label: c.label }))}
        initialRows={(data?.data ?? []) as Row[]}
        onSave={(rows) => save.mutateAsync(rows)}
        saving={save.isPending}
      />
    </div>
  );
}
