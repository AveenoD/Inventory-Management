"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package } from "lucide-react";
import { PRODUCT_KIND_LABELS } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { formatMoney } from "@/lib/format";

export default function StockInPage() {
  const { id } = useParams();
  const productId = String(id);
  const router = useRouter();
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api.getProduct(productId),
  });

  const stockIn = useMutation({
    mutationFn: () =>
      api.stockIn({
        productId,
        quantity: parseInt(quantity, 10),
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => router.push("/inventory"),
  });

  return (
    <div className="stock-in-page inventory-page">
      <Link href="/inventory" className="page-back-link">
        <ArrowLeft size={16} aria-hidden />
        Back to inventory
      </Link>

      <PageHeader
        title="Add stock"
        subtitle={product ? product.name : "Add quantity to inventory"}
      />

      {isLoading && <PageLoader message="Loading product…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <Link href="/inventory">Back to inventory</Link>
        </div>
      )}

      {!isLoading && !error && product && (
        <>
          <div className="stock-in-product card">
            <div className="stock-in-product__icon" aria-hidden>
              <Package size={20} />
            </div>
            <div className="stock-in-product__body">
              <div className="stock-in-product__name">{product.name}</div>
              <div className="stock-in-product__meta">
                {PRODUCT_KIND_LABELS[product.kind]}
                {product.buyPrice ? ` · Cost ${formatMoney(product.buyPrice)}` : ""}
              </div>
            </div>
            <div className="stock-in-product__stock">
              <span className="stock-in-product__stock-label">In stock</span>
              <span
                className={
                  product.stockQty <= product.minStock
                    ? "inventory-stock-pill low"
                    : "inventory-stock-pill"
                }
              >
                {product.stockQty}
              </span>
            </div>
          </div>

          <form
            className="stock-in-form card"
            onSubmit={(e) => {
              e.preventDefault();
              stockIn.mutate();
            }}
          >
            <section className="form-step">
              <div className="form-step__head">
                <span className="form-step__num">1</span>
                <span className="form-step__title">Quantity</span>
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="stock-qty">
                  How many to add?
                </label>
                <input
                  id="stock-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 5"
                  required
                />
              </div>
            </section>

            <section className="form-step">
              <div className="form-step__head">
                <span className="form-step__num">2</span>
                <span className="form-step__title">Optional details</span>
              </div>
              <div className="form-field">
                <label className="form-field__label" htmlFor="stock-cost">
                  Unit cost <span className="form-field__optional">(optional)</span>
                </label>
                <input
                  id="stock-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder={
                    product.buyPrice
                      ? String(parseFloat(product.buyPrice))
                      : "e.g. 100"
                  }
                />
                <p className="muted form-step__hint" style={{ marginTop: "0.5rem" }}>
                  Leave blank to use the product&apos;s current cost price.
                </p>
              </div>
              <div className="form-field" style={{ marginTop: "0.85rem" }}>
                <label className="form-field__label" htmlFor="stock-note">
                  Note <span className="form-field__optional">(optional)</span>
                </label>
                <input
                  id="stock-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. New supplier batch"
                />
              </div>
            </section>

            {stockIn.error && (
              <p className="error">{(stockIn.error as Error).message}</p>
            )}

            <div className="stock-in-actions">
              <Link href="/inventory" className="secondary stock-in-cancel">
                Cancel
              </Link>
              <button type="submit" disabled={stockIn.isPending}>
                {stockIn.isPending ? "Saving…" : "Add stock"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
