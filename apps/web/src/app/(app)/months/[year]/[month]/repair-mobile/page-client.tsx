"use client";

import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { daysInMonth } from "@/lib/days";
import { EditableGrid } from "@/components/editable-grid";

type RepairRow = { date: string; jobCount: number; sale: number; cost: number };
type MobileRow = { date: string; sale: number; cost: number };
type ExtraRow = { date: string; description: string; amount: number };

export default function RepairMobilePage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);
  const qc = useQueryClient();
  const dates = daysInMonth(year, monthNum);

  const [repairRows, setRepairRows] = useState<RepairRow[]>(
    dates.map((date) => ({ date, jobCount: 0, sale: 0, cost: 0 })),
  );
  const [mobileRows, setMobileRows] = useState<MobileRow[]>(
    dates.map((date) => ({ date, sale: 0, cost: 0 })),
  );
  const [extraRows, setExtraRows] = useState<ExtraRow[]>(
    dates.map((date) => ({ date, description: "", amount: 0 })),
  );

  const saveAll = useMutation({
    mutationFn: async () => {
      await api.bulkRepair(monthId!, repairRows);
      await api.bulkMobile(monthId!, mobileRows);
      await api.bulkExtraIncome(monthId!, extraRows);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard", monthId] }),
  });

  if (!monthId) return <p>Month not found</p>;

  return (
    <div>
      <h2>Repair & Mobile Accessories</h2>
      <button
        type="button"
        onClick={() => saveAll.mutate()}
        disabled={saveAll.isPending}
        style={{ marginBottom: "1rem" }}
      >
        {saveAll.isPending ? "Saving…" : "Save all sections"}
      </button>

      <h3>Repairing</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "jobCount", label: "Jobs" },
          { key: "sale", label: "Sale" },
          { key: "cost", label: "Cost" },
        ]}
        initialRows={repairRows}
        onSave={async (rows) => {
          setRepairRows(rows);
          await api.bulkRepair(monthId, rows);
          qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
        }}
      />

      <h3 style={{ marginTop: "2rem" }}>Mobile & Accessories</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "sale", label: "Sale" },
          { key: "cost", label: "Cost" },
        ]}
        initialRows={mobileRows}
        onSave={async (rows) => {
          setMobileRows(rows);
          await api.bulkMobile(monthId, rows);
          qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
        }}
      />

      <h3 style={{ marginTop: "2rem" }}>Extra Income</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "description", label: "Description", type: "text" },
          { key: "amount", label: "Amount" },
        ]}
        initialRows={extraRows}
        onSave={async (rows) => {
          setExtraRows(rows);
          await api.bulkExtraIncome(monthId, rows);
          qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
        }}
      />
    </div>
  );
}
