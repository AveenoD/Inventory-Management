import { View, StyleSheet, type ViewStyle } from "react-native";
import { spacing } from "@/theme/tokens";

export function MetricsGrid({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.grid, style]}>{children}</View>;
}

export function MetricCell({
  children,
  style,
  fullWidth,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.cell, fullWidth && styles.cellFull, style]}>
      <View style={styles.cellFill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "stretch",
    rowGap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cell: {
    width: "48%",
  },
  cellFull: {
    width: "100%",
  },
  cellFill: {
    flex: 1,
    alignSelf: "stretch",
  },
});
