"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PRODUCT_KIND_LABELS,
  type ProductDto,
  type ProductKind,
} from "@sk-mobile/shared";
import { InlineAddField } from "@/components/inventory/inline-add-field";
import { FormModal } from "@/components/ui/form-modal";
import { api } from "@/lib/api";
import { parseMoneyInput } from "@/lib/format";

type PurchaseProductKind = Extract<
  ProductKind,
  "MOBILE" | "MOBILE_ACCESSORY" | "SPEAKERS_SOUND" | "CHARGER_CABLE"
>;

const KIND_OPTIONS: PurchaseProductKind[] = [
  "MOBILE",
  "MOBILE_ACCESSORY",
  "SPEAKERS_SOUND",
  "CHARGER_CABLE",
];

function defaultKindFromTab(tab: ProductKind | "ALL"): PurchaseProductKind {
  if (tab === "ALL") return "MOBILE_ACCESSORY";
  if (tab === "REPAIR_PART") return "MOBILE_ACCESSORY";
  return tab;
}

function namePlaceholder(kind: PurchaseProductKind): string {
  if (kind === "MOBILE") return "e.g. Samsung A15 4/64";
  if (kind === "SPEAKERS_SOUND") return "e.g. Boat Rockerz 255";
  if (kind === "CHARGER_CABLE") return "e.g. 25W Type-C Cable";
  return "e.g. Sandisk 64GB Pendrive";
}

export function PurchaseNewProductModal({
  open,
  onClose,
  productTab,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  productTab: ProductKind | "ALL";
  onAdded: (product: ProductDto, qty: number, unitCost: number) => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<PurchaseProductKind>(defaultKindFromTab(productTab));
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [qty, setQty] = useState("1");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      setKind(defaultKindFromTab(productTab));
      setFormError("");
    }
  }, [open, productTab]);

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
    enabled: open && kind === "MOBILE_ACCESSORY",
  });

  const reservedCategoryNames = new Set(Object.values(PRODUCT_KIND_LABELS));
  const categories = (categoriesRes?.data ?? []).filter(
    (c) => !reservedCategoryNames.has(c.name),
  );

  const addCategory = useMutation({
    mutationFn: () => api.createCategory(newCategory.trim()),
    onSuccess: (cat) => {
      setCategoryId(cat.id);
      setNewCategory("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.createProduct({
        kind,
        name: name.trim(),
        categoryId: kind === "MOBILE_ACCESSORY" && categoryId ? categoryId : undefined,
        buyPrice: parseMoneyInput(buyPrice),
        sellPrice: sellPrice.trim() ? parseMoneyInput(sellPrice) : parseMoneyInput(buyPrice),
        minStock: 0,
        openingStock: 0,
      }),
    onSuccess: (product) => {
      const quantity = Math.max(1, parseInt(qty, 10) || 1);
      const unitCost = parseMoneyInput(buyPrice);
      qc.invalidateQueries({ queryKey: ["products"] });
      onAdded(product, quantity, unitCost);
      resetAndClose();
    },
    onError: (e: Error) => setFormError(e.message),
  });

  function resetAndClose() {
    setCategoryId("");
    setNewCategory("");
    setName("");
    setBuyPrice("");
    setSellPrice("");
    setQty("1");
    setFormError("");
    onClose();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    const cost = parseMoneyInput(buyPrice);
    if (cost < 0) {
      setFormError("Enter a valid buy rate.");
      return;
    }
    const quantity = parseInt(qty, 10);
    if (!quantity || quantity < 1) {
      setFormError("Quantity must be at least 1.");
      return;
    }
    create.mutate();
  }

  return (
    <FormModal
      open={open}
      title="Add new product"
      subtitle="Creates in inventory and adds to this purchase bill. Stock comes from this bill, not opening stock."
      size="lg"
      onClose={resetAndClose}
    >
      <form className="form-stack purchase-new-product-form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-field__label" htmlFor="new-product-kind">
            Product type
          </label>
          <select
            id="new-product-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as PurchaseProductKind)}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {PRODUCT_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        {kind === "MOBILE_ACCESSORY" && (
          <>
            <div className="form-field">
              <label className="form-field__label" htmlFor="new-product-category">
                Accessory category <span className="form-field__optional">optional</span>
              </label>
              <select
                id="new-product-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">General accessory</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <InlineAddField
              triggerLabel="Add new category"
              placeholder="e.g. Memory/Pendrive, Earphones"
              value={newCategory}
              onChange={setNewCategory}
              onAdd={() => addCategory.mutateAsync()}
              pending={addCategory.isPending}
            />
          </>
        )}

        <div className="form-field">
          <label className="form-field__label" htmlFor="new-product-name">
            Product name
          </label>
          <input
            id="new-product-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder(kind)}
            required
          />
        </div>

        <div className="purchase-new-product-prices">
          <div className="form-field">
            <label className="form-field__label" htmlFor="new-product-buy">
              Buy rate (₹)
            </label>
            <input
              id="new-product-buy"
              type="number"
              min={0}
              step="0.01"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="new-product-sell">
              Sell price <span className="form-field__optional">optional</span>
            </label>
            <input
              id="new-product-sell"
              type="number"
              min={0}
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="MRP"
            />
          </div>
          <div className="form-field">
            <label className="form-field__label" htmlFor="new-product-qty">
              Qty on this bill
            </label>
            <input
              id="new-product-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
            />
          </div>
        </div>

        {formError && <p className="error">{formError}</p>}
        {create.error && <p className="error">{(create.error as Error).message}</p>}

        <div className="modal-footer purchase-new-product-footer">
          <button type="button" className="secondary" onClick={resetAndClose}>
            Cancel
          </button>
          <button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create & add to bill"}
          </button>
        </div>
      </form>
    </FormModal>
  );
}
