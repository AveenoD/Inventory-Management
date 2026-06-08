import { Pressable, Text, View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMonthContext } from "@/contexts/month-context";
import { PageLoader } from "@/components/ui/page-loader";
import { colors, radii, spacing } from "@/theme/tokens";

export function MonthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { monthId, isLoading, error, refetch } = useMonthContext();

  if (isLoading) {
    return <PageLoader message="Preparing business month…" />;
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>Could not load month</Text>
        <Text style={styles.errorMsg}>{error.message}</Text>
        <Pressable style={styles.btn} onPress={refetch}>
          <Text style={styles.btnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!monthId) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>No business month</Text>
        <Text style={styles.errorMsg}>
          Create a month for this period, or open Business Months to verify your books are set up.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.push("/months")}>
          <Text style={styles.btnText}>Open Business Months</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  error: {
    margin: spacing.lg,
    backgroundColor: "#fef2f2",
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: spacing.sm,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  errorMsg: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  btn: {
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.input,
  },
  btnText: { color: "#fff", fontWeight: "600" },
});
