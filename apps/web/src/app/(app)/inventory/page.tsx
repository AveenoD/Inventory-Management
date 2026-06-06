"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PackagePlus, Trash2 } from "lucide-react";
import {
  PRODUCT_KIND_LABELS,
  type ProductKind,
  type ProductDto,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/format";
import { PageLoader } from "@/components/ui/page-loader";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type InventoryFilter =
  | "ALL"
  | "COVERS"
  | "OTHER_ACCESSORIES"
  | "MOBILE"
  | "REPAIR_PART"
  | "SPEAKERS_SOUND"
  | "CHARGER_CABLE";

const FILTER_TABS: Array<{ id: InventoryFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "COVERS", label: "Covers" },
  { id: "OTHER_ACCESSORIES", label: "Accessories" },
  { id: "MOBILE", label: "Mobile" },
  { id: "REPAIR_PART", label: "Repair" },
  { id: "SPEAKERS_SOUND", label: "Speakers" },
  { id: "CHARGER_CABLE", label: "Chargers" },
];

function productSubline(p: ProductDto, filter: InventoryFilter): string | null {
  const detail = detailCell(p, filter);
  const parts: string[] = [];
  if (filter === "ALL") parts.push(PRODUCT_KIND_LABELS[p.kind]);
  if (detail !== "—" && detail !== p.name) parts.push(detail);
  return parts.length ? parts.join(" · ") : null;
}

const PAGE_SIZE = 25;

function isCoverProduct(p: ProductDto) {
  return p.kind === "MOBILE_ACCESSORY" && !!p.phoneModelId;
}

function detailCell(p: ProductDto, filter: InventoryFilter) {
  if (filter === "COVERS" || isCoverProduct(p)) {
    const parts = [p.phoneModel, p.coverTypeName, p.variantName].filter(Boolean);
    const detail = parts.join(" · ");
    if (detail && detail !== p.name) return detail;
    return parts.length > 0 ? parts.join(" · ") : "—";
  }
  if (p.kind === "MOBILE_ACCESSORY") return p.categoryName ?? "Accessory";
  if (p.kind === "REPAIR_PART") {
    return [p.phoneModel, p.partType].filter(Boolean).join(" · ") || "—";
  }
  return "—";
}

function sellPrice(p: ProductDto) {
  return p.kind === "REPAIR_PART" && p.repairCharge
    ? formatMoney(p.repairCharge)
    : formatMoney(p.sellPrice);
}

function addProductHref(filter: InventoryFilter) {
  if (filter === "COVERS") return "/inventory/new?mode=cover";
  if (filter === "OTHER_ACCESSORIES") return "/inventory/new?mode=accessory";
  if (filter === "REPAIR_PART") return "/inventory/new?mode=repair";
  if (filter === "MOBILE" || filter === "SPEAKERS_SOUND" || filter === "CHARGER_CABLE") {
    return "/inventory/new?mode=device";
  }
  return "/inventory/new";
}

function queryForFilter(filter: InventoryFilter) {
  switch (filter) {
    case "COVERS":
      return {
        kind: "MOBILE_ACCESSORY" as ProductKind,
        filters: { segment: "covers" as const },
      };
    case "OTHER_ACCESSORIES":
      return {
        kind: "MOBILE_ACCESSORY" as ProductKind,
        filters: { segment: "other_accessories" as const },
      };
    case "ALL":
      return { kind: undefined, filters: undefined };
    default:
      return { kind: filter as ProductKind, filters: undefined };
  }
}

