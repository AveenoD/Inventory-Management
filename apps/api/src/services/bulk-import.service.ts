import * as XLSX from "xlsx";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { ProductKind, StockMovementType } from "@prisma/client";
import { d } from "../lib/decimal.js";

export type ImportEntity = "products" | "repair_history";

export type UniversalPreviewRow = {
  index: number;
  data: any;
  isValid: boolean;
  errors: string[];
};

export type UniversalImportPreviewResult = {
  entity: ImportEntity;
  totalRows: number;
  validCount: number;
  errorCount: number;
  rows: UniversalPreviewRow[];
};

const productRowSchema = z.object({
  "Item Name": z.string().min(1, "Item Name is required"),
  "Category": z.string().optional(),
  "Purchase Price": z.number().min(0, "Must be >= 0"),
  "Sale Price": z.number().min(0, "Must be >= 0"),
  "Opening Stock": z.number().optional().default(0),
  "Minimum Stock": z.number().optional().default(0),
});

export function generateTemplate(entity: ImportEntity): Buffer {
  const wb = XLSX.utils.book_new();
  let headers: string[] = [];
  let data: any[] = [];

  if (entity === "products") {
    headers = [
      "Item Name",
      "Category",
      "Purchase Price",
      "Sale Price",
      "Opening Stock",
      "Minimum Stock"
    ];
    data = [
      ["Example AirPods Pro", "Mobile Accessory", 1500, 2500, 10, 2],
      ["Samsung S23 Case", "Mobile Accessory", 150, 300, 50, 5],
    ];
  } else if (entity === "repair_history") {
    headers = ["Device", "Customer Name", "Customer Phone", "Issue", "Cost", "Charge", "Date (YYYY-MM-DD)", "Status (DELIVERED/PENDING)"];
    data = [
      ["iPhone 13", "Raj", "9876543210", "Screen replacement", 2000, 4500, "2024-01-15", "DELIVERED"]
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  
  // Auto-size columns
  const wscols = headers.map(h => ({ wch: Math.max(h.length, 15) }));
  ws['!cols'] = wscols;

  XLSX.utils.book_append_sheet(wb, ws, "Template");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

export async function previewUniversalImport(
  buffer: Buffer,
  entity: ImportEntity
): Promise<UniversalImportPreviewResult> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as any[];

  const previewRows: UniversalPreviewRow[] = [];
  let validCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const preview: UniversalPreviewRow = { index: i + 2, data: raw, isValid: true, errors: [] };

    if (entity === "products") {
      const res = productRowSchema.safeParse(raw);
      if (!res.success) {
        preview.isValid = false;
        preview.errors = res.error.errors.map(e => `${e.path.join(".")}: ${e.message}`);
      }
    } else if (entity === "repair_history") {
        preview.isValid = false;
        preview.errors = ["Repair import not yet implemented"];
    }

    if (preview.isValid) {
      validCount++;
    } else {
      errorCount++;
    }
    
    // Send max 50 preview rows to avoid massive payload payload
    if (previewRows.length < 50 || !preview.isValid) {
      previewRows.push(preview);
    }
  }

  return {
    entity,
    totalRows: rows.length,
    validCount,
    errorCount,
    rows: previewRows.slice(0, 100), // Max 100 rows in preview for safety
  };
}

export async function executeUniversalImport(
  userId: string,
  buffer: Buffer,
  entity: ImportEntity
): Promise<{ success: boolean; insertedCount: number; updatedCount: number }> {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws) as any[];

  if (entity !== "products") {
      throw new Error("Only products import is currently supported.");
  }

  // Validate all first
  const validData: z.infer<typeof productRowSchema>[] = [];
  for (let i = 0; i < rows.length; i++) {
    const res = productRowSchema.safeParse(rows[i]);
    if (!res.success) {
      throw new Error(`Row ${i + 2} is invalid. Please fix errors in preview before importing.`);
    }
    validData.push(res.data);
  }

  let insertedCount = 0;
  let updatedCount = 0;

  // Execute in transaction
  await prisma.$transaction(async (tx) => {
    for (const item of validData) {
      // Determine kind
      let kind: ProductKind = ProductKind.MOBILE_ACCESSORY;
      const catStr = (item.Category || "").toLowerCase();
      if (catStr.includes("android")) kind = ProductKind.ANDROID_MOBILE;
      else if (catStr.includes("basic") || catStr.includes("keypad")) kind = ProductKind.BASIC_MOBILE;
      else if (catStr.includes("part")) kind = ProductKind.REPAIR_PART;

      const existing = await tx.product.findFirst({
        where: { userId, name: item["Item Name"] }
      });

      if (existing) {
        // Update price
        await tx.product.update({
          where: { id: existing.id },
          data: {
            buyPrice: item["Purchase Price"],
            sellPrice: item["Sale Price"],
            minStock: item["Minimum Stock"],
          }
        });
        updatedCount++;
        
        // If they provided opening stock, and it differs from existing, we could do an adjustment. 
        // For simplicity, we just add it as IN movement if opening stock is > 0 and existing stock is 0.
        if (item["Opening Stock"] > 0 && existing.stockQty === 0) {
            await tx.stockMovement.create({
                data: {
                    productId: existing.id,
                    type: StockMovementType.IN,
                    quantity: item["Opening Stock"],
                    note: "Bulk Import Update",
                }
            });
            await tx.product.update({
                where: { id: existing.id },
                data: { stockQty: { increment: item["Opening Stock"] } }
            });
        }
      } else {
        // Insert
        const newProd = await tx.product.create({
          data: {
            userId,
            name: item["Item Name"],
            kind,
            buyPrice: item["Purchase Price"],
            sellPrice: item["Sale Price"],
            minStock: item["Minimum Stock"],
            stockQty: item["Opening Stock"] > 0 ? item["Opening Stock"] : 0
          }
        });
        insertedCount++;

        if (item["Opening Stock"] > 0) {
          await tx.stockMovement.create({
            data: {
              productId: newProd.id,
              type: StockMovementType.IN,
              quantity: item["Opening Stock"],
              note: "Bulk Import Opening Stock",
            }
          });
        }
      }
    }
  });

  return { success: true, insertedCount, updatedCount };
}
