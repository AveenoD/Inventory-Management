import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, spacing } from "@/theme/tokens";

export function PageLoader({ message = "Loading…" }: { message?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  message: {
    fontSize: 14,
    color: colors.muted,
  },
});
