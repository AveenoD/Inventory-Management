import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  desc: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.muted,
    textAlign: "center",
    lineHeight: 20,
  },
  action: { marginTop: spacing.lg, alignSelf: "stretch" },
});
