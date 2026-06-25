"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Barcode,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import {
  getEffectiveSalePrice,
  getProductDisplayName,
  type ProductDto,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { ProductLabel, type LabelSize } from "@/components/qr/product-label";
import { ProductLabelSheet, type LabelEntry } from "@/components/qr/product-label-sheet";

const PAGE_SIZE = 24;

const LABEL_SIZES: Array<{ key: LabelSize; label: string; desc: string }> = [
  { key: "38x21", label: "65 Labels", desc: "38×21mm" },
  { key: "48x24", label: "48 Labels", desc: "48×24mm" },
  { key: "64x34", label: "24 Labels", desc: "64×34mm" },
  { key: "100x44", label: "12 Labels", desc: "100×44mm" },
];

type QueueItem = { product: ProductDto; qty: number };

export default function QrLabelsPage() {
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [labelSize, setLabelSize] = useState<LabelSize>("48x24");
  const [queue, setQueue] = useState<Record<string, QueueItem>>({});

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
  const queueList = Object.values(queue);
  const totalLabels = queueList.reduce((s, q) => s + q.qty, 0);

  function addToQueue(p: ProductDto) {
    setQueue((prev) => {
      const existing = prev[p.id];
      if (existing) {
        return { ...prev, [p.id]: { ...existing, qty: existing.qty + 1 } };
      }
      return { ...prev, [p.id]: { product: p, qty: 1 } };
    });
  }

  function setQty(id: string, qty: number) {
    if (qty <= 0) {
      setQueue((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setQueue((prev) => ({
        ...prev,
        [id]: { ...prev[id], qty },
      }));
    }
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function printLabels() {
    if (totalLabels === 0) return;
    window.print();
  }

  const entries: LabelEntry[] = queueList.map((q) => ({
    product: q.product,
    qty: q.qty,
  }));

  return (
    <div className="qr-labels-page">
      <PageHeader
        title="Barcode Labels"
        subtitle="Select products, set quantities, choose size, then print"
      />

      {/* ── Size selector ── */}
      <div className="qr-labels-sizes card">
        <div className="qr-labels-sizes-title">Label Size</div>
        <div className="qr-labels-sizes-row">
          {LABEL_SIZES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`qr-size-btn${labelSize === s.key ? " active" : ""}`}
              onClick={() => setLabelSize(s.key)}
            >
              <strong>{s.label}</strong>
              <span className="muted">{s.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Toolbar ── */}
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
          </span>
        </div>
      </div>

      {isLoading && <PageLoader message="Loading products…" />}
      {error && <p className="error">{(error as Error).message}</p>}

      {!isLoading && !error && (
        <>
          {/* ── Product grid ── */}
          <div className="qr-labels-grid">
            {products.map((p) => {
              const inQueue = !!queue[p.id];
              const title = getProductDisplayName(p);
              const price = formatMoney(getEffectiveSalePrice(p));
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`qr-labels-pick card${inQueue ? " selected" : ""}`}
                  onClick={() => addToQueue(p)}
                >
                  <div className="qr-labels-pick-head">
                    <Barcode size={16} aria-hidden />
                    <span>{inQueue ? `In queue (${queue[p.id].qty})` : "Tap to add"}</span>
                  </div>
                  <div className="qr-labels-pick-info">
                    <div className="qr-labels-pick-title">{title}</div>
                    <div className="qr-labels-pick-sub">
                      {p.sku ? <span>{p.sku}</span> : null}
                      <span className="qr-labels-pick-price">{price}</span>
                    </div>
                  </div>
                  <div className="qr-labels-pick-preview">
                    <ProductLabel product={p} size={labelSize} />
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

      {/* ── Print Queue ── */}
      {queueList.length > 0 && (
        <div className="qr-print-queue card">
          <div className="qr-queue-header">
            <div className="qr-queue-title">
              <Printer size={18} />
              Print Queue
              <span className="muted">
                ({queueList.length} product{queueList.length > 1 ? "s" : ""} · {totalLabels} label
                {totalLabels > 1 ? "s" : ""})
              </span>
            </div>
            <button type="button" onClick={printLabels}>
              <Printer size={16} /> Print {totalLabels} Labels
            </button>
          </div>

          <div className="qr-queue-list">
            {queueList.map((q) => (
              <div key={q.product.id} className="qr-queue-item">
                <div className="qr-queue-item-info">
                  <div className="qr-queue-item-name">{q.product.name}</div>
                  <div className="qr-queue-item-sku muted">{q.product.sku || "—"}</div>
                </div>
                <div className="qr-queue-item-controls">
                  <button
                    type="button"
                    className="secondary qr-qty-btn"
                    onClick={() => setQty(q.product.id, q.qty - 1)}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    className="qr-qty-input"
                    value={q.qty}
                    min={1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v > 0) setQty(q.product.id, v);
                    }}
                  />
                  <button
                    type="button"
                    className="secondary qr-qty-btn"
                    onClick={() => setQty(q.product.id, q.qty + 1)}
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="qr-remove-btn"
                    onClick={() => removeFromQueue(q.product.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hidden print area ── */}
      {totalLabels > 0 && (
        <div className="qr-labels-print-area" aria-hidden>
          <ProductLabelSheet entries={entries} size={labelSize} />
        </div>
      )}
    </div>
  );
}
