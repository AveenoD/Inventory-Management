export const REPAIR_JOB_STATUSES = [
  "RECEIVED",
  "IN_PROGRESS",
  "REPAIRED_PENDING_PICKUP",
  "DELIVERED",
  "UNREPAIRABLE_RETURNED",
] as const;

export type RepairJobStatus = (typeof REPAIR_JOB_STATUSES)[number];

export const REPAIR_STATUS_LABELS: Record<RepairJobStatus, string> = {
  RECEIVED: "Received",
  IN_PROGRESS: "In repair",
  REPAIRED_PENDING_PICKUP: "Pending pickup",
  DELIVERED: "Delivered",
  UNREPAIRABLE_RETURNED: "Unrepairable (returned)",
};

/** Counts toward net profit / repair day rollup */
export function repairCountsInProfit(status: RepairJobStatus): boolean {
  return status === "DELIVERED";
}
