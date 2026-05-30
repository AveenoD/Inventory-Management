export const PRODUCT_KINDS = [
  "MOBILE",
  "MOBILE_ACCESSORY",
  "REPAIR_PART",
  "SPEAKERS_SOUND",
  "CHARGER_CABLE",
] as const;

export type ProductKind = (typeof PRODUCT_KINDS)[number];

export const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  MOBILE: "Mobile",
  MOBILE_ACCESSORY: "Mobile Accessories",
  REPAIR_PART: "Repairing Accessory",
  SPEAKERS_SOUND: "Speakers / Sound",
  CHARGER_CABLE: "Charger & Cable",
};

export const DEFAULT_COVER_TYPES = [
  "Silicon",
  "Flip Cover",
  "Fancy",
  "Cartoon Printed",
  "Glitter",
  "Transparent",
  "Hard Back",
] as const;

export const REPAIR_PART_TYPES = [
  "Display",
  "Touchpad / Touch",
  "Charging Connector",
  "Speaker",
  "Charging Strip",
  "Battery",
  "Back Panel",
  "Camera",
  "Other",
] as const;

export type RepairPartType = (typeof REPAIR_PART_TYPES)[number];

export function categoryNameForKind(kind: ProductKind): string {
  return PRODUCT_KIND_LABELS[kind];
}

export function buildProductName(input: {
  kind: ProductKind;
  name?: string;
  phoneModel?: string;
  coverTypeName?: string;
  partType?: string;
}): string {
  const model = input.phoneModel?.trim();
  switch (input.kind) {
    case "MOBILE_ACCESSORY":
      if (model && input.coverTypeName) return `${model} – ${input.coverTypeName}`;
      return input.name?.trim() || model || "Accessory";
    case "REPAIR_PART":
      if (model && input.partType) return `${model} – ${input.partType}`;
      return input.name?.trim() || model || "Repair part";
    default:
      return input.name?.trim() || "Product";
  }
}
