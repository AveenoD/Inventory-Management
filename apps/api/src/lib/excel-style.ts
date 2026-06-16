import type { Alignment, Borders, Cell, Workbook, Worksheet } from "exceljs";

/** SK Mobile brand palette */
export const XL = {
  brand: "1E40AF",
  brandDark: "1E3A8A",
  brandLight: "DBEAFE",
  section: "F8FAFC",
  sectionBorder: "E2E8F0",
  headerBg: "0F172A",
  headerText: "FFFFFF",
  accent: "059669",
  accentLight: "D1FAE5",
  totalBg: "E0F2FE",
  zebra: "F1F5F9",
  text: "0F172A",
  muted: "64748B",
  border: "CBD5E1",
  profit: "16A34A",
  expense: "DC2626",
  white: "FFFFFF",
} as const;

function argb(hex: string): string {
  const h = hex.replace("#", "").toUpperCase();
  return h.length === 8 ? h : `FF${h}`;
}

const thinBorder: Partial<Borders> = {
  top: { style: "thin", color: { argb: argb(XL.border) } },
  left: { style: "thin", color: { argb: argb(XL.border) } },
  bottom: { style: "thin", color: { argb: argb(XL.border) } },
  right: { style: "thin", color: { argb: argb(XL.border) } },
};

export function fillCell(
  cell: Cell,
  bg: string,
  opts?: { bold?: boolean; color?: string; size?: number; hAlign?: Alignment["horizontal"] },
) {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: argb(bg) } };
  cell.font = {
    bold: opts?.bold ?? false,
    color: { argb: argb(opts?.color ?? XL.text) },
    size: opts?.size ?? 11,
    name: "Calibri",
  };
  if (opts?.hAlign) cell.alignment = { horizontal: opts.hAlign, vertical: "middle" };
}

export function borderRange(sheet: Worksheet, r1: number, c1: number, r2: number, c2: number) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      sheet.getCell(r, c).border = thinBorder;
    }
  }
}

