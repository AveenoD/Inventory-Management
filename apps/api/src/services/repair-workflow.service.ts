import type { Prisma, RepairJob, RepairJobPart, Product } from "@prisma/client";
import type { RepairJobStatus } from "@sk-mobile/shared";
import { d, fmt } from "../lib/decimal.js";
import { profit } from "./calculations.js";

type RepairJobWithParts = RepairJob & {
  parts?: Array<RepairJobPart & { product: Pick<Product, "name"> }>;
};

export function repairCostTotal(r: Pick<RepairJob, "partsCost" | "labourCost">) {
  return fmt(d(r.partsCost).plus(d(r.labourCost)));
}

export function mapRepairJobDto(r: RepairJobWithParts) {
  const repairCost = repairCostTotal(r);
  const customerCharge = fmt(d(r.salePrice));
  return {
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    status: r.status,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    device: r.device,
    issueDescription: r.issueDescription,
    repairCost,
    customerCharge,
    partsCost: fmt(d(r.partsCost)),
    labourCost: fmt(d(r.labourCost)),
    salePrice: customerCharge,
    profit: fmt(d(r.profit)),
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString().slice(0, 10) : null,
    note: r.note,
    otherPartUsed: r.otherPartUsed,
    partsUsed: (r.parts ?? []).map((p) => ({
      productId: p.productId,
      productName: p.product.name,
      quantity: p.quantity,
      unitCost: fmt(d(p.unitCost)),
    })),
  };
}

export function rollupDatesForJob(job: RepairJob): Date[] {
  const dates = new Set<string>();
  dates.add(job.date.toISOString().slice(0, 10));
  if (job.deliveredAt) {
    dates.add(job.deliveredAt.toISOString().slice(0, 10));
  }
  return [...dates].map((s) => new Date(`${s}T00:00:00.000Z`));
}

export function financialsForRepair(
  partsCost: number,
  labourCost: number,
  salePrice: number,
) {
  const cost = d(partsCost).plus(d(labourCost));
  const profitVal = profit(salePrice, cost.toString());
  return { cost, profitVal };
}

export function clearFinancials() {
  return {
    partsCost: 0,
    labourCost: 0,
    salePrice: 0,
    profit: 0,
  };
}

export type StatusUpdateInput = {
  status: RepairJobStatus;
  date?: string;
  customerName?: string;
  customerPhone?: string;
  device?: string;
  issueDescription?: string;
  /** legacy alias for parts cost (older clients) */
  repairCost?: number;
  /** legacy alias for sale price (older clients) */
  customerCharge?: number;
  partsCost?: number;
  labourCost?: number;
  salePrice?: number;
  partsUsed?: Array<{ productId: string; quantity: number }>;
  otherPartUsed?: string;
  deliveredAt?: string;
  note?: string;
};

export function validateRepairPartSelection(input: StatusUpdateInput) {
  const hasInventory = (input.partsUsed?.length ?? 0) > 0;
  const hasOther = Boolean(input.otherPartUsed?.trim());
  if (hasInventory && hasOther) {
    throw new Error("Choose either an inventory part or other part, not both");
  }
}

export async function consumeRepairParts(
  tx: Prisma.TransactionClient,
  userId: string,
  repairJobId: string,
  parts: Array<{ productId: string; quantity: number }>,
): Promise<{ partsCost: number; labourCost: number }> {
  let partsTotal = d(0);

  for (const line of parts) {
    const product = await tx.product.findFirst({
      where: { id: line.productId, userId, kind: "REPAIR_PART", isActive: true },
    });
    if (!product) {
      throw new Error("Selected repair part not found in inventory");
    }
    if (product.stockQty < line.quantity) {
      throw new Error(`Insufficient stock for ${product.name} (${product.stockQty} left)`);
    }

    const unitCost = d(product.buyPrice);
    const lineCost = unitCost.times(line.quantity);
    partsTotal = partsTotal.plus(lineCost);

    await tx.repairJobPart.create({
      data: {
        repairJobId,
        productId: product.id,
        quantity: line.quantity,
        unitCost: fmt(unitCost),
      },
    });

    await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: "OUT",
        quantity: line.quantity,
        unitCost: fmt(unitCost),
        note: `Repair job ${repairJobId}`,
      },
    });

    await tx.product.update({
      where: { id: product.id },
      data: { stockQty: { decrement: line.quantity } },
    });
  }

  return { partsCost: Number(partsTotal), labourCost: 0 };
}

