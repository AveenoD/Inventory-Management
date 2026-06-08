import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

type BadgeTone = "default" | "ok" | "warning" | "danger" | "upi" | "card";

export function Badge({
  label,
  tone = "default",
  style,
}: {
  label: string;
  tone?: BadgeTone;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.base, styles[tone], style]}>
      <Text style={[styles.text, styles[`${tone}Text` as keyof typeof styles]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  text: { fontSize: 12, fontWeight: "600" },
  default: { backgroundColor: colors.pageBg, borderColor: colors.border },
  defaultText: { color: colors.muted },
  ok: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  okText: { color: colors.green },
  warning: { backgroundColor: colors.amberBg, borderColor: "#fde68a" },
  warningText: { color: colors.amber },
  danger: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  dangerText: { color: colors.red },
  upi: { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" },
  upiText: { color: colors.accent },
  card: { backgroundColor: "#faf5ff", borderColor: "#e9d5ff" },
  cardText: { color: colors.purple },
});
