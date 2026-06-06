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

type AddProductMode = "cover" | "other_accessory" | "device" | "repair";
type DeviceKind = Extract<ProductKind, "MOBILE" | "SPEAKERS_SOUND" | "CHARGER_CABLE">;

const MODES: Array<{ id: AddProductMode; label: string; hint: string }> = [
  { id: "cover", label: "Mobile Cover", hint: "Model → cover type → design" },
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

function InlineAddField({
  triggerLabel,
  placeholder,
  value,
  onChange,
  onAdd,
  pending,
  disabled,
}: {
  triggerLabel: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onAdd: () => Promise<unknown>;
  pending?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
    onChange("");
  }

  async function submit() {
    if (!value.trim() || pending) return;
    try {
      await onAdd();
      close();
    } catch {
      /* error surfaced by mutation */
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="inline-add-trigger"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        + {triggerLabel}
      </button>
    );
  }

  return (
    <div className="inline-add-panel">
      <div className="inline-add-row">
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") close();
          }}
        />
        <button type="button" disabled={!value.trim() || pending} onClick={submit}>
          {pending ? "Adding…" : "Add"}
        </button>
        <button type="button" className="secondary" disabled={pending} onClick={close}>
          Cancel
        </button>
      </div>
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
  const [coverTypeId, setCoverTypeId] = useState("");
  const [newCoverType, setNewCoverType] = useState("");
  const [variantName, setVariantName] = useState("");
  const [partType, setPartType] = useState<string>(REPAIR_PART_TYPES[0]);
  const [sku, setSku] = useState("");
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
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
      setCoverTypeId("");
      refetchPhoneModels();
    },
  });

  const addCoverType = useMutation({
    mutationFn: () => api.createCoverType(phoneModelId, newCoverType.trim()),
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
        sku: sku || undefined,
        categoryId: mode === "other_accessory" ? categoryId || undefined : undefined,
        phoneModelId: mode === "cover" && phoneModelId ? phoneModelId : undefined,
        phoneModel: mode === "repair" ? phoneModel : undefined,
        coverTypeId: mode === "cover" ? coverTypeId : undefined,
        coverTypeName: undefined,
        variantName: mode === "cover" ? variantName.trim() : undefined,
        partType: mode === "repair" ? partType : undefined,
        buyPrice: parseFloat(buyPrice) || 0,
        sellPrice: parseFloat(sellPrice) || parseFloat(repairCharge) || 0,
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
      router.push("/inventory");
    },
  });

  const phoneModelList = phoneModels?.data ?? [];
  const coverList = coverTypes?.data ?? [];
  const reservedCategoryNames = new Set(Object.values(PRODUCT_KIND_LABELS));
  const catList = (categories?.data ?? []).filter((c) => !reservedCategoryNames.has(c.name));

  const coverStep2Locked = !phoneModelId;
  const coverStep3Locked = coverStep2Locked || !coverTypeId;

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
    setCoverTypeId("");
    setVariantName("");
    setName("");
    setPhoneModel("");
    setNewPhoneModel("");
    setNewCoverType("");
    setNewCategory("");
  }

  function handlePhoneModelChange(id: string) {
    setPhoneModelId(id);
    setCoverTypeId("");
    setNewCoverType("");
    setVariantName("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (mode === "cover") {
      if (!phoneModelId) {
        setFormError("Step 1: Select a phone model or add a new one.");
        return;
      }
      if (!coverTypeId) {
        setFormError("Step 2: Select a cover type or add a new one.");
        return;
      }
      if (!variantName.trim()) {
        setFormError("Step 3: Design name is required (e.g. Blue Marble, Plain Black).");
        return;
      }
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

  return (
    <form className="card form-stack product-form" onSubmit={handleSubmit}>
      <div className="product-form-modes">
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

          <FormStep step={2} title="Cover type" locked={coverStep2Locked}>
            <select value={coverTypeId} onChange={(e) => setCoverTypeId(e.target.value)}>
              <option value="">Select cover type</option>
              {coverList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <InlineAddField
              triggerLabel="Add new cover type"
              placeholder="e.g. Matte, Ring Light"
              value={newCoverType}
              onChange={setNewCoverType}
              onAdd={handleAddCoverType}
              pending={addCoverType.isPending}
              disabled={!phoneModelId}
            />
          </FormStep>

          <FormStep step={3} title="Design / variant" locked={coverStep3Locked}>
            <input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              placeholder="e.g. Blue Marble, Tiger Print, Plain Black"
            />
            <p className="muted form-step__hint">
              Name auto: Model – Cover type – Design (e.g. Samsung J7 – Silicon – Blue Marble)
            </p>
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

      <div className="form-step">
        <div className="form-step__head">
          <span className="form-step__num">{mode === "cover" ? 4 : 1}</span>
          <span className="form-step__title">Price & stock</span>
        </div>

        <label className="stat-label">SKU (optional)</label>
        <input value={sku} onChange={(e) => setSku(e.target.value)} />

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

      {formError && <p className="error">{formError}</p>}
      {create.error && <p className="error">{(create.error as Error).message}</p>}
      <button type="submit" disabled={create.isPending}>
        {create.isPending ? "Saving…" : mode === "cover" ? "Save cover" : "Save product"}
      </button>
    </form>
  );
}
