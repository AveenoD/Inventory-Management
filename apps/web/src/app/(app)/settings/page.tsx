"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { formatMoney } from "@/lib/format";
import { Download } from "lucide-react";

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
    <div>
      <PageHeader title="Settings" subtitle="Import and export business data" />

      <div className="card form-stack" style={{ maxWidth: 520, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Export Excel</h3>
        <p className="muted">
          Download sales, profit, inventory stock balance, and daily breakdown. Choose full month or a
          single day.
        </p>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="exportPeriod"
              checked={exportPeriod === "month"}
              onChange={() => setExportPeriod("month")}
            />
            Full month
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="exportPeriod"
              checked={exportPeriod === "day"}
              onChange={() => setExportPeriod("day")}
            />
            Single day
          </label>
        </div>
        {exportPeriod === "month" ? (
          <>
            <label className="stat-label">Year</label>
            <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            <label className="stat-label">Month</label>
            <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
          </>
        ) : (
          <>
            <label className="stat-label">Export date</label>
            <input
              type="date"
              value={exportDate}
              onChange={(e) => setExportDate(e.target.value)}
            />
          </>
        )}
        {exportError && <p className="error">{exportError}</p>}
        <button type="button" onClick={handleExport} disabled={exporting}>
          <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          {exporting ? "Preparing Excel…" : "Download Excel"}
        </button>
      </div>

      <div className="card form-stack" style={{ maxWidth: 520, marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Import Excel</h3>
        <p className="muted">
          Upload your shop workbook (.xlsx). Supports Money Transfer, Recharge, Repair, and Mobile
          sheets. Preview first to verify row counts before importing.
        </p>
        <button type="button" className="secondary" onClick={downloadTemplate} disabled={templateLoading}>
          <Download size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />
          {templateLoading ? "Downloading…" : "Download import template"}
        </button>
        <label className="stat-label">Import year</label>
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        <label className="stat-label">Import month</label>
        <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        <label className="stat-label">Excel file</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setResult(null);
          }}
        />
        {(previewImport.error || importExcel.error) && (
          <p className="error">
            {((previewImport.error ?? importExcel.error) as Error).message}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary"
            disabled={!file || previewImport.isPending}
            onClick={() => previewImport.mutate()}
          >
            {previewImport.isPending ? "Checking…" : "Preview import"}
          </button>
          <button
            type="button"
            disabled={!file || importExcel.isPending}
            onClick={() => importExcel.mutate()}
          >
            {importExcel.isPending ? "Importing…" : "Import now"}
          </button>
        </div>
      </div>

      {active && (
        <div className="card" style={{ maxWidth: 520 }}>
          <h3>{result ? "Import complete" : "Import preview"}</h3>
          {active.sheets && (
            <p className="muted">Sheets found: {active.sheets.join(", ")}</p>
          )}
          {active.counts && (
            <table className="data-list" style={{ marginTop: "0.75rem" }}>
              <tbody>
                <tr>
                  <td>Money Transfer days</td>
                  <td className="right">{active.counts.moneyTransferDays}</td>
                </tr>
                <tr>
                  <td>Recharge days</td>
                  <td className="right">{active.counts.rechargeDays}</td>
                </tr>
                <tr>
                  <td>Repair days</td>
                  <td className="right">{active.counts.repairDays}</td>
                </tr>
                <tr>
                  <td>Mobile days</td>
                  <td className="right">{active.counts.mobileDays}</td>
                </tr>
              </tbody>
            </table>
          )}
          {active.validation && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Dashboard totals after import</h4>
              <table className="data-list">
                <tbody>
                  <tr>
                    <td>Total income</td>
                    <td className="right">{formatMoney(active.validation.totalIncome)}</td>
                  </tr>
                  <tr>
                    <td>Net profit</td>
                    <td className="right">{formatMoney(active.validation.netProfit)}</td>
                  </tr>
                  <tr>
                    <td>Recharge + Transfer</td>
                    <td className="right">{formatMoney(active.validation.rechargeTransferProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {active.warnings && active.warnings.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h4>Warnings</h4>
              <ul className="muted">
                {active.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          {active.errors && active.errors.length > 0 && (
            <div style={{ marginTop: "1rem" }}>
              <h4 className="error">Errors</h4>
              <ul>
                {active.errors.map((e) => (
                  <li key={e} className="error">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
