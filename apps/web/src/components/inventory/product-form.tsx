"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PRODUCT_KIND_LABELS,
  REPAIR_PART_TYPES,
  type ProductKind,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { InlineAddField } from "@/components/inventory/inline-add-field";
import { Edit2, Trash2, ChevronDown } from "lucide-react";

type AddProductMode = "cover" | "other_accessory" | "device" | "repair";
type DeviceKind = Extract<ProductKind, "ANDROID_MOBILE" | "BASIC_MOBILE">;

const MODES: Array<{ id: AddProductMode; label: string; hint: string }> = [
  { id: "cover", label: "Mobile Cover", hint: "Model → cover category → design" },
  { id: "other_accessory", label: "Other Accessory", hint: "Pendrive, earphone, glass…" },
  { id: "device", label: "Mobile", hint: "Android / Basic Mobile" },
  { id: "repair", label: "Repair Part", hint: "Display, battery, charging pin…" },
];

const DEVICE_KINDS: DeviceKind[] = ["ANDROID_MOBILE", "BASIC_MOBILE"];

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

function CustomDropdownSelect({
  value,
  onChange,
  options,
  onEdit,
  onDelete,
  placeholder = "Select an option",
}: {
  value: string;
  onChange: (val: string) => void;
  options: { id: string; name: string }[];
  onEdit: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", marginBottom: "16px" }}>
      <div
        style={{
          border: "1px solid var(--border)",
          padding: "10px 14px",
          borderRadius: "8px",
          cursor: "pointer",
          background: "var(--card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
        onClick={() => setOpen(!open)}
      >
        {value === "" ? placeholder : options.find(o => o.id === value)?.name || placeholder}
        <ChevronDown size={16} />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            marginTop: "4px",
            zIndex: 10,
            maxHeight: "250px",
            overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
          }}
        >
          <div
            style={{ padding: "10px 14px", cursor: "pointer" }}
            onClick={() => { onChange(""); setOpen(false); }}
            className="dropdown-item"
          >
            {placeholder}
          </div>
          {options.map((opt) => (
            <div
              key={opt.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                cursor: "pointer",
              }}
              className="dropdown-item category-dropdown-item"
              onClick={() => { onChange(opt.id); setOpen(false); }}
            >
              <span>{opt.name}</span>
              <div className="category-actions" style={{ gap: "8px" }}>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#0070f3", cursor: "pointer", padding: 0 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onEdit(opt.id, opt.name);
                    setOpen(false); 
                  }}
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: "#e11d48", cursor: "pointer", padding: 0 }}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onDelete(opt.id, opt.name);
                    setOpen(false); 
                  }}
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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

  const [editModal, setEditModal] = useState<{type: "category" | "phoneModel" | "coverType", id: string, name: string} | null>(null);
  const [deleteModal, setDeleteModal] = useState<{type: "category" | "phoneModel" | "coverType", id: string, name: string} | null>(null);
  const [editName, setEditName] = useState("");
  const [deviceKind, setDeviceKind] = useState<DeviceKind>("ANDROID_MOBILE");
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

  const editCategory = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCategory(id, name),
    onSuccess: () => {
      refetchCategories();
    },
  });

  const removeCategory = useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      refetchCategories();
      setCategoryId("");
    },
  });

  const editPhoneModel = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updatePhoneModel(id, name),
    onSuccess: () => {
      refetchPhoneModels();
      qc.invalidateQueries({ queryKey: ["phone-models"] });
    },
  });

  const removePhoneModel = useMutation({
    mutationFn: (id: string) => api.deletePhoneModel(id),
    onSuccess: () => {
      refetchPhoneModels();
      qc.invalidateQueries({ queryKey: ["phone-models"] });
      setPhoneModelId("");
    },
  });

  const editCoverType = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateCoverType(id, name),
    onSuccess: () => {
      refetchCoverTypes();
      qc.invalidateQueries({ queryKey: ["cover-types"] });
    },
  });

  const removeCoverType = useMutation({
    mutationFn: (id: string) => api.deleteCoverType(id),
    onSuccess: () => {
      refetchCoverTypes();
      qc.invalidateQueries({ queryKey: ["cover-types"] });
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
    deviceKind === "BASIC_MOBILE"
      ? "e.g. Nokia 105"
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
            <CustomDropdownSelect
              value={phoneModelId}
              onChange={(val) => handlePhoneModelChange(val)}
              options={phoneModelList}
              placeholder="Select phone model"
              onEdit={(id, name) => {
                setEditName(name);
                setEditModal({ type: "phoneModel", id, name });
              }}
              onDelete={(id, name) => {
                setDeleteModal({ type: "phoneModel", id, name });
              }}
            />
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
                        <td style={{ fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                          {c.name}
                          <div className="category-actions" style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: "#0070f3", cursor: "pointer", padding: 0 }}
                              onClick={(e) => { 
                                e.preventDefault(); 
                                setEditName(c.name);
                                setEditModal({ type: "coverType", id: c.id, name: c.name }); 
                              }}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              type="button"
                              style={{ background: "none", border: "none", color: "#e11d48", cursor: "pointer", padding: 0 }}
                              onClick={(e) => { 
                                e.preventDefault(); 
                                setDeleteModal({ type: "coverType", id: c.id, name: c.name }); 
                              }}
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
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
          <CustomDropdownSelect
            value={categoryId}
            onChange={setCategoryId}
            options={catList}
            placeholder="Select a category"
            onEdit={(id, name) => {
              setEditName(name);
              setEditModal({ type: "category", id, name });
            }}
            onDelete={(id, name) => {
              setDeleteModal({ type: "category", id, name });
            }}
          />
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

      {/* Shared Edit Modal */}
      {editModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--card)", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "1.2rem", fontWeight: 600 }}>Edit {editModal.type === "phoneModel" ? "Phone Model" : editModal.type === "coverType" ? "Cover Type" : "Category"}</h3>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={{ width: "100%", padding: "10px", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "20px" }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setEditModal(null)}>Cancel</button>
              <button type="button" onClick={() => {
                if (editName.trim() && editName.trim() !== editModal.name) {
                  if (editModal.type === "category") {
                    editCategory.mutate({ id: editModal.id, name: editName.trim() });
                  } else if (editModal.type === "phoneModel") {
                    editPhoneModel.mutate({ id: editModal.id, name: editName.trim() });
                  } else if (editModal.type === "coverType") {
                    editCoverType.mutate({ id: editModal.id, name: editName.trim() });
                  }
                }
                setEditModal(null);
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Delete Modal */}
      {deleteModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--card)", padding: "24px", borderRadius: "12px", width: "90%", maxWidth: "400px", boxShadow: "0 10px 25px rgba(0,0,0,0.2)" }}>
            <h3 style={{ marginTop: 0, marginBottom: "16px", fontSize: "1.2rem", fontWeight: 600, color: "#e11d48" }}>Delete {deleteModal.type === "phoneModel" ? "Phone Model" : deleteModal.type === "coverType" ? "Cover Type" : "Category"}</h3>
            <p style={{ marginBottom: "20px", color: "var(--muted)", lineHeight: 1.5 }}>
              Are you sure you want to permanently delete <strong>{deleteModal.name}</strong>? 
              <br/><br/>
              {deleteModal.type === "category" ? "Products in this category will be moved to 'General accessory'." : "Any associated products will have their reference to this removed."} This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button type="button" className="secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="button" style={{ background: "#e11d48" }} onClick={() => {
                if (deleteModal.type === "category") {
                  removeCategory.mutate(deleteModal.id);
                } else if (deleteModal.type === "phoneModel") {
                  removePhoneModel.mutate(deleteModal.id);
                } else if (deleteModal.type === "coverType") {
                  removeCoverType.mutate(deleteModal.id);
                }
                setDeleteModal(null);
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
