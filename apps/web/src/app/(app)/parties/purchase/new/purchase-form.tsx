"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  IndianRupee,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { PRODUCT_KIND_LABELS, type ProductDto, type ProductKind } from "@sk-mobile/shared";
import { InlineAddField } from "@/components/inventory/inline-add-field";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { PurchaseNewProductModal } from "./purchase-new-product-modal";

type ItemMode = "cover" | "product";

type PurchaseCartLine =
  | {
      type: "product";
      key: string;
      productId: string;
      displayName: string;
      kind: ProductKind;
      qty: number;
      unitCost: number;
    }
  | {
      type: "cover";
      key: string;
      phoneModelId: string;
      coverTypeId: string;
      variantName: string;
      displayName: string;
      qty: number;
      unitCost: number;
      sellPrice?: number;
    };

const EXCLUDE_KINDS: ProductKind[] = ["REPAIR_PART"];
const PAGE_SIZE = 20;

const PRODUCT_TABS: Array<{ key: "ALL" | ProductKind; label: string }> = [
  { key: "ALL", label: "All Products" },
  { key: "MOBILE", label: "Mobile" },
  { key: "MOBILE_ACCESSORY", label: "Accessories" },
  { key: "SPEAKERS_SOUND", label: "Speakers" },
  { key: "CHARGER_CABLE", label: "Charger & Cable" },
];

function FormStep({
  step,
  title,
  locked,
  children,
}: {
  step: number;
  title: string;
  locked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`form-step${locked ? " form-step--locked" : ""}`}>
      <div className="form-step__head">
        <span className="form-step__num">{step}</span>
        <span className="form-step__title">{title}</span>
        {locked && <span className="form-step__lock">Complete previous step first</span>}
      </div>
      {!locked && children}
    </div>
  );
}

