"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Barcode, ChevronLeft, ChevronRight, Printer, Search } from "lucide-react";
import {
  getEffectiveSalePrice,
  getProductDisplayName,
  type ProductDto,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { ProductLabel } from "@/components/qr/product-label";
import { ProductLabelSheet } from "@/components/qr/product-label-sheet";

const PAGE_SIZE = 24;

export default function QrLabelsPage() {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, ProductDto>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["products", "qr-labels", searchDebounced, page],
    queryFn: () => api.getProducts(page, searchDebounced || undefined, undefined, PAGE_SIZE),
    staleTime: 60_000,
  });

  const products = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;
  const total = meta?.total ?? products.length;
  const selectedList = Object.values(selected);

  function toggle(p: ProductDto) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });
  }

  function printLabels() {
    if (selectedList.length === 0) return;
    window.print();
  }

  return (
    <div className="qr-labels-page">
      <PageHeader
        title="Barcode Labels"
        subtitle="Select products, preview stickers, then print name + barcode + SKU + price"
      />

      <div className="qr-labels-toolbar card">
        <div className="qr-labels-search">
          <Search size={16} aria-hidden />
          <input
            type="search"
            placeholder="Search by name, model, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="qr-labels-toolbar-meta">
          <span className="muted">
            {isFetching ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}
            {selectedList.length > 0 ? ` · ${selectedList.length} selected` : ""}
          </span>
          <button type="button" onClick={printLabels} disabled={selectedList.length === 0}>
            <Printer size={16} /> Print {selectedList.length || ""} label
            {selectedList.length === 1 ? "" : "s"}
          </button>
        </div>
      </div>

      {isLoading && <PageLoader message="Loading products…" />}
      {error && <p className="error">{(error as Error).message}</p>}

      {!isLoading && !error && (
        <>
          <div className="qr-labels-grid">
            {products.map((p) => {
              const on = !!selected[p.id];
              const title = getProductDisplayName(p);
              const price = formatMoney(getEffectiveSalePrice(p));
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`qr-labels-pick card${on ? " selected" : ""}`}
                  onClick={() => toggle(p)}
                >
                  <div className="qr-labels-pick-head">
                    <Barcode size={16} aria-hidden />
                    <span>{on ? "Selected" : "Tap to select"}</span>
                  </div>
                  <div className="qr-labels-pick-info">
                    <div className="qr-labels-pick-title">{title}</div>
                    <div className="qr-labels-pick-sub">
                      {p.sku ? <span>{p.sku}</span> : null}
                      <span className="qr-labels-pick-price">{price}</span>
                    </div>
                  </div>
                  <div className="qr-labels-pick-preview">
                    <ProductLabel product={p} />
                  </div>
                </button>
              );
            })}
            {products.length === 0 && (
              <p className="muted qr-labels-empty">No products found. Add inventory first.</p>
            )}
          </div>

          {totalPages > 1 && (
            <div className="qr-labels-pagination">
              <button
                type="button"
                className="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft size={16} /> Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className="secondary"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {selectedList.length > 0 && (
        <div className="qr-labels-print-area" aria-hidden>
          <ProductLabelSheet products={selectedList} />
        </div>
      )}
    </div>
  );
}
