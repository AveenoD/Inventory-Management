"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";

export default function StockInPage() {
  const { id } = useParams();
  const router = useRouter();
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const stockIn = useMutation({
    mutationFn: () =>
      api.stockIn({
        productId: String(id),
        quantity: parseInt(quantity, 10),
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => router.push("/inventory"),
  });

  return (
    <div className="page-narrow">
      <PageHeader title="Stock in" subtitle="Add quantity to inventory" />
      <form
        className="card form-stack stockin-card"
        onSubmit={(e) => {
          e.preventDefault();
          stockIn.mutate();
        }}
      >
        <label className="stat-label">Quantity</label>
        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        <label className="stat-label">Unit cost (optional)</label>
        <input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
        <label className="stat-label">Note</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="submit" disabled={stockIn.isPending}>
          {stockIn.isPending ? "Saving…" : "Add stock"}
        </button>
      </form>
    </div>
  );
}
