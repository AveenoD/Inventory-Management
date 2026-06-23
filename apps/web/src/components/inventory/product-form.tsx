"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PRODUCT_KIND_LABELS,
  REPAIR_PART_TYPES,
  type ProductKind,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { InlineAddField } from "@/components/inventory/inline-add-field";

type AddProductMode = "cover" | "other_accessory" | "device" | "repair";
type DeviceKind = Extract<ProductKind, "MOBILE" | "SPEAKERS_SOUND" | "CHARGER_CABLE">;

const MODES: Array<{ id: AddProductMode; label: string; hint: string }> = [
  { id: "cover", label: "Mobile Cover", hint: "Model → cover category → design" },
  { id: "other_accessory", label: "Other Accessory", hint: "Pendrive, earphone, glass…" },
  { id: "device", label: "Mobile / Audio / Cable", hint: "Phones, speakers, chargers" },
  { id: "repair", label: "Repair Part", hint: "Display, battery, charging pin…" },
];

const DEVICE_KINDS: DeviceKind[] = ["MOBILE", "SPEAKERS_SOUND", "CHARGER_CABLE"];

function parseInitialMode(value: string | null): AddProductMode {
  if (value === "accessory" || value === "other_accessory") return "other_accessory";
  if (value === "device" || value === "mobile") return "device";
  if (value === "repair") return "repair";
  return "cover";
}

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

