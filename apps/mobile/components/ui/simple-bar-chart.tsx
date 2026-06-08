import { View, Text, StyleSheet } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function SimpleBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.bars}>
        {data.map((d) => (
          <View key={d.label} style={styles.col}>
            <View style={styles.barTrack}>
              <View style={[styles.bar, { height: `${Math.max(4, (d.value / max) * 100)}%` }]} />
            </View>
            <Text style={styles.label}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: spacing.sm },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 160,
    gap: 6,
  },
  col: { flex: 1, alignItems: "center" },
  barTrack: {
    width: "100%",
    height: 130,
    justifyContent: "flex-end",
    backgroundColor: colors.pageBg,
    borderRadius: 8,
    overflow: "hidden",
  },
  bar: {
    width: "100%",
    backgroundColor: colors.accent,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  label: { marginTop: 6, fontSize: 10, color: colors.muted, fontWeight: "600" },
});
