"use client";

import { useState } from "react";

export type GridColumn<T> = {
  key: keyof T & string;
  label: string;
  type?: "number" | "text";
};

export function EditableGrid<T extends { date: string }>({
  dates,
  columns,
  initialRows,
  onSave,
  saving,
}: {
  dates: string[];
  columns: GridColumn<T>[];
  initialRows: T[];
  onSave: (rows: T[]) => Promise<unknown>;
  saving?: boolean;
}) {
  const rowMap = new Map(initialRows.map((r) => [r.date, r]));
  const empty = () =>
    ({ date: "", ...Object.fromEntries(columns.map((c) => [c.key, 0])) }) as T;

  const [rows, setRows] = useState<T[]>(() =>
    dates.map((date) => {
      const existing = rowMap.get(date);
      if (existing) return { ...existing, date };
      return { ...empty(), date } as T;
    }),
  );

  function update(date: string, key: string, value: string | number) {
    setRows((prev) =>
      prev.map((r) =>
        r.date === date
          ? {
              ...r,
              [key]: columns.find((c) => c.key === key)?.type === "text" ? value : Number(value) || 0,
            }
          : r,
      ),
    );
  }

  return (
    <div>
      <button type="button" onClick={() => onSave(rows)} disabled={saving}>
        {saving ? "Saving…" : "Save all"}
      </button>
      <div className="table-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              <th>Date</th>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.date}>
                <td>{row.date.slice(8)}</td>
                {columns.map((c) => (
                  <td key={c.key}>
                    <input
                      type={c.type === "text" ? "text" : "number"}
                      step="0.01"
                      value={String((row as Record<string, unknown>)[c.key] ?? "")}
                      onChange={(e) => update(row.date, c.key, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
