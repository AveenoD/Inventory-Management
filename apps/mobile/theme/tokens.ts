/** Design tokens mirrored from apps/web/src/app/globals.css */
export const colors = {
  pageBg: "#f1f5f9",
  card: "#ffffff",
  border: "#e2e8f0",
  text: "#0f172a",
  muted: "#64748b",
  accent: "#2563eb",
  accentLight: "#eff6ff",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#d97706",
  amberBg: "#fffbeb",
  purple: "#7c3aed",
  shadow: "rgba(15, 23, 42, 0.08)",
} as const;

export const radii = {
  input: 10,
  card: 14,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;