export default function NewPartyPurchasePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const prefillPartyId = searchParams.get("partyId") ?? "";

  const [itemMode, setItemMode] = useState<ItemMode>("product");
  const [productTab, setProductTab] = useState<(typeof PRODUCT_TABS)[number]["key"]>("ALL");
  const [productPage, setProductPage] = useState(1);

  const [date, setDate] = useState(today);
  const [partyId, setPartyId] = useState(prefillPartyId);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [note, setNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD" | "BANK">("CASH");
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [cart, setCart] = useState<PurchaseCartLine[]>([]);
  const [cartError, setCartError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [phoneModelId, setPhoneModelId] = useState("");
  const [coverTypeId, setCoverTypeId] = useState("");
  const [variantName, setVariantName] = useState("");
  const [coverQty, setCoverQty] = useState("1");
  const [coverCost, setCoverCost] = useState("");
  const [coverSell, setCoverSell] = useState("");
  const [newPhoneModel, setNewPhoneModel] = useState("");
  const [newCoverType, setNewCoverType] = useState("");
  const [newProductOpen, setNewProductOpen] = useState(false);

  useEffect(() => {
    if (prefillPartyId) setPartyId(prefillPartyId);
  }, [prefillPartyId]);

  const { data: partiesRes, isPending: partiesLoading } = useQuery({
    queryKey: ["party-list"],
    queryFn: () => api.getPartyList(),
  });

  const { data: phoneModelsRes } = useQuery({
    queryKey: ["phone-models"],
    queryFn: () => api.getPhoneModels(),
  });

  const { data: coverTypesRes, refetch: refetchCoverTypes } = useQuery({
    queryKey: ["cover-types", phoneModelId],
    queryFn: () => api.getCoverTypes(phoneModelId),
    enabled: !!phoneModelId,
  });

  const addPhoneModel = useMutation({
    mutationFn: () => api.createPhoneModel(newPhoneModel.trim()),
    onSuccess: (pm) => {
      setPhoneModelId(pm.id);
      setNewPhoneModel("");
      setCoverTypeId("");
      qc.invalidateQueries({ queryKey: ["phone-models"] });
      qc.invalidateQueries({ queryKey: ["cover-types"] });
    },
  });

  const addCoverType = useMutation({
    mutationFn: () => api.createCoverType(phoneModelId, newCoverType.trim()),
    onSuccess: (ct) => {
      setCoverTypeId(ct.id);
      setNewCoverType("");
      refetchCoverTypes();
      qc.invalidateQueries({ queryKey: ["cover-types"] });
    },
  });

  const {
    data: productsRes,
    isPending: productsLoading,
    isFetching: productsFetching,
    error: productsError,
  } = useQuery({
    queryKey: ["products", "purchase", productPage, productTab],
    queryFn: () =>
      api.getProducts(
        productPage,
        undefined,
        productTab === "ALL" ? undefined : productTab,
        PAGE_SIZE,
        EXCLUDE_KINDS,
      ),
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const parties = partiesRes?.data ?? [];
  const phoneModels = phoneModelsRes?.data ?? [];
  const coverTypes = coverTypesRes?.data ?? [];
  const products = productsRes?.data ?? [];
  const productMeta = productsRes?.meta;
  const totalPages = productMeta?.totalPages ?? 1;
  const totalItems = productMeta?.total ?? products.length;

  const create = useMutation({
    mutationFn: () =>
      api.createPurchase({
        partyId,
        date,
        invoiceNo: invoiceNo.trim() || undefined,
        note: note.trim() || undefined,
        discount: discountValue,
        paidAmount: paidValue,
        paymentMethod,
        lines: cart.map((c) => {
          if (c.type === "product") {
            return { productId: c.productId, quantity: c.qty, unitCost: c.unitCost };
          }
          return {
            phoneModelId: c.phoneModelId,
            coverTypeId: c.coverTypeId,
            variantName: c.variantName,
            quantity: c.qty,
            unitCost: c.unitCost,
            ...(c.sellPrice != null ? { sellPrice: c.sellPrice } : {}),
          };
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["party-txs"] });
      qc.invalidateQueries({ queryKey: ["party-list"] });
      router.push("/parties");
    },
    onError: (e: Error) => setSubmitError(e.message),
  });

  const subtotal = useMemo(
    () => cart.reduce((sum, c) => sum + c.qty * c.unitCost, 0),
    [cart],
  );
  const discountValue = parseMoneyInput(discount);
  const total = Math.max(0, subtotal - discountValue);
  const paidValue = parseMoneyInput(paidAmount);
  const balanceDue = Math.max(0, total - paidValue);

  const coverStep2Locked = !phoneModelId;
  const coverStep3Locked = coverStep2Locked || !coverTypeId;
  const coverStep4Locked = coverStep3Locked || !variantName.trim();

  function addCoverLine() {
    setCartError("");
    if (!phoneModelId || !coverTypeId) {
      setCartError("Select phone model and cover category.");
      return;
    }
    const variant = variantName.trim();
    if (!variant) {
      setCartError("Enter design / variant name.");
      return;
    }
    const qty = parseInt(coverQty, 10);
    const cost = parseMoneyInput(coverCost);
    if (!qty || qty < 1 || cost < 0) {
      setCartError("Enter valid quantity and buy rate.");
      return;
    }
    const modelName = phoneModels.find((m) => m.id === phoneModelId)?.name ?? "Model";
    const typeName = coverTypes.find((t) => t.id === coverTypeId)?.name ?? "Cover";
    const sell = coverSell.trim() ? parseMoneyInput(coverSell) : undefined;
    const key = `cover-${phoneModelId}-${coverTypeId}-${variant}`;

    setCart((prev) => {
      const existing = prev.find((c) => c.type === "cover" && c.key === key);
      if (existing && existing.type === "cover") {
        return prev.map((c) =>
          c.key === key && c.type === "cover" ? { ...c, qty: c.qty + qty, unitCost: cost } : c,
        );
      }
      return [
        ...prev,
        {
          type: "cover",
          key,
          phoneModelId,
          coverTypeId,
          variantName: variant,
          displayName: `${modelName} – ${typeName} – ${variant}`,
          qty,
          unitCost: cost,
          sellPrice: sell,
        },
      ];
    });
    setVariantName("");
    setCoverQty("1");
    setCoverCost("");
    setCoverSell("");
  }

  function addProductLine(p: ProductDto) {
    setCartError("");
    const cost = parseFloat(p.buyPrice) || 0;
    setCart((prev) => {
      const existing = prev.find((c) => c.type === "product" && c.productId === p.id);
      if (existing && existing.type === "product") {
        return prev.map((c) =>
          c.type === "product" && c.productId === p.id ? { ...c, qty: c.qty + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          type: "product",
          key: p.id,
          productId: p.id,
          displayName: p.name,
          kind: p.kind,
          qty: 1,
          unitCost: cost,
        },
      ];
    });
  }

  function addNewProductToBill(product: ProductDto, qty: number, unitCost: number) {
    setCartError("");
    setCart((prev) => {
      const existing = prev.find((c) => c.type === "product" && c.productId === product.id);
      if (existing && existing.type === "product") {
        return prev.map((c) =>
          c.type === "product" && c.productId === product.id
            ? { ...c, qty: c.qty + qty, unitCost }
            : c,
        );
      }
      return [
        ...prev,
        {
          type: "product",
          key: product.id,
          productId: product.id,
          displayName: product.name,
          kind: product.kind,
          qty,
          unitCost,
        },
      ];
    });
    if (product.kind !== "REPAIR_PART") {
      setProductTab(product.kind);
      setProductPage(1);
    }
    qc.invalidateQueries({ queryKey: ["products", "purchase"] });
  }

  function updateLineCost(key: string, value: string) {
    const cost = parseMoneyInput(value);
    setCart((prev) =>
      prev.map((c) => (c.key === key ? { ...c, unitCost: cost } : c)),
    );
  }

  function handleSave() {
    setSubmitError("");
    setCartError("");
    if (!partyId) {
      setSubmitError("Select a supplier.");
      return;
    }
    if (!cart.length) {
      setSubmitError("Add at least one item.");
      return;
    }
    if (discountValue > subtotal) {
      setSubmitError("Discount cannot exceed subtotal.");
      return;
    }
    if (paidValue > total) {
      setSubmitError("Paid amount cannot exceed total.");
      return;
    }
    create.mutate();
  }

  if (partiesLoading) {
    return <PageLoader message="Loading suppliers…" />;
  }

  const formError =
    submitError || cartError || (create.error as Error | undefined)?.message;

  return (
    <div className="pos-page purchase-pos-page">
      <Link href="/parties" className="page-back-link">
        <ArrowLeft size={16} aria-hidden />
        Back to Parties
      </Link>

      <PageHeader
        title="New purchase"
        subtitle="Add items from supplier — stock updates in inventory automatically"
      />

      <div className="card purchase-supplier-card">
        <div className="purchase-supplier-grid">
          <div className="form-field">
            <label className="form-field__label" htmlFor="purchase-party">
              Supplier
            </label>
            <select
              id="purchase-party"
              value={partyId}
              onChange={(e) => setPartyId(e.target.value)}
            >
              <option value="">Select supplier…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="purchase-date">
              Date
            </label>
            <input
              id="purchase-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="purchase-invoice">
              Invoice # <span className="form-field__optional">optional</span>
            </label>
            <input
              id="purchase-invoice"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder="Supplier bill no."
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="purchase-note">
              Note <span className="form-field__optional">optional</span>
            </label>
            <input
              id="purchase-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any remark"
            />
          </div>
        </div>
        {parties.length === 0 && (
          <p className="muted purchase-supplier-hint">
            Add a supplier in Parties first (+ Party).
          </p>
        )}
      </div>

      <div className="pos-shell">
        <div className="pos-left">
          <div className="pos-tabs purchase-mode-tabs">
            <button
              type="button"
              className={itemMode === "product" ? "pos-tab active" : "pos-tab"}
              onClick={() => setItemMode("product")}
            >
              Other products
            </button>
            <button
              type="button"
              className={itemMode === "cover" ? "pos-tab active" : "pos-tab"}
              onClick={() => setItemMode("cover")}
            >
              Mobile cover
            </button>
          </div>

          {itemMode === "cover" ? (
            <div className="purchase-cover-steps">
              <p className="muted purchase-cover-intro">
                Same steps as Inventory → Add product → Mobile Cover. New designs are created
                automatically if they do not exist yet.
              </p>

              <FormStep step={1} title="Phone model">
                <select
                  value={phoneModelId}
                  onChange={(e) => {
                    setPhoneModelId(e.target.value);
                    setCoverTypeId("");
                  }}
                >
                  <option value="">Select model…</option>
                  {phoneModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <InlineAddField
                  triggerLabel="Add new model"
                  placeholder="e.g. Samsung J7, Redmi Note 13"
                  value={newPhoneModel}
                  onChange={setNewPhoneModel}
                  onAdd={() => addPhoneModel.mutateAsync()}
                  pending={addPhoneModel.isPending}
                />
              </FormStep>

              <FormStep step={2} title="Cover category" locked={coverStep2Locked}>
                <select
                  value={coverTypeId}
                  onChange={(e) => setCoverTypeId(e.target.value)}
                  disabled={!phoneModelId}
                >
                  <option value="">Select category…</option>
                  {coverTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <InlineAddField
                  triggerLabel="Add new cover category"
                  placeholder="e.g. Matte, Ring Light"
                  value={newCoverType}
                  onChange={setNewCoverType}
                  onAdd={() => addCoverType.mutateAsync()}
                  pending={addCoverType.isPending}
                  disabled={!phoneModelId}
                />
              </FormStep>

              <FormStep step={3} title="Design / variant" locked={coverStep3Locked}>
                <input
                  value={variantName}
                  onChange={(e) => setVariantName(e.target.value)}
                  placeholder="e.g. Blue Glitter, Plain Black"
                />
              </FormStep>

              <FormStep step={4} title="Quantity & pricing" locked={coverStep4Locked}>
                <div className="purchase-pricing-grid">
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="cover-qty">
                      Quantity
                    </label>
                    <input
                      id="cover-qty"
                      type="number"
                      min={1}
                      value={coverQty}
                      onChange={(e) => setCoverQty(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="cover-cost">
                      Buy rate (₹)
                    </label>
                    <input
                      id="cover-cost"
                      type="number"
                      min={0}
                      step="0.01"
                      value={coverCost}
                      onChange={(e) => setCoverCost(e.target.value)}
                    />
                  </div>
                  <div className="form-field">
                    <label className="form-field__label" htmlFor="cover-sell">
                      Sell price <span className="form-field__optional">optional</span>
                    </label>
                    <input
                      id="cover-sell"
                      type="number"
                      min={0}
                      step="0.01"
                      value={coverSell}
                      onChange={(e) => setCoverSell(e.target.value)}
                      placeholder="MRP"
                    />
                  </div>
                </div>
                {cartError && itemMode === "cover" && <p className="error">{cartError}</p>}
                <button type="button" className="purchase-cover-add" onClick={addCoverLine}>
                  <Plus size={16} aria-hidden />
                  Add cover to bill
                </button>
              </FormStep>
            </div>
          ) : (
            <>
              <div className="pos-tabs">
                {PRODUCT_TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={t.key === productTab ? "pos-tab active" : "pos-tab"}
                    onClick={() => {
                      setProductTab(t.key);
                      setProductPage(1);
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="pos-toolbar purchase-toolbar">
                <p className="muted purchase-toolbar-hint">
                  Pick from list or add a brand-new product to inventory
                </p>
                <button
                  type="button"
                  className="purchase-new-product-btn"
                  onClick={() => setNewProductOpen(true)}
                >
                  <Plus size={16} aria-hidden />
                  New product
                </button>
              </div>

              {productsLoading && <PageLoader message="Loading products…" />}

              {productsError && !productsLoading && (
                <div className="card error-card">
                  <p className="error">{(productsError as Error).message}</p>
                </div>
              )}

              {productsFetching && !productsLoading && (
                <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                  Updating…
                </div>
              )}

              {!productsLoading && !productsError && products.length === 0 ? (
                <div className="card empty-state purchase-empty-products">
                  <h3>No products found</h3>
                  <p>Add a new product here — it will be saved to inventory and added to this bill.</p>
                  <button type="button" onClick={() => setNewProductOpen(true)}>
                    <Plus size={16} aria-hidden />
                    Add new product
                  </button>
                </div>
              ) : (
                !productsLoading &&
                !productsError &&
                products.length > 0 && (
                  <div className="pos-product-list card">
                    <div className="pos-grid">
                      {products.map((p) => {
                        const inCart = cart.find(
                          (c) => c.type === "product" && c.productId === p.id,
                        );
                        return (
                          <div key={p.id} className="pos-product">
                            <div className="pos-row-left">
                              <div className="pos-row-title">{p.name}</div>
                              <div className="pos-row-meta">
                                <span className="pos-row-kind">{PRODUCT_KIND_LABELS[p.kind]}</span>
                                <span className="pos-stock in">In Stock: {p.stockQty}</span>
                                {inCart && inCart.type === "product" && (
                                  <span className="pos-row-incart">In bill: {inCart.qty}</span>
                                )}
                              </div>
                            </div>
                            <div className="pos-row-right">
                              <div className="pos-product-price">{formatMoney(p.buyPrice)}</div>
                              <button
                                type="button"
                                className="pos-add"
                                onClick={() => addProductLine(p)}
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}

              <div className="pos-pagination">
                <div className="muted" style={{ fontSize: 12 }}>
                  Showing {products.length} item{products.length === 1 ? "" : "s"} of {totalItems}
                </div>
                <div className="pos-pages">
                  <button
                    type="button"
                    className="secondary"
                    disabled={productPage <= 1}
                    onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  >
                    Prev
                  </button>
                  <div className="pos-page-pill">
                    {productPage} / {totalPages}
                  </div>
                  <button
                    type="button"
                    className="secondary"
                    disabled={productPage >= totalPages}
                    onClick={() => setProductPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="pos-right">
          <div className="pos-cart card">
            <div className="pos-cart-header">
              <div className="pos-cart-title">
                <ShoppingBag size={18} />
                Purchase bill
                <span className="muted">({cart.length} items)</span>
              </div>
              <button
                type="button"
                className="secondary pos-clear"
                disabled={cart.length === 0}
                onClick={() => setCart([])}
              >
                <Trash2 size={16} />
                Clear
              </button>
            </div>

            {formError && <p className="error">{formError}</p>}

            {cart.length === 0 ? (
              <div className="muted">No items — add products or a mobile cover</div>
            ) : (
              <div className="pos-cart-lines">
                {cart.map((line) => (
                  <div key={line.key} className="pos-line purchase-line">
                    <div className="pos-line-left">
                      <div className="pos-line-title">{line.displayName}</div>
                      <div className="pos-line-sub">
                        {line.type === "product"
                          ? PRODUCT_KIND_LABELS[line.kind]
                          : "Mobile cover"}
                      </div>
                      <label className="purchase-rate-field">
                        <span className="muted">Buy rate</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitCost || ""}
                          onChange={(e) => updateLineCost(line.key, e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="pos-line-qty">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setCart((prev) =>
                            prev
                              .map((c) =>
                                c.key === line.key ? { ...c, qty: c.qty - 1 } : c,
                              )
                              .filter((c) => c.qty > 0),
                          )
                        }
                      >
                        <Minus size={16} />
                      </button>
                      <div className="pos-qty">{line.qty}</div>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setCart((prev) =>
                            prev.map((c) =>
                              c.key === line.key ? { ...c, qty: c.qty + 1 } : c,
                            ),
                          )
                        }
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="pos-line-right">
                      <div className="pos-line-total">
                        {formatMoney(String(line.qty * line.unitCost))}
                      </div>
                      <button
                        type="button"
                        className="pos-remove"
                        onClick={() => setCart((prev) => prev.filter((c) => c.key !== line.key))}
                        aria-label="Remove"
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
                  <IndianRupee size={15} />
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
              <div className="pos-pay-tabs purchase-pay-tabs">
                {(["CASH", "UPI", "CARD", "BANK"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={paymentMethod === m ? "pos-pay active" : "pos-pay secondary"}
                    onClick={() => setPaymentMethod(m)}
                  >
                    {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : m === "CARD" ? "Card" : "Bank"}
                  </button>
                ))}
              </div>
              <div className="pos-pay-grid">
                <div>
                  <div className="muted pos-field-label">Paid now</div>
                  <input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <div className="muted pos-field-label">Balance due</div>
                  <div className="pos-change">{formatMoney(String(balanceDue))}</div>
                </div>
              </div>
            </div>

            <div className="pos-actions purchase-actions">
              <button
                type="button"
                disabled={cart.length === 0 || create.isPending}
                onClick={handleSave}
              >
                {create.isPending ? "Saving…" : "Save purchase"}
              </button>
            </div>

            <div className="pos-foot muted">
              Saving adds stock to inventory and updates supplier ledger.
            </div>
          </div>
        </div>
      </div>

      <PurchaseNewProductModal
        open={newProductOpen}
        onClose={() => setNewProductOpen(false)}
        productTab={productTab}
        onAdded={addNewProductToBill}
      />
    </div>
  );
}
