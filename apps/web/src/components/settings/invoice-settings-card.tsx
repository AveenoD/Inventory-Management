"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus } from "lucide-react";
import { SHOP_NAME } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoader } from "@/components/ui/page-loader";

const MAX_LOGO_BYTES = 400_000;

export function InvoiceSettingsCard() {
  const qc = useQueryClient();
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [warrantyText, setWarrantyText] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDirty, setLogoDirty] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: () => api.getInvoiceSettings(),
  });

  useEffect(() => {
    if (!data) return;
    setAddress(data.address ?? "");
    setPhone(data.phone ?? "");
    setWarrantyText(data.warrantyText ?? "");
    if (!logoDirty) setLogoPreview(data.logoDataUrl);
  }, [data, logoDirty]);

  const save = useMutation({
    mutationFn: () =>
      api.updateInvoiceSettings({
        address: address.trim() || null,
        phone: phone.trim() || null,
        warrantyText: warrantyText.trim() || null,
        ...(logoDirty ? { logoDataUrl: logoPreview } : {}),
      }),
    onSuccess: (saved) => {
      qc.setQueryData(["invoice-settings"], saved);
      setLogoDirty(false);
      setSaveMsg("Invoice settings saved.");
      setTimeout(() => setSaveMsg(null), 3000);
    },
  });

  function onLogoChange(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file (PNG, JPG, etc.)");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      alert("Logo must be under 400 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLogoPreview(reader.result as string);
      setLogoDirty(true);
    };
    reader.readAsDataURL(file);
  }

  function removeLogo() {
    setLogoPreview(null);
    setLogoDirty(true);
  }

  if (isLoading) return <PageLoader message="Loading invoice settings…" />;

  return (
    <div className="card form-stack" style={{ maxWidth: 520, marginBottom: "1rem" }}>
      <h3 style={{ marginTop: 0 }}>Invoice Settings</h3>
      <p className="muted">
        Logo, address, and warranty text appear on every sale invoice. Shop name is fixed as{" "}
        <strong>{SHOP_NAME}</strong>.
      </p>

      <label className="stat-label">Shop name</label>
      <input type="text" value={SHOP_NAME} disabled />

      <label className="stat-label">Shop logo</label>
      <div className="invoice-settings-logo">
        {logoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoPreview} alt="Shop logo" className="invoice-settings-logo-preview" />
        ) : (
          <div className="invoice-settings-logo-empty">
            <ImagePlus size={24} />
            <span>No logo</span>
          </div>
        )}
        <div className="invoice-settings-logo-actions">
          <label className="secondary invoice-file-label">
            Upload logo
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
            />
          </label>
          {logoPreview && (
            <button type="button" className="secondary" onClick={removeLogo}>
              Remove
            </button>
          )}
        </div>
      </div>

      <label className="stat-label">Shop address</label>
      <textarea
        rows={3}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Street, area, city, pin code"
      />

      <label className="stat-label">Phone number</label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="98XXXXXXXX"
      />

      <label className="stat-label">Default warranty / guarantee</label>
      <textarea
        rows={4}
        value={warrantyText}
        onChange={(e) => setWarrantyText(e.target.value)}
        placeholder="e.g. Accessories: 6 months warranty. Tempered glass: 7 days. No warranty on physical damage."
      />

      {save.error && <p className="error">{(save.error as Error).message}</p>}
      {saveMsg && <p className="muted">{saveMsg}</p>}

      <button type="button" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save invoice settings"}
      </button>
    </div>
  );
}
