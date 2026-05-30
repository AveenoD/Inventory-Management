import type { Prisma, RepairJob } from "@prisma/client";
import type { RepairJobStatus } from "@sk-mobile/shared";
import { d, fmt } from "../lib/decimal.js";
import { profit } from "./calculations.js";

export function repairCostTotal(r: Pick<RepairJob, "partsCost" | "labourCost">) {
  return fmt(d(r.partsCost).plus(d(r.labourCost)));
}

export function mapRepairJobDto(r: RepairJob) {
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
  /** legacy alias for parts cost (older clients) */
  repairCost?: number;
  /** legacy alias for sale price (older clients) */
  customerCharge?: number;
  partsCost?: number;
  labourCost?: number;
  salePrice?: number;
  deliveredAt?: string;
  note?: string;
};

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
    };
  }

  if (status === "RECEIVED" || status === "IN_PROGRESS") {
    return {
      status,
      deliveredAt: null,
      note: input.note ?? current.note,
    };
  }

  if (status === "REPAIRED_PENDING_PICKUP") {
    const partsCost =
      input.repairCost ??
      input.partsCost ??
      Number(current.partsCost);
    const labourCost =
      input.repairCost != null ? 0 : (input.labourCost ?? Number(current.labourCost));
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
    };
  }

  throw new Error("Invalid status transition");
}