export async function resolveRepairCompleteCostsInTx(
  tx: Prisma.TransactionClient,
  input: StatusUpdateInput,
  userId: string,
  repairJobId: string,
): Promise<{ partsCost: number; labourCost: number }> {
  if (input.partsUsed && input.partsUsed.length > 0) {
    const existingCount = await tx.repairJobPart.count({ where: { repairJobId } });
    if (existingCount > 0) {
      throw new Error("Parts already recorded for this repair job");
    }
    const consumed = await consumeRepairParts(tx, userId, repairJobId, input.partsUsed);
    const manualTotal = input.repairCost ?? consumed.partsCost;
    const labourCost = Math.max(0, manualTotal - consumed.partsCost);
    return { partsCost: consumed.partsCost, labourCost };
  }

  const manualTotal = input.repairCost ?? input.partsCost ?? 0;
  const labour = input.labourCost ?? 0;
  return {
    partsCost: Math.max(0, manualTotal - labour),
    labourCost: labour,
  };
}

export function buildStatusUpdateData(
  current: RepairJob,
  input: StatusUpdateInput,
): Prisma.RepairJobUpdateInput {
  const { status } = input;

  if (status === "UNREPAIRABLE_RETURNED") {
    return {
      status,
      ...clearFinancials(),
      deliveredAt: null,
      note: input.note ?? current.note,
      ...(input.date && { date: new Date(`${input.date}T00:00:00.000Z`) }),
      ...(input.customerName !== undefined && { customerName: input.customerName }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone || null }),
      ...(input.device !== undefined && { device: input.device }),
      ...(input.issueDescription !== undefined && { issueDescription: input.issueDescription }),
    };
  }

  if (status === "RECEIVED" || status === "IN_PROGRESS") {
    const partsCost =
      input.repairCost ?? input.partsCost ?? Number(current.partsCost);
    const labourCost = input.labourCost ?? Number(current.labourCost);
    const salePrice =
      input.customerCharge ?? input.salePrice ?? Number(current.salePrice);
    const { profitVal } = financialsForRepair(partsCost, labourCost, salePrice);
    return {
      status,
      deliveredAt: null,
      note: input.note ?? current.note,
      ...(input.date && { date: new Date(`${input.date}T00:00:00.000Z`) }),
      ...(input.customerName !== undefined && { customerName: input.customerName }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone || null }),
      ...(input.device !== undefined && { device: input.device }),
      ...(input.issueDescription !== undefined && { issueDescription: input.issueDescription }),
      partsCost,
      labourCost,
      salePrice,
      profit: profitVal,
    };
  }

  if (status === "REPAIRED_PENDING_PICKUP") {
    const partsCost =
      input.partsCost ??
      input.repairCost ??
      Number(current.partsCost);
    const labourCost = input.labourCost ?? Number(current.labourCost);
    const salePrice =
      input.customerCharge ??
      input.salePrice ??
      Number(current.salePrice);
    if (salePrice <= 0) {
      throw new Error("Enter customer charge before marking ready for pickup");
    }
    const { profitVal } = financialsForRepair(partsCost, labourCost, salePrice);
    return {
      status,
      partsCost,
      labourCost,
      salePrice,
      profit: profitVal,
      deliveredAt: null,
      note: input.note ?? current.note,
      ...(input.date && { date: new Date(`${input.date}T00:00:00.000Z`) }),
      ...(input.customerName !== undefined && { customerName: input.customerName }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone || null }),
      ...(input.device !== undefined && { device: input.device }),
      ...(input.issueDescription !== undefined && { issueDescription: input.issueDescription }),
      otherPartUsed:
        (input.partsUsed?.length ?? 0) > 0
          ? null
          : input.otherPartUsed?.trim() || null,
    };
  }

  if (status === "DELIVERED") {
    if (current.status !== "REPAIRED_PENDING_PICKUP") {
      throw new Error("Only jobs pending pickup can be marked delivered");
    }
    const deliveredStr =
      input.deliveredAt ?? new Date().toISOString().slice(0, 10);
    return {
      status,
      deliveredAt: new Date(`${deliveredStr}T00:00:00.000Z`),
      note: input.note ?? current.note,
      ...(input.customerName !== undefined && { customerName: input.customerName }),
      ...(input.customerPhone !== undefined && { customerPhone: input.customerPhone || null }),
      ...(input.device !== undefined && { device: input.device }),
      ...(input.issueDescription !== undefined && { issueDescription: input.issueDescription }),
    };
  }

  throw new Error("Invalid status transition");
}
