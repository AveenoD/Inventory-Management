"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { daysInMonth } from "@/lib/days";
import { EditableGrid } from "@/components/editable-grid";

type Row = {
  date: string;
  dmt99Dmt: number;
  dmt99Aeps: number;
  dmt99Nepal: number;
  dmt99BillPay: number;
  dmt99Qr: number;
  dmt86Dmt: number;
  dmt86Aeps: number;
  dmt86Credit: number;
  dmt86BillPay: number;
  dmt86Wallet: number;
  dmt86Qr: number;
  dmt86Nepal: number;
  imeAeps: number;
  imeNepal: number;
};

const COLS = [
  { key: "dmt99Dmt", label: "DMT99 DMT" },
  { key: "dmt99Aeps", label: "DMT99 AEPS" },
  { key: "dmt99Nepal", label: "DMT99 Nepal" },
  { key: "dmt99BillPay", label: "DMT99 Bill" },
  { key: "dmt99Qr", label: "DMT99 QR" },
  { key: "dmt86Dmt", label: "DMT86 DMT" },
  { key: "dmt86Aeps", label: "DMT86 AEPS" },
  { key: "dmt86Credit", label: "DMT86 Credit" },
  { key: "dmt86BillPay", label: "DMT86 Bill" },
  { key: "dmt86Wallet", label: "DMT86 Wallet" },
  { key: "dmt86Qr", label: "DMT86 QR" },
  { key: "dmt86Nepal", label: "DMT86 Nepal" },
  { key: "imeAeps", label: "IME AEPS" },
  { key: "imeNepal", label: "IME Nepal" },
] as const;

export default function MoneyTransferPage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);
  const qc = useQueryClient();
  const dates = daysInMonth(year, monthNum);

  const { data } = useQuery({
    queryKey: ["money-transfers", monthId],
    queryFn: () => api.getMoneyTransfers(monthId!, 1, 31),
    enabled: !!monthId,
  });

  const save = useMutation({
    mutationFn: (rows: Row[]) => api.bulkMoneyTransfer(monthId!, rows),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["money-transfers", monthId] });
      qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
    },
  });

  if (!monthId) return <p>Month not found</p>;

  const initial = (data?.data ?? []) as Row[];

  return (
    <div>
      <h2>Money Transfer Report</h2>
      <EditableGrid
        dates={dates}
        columns={COLS.map((c) => ({ key: c.key, label: c.label }))}
        initialRows={initial}
        onSave={(rows) => save.mutateAsync(rows)}
        saving={save.isPending}
      />
    </div>
  );
}
