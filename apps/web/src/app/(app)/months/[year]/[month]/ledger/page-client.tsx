"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { daysInMonth } from "@/lib/days";
import { EditableGrid } from "@/components/editable-grid";

export default function LedgerPage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);
  const qc = useQueryClient();
  const dates = daysInMonth(year, monthNum);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["dashboard", monthId] });

  if (!monthId) return <p>Month not found</p>;

  return (
    <div>
      <h2>Party, Udhhar, Bank & Withdrawal</h2>

      <h3>Bank balance (daily)</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "directAc", label: "Direct AC" },
          { key: "salesQr", label: "Sales QR" },
          { key: "transferQr", label: "Transfer QR" },
          { key: "cash", label: "Cash" },
        ]}
        initialRows={dates.map((date) => ({
          date,
          directAc: 0,
          salesQr: 0,
          transferQr: 0,
          cash: 0,
        }))}
        onSave={async (rows) => {
          await api.bulkBank(monthId, rows);
          invalidate();
        }}
      />

      <h3 style={{ marginTop: "2rem" }}>Udhhar</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "paymentOut", label: "Payment out" },
          { key: "paymentIn", label: "Payment in" },
        ]}
        initialRows={dates.map((date) => ({ date, paymentOut: 0, paymentIn: 0 }))}
        onSave={async (rows) => {
          await api.bulkUdhhar(monthId, rows);
          invalidate();
        }}
      />

      <h3 style={{ marginTop: "2rem" }}>Withdrawals</h3>
      <EditableGrid
        dates={dates}
        columns={[
          { key: "description", label: "Description", type: "text" },
          { key: "cash", label: "Cash" },
          { key: "bank", label: "Bank" },
        ]}
        initialRows={dates.map((date) => ({
          date,
          description: "",
          cash: 0,
          bank: 0,
        }))}
        onSave={async (rows) => {
          await api.bulkWithdrawal(monthId, rows);
          invalidate();
        }}
      />

      <h3 style={{ marginTop: "2rem" }}>Party payment (add rows via API)</h3>
      <PartyQuickAdd monthId={monthId} onSaved={invalidate} />
    </div>
  );
}

function PartyQuickAdd({
  monthId,
  onSaved,
}: {
  monthId: string;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(datesToday());
  const [partyName, setPartyName] = useState("");
  const [materialIn, setMaterialIn] = useState(0);
  const [paymentOut, setPaymentOut] = useState(0);

  const save = useMutation({
    mutationFn: () =>
      api.bulkParty(monthId, [{ date, partyName, materialIn, paymentOut }]),
    onSuccess: onSaved,
  });

  return (
    <div className="card" style={{ marginTop: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto", gap: "0.5rem" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input placeholder="Party name" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
        <input type="number" placeholder="Material in" value={materialIn} onChange={(e) => setMaterialIn(+e.target.value)} />
        <input type="number" placeholder="Payment out" value={paymentOut} onChange={(e) => setPaymentOut(+e.target.value)} />
        <button type="button" onClick={() => save.mutate()} disabled={save.isPending || !partyName}>
          Add
        </button>
      </div>
    </div>
  );
}

function datesToday() {
  return new Date().toISOString().slice(0, 10);
}