export function moneyFmt(cell: Cell) {
  cell.numFmt = '#,##0.00';
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

export function intFmt(cell: Cell) {
  cell.numFmt = "#,##0";
  cell.alignment = { horizontal: "right", vertical: "middle" };
}

export function autoFitColumns(sheet: Worksheet, min = 10, max = 42) {
  sheet.columns.forEach((col) => {
    if (!col) return;
    let maxLen = min;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      const len = v == null ? 0 : String(v).length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(max + 2, Math.max(min, maxLen + 2));
  });
}

export function addReportTitle(
  sheet: Worksheet,
  title: string,
  subtitle: string,
  colSpan = 4,
) {
  sheet.mergeCells(1, 1, 1, colSpan);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  fillCell(titleCell, XL.brand, { bold: true, color: XL.headerText, size: 16, hAlign: "left" });
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(1).height = 36;

  sheet.mergeCells(2, 1, 2, colSpan);
  const subCell = sheet.getCell(2, 1);
  subCell.value = subtitle;
  fillCell(subCell, XL.brandLight, { color: XL.brandDark, size: 11, hAlign: "left" });
  subCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(2).height = 22;

  return 4;
}

export function addMetaRow(sheet: Worksheet, row: number, label: string, value: string) {
  const labelCell = sheet.getCell(row, 1);
  const valueCell = sheet.getCell(row, 2);
  labelCell.value = label;
  valueCell.value = value;
  fillCell(labelCell, XL.section, { bold: true, color: XL.muted });
  fillCell(valueCell, XL.section);
  labelCell.border = thinBorder;
  valueCell.border = thinBorder;
  labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  valueCell.alignment = { horizontal: "left", vertical: "middle" };
  sheet.getRow(row).height = 20;
}

export function addSectionTitle(sheet: Worksheet, row: number, title: string, colSpan = 2) {
  sheet.mergeCells(row, 1, row, colSpan);
  const cell = sheet.getCell(row, 1);
  cell.value = title;
  fillCell(cell, XL.brand, { bold: true, color: XL.headerText, size: 12, hAlign: "left" });
  cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 26;
  return row + 1;
}

export function addKvTableHeader(sheet: Worksheet, row: number) {
  const h1 = sheet.getCell(row, 1);
  const h2 = sheet.getCell(row, 2);
  h1.value = "Metric";
  h2.value = "Amount (₹)";
  fillCell(h1, XL.headerBg, { bold: true, color: XL.headerText, hAlign: "left" });
  fillCell(h2, XL.headerBg, { bold: true, color: XL.headerText, hAlign: "right" });
  h1.border = thinBorder;
  h2.border = thinBorder;
  h1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  h2.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 24;
  return row + 1;
}

export function addKvRow(
  sheet: Worksheet,
  row: number,
  label: string,
  value: number | string,
  opts?: { highlight?: boolean; isTotal?: boolean; format?: "money" | "integer"; col?: number },
) {
  const col = opts?.col ?? 1;
  const labelCell = sheet.getCell(row, col);
  const valueCell = sheet.getCell(row, col + 1);
  labelCell.value = label;
  valueCell.value = value;

  const bg = opts?.isTotal ? XL.totalBg : opts?.highlight ? XL.accentLight : XL.white;
  fillCell(labelCell, bg, { bold: opts?.isTotal ?? false });
  fillCell(valueCell, bg, { bold: opts?.isTotal ?? false });
  labelCell.border = thinBorder;
  valueCell.border = thinBorder;
  labelCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  if (typeof value === "number") {
    if (opts?.format === "integer") intFmt(valueCell);
    else moneyFmt(valueCell);
  } else {
    valueCell.alignment = { horizontal: "left", vertical: "middle" };
  }
  sheet.getRow(row).height = 21;
  return row + 1;
}

export function addGridSheet(
  sheet: Worksheet,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  moneyColsFrom = 2,
) {
  const colSpan = Math.min(headers.length, 8);
  let r = addReportTitle(sheet, title, `Generated ${new Date().toISOString().slice(0, 10)}`, colSpan);

  r += 1;
  headers.forEach((h, i) => {
    const cell = sheet.getCell(r, i + 1);
    cell.value = h;
    fillCell(cell, XL.headerBg, { bold: true, color: XL.headerText, hAlign: i === 0 ? "left" : "center" });
    cell.border = thinBorder;
    cell.alignment = {
      horizontal: i === 0 ? "left" : "center",
      vertical: "middle",
      wrapText: true,
    };
  });
  sheet.getRow(r).height = 28;

  const headerRow = r;
  r += 1;

  if (rows.length === 0) {
    sheet.mergeCells(r, 1, r, headers.length);
    const empty = sheet.getCell(r, 1);
    empty.value = "No data for this period";
    fillCell(empty, XL.section, { color: XL.muted, hAlign: "center" });
    empty.alignment = { horizontal: "center", vertical: "middle" };
    borderRange(sheet, headerRow, 1, r, headers.length);
    autoFitColumns(sheet);
    sheet.views = [{ state: "frozen", ySplit: headerRow, activeCell: "A1" }];
    return;
  }

  rows.forEach((row, idx) => {
    const bg = idx % 2 === 0 ? XL.white : XL.zebra;
    row.forEach((val, ci) => {
      const cell = sheet.getCell(r, ci + 1);
      cell.value = val;
      fillCell(cell, bg);
      cell.border = thinBorder;
      if (ci === 0) {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      } else if (ci >= moneyColsFrom - 1 && typeof val === "number") {
        moneyFmt(cell);
      } else if (typeof val === "number") {
        intFmt(cell);
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      }
    });
    sheet.getRow(r).height = 20;
    r += 1;
  });

  borderRange(sheet, headerRow, 1, r - 1, headers.length);
  autoFitColumns(sheet, 12, 22);
  sheet.views = [{ state: "frozen", ySplit: headerRow, activeCell: "A1" }];
}

export type KvEntry = {
  label: string;
  value: number | string;
  highlight?: boolean;
  isTotal?: boolean;
  format?: "money" | "integer";
};

function addKvTableHeaderAt(sheet: Worksheet, row: number, col: number) {
  const h1 = sheet.getCell(row, col);
  const h2 = sheet.getCell(row, col + 1);
  h1.value = "Metric";
  h2.value = "Amount (₹)";
  fillCell(h1, XL.headerBg, { bold: true, color: XL.headerText, hAlign: "left" });
  fillCell(h2, XL.headerBg, { bold: true, color: XL.headerText, hAlign: "right" });
  h1.border = thinBorder;
  h2.border = thinBorder;
  h1.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  h2.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
  sheet.getRow(row).height = 24;
}

/** Side-by-side summary block: title + metric/value rows in two columns */
export function addKvBlock(
  sheet: Worksheet,
  startRow: number,
  startCol: number,
  title: string,
  entries: KvEntry[],
): number {
  sheet.mergeCells(startRow, startCol, startRow, startCol + 1);
  const titleCell = sheet.getCell(startRow, startCol);
  titleCell.value = title;
  fillCell(titleCell, XL.brand, { bold: true, color: XL.headerText, size: 12, hAlign: "left" });
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  sheet.getRow(startRow).height = 26;

  let r = startRow + 1;
  addKvTableHeaderAt(sheet, r, startCol);
  r += 1;

  for (const entry of entries) {
    addKvRow(sheet, r, entry.label, entry.value, { ...entry, col: startCol });
    r += 1;
  }

  borderRange(sheet, startRow, startCol, r - 1, startCol + 1);
  return r;
}

export async function workbookToBuffer(workbook: Workbook): Promise<Buffer> {
  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
