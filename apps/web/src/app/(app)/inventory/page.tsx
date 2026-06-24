"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { PackagePlus, Pencil, Search, Trash2 } from "lucide-react";
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
import { FormModal } from "@/components/ui/form-modal";
import { parseMoneyInput } from "@/lib/format";

type InventoryFilter =
  | "ALL"
  | "COVERS"
  | "OTHER_ACCESSORIES"
  | "ANDROID_MOBILE"
  | "BASIC_MOBILE"
  | "REPAIR_PART";

const FILTER_TABS: Array<{ id: InventoryFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "COVERS", label: "Covers" },
  { id: "OTHER_ACCESSORIES", label: "Accessories" },
  { id: "ANDROID_MOBILE", label: "Android Mobile" },
  { id: "BASIC_MOBILE", label: "Basic Mobile" },
  { id: "REPAIR_PART", label: "Repair" },
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
  if (filter === "ANDROID_MOBILE" || filter === "BASIC_MOBILE") {
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

type EditProductDraft = {
  name: string;
  buyPrice: string;
  sellPrice: string;
  repairCharge: string;
  minStock: string;
};

function productToDraft(p: ProductDto): EditProductDraft {
  return {
    name: p.name,
    buyPrice: p.buyPrice,
    sellPrice: p.sellPrice,
    repairCharge: p.repairCharge ?? "",
    minStock: String(p.minStock),
  };
}

function InventoryProductCard({
  product: p,
  filter,
  onEdit,
}: {
  product: ProductDto;
  filter: InventoryFilter;
  onEdit: (product: ProductDto) => void;
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

      <div className="inventory-card__actions">
        <button type="button" className="inventory-card__action secondary" onClick={() => onEdit(p)}>
          <Pencil size={16} /> Edit
        </button>
        <Link className="inventory-card__action" href={`/inventory/${p.id}/stock`} title="Add stock">
          <PackagePlus size={16} /> Add stock
        </Link>
      </div>
    </article>
  );
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>("ALL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [coverPhoneModelId, setCoverPhoneModelId] = useState("");
  const [coverTypeName, setCoverTypeName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<ProductDto | null>(null);
  const [editDraft, setEditDraft] = useState<EditProductDraft | null>(null);
  const { kind, filters } = queryForFilter(filter);

  const productFilters = useMemo(() => {
    if (filter !== "COVERS") return filters;
    return {
      segment: "covers" as const,
      ...(coverPhoneModelId && { phoneModelId: coverPhoneModelId }),
      ...(coverTypeName && { coverTypeName }),
    };
  }, [filter, filters, coverPhoneModelId, coverTypeName]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    if (filter !== "COVERS") {
      setCoverPhoneModelId("");
      setCoverTypeName("");
    }
  }, [filter]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, coverPhoneModelId, coverTypeName]);

  const { data: phoneModelsData } = useQuery({
    queryKey: ["phone-models"],
    queryFn: () => api.getPhoneModels(),
    enabled: filter === "COVERS",
  });

  const { data: coverTypesData } = useQuery({
    queryKey: ["cover-types", "catalog"],
    queryFn: () => api.getCoverTypes(),
    enabled: filter === "COVERS",
  });

  const { data: coverStats } = useQuery({
    queryKey: ["covers-stats"],
    queryFn: () => api.getCoverProductStats(),
    enabled: filter === "COVERS",
  });

  const productCountByModel = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of coverStats?.byModel ?? []) {
      counts.set(row.phoneModelId, row.count);
    }
    return counts;
  }, [coverStats]);

  const productCountByTypeName = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of coverStats?.byType ?? []) {
      counts.set(row.name, row.count);
    }
    return counts;
  }, [coverStats]);

  const coverModelOptions = useMemo(() => {
    return (phoneModelsData?.data ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      count: productCountByModel.get(m.id) ?? 0,
    }));
  }, [phoneModelsData, productCountByModel]);

  const coverTypeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of coverTypesData?.data ?? []) {
      if (t.name) names.add(t.name);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        count: productCountByTypeName.get(name) ?? 0,
      }));
  }, [coverTypesData, productCountByTypeName]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["products", filter, page, searchDebounced, coverPhoneModelId, coverTypeName],
    queryFn: () =>
      api.getProducts(
        page,
        searchDebounced || undefined,
        kind,
        PAGE_SIZE,
        undefined,
        productFilters,
      ),
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, draft, kind }: { id: string; draft: EditProductDraft; kind: ProductKind }) =>
      api.updateProduct(id, {
        name: draft.name.trim(),
        buyPrice: parseMoneyInput(draft.buyPrice),
        sellPrice: parseMoneyInput(draft.sellPrice),
        ...(kind === "REPAIR_PART" && {
          repairCharge: parseMoneyInput(draft.repairCharge),
        }),
        minStock: Math.max(0, parseInt(draft.minStock, 10) || 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["covers-stats"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditTarget(null);
      setEditDraft(null);
      updateProduct.reset();
    },
  });

  const removeProduct = useMutation({
    mutationFn: (productId: string) => api.deleteProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["covers-stats"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTarget(null);
    },
  });

  const products = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? products.length;
  const totalPages = meta?.totalPages ?? 1;

  const openEdit = (product: ProductDto) => {
    setEditTarget(product);
    setEditDraft(productToDraft(product));
  };

  const closeEdit = () => {
    setEditTarget(null);
    setEditDraft(null);
    updateProduct.reset();
  };

  return (
    <div className="inventory-page">
      <PageHeader
        title="Inventory"
        subtitle="Stock by category"
        action={
          <div className="inventory-top-actions">
            <div className="recharge-search inventory-search">
              <Search size={16} />
              <input
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Link href={addProductHref(filter)} className="inventory-add-link">
              <button type="button">+ Add product</button>
            </Link>
          </div>
        }
      />

      <div className="inventory-tabs-bar">
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

        {filter === "COVERS" && (
          <div className="inventory-cover-filters">
            <select
              className="inventory-cover-select"
              value={coverTypeName}
              onChange={(e) => setCoverTypeName(e.target.value)}
              aria-label="Filter by cover category"
            >
              <option value="">All cover categories</option>
              {coverTypeOptions.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.count})
                </option>
              ))}
            </select>
            <select
              className="inventory-cover-select"
              value={coverPhoneModelId}
              onChange={(e) => setCoverPhoneModelId(e.target.value)}
              aria-label="Filter by phone model"
            >
              <option value="">All phone models</option>
              {coverModelOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.count})
                </option>
              ))}
            </select>
          </div>
        )}
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
              ? "Add a cover: pick phone model, cover category, then design."
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
                  <th className="col-action">Actions</th>
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
                          <button
                            type="button"
                            className="inventory-action-btn"
                            title="Edit product"
                            aria-label={`Edit ${p.name}`}
                            onClick={() => openEdit(p)}
                          >
                            Edit
                          </button>
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
              <InventoryProductCard key={p.id} product={p} filter={filter} onEdit={openEdit} />
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

      <FormModal open={!!editTarget && !!editDraft} title="Edit product" onClose={closeEdit}>
        {editTarget && editDraft && (
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              updateProduct.mutate({
                id: editTarget.id,
                draft: editDraft,
                kind: editTarget.kind,
              });
            }}
          >
            <label className="stat-label">Product name</label>
            <input
              value={editDraft.name}
              onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
              required
            />

            <label className="stat-label">Cost price (₹)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={editDraft.buyPrice}
              onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, buyPrice: e.target.value } : prev))}
              required
            />

            {editTarget.kind === "REPAIR_PART" ? (
              <>
                <label className="stat-label">Repair charge (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDraft.repairCharge}
                  onChange={(e) =>
                    setEditDraft((prev) => (prev ? { ...prev, repairCharge: e.target.value } : prev))
                  }
                  required
                />
              </>
            ) : (
              <>
                <label className="stat-label">Sell price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDraft.sellPrice}
                  onChange={(e) =>
                    setEditDraft((prev) => (prev ? { ...prev, sellPrice: e.target.value } : prev))
                  }
                  required
                />
              </>
            )}

            <label className="stat-label">Minimum stock alert</label>
            <input
              type="number"
              step="1"
              min="0"
              value={editDraft.minStock}
              onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, minStock: e.target.value } : prev))}
            />

            {updateProduct.error && <p className="error">{(updateProduct.error as Error).message}</p>}
            <button type="submit" disabled={updateProduct.isPending}>
              {updateProduct.isPending ? "Saving…" : "Save changes"}
            </button>
          </form>
        )}
      </FormModal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove product?"
        message={
          deleteTarget
            ? `Remove "${deleteTarget.name}" from inventory? Past sales and income records will stay unchanged.`
            : ""
        }
        confirmLabel="Remove"
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
