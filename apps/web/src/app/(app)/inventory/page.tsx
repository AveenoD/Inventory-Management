"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  PRODUCT_KINDS,
  PRODUCT_KIND_LABELS,
  type ProductKind,
  type ProductDto,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";
import { PageLoader } from "@/components/ui/page-loader";

function detailCell(p: ProductDto) {
  if (p.kind === "MOBILE_ACCESSORY" || p.kind === "REPAIR_PART") {
    const parts = [p.phoneModel, p.kind === "MOBILE_ACCESSORY" ? p.coverTypeName : p.partType].filter(
      Boolean,
    );
    return parts.join(" · ") || "—";
  }
  return "—";
}

export default function InventoryPage() {
  const [kindFilter, setKindFilter] = useState<ProductKind | "ALL">("ALL");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["products", kindFilter],
    queryFn: () =>
      api.getProducts(1, undefined, kindFilter === "ALL" ? undefined : kindFilter),
  });

  const products = data?.data ?? [];

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Mobile, accessories, repair parts, audio & chargers"
        action={
          <Link href="/inventory/new">
            <button type="button">+ Add product</button>
          </Link>
        }
      />

      <div className="inventory-tabs">
        <button
          type="button"
          className={kindFilter === "ALL" ? "tab active" : "tab"}
          onClick={() => setKindFilter("ALL")}
        >
          All
        </button>
        {PRODUCT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            className={kindFilter === k ? "tab active" : "tab"}
            onClick={() => setKindFilter(k)}
          >
            {PRODUCT_KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {isLoading && <PageLoader message="Loading products…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}
      {!isLoading && !error && products.length === 0 && (
        <EmptyState
          title="No products in this category"
          description="Add items with the correct product type."
          action={
            <Link href="/inventory/new">
              <button type="button">Add product</button>
            </Link>
          }
        />
      )}
      {!isLoading && !error && products.length > 0 && (
        <div className="data-table-wrap">
          <table className="data-list">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Model / Detail</th>
                <th>Stock</th>
                <th>Cost</th>
                <th>{kindFilter === "REPAIR_PART" ? "Repair ₹" : "Sell"}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {p.sku && <span className="muted"> ({p.sku})</span>}
                  </td>
                  <td>{PRODUCT_KIND_LABELS[p.kind]}</td>
                  <td>{detailCell(p)}</td>
                  <td>
                    <span
                      className={p.stockQty <= p.minStock ? "badge warning" : "badge ok"}
                    >
                      {p.stockQty}
                    </span>
                  </td>
                  <td>{formatMoney(p.buyPrice)}</td>
                  <td>
                    {p.kind === "REPAIR_PART" && p.repairCharge
                      ? formatMoney(p.repairCharge)
                      : formatMoney(p.sellPrice)}
                  </td>
                  <td>
                    <Link href={`/inventory/${p.id}/stock`}>Stock in</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
