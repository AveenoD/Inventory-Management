import { useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField, FieldLabel, PrimaryButton } from "@/components/ui/form-fields";
import { formatMoney, monthLabel, parseMoneyInput } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type MonthRow = {
  id: string;
  year: number;
  month: number;
  openingBalance: string;
};

export default function MonthsScreen() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [opening, setOpening] = useState("0");

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["months", "list"],
    queryFn: () => api.getMonths(1, 24),
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const months = (data?.data ?? []) as MonthRow[];

  const createMutation = useMutation({
    mutationFn: () =>
      api.createMonth({
        year: parseInt(year, 10),
        month: parseInt(month, 10),
        openingBalance: parseMoneyInput(opening),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["months"] });
      qc.invalidateQueries({ queryKey: ["months", "context"] });
      setShowCreate(false);
    },
  });

  return (
    <ScreenShell
      title="Business Months"
      subtitle="Monthly books"
      showBack
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <Pressable style={styles.toggleBtn} onPress={() => setShowCreate((v) => !v)}>
        <Text style={styles.toggleText}>{showCreate ? "Cancel" : "+ New month"}</Text>
      </Pressable>

      {showCreate ? (
        <View style={styles.createCard}>
          <FieldLabel>Year</FieldLabel>
          <TextField value={year} onChangeText={setYear} keyboardType="numeric" />
          <FieldLabel>Month (1–12)</FieldLabel>
          <TextField value={month} onChangeText={setMonth} keyboardType="numeric" />
          <FieldLabel>Opening balance</FieldLabel>
          <TextField value={opening} onChangeText={setOpening} keyboardType="numeric" />
          {createMutation.error ? (
            <Text style={styles.error}>{(createMutation.error as Error).message}</Text>
          ) : null}
          <PrimaryButton
            label={createMutation.isPending ? "Creating…" : "Create month"}
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          />
        </View>
      ) : null}

      {isLoading ? <PageLoader message="Loading months…" /> : null}
      {error ? (
        <View>
          <Text style={styles.error}>{(error as Error).message}</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && months.length === 0 ? (
        <EmptyState
          title="No business months"
          description="Create a month to track recharge, sales, and expenses."
          action={
            <Pressable style={styles.toggleBtn} onPress={() => setShowCreate(true)}>
              <Text style={styles.toggleText}>New month</Text>
            </Pressable>
          }
        />
      ) : null}

      {!isLoading && months.length > 0 ? (
        <FlatList
          data={months}
          keyExtractor={(m) => m.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: m }) => (
            <View style={styles.monthCard}>
              <Text style={styles.monthTitle}>{monthLabel(m.year, m.month)}</Text>
              <Text style={styles.monthSub}>Opening {formatMoney(m.openingBalance)}</Text>
            </View>
          )}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toggleBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  toggleText: { color: "#fff", fontWeight: "700" },
  createCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  monthCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  monthTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  monthSub: { marginTop: 4, color: colors.muted },
  error: { color: colors.red },
  link: { color: colors.accent, fontWeight: "600" },
});
