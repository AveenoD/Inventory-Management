import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "positive" | "negative" | "warning";
}) {
  const toneStyle =
    tone === "positive"
      ? styles.positive
      : tone === "negative"
        ? styles.negative
        : tone === "warning"
          ? styles.warning
          : null;

  return (
    <View style={[styles.card, toneStyle]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    marginTop: spacing.sm,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  positive: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  negative: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  warning: {
    borderColor: "#fde68a",
    backgroundColor: colors.amberBg,
  },
});
