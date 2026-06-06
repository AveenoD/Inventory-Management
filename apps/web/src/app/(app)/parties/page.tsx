"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/lib/format";
import { Trash2 } from "lucide-react";

type PartyOption = { id: string; name: string };
type PartyTxRow = {
  id: string;
  date: string;
  partyName: string;
  materialIn: string;
  paymentOut: string;
};

export default function PartiesPage() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const [partyOpen, setPartyOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyId, setPartyId] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [materialIn, setMaterialIn] = useState("0");
  const [paymentOut, setPaymentOut] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<PartyTxRow | null>(null);

  const { data: parties } = useQuery({
    queryKey: ["party-list"],
    queryFn: () => api.getPartyList(),
  });

  const { data: txs, isLoading, error, refetch } = useQuery({
    queryKey: ["party-txs", monthId],
    queryFn: () => api.getPartyTransactions(monthId!, 1),
    enabled: !!monthId,
  });

  const partyList = (parties?.data ?? []) as PartyOption[];
  const transactions = (txs?.data ?? []) as PartyTxRow[];
  const filteredTransactions = transactions.filter((r) =>
    r.partyName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const createParty = useMutation({
    mutationFn: () => api.createParty({ name: partyName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-list"] });
      setPartyOpen(false);
      setPartyName("");
    },
  });

  const createTx = useMutation({
    mutationFn: () =>
      api.createPartyTransaction(monthId!, {
        partyId,
        date,
        materialIn: parseFloat(materialIn) || 0,
        paymentOut: parseFloat(paymentOut) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-txs", monthId] });
      setTxOpen(false);
    },
  });

  const removeTx = useMutation({
    mutationFn: (txId: string) => api.deletePartyTransaction(monthId!, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-txs", monthId] });
      setDeleteTarget(null);
    },
  });

  return (
    <MonthGate>
    <div>
      <PageHeader
        title="Parties"
        subtitle="Supplier ledger and payments"
        action={
          <>
            <button type="button" className="secondary" onClick={() => setPartyOpen(true)} style={{ marginRight: 8 }}>
              + Party
            </button>
            <button type="button" onClick={() => setTxOpen(true)}>
              + Transaction
            </button>
          </>
        }
      />
      {isLoading && <PageLoader message="Loading transactions…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {!isLoading && !error && transactions.length === 0 && (
        <EmptyState
          title="No party transactions yet"
          description="Add a party, then record material in or payments for this month."
          action={
            <button type="button" onClick={() => setTxOpen(true)}>
              Add transaction
            </button>
          }
        />
      )}
      {!isLoading && !error && transactions.length > 0 && (
      <div className="data-table-wrap">
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
          <input
            placeholder="Search party…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <div className="muted" style={{ fontSize: 13 }}>
            {filteredTransactions.length} result{filteredTransactions.length === 1 ? "" : "s"}
          </div>
        </div>
        <table className="data-list">
          <thead>
            <tr>
              <th>Date</th>
              <th>Party</th>
              <th>Material in</th>
              <th>Payment out</th>
              <th>Pending</th>
              <th className="col-action" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((r) => {
              const pending = (parseFloat(r.materialIn) || 0) - (parseFloat(r.paymentOut) || 0);
              return (
              <tr key={r.id}>
                <td>{r.date}</td>
                <td>{r.partyName}</td>
                <td>{formatMoney(r.materialIn)}</td>
                <td>{formatMoney(r.paymentOut)}</td>
                <td>{formatMoney(pending)}</td>
                <td className="col-action">
                  <button
                    type="button"
                    className="inventory-stock-btn danger"
                    title="Delete transaction"
                    aria-label="Delete transaction"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
      <FormModal open={partyOpen} title="Add party" onClose={() => setPartyOpen(false)}>
        <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createParty.mutate(); }}>
          <label className="stat-label">Party name</label>
          <input value={partyName} onChange={(e) => setPartyName(e.target.value)} required />
          {createParty.error && <p className="error">{(createParty.error as Error).message}</p>}
          <button type="submit" disabled={createParty.isPending}>Save</button>
        </form>
      </FormModal>
      <FormModal open={txOpen} title="Add transaction" onClose={() => setTxOpen(false)}>
        <form className="form-stack" onSubmit={(e) => { e.preventDefault(); createTx.mutate(); }}>
          <label className="stat-label">Party</label>
          <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
            <option value="">Select party</option>
            {partyList.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <label className="stat-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <label className="stat-label">Material in</label>
          <input type="number" step="0.01" value={materialIn} onChange={(e) => setMaterialIn(e.target.value)} />
          <label className="stat-label">Payment out</label>
          <input type="number" step="0.01" value={paymentOut} onChange={(e) => setPaymentOut(e.target.value)} />
          {createTx.error && <p className="error">{(createTx.error as Error).message}</p>}
          <button type="submit" disabled={createTx.isPending}>Save</button>
        </form>
      </FormModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete transaction?"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.partyName} transaction on ${deleteTarget.date} permanently?`
            : ""
        }
        loading={removeTx.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeTx.mutate(deleteTarget.id)}
      />
    </div>
    </MonthGate>
  );
}
