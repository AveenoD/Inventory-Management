"use client";

import { useState } from "react";
import { Download, Upload, CheckCircle2, AlertCircle, ArrowRight, Table, ServerCrash } from "lucide-react";
import { api } from "@/lib/api";

type ImportEntity = "products" | "repair_history";

type PreviewRow = {
  index: number;
  data: any;
  isValid: boolean;
  errors: string[];
};

type PreviewResult = {
  entity: ImportEntity;
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: PreviewRow[];
};

export function UniversalImportWizard() {
  const [entity, setEntity] = useState<ImportEntity>("products");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    // API client doesn't handle blob downloads cleanly sometimes, so we'll just redirect to the URL
    // or trigger a standard download via a link
    window.open(`http://localhost:3001/api/v1/import/universal/template?entity=${entity}`, "_blank");
  };

  const handlePreview = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setSuccess(null);
    setIsLoading(true);
    
    try {
      const result = await api.previewUniversalImport(selectedFile, entity);
      setPreview(result);
    } catch (e: any) {
      setError(e.message || "Failed to preview file");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.executeUniversalImport(file, entity);
      setSuccess(`Successfully imported! Inserted: ${result.insertedCount}, Updated: ${result.updatedCount}`);
      setPreview(null);
      setFile(null);
    } catch (e: any) {
      setError(e.message || "Failed to execute import");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="settings-card">
      <div className="settings-card-header">
        <div className="settings-card-icon" style={{ background: "#f0fdf4", color: "#166534" }}>
          <Table size={20} />
        </div>
        <div className="settings-card-title-group">
          <h2 className="settings-card-title">Universal Data Importer</h2>
          <p className="settings-card-subtitle">Bulk import Inventory, Repairs, and more directly via Excel.</p>
        </div>
      </div>

      <div className="settings-card-body">
        {success && (
          <div className="form-group" style={{ marginBottom: "1rem" }}>
             <div style={{ padding: "1rem", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", color: "#166534", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CheckCircle2 size={18} />
                <b>{success}</b>
             </div>
          </div>
        )}

        {error && (
          <div className="form-group" style={{ marginBottom: "1rem" }}>
             <div style={{ padding: "1rem", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", color: "#991b1b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertCircle size={18} />
                <b>{error}</b>
             </div>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">1. Select Data Type</label>
            <select
              className="form-input"
              value={entity}
              onChange={(e) => {
                setEntity(e.target.value as ImportEntity);
                setPreview(null);
                setFile(null);
              }}
              disabled={isLoading || preview !== null}
            >
              <option value="products">Inventory Products</option>
              <option value="repair_history">Repair History (Coming Soon)</option>
            </select>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "flex-end" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDownloadTemplate}
              style={{ width: "100%", justifyContent: "center" }}
              disabled={isLoading || preview !== null}
            >
              <Download size={16} /> Download {entity === "products" ? "Inventory" : "Repair"} Template
            </button>
          </div>
        </div>

        {!preview && (
          <div className="form-group" style={{ marginTop: "1rem" }}>
            <label className="form-label">2. Upload Filled Template</label>
            <div
              style={{
                border: "2px dashed #cbd5e1",
                borderRadius: "8px",
                padding: "2rem",
                textAlign: "center",
                background: "#f8fafc",
                cursor: "pointer",
                position: "relative"
              }}
            >
              <Upload size={24} color="#64748b" style={{ margin: "0 auto 0.5rem" }} />
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
                {isLoading ? "Analyzing file..." : "Click to select Excel file (.xlsx)"}
              </p>
              <input
                type="file"
                accept=".xlsx, .xls"
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  opacity: 0, cursor: "pointer"
                }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handlePreview(e.target.files[0]);
                  }
                  e.target.value = "";
                }}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        {preview && (
          <div className="preview-container" style={{ marginTop: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "1rem", background: "#f8fafc", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Data Preview</h3>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                  Found {preview.totalRows} rows. 
                  <span style={{ color: "#16a34a", marginLeft: "0.5rem" }}>{preview.validCount} valid</span>, 
                  <span style={{ color: "#dc2626", marginLeft: "0.5rem" }}>{preview.errorCount} errors</span>
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPreview(null)}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleExecute}
                  disabled={isLoading || preview.errorCount > 0}
                  style={preview.errorCount > 0 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                >
                  Confirm Import <ArrowRight size={16} />
                </button>
              </div>
            </div>

            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead style={{ position: "sticky", top: 0, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <tr>
                    <th style={{ padding: "0.75rem", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Row</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>Details / Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: row.isValid ? "#fff" : "#fef2f2" }}>
                      <td style={{ padding: "0.75rem", color: "#475569" }}>#{row.index}</td>
                      <td style={{ padding: "0.75rem" }}>
                        {row.isValid ? (
                          <span style={{ color: "#16a34a", display: "flex", alignItems: "center", gap: "0.25rem" }}><CheckCircle2 size={14} /> Valid</span>
                        ) : (
                          <span style={{ color: "#dc2626", display: "flex", alignItems: "center", gap: "0.25rem" }}><AlertCircle size={14} /> Error</span>
                        )}
                      </td>
                      <td style={{ padding: "0.75rem", color: "#334155" }}>
                        {row.isValid ? (
                          <span>{row.data["Item Name"] || "Valid Data"}</span>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#b91c1c" }}>
                            {row.errors.map((e, ei) => <li key={ei}>{e}</li>)}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                  {preview.totalRows > preview.rows.length && (
                    <tr>
                      <td colSpan={3} style={{ padding: "1rem", textAlign: "center", color: "#64748b" }}>
                        ... and {preview.totalRows - preview.rows.length} more rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {preview.errorCount > 0 && (
              <div style={{ padding: "0.75rem 1rem", background: "#fff1f2", borderTop: "1px solid #fecaca", color: "#9f1239", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ServerCrash size={16} />
                Fix the errors in your Excel file and upload again to proceed.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
