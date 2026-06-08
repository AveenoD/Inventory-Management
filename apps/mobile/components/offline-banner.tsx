import { View, Text, StyleSheet } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { colors, spacing } from "@/theme/tokens";

export function OfflineBanner() {
  const { online } = useNetworkStatus();
  if (online) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <WifiOff size={16} color="#fff" />
      <Text style={styles.text}>You&apos;re offline — changes sync when back online</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.amber,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
