"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  PRODUCT_KINDS,
  PRODUCT_KIND_LABELS,
  REPAIR_PART_TYPES,
  type ProductKind,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";

export function ProductForm() {
  const router = useRouter();
  const qc = useQueryClient();

  const [kind, setKind] = useState<ProductKind>("MOBILE_ACCESSORY");
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [phoneModel, setPhoneModel] = useState("");
  const [coverTypeId, setCoverTypeId] = useState("");
  const [newCoverType, setNewCoverType] = useState("");
  const [partType, setPartType] = useState<string>(REPAIR_PART_TYPES[0]);
  const [sku, setSku] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [repairCharge, setRepairCharge] = useState("");
  const [minStock, setMinStock] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [formError, setFormError] = useState("");

  const { data: coverTypes, refetch: refetchCoverTypes } = useQuery({
    queryKey: ["cover-types"],
    queryFn: () => api.getCoverTypes(),
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
  });

  const addCoverType = useMutation({
    mutationFn: () => api.createCoverType(newCoverType.trim()),
    onSuccess: (ct) => {
      setCoverTypeId(ct.id);
      setNewCoverType("");
      refetchCoverTypes();
    },
  });

  const addCategory = useMutation({
    mutationFn: () => api.createCategory(newCategory.trim()),
    onSuccess: (c) => {
      setCategoryId(c.id);
      setNewCategory("");
      refetchCategories();
    },
  });

  const create = useMutation({
    mutationFn: () =>
      api.createProduct({
        kind,
        name: needsManualName || (kind === "MOBILE_ACCESSORY" && !!categoryId) ? name : undefined,
        sku: sku || undefined,
        categoryId: categoryId || undefined,
        phoneModel:
          kind === "MOBILE_ACCESSORY" && categoryId
            ? undefined
            : needsPhoneModel
              ? phoneModel
              : undefined,
        coverTypeId:
          kind === "MOBILE_ACCESSORY" && categoryId ? undefined : kind === "MOBILE_ACCESSORY" ? coverTypeId : undefined,
        coverTypeName:
          kind === "MOBILE_ACCESSORY" && !categoryId && !coverTypeId && newCoverType.trim()
            ? newCoverType.trim()
            : undefined,
        partType: kind === "REPAIR_PART" ? partType : undefined,
        buyPrice: parseFloat(buyPrice) || 0,
        sellPrice: parseFloat(sellPrice) || parseFloat(repairCharge) || 0,
        repairCharge:
          kind === "REPAIR_PART" ? parseFloat(repairCharge) || parseFloat(sellPrice) || 0 : undefined,
        minStock: parseInt(minStock, 10) || 0,
        openingStock: parseInt(openingStock, 10) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      router.push("/inventory");
    },
  });

  const needsPhoneModel = kind === "MOBILE_ACCESSORY" || kind === "REPAIR_PART";
  const needsManualName =
    kind === "MOBILE" || kind === "SPEAKERS_SOUND" || kind === "CHARGER_CABLE";
  const isRepair = kind === "REPAIR_PART";
  const isAccessory = kind === "MOBILE_ACCESSORY";
  const isCustomAccessory = kind === "MOBILE_ACCESSORY" && !!categoryId;
  const coverList = coverTypes?.data ?? [];
  const reservedCategoryNames = new Set(Object.values(PRODUCT_KIND_LABELS));
  const catList = (categories?.data ?? []).filter((c) => !reservedCategoryNames.has(c.name));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (isCustomAccessory && !name.trim()) {
      setFormError("Product name is required for this accessory type.");
      return;
    }
    if (needsManualName && !name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (isAccessory && !isCustomAccessory && !coverTypeId && !newCoverType.trim()) {
      setFormError("Select a cover type or add a new one.");
      return;
    }
    if (needsPhoneModel && !isCustomAccessory && !phoneModel.trim()) {
      setFormError("Phone model is required.");
      return;
    }

    const parsedMinStock = parseInt(minStock, 10);
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setFormError("Min stock alert must be 0 or greater.");
      return;
    }

    create.mutate();
  }

  return (
    <form className="card form-stack" onSubmit={handleSubmit}>
      <label className="stat-label">Product kind</label>
      <select value={kind} onChange={(e) => setKind(e.target.value as ProductKind)}>
        {PRODUCT_KINDS.map((k) => (
          <option key={k} value={k}>
            {PRODUCT_KIND_LABELS[k]}
          </option>
        ))}
      </select>

      {isAccessory && (
        <>
          <label className="stat-label">Accessory type (optional)</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Covers (default)</option>
            {catList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="form-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="stat-label">Create new accessory type</label>
              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Memory/Pendrive, Earphones, Glass"
              />
            </div>
            <button
              type="button"
              className="secondary"
              disabled={!newCategory.trim() || addCategory.isPending}
              onClick={() => addCategory.mutate()}
            >
              Add type
            </button>
          </div>
        </>
      )}

      {(needsManualName || isCustomAccessory) && (
        <>
          <label className="stat-label">Product name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              isCustomAccessory
                ? "e.g. Sandisk 64GB Pendrive"
                : kind === "SPEAKERS_SOUND"
                  ? "e.g. Boat Rockerz 255"
                  : kind === "CHARGER_CABLE"
                    ? "e.g. 25W Type-C Cable"
                    : "e.g. Samsung A15 4/64"
            }
            required={needsManualName || isCustomAccessory}
          />
        </>
      )}

      {needsManualName && (
        <>
          {/* rendered above */}
        </>
      )}

      {needsPhoneModel && !isCustomAccessory && (
        <>
          <label className="stat-label">Phone model</label>
          <input
            value={phoneModel}
            onChange={(e) => setPhoneModel(e.target.value)}
            placeholder="e.g. Redmi Note 13, iPhone 12"
            required={needsPhoneModel}
          />
        </>
      )}

      {isAccessory && !isCustomAccessory && (
        <>
          <label className="stat-label">Cover type</label>
          <select
            value={coverTypeId}
            onChange={(e) => setCoverTypeId(e.target.value)}
            required={!newCoverType.trim()}
          >
            <option value="">Select cover type</option>
            {coverList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="form-row" style={{ alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label className="stat-label">Add new cover type</label>
              <input
                value={newCoverType}
                onChange={(e) => setNewCoverType(e.target.value)}
                placeholder="e.g. Matte, Ring Light"
              />
            </div>
            <button
              type="button"
              className="secondary"
              disabled={!newCoverType.trim() || addCoverType.isPending}
              onClick={() => addCoverType.mutate()}
            >
              Add type
            </button>
          </div>
        </>
      )}

      {isRepair && (
        <>
          <label className="stat-label">Part type</label>
          <select value={partType} onChange={(e) => setPartType(e.target.value)}>
            {REPAIR_PART_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </>
      )}

      <label className="stat-label">SKU (optional)</label>
      <input value={sku} onChange={(e) => setSku(e.target.value)} />

      <div className="form-row">
        <div>
          <label className="stat-label">{isRepair ? "Purchase cost (kitne me aaya)" : "Buy price"}</label>
          <input
            type="number"
            step="0.01"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            required
          />
        </div>
        {isRepair ? (
          <div>
            <label className="stat-label">Repair charge (customer se)</label>
            <input
              type="number"
              step="0.01"
              value={repairCharge}
              onChange={(e) => setRepairCharge(e.target.value)}
              required
            />
          </div>
        ) : (
          <div>
            <label className="stat-label">Sell price</label>
            <input
              type="number"
              step="0.01"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              required
            />
          </div>
        )}
      </div>

      {!isRepair && !isCustomAccessory && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          {isAccessory
            ? "Name auto: Model – Cover type (e.g. Redmi Note 13 – Silicon)"
            : "Use clear names so POS search is easy."}
        </p>
      )}

      {isCustomAccessory && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          For this accessory type, phone model and cover type are not required.
        </p>
      )}

      {isRepair && (
        <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
          Name auto: Model – Part (e.g. Redmi Note 13 – Display). Stock = spare parts in shop.
        </p>
      )}

      <div className="form-row">
        <div>
          <label className="stat-label">Opening stock</label>
          <input
            type="number"
            min={0}
            value={openingStock}
            onChange={(e) => setOpeningStock(e.target.value)}
            placeholder="0"
          />
        </div>
        <div>
          <label className="stat-label">Min stock alert</label>
          <input
            type="number"
            min={0}
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {formError && <p className="error">{formError}</p>}
      {create.error && <p className="error">{(create.error as Error).message}</p>}
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}