export function ProductForm() {
  const router = useRouter();
  const qc = useQueryClient();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<AddProductMode>(() =>
    parseInitialMode(searchParams.get("mode")),
  );
  const [deviceKind, setDeviceKind] = useState<DeviceKind>("MOBILE");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [phoneModelId, setPhoneModelId] = useState("");
  const [newPhoneModel, setNewPhoneModel] = useState("");
  const [phoneModel, setPhoneModel] = useState("");
  const [coverBatchRows, setCoverBatchRows] = useState<Record<string, { buy: string; sell: string; offer: string; qty: string }>>({});
  const [newCoverType, setNewCoverType] = useState("");
  const [partType, setPartType] = useState<string>(REPAIR_PART_TYPES[0]);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [repairCharge, setRepairCharge] = useState("");
  const [minStock, setMinStock] = useState("");
  const [openingStock, setOpeningStock] = useState("");
  const [formError, setFormError] = useState("");

  const { data: phoneModels, refetch: refetchPhoneModels } = useQuery({
    queryKey: ["phone-models"],
    queryFn: () => api.getPhoneModels(),
    enabled: mode === "cover",
  });

  const { data: coverTypes, refetch: refetchCoverTypes } = useQuery({
    queryKey: ["cover-types", phoneModelId],
    queryFn: () => api.getCoverTypes(phoneModelId),
    enabled: mode === "cover" && !!phoneModelId,
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
    enabled: mode === "other_accessory",
  });

  const addPhoneModel = useMutation({
    mutationFn: () => api.createPhoneModel(newPhoneModel.trim()),
    onSuccess: (pm) => {
      setPhoneModelId(pm.id);
      setNewPhoneModel("");
      refetchPhoneModels();
      qc.invalidateQueries({ queryKey: ["phone-models"] });
      qc.invalidateQueries({ queryKey: ["cover-types"] });
    },
  });

  const addCoverType = useMutation({
    mutationFn: () => api.createCoverType(phoneModelId, newCoverType.trim()),
    onSuccess: (ct) => {
      setNewCoverType("");
      refetchCoverTypes();
      qc.invalidateQueries({ queryKey: ["cover-types"] });
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
    mutationFn: () => {
      const kind: ProductKind =
        mode === "cover" || mode === "other_accessory"
          ? "MOBILE_ACCESSORY"
          : mode === "repair"
            ? "REPAIR_PART"
            : deviceKind;

      return api.createProduct({
        kind,
        name: mode === "cover" ? undefined : name.trim() || undefined,
        categoryId: mode === "other_accessory" ? categoryId || undefined : undefined,
        phoneModelId: mode === "cover" && phoneModelId ? phoneModelId : undefined,
        phoneModel: mode === "repair" ? phoneModel : undefined,
        coverTypeId: undefined,
        coverTypeName: undefined,
        variantName: undefined,
        partType: mode === "repair" ? partType : undefined,
        buyPrice: parseFloat(buyPrice) || 0,
        sellPrice: parseFloat(sellPrice) || parseFloat(repairCharge) || 0,
        offerPrice:
          mode !== "repair" && offerPrice.trim()
            ? parseFloat(offerPrice) || undefined
            : undefined,
        repairCharge:
          mode === "repair"
            ? parseFloat(repairCharge) || parseFloat(sellPrice) || 0
            : undefined,
        minStock: parseInt(minStock, 10) || 0,
        openingStock: parseInt(openingStock, 10) || 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["covers-stats"] });
      qc.invalidateQueries({ queryKey: ["phone-models"] });
      qc.invalidateQueries({ queryKey: ["cover-types"] });
      router.push("/inventory");
    },
  });

  const batchCreateCovers = useMutation({
    mutationFn: () => {
      const covers = Object.entries(coverBatchRows)
        .filter(([_, row]) => {
          const qty = parseInt(row.qty, 10);
          return !Number.isNaN(qty) && qty > 0;
        })
        .map(([coverTypeId, row]) => ({
          coverTypeId,
          buyPrice: parseFloat(row.buy) || 0,
          sellPrice: parseFloat(row.sell) || 0,
          offerPrice: row.offer ? parseFloat(row.offer) : undefined,
          openingStock: parseInt(row.qty, 10) || 0,
        }));
      
      if (covers.length === 0) {
        throw new Error("Please enter stock for at least one cover category.");
      }

      return api.createBatchCovers({
        phoneModelId,
        covers,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["covers-stats"] });
      qc.invalidateQueries({ queryKey: ["phone-models"] });
      qc.invalidateQueries({ queryKey: ["cover-types"] });
      router.push("/inventory");
    },
  });

  const phoneModelList = phoneModels?.data ?? [];
  const coverList = coverTypes?.data ?? [];
  const reservedCategoryNames = new Set(Object.values(PRODUCT_KIND_LABELS));
  const catList = (categories?.data ?? []).filter((c) => !reservedCategoryNames.has(c.name));

  const coverStep2Locked = !phoneModelId;

  function handleAddPhoneModel() {
    if (!newPhoneModel.trim()) return Promise.resolve();
    return addPhoneModel.mutateAsync();
  }

  function handleAddCoverType() {
    if (!newCoverType.trim()) return Promise.resolve();
    return addCoverType.mutateAsync();
  }

  function handleAddCategory() {
    if (!newCategory.trim()) return Promise.resolve();
    return addCategory.mutateAsync();
  }

  function handleModeChange(next: AddProductMode) {
    setMode(next);
    setFormError("");
    setCategoryId("");
    setPhoneModelId("");
    setName("");
    setPhoneModel("");
    setNewPhoneModel("");
    setNewCoverType("");
    setNewCategory("");
  }

  function handlePhoneModelChange(id: string) {
    setPhoneModelId(id);
    setCoverBatchRows({});
    setNewCoverType("");
  }

  function handleBatchRowChange(coverId: string, field: "buy" | "sell" | "offer" | "qty", value: string) {
    setCoverBatchRows((prev) => ({
      ...prev,
      [coverId]: {
        buy: prev[coverId]?.buy ?? "",
        sell: prev[coverId]?.sell ?? "",
        offer: prev[coverId]?.offer ?? "",
        qty: prev[coverId]?.qty ?? "",
        [field]: value,
      },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (mode === "cover") {
      if (!phoneModelId) {
        setFormError("Step 1: Select a phone model or add a new one.");
        return;
      }
      batchCreateCovers.mutate();
      return;
    }

    if (mode === "other_accessory" && !name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    if (mode === "device" && !name.trim()) {
      setFormError("Product name is required.");
      return;
    }

    if (mode === "repair") {
      if (!phoneModel.trim()) {
        setFormError("Phone model is required.");
        return;
      }
    }

    const parsedMinStock = parseInt(minStock, 10);
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setFormError("Min stock alert must be 0 or greater.");
      return;
    }

    create.mutate();
  }

  const deviceNamePlaceholder =
    deviceKind === "SPEAKERS_SOUND"
      ? "e.g. Boat Rockerz 255"
      : deviceKind === "CHARGER_CABLE"
        ? "e.g. 25W Type-C Cable"
        : "e.g. Samsung A15 4/64";

  function coverStepState(step: number): "done" | "current" | "pending" {
    if (step === 1) return phoneModelId ? "done" : "current";
    if (step === 2) return phoneModelId ? "current" : "pending";
    return "pending";
  }

  const coverSteps =
    mode === "cover"
      ? [
          { n: 1, label: "Phone model" },
          { n: 2, label: "Categories & stock" },
        ]
      : [];

  return (
    <form className="product-add-form" onSubmit={handleSubmit}>
      <div className="product-add-layout">
        <aside className="product-add-sidebar">
          <div className="product-add-sidebar__title">Product type</div>
          <div className="product-form-modes product-form-modes--vertical">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={mode === m.id ? "product-form-mode active" : "product-form-mode"}
                onClick={() => handleModeChange(m.id)}
              >
                <span className="product-form-mode__label">{m.label}</span>
                <span className="product-form-mode__hint">{m.hint}</span>
              </button>
            ))}
          </div>

          {mode === "cover" && (
            <div className="product-add-progress">
              <div className="product-add-progress__title">Steps</div>
              <ol className="product-add-progress__list">
                {coverSteps.map((s) => (
                  <li
                    key={s.n}
                    className={`product-add-progress__item ${coverStepState(s.n)}`}
                  >
                    <span className="product-add-progress__num">{s.n}</span>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>

        <div className="card form-stack product-add-main">
      {mode === "cover" && (
        <>
          <FormStep step={1} title="Phone model">
            <select
              value={phoneModelId}
              onChange={(e) => handlePhoneModelChange(e.target.value)}
            >
              <option value="">Select phone model</option>
              {phoneModelList.map((m) => (
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
              onAdd={handleAddPhoneModel}
              pending={addPhoneModel.isPending}
            />
          </FormStep>

          <FormStep step={2} title="Cover categories & stock" locked={coverStep2Locked}>
            <p className="muted" style={{ marginBottom: 12 }}>
              Enter stock and prices for the categories you want to add. Blank rows will be ignored.
            </p>
            
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th style={{ width: "100px" }}>Buy Price</th>
                    <th style={{ width: "100px" }}>MRP (Sell)</th>
                    <th style={{ width: "100px" }}>Discount</th>
                    <th style={{ width: "80px" }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {coverList.map((c) => {
                    const row = coverBatchRows[c.id] || { buy: "", sell: "", offer: "", qty: "" };
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td>
                          <input type="number" step="0.01" style={{ padding: "4px 8px" }} value={row.buy} onChange={e => handleBatchRowChange(c.id, "buy", e.target.value)} placeholder="0.00" />
                        </td>
                        <td>
                          <input type="number" step="0.01" style={{ padding: "4px 8px" }} value={row.sell} onChange={e => handleBatchRowChange(c.id, "sell", e.target.value)} placeholder="0.00" />
                        </td>
                        <td>
                          <input type="number" step="0.01" style={{ padding: "4px 8px" }} value={row.offer} onChange={e => handleBatchRowChange(c.id, "offer", e.target.value)} placeholder="0.00" />
                        </td>
                        <td>
                          <input type="number" style={{ padding: "4px 8px" }} value={row.qty} onChange={e => handleBatchRowChange(c.id, "qty", e.target.value)} placeholder="0" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "16px" }}>
              <InlineAddField
                triggerLabel="Add new category"
                placeholder="e.g. Transparent, Silicon"
                value={newCoverType}
                onChange={setNewCoverType}
                onAdd={handleAddCoverType}
                pending={addCoverType.isPending}
                disabled={!phoneModelId}
              />
            </div>
          </FormStep>
        </>
      )}

      {mode === "other_accessory" && (
        <>
          <label className="stat-label">Accessory category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">General accessory</option>
            {catList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <InlineAddField
            triggerLabel="Add new category"
            placeholder="e.g. Memory/Pendrive, Earphones, Glass"
            value={newCategory}
            onChange={setNewCategory}
            onAdd={handleAddCategory}
            pending={addCategory.isPending}
          />

          <label className="stat-label">Product name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sandisk 64GB Pendrive"
            required
          />
        </>
      )}

      {mode === "device" && (
        <>
          <label className="stat-label">Product type</label>
          <select
            value={deviceKind}
            onChange={(e) => setDeviceKind(e.target.value as DeviceKind)}
          >
            {DEVICE_KINDS.map((k) => (
              <option key={k} value={k}>
                {PRODUCT_KIND_LABELS[k]}
              </option>
            ))}
          </select>

          <label className="stat-label">Product name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={deviceNamePlaceholder}
            required
          />
        </>
      )}

      {mode === "repair" && (
        <>
          <label className="stat-label">Phone model</label>
          <input
            value={phoneModel}
            onChange={(e) => setPhoneModel(e.target.value)}
            placeholder="e.g. Redmi Note 13, iPhone 12"
            required
          />

          <label className="stat-label">Part type</label>
          <select value={partType} onChange={(e) => setPartType(e.target.value)}>
            {REPAIR_PART_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            Name auto: Model – Part (e.g. Redmi Note 13 – Display)
          </p>
        </>
      )}

      {mode !== "cover" && (
        <div className="form-step">
          <div className="form-step__head">
            <span className="form-step__num">1</span>
            <span className="form-step__title">Price & stock</span>
          </div>

          <div className="form-row">
            <div>
              <label className="stat-label">
                {mode === "repair" ? "Purchase cost (kitne me aaya)" : "Buy price"}
              </label>
              <input
                type="number"
                step="0.01"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                required
              />
            </div>
            {mode === "repair" ? (
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
                <label className="stat-label">MRP (sell price)</label>
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

        {mode !== "repair" && (
          <div className="form-row">
            <div>
              <label className="stat-label">Offer price (optional)</label>
              <input
                type="number"
                step="0.01"
                min={0}
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="Discounted price for QR sticker"
              />
            </div>
          </div>
        )}

          <div className="form-row">
            <div>
              <label className="stat-label">Opening stock (quantity)</label>
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
        </div>
      )}

      {formError && <p className="error">{formError}</p>}
      {(create.error || batchCreateCovers.error) && <p className="error">{((create.error || batchCreateCovers.error) as Error).message}</p>}
      <div className="product-add-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => router.push("/inventory")}
        >
          Cancel
        </button>
        <button type="submit" disabled={create.isPending || batchCreateCovers.isPending}>
          {create.isPending || batchCreateCovers.isPending ? "Saving…" : mode === "cover" ? "Save all covers" : "Save product"}
        </button>
      </div>
        </div>
      </div>
    </form>
  );
}
