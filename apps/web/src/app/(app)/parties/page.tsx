"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, Trash2 } from "lucide-react";
import type { PurchaseDto } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatMoney } from "@/lib/format";

type PartyOption = { id: string; name: string };
type PartyTxRow = {
  id: string;
  date: string;
  partyName: string;
  materialIn: string;
  paymentOut: string;
};

function formatPurchaseItems(lines: PurchaseDto["lines"]) {
  if (!lines.length) return "—";
  return lines
    .map((l) => (l.quantity > 1 ? `${l.productName} ×${l.quantity}` : l.productName))
    .join(", ");
}

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
  const [purchaseDate, setPurchaseDate] = useState(today);
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

  const {
    data: purchasesRes,
    isLoading: purchasesLoading,
    error: purchasesError,
    refetch: refetchPurchases,
  } = useQuery({
    queryKey: ["purchases", purchaseDate],
    queryFn: () => api.getPurchases(1, { date: purchaseDate }),
  });

  const partyList = (parties?.data ?? []) as PartyOption[];
  const transactions = (txs?.data ?? []) as PartyTxRow[];
  const purchases = purchasesRes?.data ?? [];
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
          subtitle="Supplier purchases, stock in, and payments"
          action={
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="secondary" onClick={() => setPartyOpen(true)}>
                + Party
              </button>
              <Link href="/parties/purchase/new">
                <button type="button">
                  <ShoppingBag size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                  + Purchase
                </button>
              </Link>
              <button type="button" className="secondary" onClick={() => setTxOpen(true)}>
                + Quick payment
              </button>
            </div>
          }
        />

        <div className="card parties-purchase-intro" style={{ marginBottom: "1.25rem" }}>
          <h3 style={{ marginTop: 0, marginBottom: "0.35rem" }}>Add stock from supplier</h3>
          <p className="muted" style={{ margin: "0 0 0.75rem" }}>
            Use <strong>+ Purchase</strong> to record items (covers by model, chargers, etc.) — stock
            updates in inventory and supplier balance updates automatically.
          </p>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            <strong>+ Quick payment</strong> is only for manual amount entry (no items) — e.g. paying
            old balance without a new bill.
          </p>
        </div>

        <h2 className="parties-section-title">Purchases (with items)</h2>
        <div className="card" style={{ marginBottom: "1.5rem", maxWidth: 280 }}>
          <label className="stat-label">Purchase date</label>
          <input
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
          />
        </div>

        {purchasesLoading && <PageLoader message="Loading purchases…" />}
        {purchasesError && (
          <div className="card error-card" style={{ marginBottom: "1.5rem" }}>
            <p className="error">{(purchasesError as Error).message}</p>
            <button type="button" onClick={() => refetchPurchases()}>
              Retry
            </button>
          </div>
        )}
        {!purchasesLoading && !purchasesError && purchases.length === 0 && (
          <EmptyState
            title="No purchases for this date"
            description="Click + Purchase to add covers and products from a supplier."
            action={
              <Link href="/parties/purchase/new">
                <button type="button">+ Purchase</button>
              </Link>
            }
          />
        )}
        {!purchasesLoading && !purchasesError && purchases.length > 0 && (
          <div className="data-table-wrap" style={{ marginBottom: "2rem" }}>
            <table className="data-list">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th className="right">Total</th>
                  <th className="right">Paid</th>
                  <th className="right">Due</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.partyName}</strong>
                      {p.invoiceNo && (
                        <div className="muted" style={{ fontSize: "0.85rem" }}>
                          Inv. {p.invoiceNo}
                        </div>
                      )}
                    </td>
                    <td className="muted" style={{ maxWidth: 300 }}>
                      {formatPurchaseItems(p.lines)}
                    </td>
                    <td className="right">{formatMoney(p.total)}</td>
                    <td className="right">{formatMoney(p.paidAmount)}</td>
                    <td className="right">
                      <span
                        className={
                          parseFloat(p.balanceDue) > 0 ? "badge warning" : "badge ok"
                        }
                      >
                        {formatMoney(p.balanceDue)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2 className="parties-section-title">Ledger (payments &amp; balances)</h2>
        {isLoading && <PageLoader message="Loading transactions…" />}
        {error && (
          <div className="card error-card">
            <p className="error">{(error as Error).message}</p>
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        )}
        {!isLoading && !error && transactions.length === 0 && (
          <EmptyState
            title="No ledger entries this month"
            description="Purchases appear here automatically. Use Quick payment for extra payments only."
            action={
              <Link href="/parties/purchase/new">
                <button type="button">+ Purchase</button>
              </Link>
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
                {filteredTransactions.length} result
                {filteredTransactions.length === 1 ? "" : "s"}
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
                  const pending =
                    (parseFloat(r.materialIn) || 0) - (parseFloat(r.paymentOut) || 0);
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
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              createParty.mutate();
            }}
          >
            <label className="stat-label">Party name</label>
            <input value={partyName} onChange={(e) => setPartyName(e.target.value)} required />
            {createParty.error && <p className="error">{(createParty.error as Error).message}</p>}
            <button type="submit" disabled={createParty.isPending}>
              Save
            </button>
          </form>
        </FormModal>

        <FormModal open={txOpen} title="Quick payment" onClose={() => setTxOpen(false)}>
          <p className="muted" style={{ marginTop: 0, fontSize: "0.9rem" }}>
            For paying balance only — no items. To add stock use <strong>+ Purchase</strong>.
          </p>
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              createTx.mutate();
            }}
          >
            <label className="stat-label">Party</label>
            <select value={partyId} onChange={(e) => setPartyId(e.target.value)} required>
              <option value="">Select party</option>
              {partyList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <label className="stat-label">Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="stat-label">Material in (₹)</label>
            <input
              type="number"
              step="0.01"
              value={materialIn}
              onChange={(e) => setMaterialIn(e.target.value)}
            />
            <label className="stat-label">Payment out (₹)</label>
            <input
              type="number"
              step="0.01"
              value={paymentOut}
              onChange={(e) => setPaymentOut(e.target.value)}
            />
            {createTx.error && <p className="error">{(createTx.error as Error).message}</p>}
            <button type="submit" disabled={createTx.isPending}>
              Save
            </button>
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
