"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PRODUCT_KIND_LABELS,
  getEffectiveSalePrice,
  getProductDisplayName,
  getProductDiscount,
  type ProductDto,
  type ProductKind,
} from "@sk-mobile/shared";
import {
  CircleDollarSign,
  Filter,
  Minus,
  Plus,
  ScanLine,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { formatMoney, parseMoneyInput } from "@/lib/format";

type CartLine = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  maxStock: number;
  kind: ProductKind;
};

function unitSalePrice(p: ProductDto): number {
  return getEffectiveSalePrice(p);
}

const PAGE_SIZE = 20;
const EXCLUDE_KINDS: ProductKind[] = ["REPAIR_PART"];

const TABS: Array<{ key: "ALL" | ProductKind; label: string }> = [
  { key: "ALL", label: "All Products" },
  { key: "MOBILE", label: "Mobile" },
  { key: "MOBILE_ACCESSORY", label: "Accessories" },
  { key: "SPEAKERS_SOUND", label: "Speakers" },
  { key: "CHARGER_CABLE", label: "Charger & Cable" },
];

export default function NewSalePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanMode = searchParams.get("scan") === "1";
  const qc = useQueryClient();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [scanBuffer, setScanBuffer] = useState("");
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartError, setCartError] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [discount, setDiscount] = useState("");
  const [warrantyNote, setWarrantyNote] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!scanMode) return;
    scanInputRef.current?.focus();
  }, [scanMode]);

  async function handleScanSubmit(raw: string) {
    const code = raw.trim();
    if (!code) return;
    setScanStatus(null);
    setCartError("");
    try {
      const { product } = await api.scanProduct(code);
      addToCart(product);
      setScanStatus(`Added: ${getProductDisplayName(product)}`);
    } catch (e) {
      setScanStatus((e as Error).message || "Product not found");
    }
    setScanBuffer("");
    scanInputRef.current?.focus();
  }

  const {
    data: productsRes,
    isPending,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["products", "sale", page, searchDebounced, tab],
    queryFn: () =>
      api.getProducts(
        page,
        searchDebounced || undefined,
        tab === "ALL" ? undefined : tab,
        PAGE_SIZE,
        EXCLUDE_KINDS,
      ),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Standard UX: keep last results while fetching next filter/search page
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const products = productsRes?.data ?? [];
  const meta = productsRes?.meta;

  const create = useMutation({
    mutationFn: () =>
      api.createSale({
        date: today,
        customerName: customerName || undefined,
        paymentMethod,
        discount: discountValue,
        warrantyNote: warrantyNote.trim() || undefined,
        lines: cart.map((c) => ({ productId: c.productId, quantity: c.qty, unitPrice: c.unitPrice })),
      }),
    onSuccess: (sale) => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      router.push(`/sales/${sale.id}/invoice`);
    },
  });

  function addToCart(p: ProductDto) {
    setCartError("");
    const quantity = 1;
    if (quantity < 1) {
      setCartError("Quantity must be at least 1");
      return;
    }
    const inCart = cart.find((c) => c.productId === p.id);
    const alreadyInCart = inCart?.qty ?? 0;
    if (alreadyInCart + quantity > p.stockQty) {
      setCartError(`Only ${p.stockQty} in stock for ${getProductDisplayName(p)}`);
      return;
    }
    if (inCart) {
      setCart((prev) =>
        prev.map((c) =>
          c.productId === p.id ? { ...c, qty: c.qty + quantity } : c,
        ),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: p.id,
          name: getProductDisplayName(p),
          qty: quantity,
          unitPrice: unitSalePrice(p),
          maxStock: p.stockQty,
          kind: p.kind,
        },
      ]);
    }
  }

  const subtotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const discountValue = parseMoneyInput(discount);
  const total = Math.max(0, subtotal - discountValue);
  const received = parseMoneyInput(amountReceived);
  const change = Math.max(0, received - total);

  const totalPages = meta?.totalPages ?? 1;
  const totalItems = meta?.total ?? products.length;

  return (
    <div className="pos-page">
      <PageHeader
        title="Sales (POS)"
        subtitle="Create new sale and add products to cart."
      />
      {isPending && <PageLoader message="Loading inventory…" />}
      {error && (
        <div className="card error-card">
          <p className="error">{(error as Error).message}</p>
        </div>
      )}
      {!isPending && !error && (
        <div className="pos-shell">
          {scanMode && (
            <div className="pos-scan-banner">
              <div>
                <strong>
                  <ScanLine size={16} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Scanner ready
                </strong>
                <div className="muted" style={{ fontSize: 12 }}>
                  Scan barcode with USB gun — item adds to cart automatically.
                </div>
                {scanStatus && <div style={{ fontSize: 12, marginTop: 4 }}>{scanStatus}</div>}
              </div>
              <input
                ref={scanInputRef}
                className="pos-scan-input"
                value={scanBuffer}
                onChange={(e) => setScanBuffer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleScanSubmit(scanBuffer);
                  }
                }}
                aria-label="Barcode scanner input"
                autoComplete="off"
              />
            </div>
          )}
          <div className="pos-left">
            <div className="pos-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={t.key === tab ? "pos-tab active" : "pos-tab"}
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="pos-toolbar">
              <div className="pos-search">
                <Search size={16} />
                <input
                  placeholder="Search by name or model…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <button type="button" className="secondary pos-filter" title="Filter (coming soon)">
                <Filter size={16} />
                Filter
              </button>
            </div>

            {isFetching && (
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                Updating…
              </div>
            )}

            {products.length === 0 && !isFetching ? (
              <div className="card" style={{ padding: "1.1rem" }}>
                <p className="muted" style={{ margin: 0 }}>
                  No products found.
                </p>
              </div>
            ) : (
              <div className="pos-product-list card">
                <div className="pos-grid">
                {products.map((p) => {
                  const out = p.stockQty <= 0;
                  const inCart = cart.find((c) => c.productId === p.id);
                  const disc = getProductDiscount(p);
                  const price = disc.hasDiscount ? p.effectivePrice : p.sellPrice;
                  return (
                    <div
                      key={p.id}
                      className={`pos-product${out ? " disabled" : ""}`}
                    >
                      <div className="pos-row-left">
                        <div className="pos-row-title">{p.name}</div>
                        <div className="pos-row-meta">
                          <span className="pos-row-kind">{PRODUCT_KIND_LABELS[p.kind]}</span>
                          <span className={`pos-stock ${out ? "out" : "in"}`}>
                            {out ? "Out of Stock" : `In Stock: ${p.stockQty}`}
                          </span>
                          {inCart && <span className="pos-row-incart">In cart: {inCart.qty}</span>}
                        </div>
                      </div>

                      <div className="pos-row-right">
                        <div className="pos-product-price">
                          {disc.hasDiscount ? (
                            <>
                              <span className="muted" style={{ textDecoration: "line-through", fontSize: 11 }}>
                                {formatMoney(p.sellPrice)}
                              </span>{" "}
                              {formatMoney(price)}
                            </>
                          ) : (
                            formatMoney(price)
                          )}
                        </div>
                        <button
                          type="button"
                          className="pos-add"
                          disabled={out}
                          onClick={() => addToCart(p)}
                        >
                          + Add
                        </button>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            )}

            <div className="pos-pagination">
              <div className="muted" style={{ fontSize: 12 }}>
                Showing {products.length} item{products.length === 1 ? "" : "s"} of {totalItems}
              </div>
              <div className="pos-pages">
                <button
                  type="button"
                  className="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <div className="pos-page-pill">
                  {page} / {totalPages}
                </div>
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

          <div className="pos-right">
            <div className="pos-cart card">
              <div className="pos-cart-header">
                <div className="pos-cart-title">
                  <ShoppingCart size={18} /> Current Cart <span className="muted">({cart.length} items)</span>
                </div>
                <button
                  type="button"
                  className="secondary pos-clear"
                  disabled={cart.length === 0}
                  onClick={() => setCart([])}
                >
                  <Trash2 size={16} /> Clear Cart
                </button>
              </div>

              {(cartError || create.error) && (
                <p className="error">{cartError || (create.error as Error).message}</p>
              )}

              {cart.length === 0 ? (
                <div className="muted">No items</div>
              ) : (
                <div className="pos-cart-lines">
                  {cart.map((c) => (
                    <div key={c.productId} className="pos-line">
                      <div className="pos-line-left">
                        <div className="pos-line-title">{c.name}</div>
                        <div className="pos-line-sub">{PRODUCT_KIND_LABELS[c.kind]}</div>
                      </div>
                      <div className="pos-line-qty">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            setCart((prev) =>
                              prev
                                .map((x) =>
                                  x.productId === c.productId ? { ...x, qty: x.qty - 1 } : x,
                                )
                                .filter((x) => x.qty > 0),
                            )
                          }
                        >
                          <Minus size={16} />
                        </button>
                        <div className="pos-qty">{c.qty}</div>
                        <button
                          type="button"
                          className="secondary"
                          disabled={c.qty >= c.maxStock}
                          onClick={() =>
                            setCart((prev) =>
                              prev.map((x) =>
                                x.productId === c.productId ? { ...x, qty: x.qty + 1 } : x,
                              ),
                            )
                          }
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <div className="pos-line-right">
                        <div className="pos-line-total">{formatMoney(String(c.qty * c.unitPrice))}</div>
                        <button
                          type="button"
                          className="pos-remove"
                          onClick={() => setCart((prev) => prev.filter((x) => x.productId !== c.productId))}
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pos-summary">
                <div className="pos-sum-row">
                  <span className="muted">Subtotal</span>
                  <span>{formatMoney(String(subtotal))}</span>
                </div>
                <div className="pos-sum-row">
                  <span className="muted">Discount</span>
                  <span className="pos-inline">
                    <CircleDollarSign size={16} />
                    <input
                      className="pos-inline-input"
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                    />
                  </span>
                </div>
                <div className="pos-sum-total">
                  <div className="muted">Total Amount</div>
                  <div className="pos-total">{formatMoney(String(total))}</div>
                </div>
              </div>

              <div className="pos-payment">
                <div className="pos-pay-title muted">Payment Method</div>
                <div className="pos-pay-tabs">
                  {(["CASH", "UPI", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={paymentMethod === m ? "pos-pay active" : "pos-pay secondary"}
                      onClick={() => setPaymentMethod(m)}
                    >
                      {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : "Card"}
                    </button>
                  ))}
                </div>

                <div className="pos-pay-grid">
                  <div>
                    <div className="muted pos-field-label">Amount Received</div>
                    <input
                      type="number"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <div className="muted pos-field-label">Change</div>
                    <div className="pos-change">{formatMoney(String(change))}</div>
                  </div>
                </div>
              </div>

              <div className="pos-warranty">
                <div className="muted pos-field-label">Warranty / guarantee (optional)</div>
                <textarea
                  rows={3}
                  value={warrantyNote}
                  onChange={(e) => setWarrantyNote(e.target.value)}
                  placeholder="Leave blank to use default from Settings → Invoice"
                />
              </div>

              <div className="pos-actions">
                <button
                  type="button"
                  disabled={cart.length === 0 || create.isPending}
                  onClick={() => {
                    if (discountValue > subtotal) {
                      setCartError("Discount cannot exceed subtotal.");
                      return;
                    }
                    setCartError("");
                    create.mutate();
                  }}
                >
                  {create.isPending ? "Processing…" : "Complete Sale"}
                </button>
                <button type="button" className="secondary" disabled>
                  Hold Sale
                </button>
              </div>

              <div className="pos-foot muted">
                Completing sale reduces stock for each item automatically.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
