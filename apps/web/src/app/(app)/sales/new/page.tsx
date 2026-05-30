"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_KIND_LABELS, type ProductDto, type ProductKind } from "@sk-mobile/shared";
import { motion } from "framer-motion";
import {
  CircleDollarSign,
  Filter,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { formatMoney } from "@/lib/format";

type CartLine = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  maxStock: number;
  kind: ProductKind;
};

function unitSalePrice(p: ProductDto): number {
  return parseFloat(p.sellPrice) || 0;
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
  const qc = useQueryClient();
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

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

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
        lines: cart.map((c) => ({ productId: c.productId, quantity: c.qty, unitPrice: c.unitPrice })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      router.push("/sales");
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
      setCartError(`Only ${p.stockQty} in stock for ${p.name}`);
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
          name: p.name,
          qty: quantity,
          unitPrice: unitSalePrice(p),
          maxStock: p.stockQty,
          kind: p.kind,
        },
      ]);
    }
  }

  const subtotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const discountValue = parseFloat(discount) || 0;
  const total = Math.max(0, subtotal - discountValue);
  const received = parseFloat(amountReceived) || 0;
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
                  placeholder="Search by name, model, SKU…"
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
              <div className="pos-grid">
                {products.map((p) => {
                  const out = p.stockQty <= 0;
                  const inCart = cart.find((c) => c.productId === p.id);
                  return (
                    <motion.div
                      key={p.id}
                      className={`pos-product${out ? " disabled" : ""}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
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
                        <div className="pos-product-price">{formatMoney(p.sellPrice)}</div>
                        <button
                          type="button"
                          className="pos-add"
                          disabled={out}
                          onClick={() => addToCart(p)}
                        >
                          + Add
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
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

              <div className="pos-actions">
                <button
                  type="button"
                  disabled={cart.length === 0 || create.isPending}
                  onClick={() => create.mutate()}
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
