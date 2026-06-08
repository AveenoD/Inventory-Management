import { View, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function PageHeader({
  title,
  subtitle,
  action,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  textCol: { flex: 1 },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  action: {
    flexShrink: 0,
  },
});
