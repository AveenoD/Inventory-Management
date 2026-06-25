"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/format";
import { Download, Upload, FileDown, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { InvoiceSettingsCard } from "@/components/settings/invoice-settings-card";
import { UniversalImportWizard } from "@/components/settings/universal-import-wizard";

type ExportPeriod = "month" | "day";

type ImportResult = {
  dryRun?: boolean;
  sheets?: string[];
  counts?: {
    moneyTransferDays: number;
    rechargeDays: number;
    repairDays: number;
    mobileDays: number;
  };
  warnings?: string[];
  errors?: string[];
  validation?: {
    totalIncome: string;
    netProfit: string;
    rechargeTransferProfit: string;
  };
};

export default function SettingsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [exportPeriod, setExportPeriod] = useState<ExportPeriod>("month");
  const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const previewImport = useMutation({
    mutationFn: () => api.previewImportExcel(file!, parseInt(year, 10), parseInt(month, 10)),
    onSuccess: (data) => {
      setPreview(data as ImportResult);
      setResult(null);
    },
  });

  const importExcel = useMutation({
    mutationFn: () => api.importExcel(file!, parseInt(year, 10), parseInt(month, 10)),
    onSuccess: (data) => {
      setResult(data as ImportResult);
      setPreview(null);
    },
  });

  async function downloadTemplate() {
    setTemplateLoading(true);
    try {
      await api.downloadImportTemplate();
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleExport() {
    setExportError(null);
    setExporting(true);
    try {
      if (exportPeriod === "day") {
        await api.downloadExportExcel({ date: exportDate });
      } else {
        await api.downloadExportExcel({
          year: parseInt(year, 10),
          month: parseInt(month, 10),
        });
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const active = result ?? preview;

  return (
    <div className="settings-page">
      <PageHeader title="Settings" subtitle="Manage shop configuration and data" />

      <div className="settings-grid">
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <InvoiceSettingsCard />

          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon">
                <FileDown size={20} />
              </div>
              <div>
                <h3 className="settings-card-title">Export Business Data</h3>
                <p className="settings-card-subtitle">
                  Download sales, profit, stock balance, and daily breakdown.
                </p>
              </div>
            </div>

            <div className="settings-form-row">
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="exportPeriod"
                    checked={exportPeriod === "month"}
                    onChange={() => setExportPeriod("month")}
                  />
                  Full month
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer", fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="exportPeriod"
                    checked={exportPeriod === "day"}
                    onChange={() => setExportPeriod("day")}
                  />
                  Single day
                </label>
              </div>
            </div>

            {exportPeriod === "month" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div className="settings-form-row">
                  <label className="stat-label">Year</label>
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div className="settings-form-row">
                  <label className="stat-label">Month</label>
                  <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="settings-form-row">
                <label className="stat-label">Export date</label>
                <input
                  type="date"
                  value={exportDate}
                  onChange={(e) => setExportDate(e.target.value)}
                />
              </div>
            )}

            {exportError && <p className="error" style={{ marginTop: "1rem" }}>{exportError}</p>}
            
            <div className="settings-btn-group">
              <button type="button" onClick={handleExport} disabled={exporting}>
                <Download size={16} style={{ marginRight: 6 }} />
                {exporting ? "Preparing Excel…" : "Download Excel"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <UniversalImportWizard />

          <div className="settings-card">
            <div className="settings-card-header">
              <div className="settings-card-icon" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#16a34a" }}>
                <Upload size={20} />
              </div>
              <div>
                <h3 className="settings-card-title">Import Legacy Data</h3>
                <p className="settings-card-subtitle">
                  Upload an existing Excel workbook (.xlsx). Preview before importing.
                </p>
              </div>
            </div>

            <div className="settings-form-row">
              <button type="button" className="secondary" onClick={downloadTemplate} disabled={templateLoading} style={{ alignSelf: "flex-start" }}>
                <Download size={16} style={{ marginRight: 6 }} />
                {templateLoading ? "Downloading…" : "Download Template"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className="settings-form-row">
                <label className="stat-label">Import year</label>
                <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
              </div>
              <div className="settings-form-row">
                <label className="stat-label">Import month</label>
                <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
              </div>
            </div>

            <div className="settings-form-row">
              <label className="stat-label">Excel file</label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setPreview(null);
                  setResult(null);
                }}
                style={{ padding: "0.5rem" }}
              />
            </div>

            {(previewImport.error || importExcel.error) && (
              <p className="error" style={{ marginTop: "1rem", padding: "0.75rem", background: "#fef2f2", borderRadius: "8px" }}>
                <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: "4px" }} />
                {((previewImport.error ?? importExcel.error) as Error).message}
              </p>
            )}

            <div className="settings-btn-group">
              <button
                type="button"
                className="secondary"
                disabled={!file || previewImport.isPending}
                onClick={() => previewImport.mutate()}
              >
                {previewImport.isPending ? "Checking…" : "Preview Import"}
              </button>
              <button
                type="button"
                disabled={!file || importExcel.isPending}
                onClick={() => importExcel.mutate()}
                style={{ background: "#16a34a", borderColor: "#16a34a" }}
              >
                {importExcel.isPending ? "Importing…" : "Import Now"}
              </button>
            </div>
          </div>

          {active && (
            <div className="settings-card" style={{ border: result ? "2px solid #22c55e" : "2px solid #3b82f6" }}>
              <div className="settings-card-header" style={{ marginBottom: "1rem", paddingBottom: "0.75rem" }}>
                <div className="settings-card-icon" style={{ background: "transparent", color: result ? "#16a34a" : "#2563eb", width: "auto" }}>
                  {result ? <CheckCircle size={24} /> : <AlertCircle size={24} />}
                </div>
                <div>
                  <h3 className="settings-card-title">{result ? "Import Successful" : "Import Preview"}</h3>
                  {active.sheets && (
                    <p className="settings-card-subtitle">Found sheets: {active.sheets.join(", ")}</p>
                  )}
                </div>
              </div>

              {active.counts && (
                <div className="settings-form-row">
                  <label className="stat-label">Detected Records</label>
                  <table className="data-list" style={{ width: "100%", background: "#f8fafc", borderRadius: "8px", overflow: "hidden" }}>
                    <tbody>
                      <tr>
                        <td>Money Transfer</td>
                        <td className="right" style={{ fontWeight: 600 }}>{active.counts.moneyTransferDays} days</td>
                      </tr>
                      <tr>
                        <td>Recharge</td>
                        <td className="right" style={{ fontWeight: 600 }}>{active.counts.rechargeDays} days</td>
                      </tr>
                      <tr>
                        <td>Repair</td>
                        <td className="right" style={{ fontWeight: 600 }}>{active.counts.repairDays} days</td>
                      </tr>
                      <tr>
                        <td>Mobile</td>
                        <td className="right" style={{ fontWeight: 600 }}>{active.counts.mobileDays} days</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {active.validation && (
                <div className="settings-form-row" style={{ marginTop: "1rem" }}>
                  <label className="stat-label">Projected Totals</label>
                  <table className="data-list" style={{ width: "100%", background: "#f8fafc", borderRadius: "8px", overflow: "hidden" }}>
                    <tbody>
                      <tr>
                        <td>Total income</td>
                        <td className="right" style={{ fontWeight: 600 }}>{formatMoney(active.validation.totalIncome)}</td>
                      </tr>
                      <tr>
                        <td>Net profit</td>
                        <td className="right" style={{ fontWeight: 600, color: "var(--green)" }}>{formatMoney(active.validation.netProfit)}</td>
                      </tr>
                      <tr>
                        <td>Recharge + Transfer</td>
                        <td className="right" style={{ fontWeight: 600 }}>{formatMoney(active.validation.rechargeTransferProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {active.warnings && active.warnings.length > 0 && (
                <div className="settings-form-row" style={{ marginTop: "1rem" }}>
                  <label className="stat-label" style={{ color: "#ca8a04", display: "flex", alignItems: "center", gap: "4px" }}>
                    <AlertCircle size={14} /> Warnings
                  </label>
                  <ul className="muted" style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem" }}>
                    {active.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {active.errors && active.errors.length > 0 && (
                <div className="settings-form-row" style={{ marginTop: "1rem" }}>
                  <label className="stat-label" style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "4px" }}>
                    <XCircle size={14} /> Errors
                  </label>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.85rem", color: "#dc2626" }}>
                    {active.errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
