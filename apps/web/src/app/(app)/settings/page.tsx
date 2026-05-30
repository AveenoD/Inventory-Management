"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";

export default function SettingsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState("2026");
  const [month, setMonth] = useState("5");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const importExcel = useMutation({
    mutationFn: () => api.importExcel(file!, parseInt(year, 10), parseInt(month, 10)),
    onSuccess: (data) => setResult(data as Record<string, unknown>),
  });

  return (
    <div>
      <PageHeader title="Settings" subtitle="Import Excel workbook data" />
      <div className="card form-stack" style={{ maxWidth: 480 }}>
        <h3>Import Excel</h3>
        <p className="muted">
          Upload your SK Mobile Shop workbook (.xlsx). Data imports into the selected month and
          validates against known totals.
        </p>
        <label className="stat-label">Year</label>
        <input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
        <label className="stat-label">Month</label>
        <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(e.target.value)} />
        <label className="stat-label">Excel file</label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {importExcel.error && (
          <p className="error">{(importExcel.error as Error).message}</p>
        )}
        <button
          type="button"
          disabled={!file || importExcel.isPending}
          onClick={() => importExcel.mutate()}
        >
          {importExcel.isPending ? "Importing…" : "Import"}
        </button>
      </div>
      {result && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Import result</h3>
          <pre style={{ overflow: "auto", fontSize: "0.85rem" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
