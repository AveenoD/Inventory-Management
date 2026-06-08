import { View, Text, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii, spacing } from "@/theme/tokens";

type Tone = "blue" | "green" | "amber" | "purple" | "teal" | "orange";

const GRADIENTS: Record<Tone, [string, string]> = {
  blue: ["#eff6ff", "#ffffff"],
  green: ["#f0fdf4", "#ffffff"],
  amber: ["#fffbeb", "#ffffff"],
  purple: ["#faf5ff", "#ffffff"],
  teal: ["#f0fdfa", "#ffffff"],
  orange: ["#fff7ed", "#ffffff"],
};

const ICON_BG: Record<Tone, string> = {
  blue: "#dbeafe",
  green: "#dcfce7",
  amber: "#fef3c7",
  purple: "#ede9fe",
  teal: "#ccfbf1",
  orange: "#ffedd5",
};

export function GradientStatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: Tone;
}) {
  return (
    <LinearGradient colors={GRADIENTS[tone]} style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: ICON_BG[tone] }]}>{icon}</View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <View style={styles.subSlot}>
        {sub ? <Text style={styles.sub}>{sub}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  value: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  subSlot: {
    flexGrow: 1,
    minHeight: 34,
    marginTop: 4,
    justifyContent: "flex-start",
  },
  sub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
  },
});