function InventoryProductCard({
  product: p,
  filter,
}: {
  product: ProductDto;
  filter: InventoryFilter;
}) {
  const subline = productSubline(p, filter);

  return (
    <article className="inventory-card">
      <div className="inventory-card__head">
        <div className="inventory-card__title-wrap">
          <h3 className="inventory-card__title">{p.name}</h3>
          {subline ? <p className="inventory-card__sub">{subline}</p> : null}
        </div>
        <span
          className={
            p.stockQty <= p.minStock ? "inventory-stock-pill low" : "inventory-stock-pill"
          }
        >
          {p.stockQty}
        </span>
      </div>

      <div className="inventory-card__stats">
        <div>
          <span className="inventory-card__stat-label">Cost</span>
          <strong>{formatMoney(p.buyPrice)}</strong>
        </div>
        <div>
          <span className="inventory-card__stat-label">
            {filter === "REPAIR_PART" ? "Repair" : "Sell"}
          </span>
          <strong>{sellPrice(p)}</strong>
        </div>
      </div>

      <Link className="inventory-card__action" href={`/inventory/${p.id}/stock`} title="Add stock">
        <PackagePlus size={16} /> Add stock
      </Link>
    </article>
  );
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>("ALL");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const { kind, filters } = queryForFilter(filter);

  useEffect(() => {
    setPage(1);
  }, [filter]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["products", filter, page],
    queryFn: () => api.getProducts(page, undefined, kind, PAGE_SIZE, undefined, filters),
  });

  const removeProduct = useMutation({
    mutationFn: (productId: string) => api.deleteProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      setDeleteTarget(null);
    },
  });

  const products = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? products.length;
  const totalPages = meta?.totalPages ?? 1;
  return (
    <div className="inventory-page">
      <PageHeader
        title="Inventory"
        subtitle="Stock by category"
        action={
          <Link href={addProductHref(filter)} className="inventory-add-link">
            <button type="button">+ Add product</button>
          </Link>
        }
      />

      <div className="inventory-tabs" role="tablist" aria-label="Inventory categories">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={filter === tab.id ? "tab active" : "tab"}
            onClick={() => setFilter(tab.id)}
          >
            {tab.label}
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
          title={
            filter === "COVERS"
              ? "No covers yet"
              : filter === "OTHER_ACCESSORIES"
                ? "No other accessories yet"
                : "No products in this category"
          }
          description={
            filter === "COVERS"
              ? "Add a cover: pick phone model, cover type, then design."
              : "Add items with the correct product type."
          }
          action={
            <Link href={addProductHref(filter)}>
              <button type="button">
                {filter === "COVERS" ? "Add cover" : "Add product"}
              </button>
            </Link>
          }
        />
      )}
      {!isLoading && !error && products.length > 0 && (
        <>
          <div className="inventory-table-desktop data-table-wrap">
            <table className="data-list inventory-table">
              <thead>
                <tr>
                  <th className="col-product">Product</th>
                  <th className="col-stock">Stock</th>
                  <th className="col-cost">Cost</th>
                  <th className="col-sell">
                    {filter === "REPAIR_PART" ? "Repair" : "Sell"}
                  </th>
                  <th className="col-action" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const subline = productSubline(p, filter);

                  return (
                    <tr key={p.id}>
                      <td className="col-product">
                        <div className="inventory-product-name" title={p.name}>
                          {p.name}
                        </div>
                        {subline ? (
                          <div className="inventory-product-sub" title={subline}>
                            {subline}
                          </div>
                        ) : null}
                      </td>
                      <td className="col-stock">
                        <span
                          className={
                            p.stockQty <= p.minStock
                              ? "inventory-stock-pill low"
                              : "inventory-stock-pill"
                          }
                        >
                          {p.stockQty}
                        </span>
                      </td>
                      <td className="col-cost inventory-money">{formatMoney(p.buyPrice)}</td>
                      <td className="col-sell inventory-money">{sellPrice(p)}</td>
                      <td className="col-action">
                        <div className="row-actions">
                          <Link
                            className="inventory-stock-btn"
                            href={`/inventory/${p.id}/stock`}
                            title="Add stock"
                            aria-label={`Add stock for ${p.name}`}
                          >
                            <PackagePlus size={16} />
                          </Link>
                          <button
                            type="button"
                            className="inventory-stock-btn danger"
                            title="Delete product"
                            aria-label={`Delete ${p.name}`}
                            onClick={() => setDeleteTarget({ id: p.id, name: p.name })}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="inventory-card-list">
            {products.map((p) => (
              <InventoryProductCard key={p.id} product={p} filter={filter} />
            ))}
          </div>

          <div className="inventory-footer">
            <div className="inventory-footer-left muted">
              {total} product{total === 1 ? "" : "s"}
              {isFetching && !isLoading ? " · Updating…" : ""}
            </div>
            <div className="inventory-footer-right">
              <span className="inventory-pages muted">{page}/{totalPages}</span>
              <div className="inventory-pages">
                <button
                  type="button"
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete product?"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.name}" permanently? Stock history will be deleted. Linked sales and repair records will be updated.`
            : ""
        }
        error={removeProduct.error ? (removeProduct.error as Error).message : null}
        loading={removeProduct.isPending}
        onCancel={() => {
          removeProduct.reset();
          setDeleteTarget(null);
        }}
        onConfirm={() => deleteTarget && removeProduct.mutate(deleteTarget.id)}
      />
    </div>
  );
}
