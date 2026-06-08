import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { Plus } from "lucide-react-native";
import {
  EXPENSE_CATEGORIES,
  getExpenseCategoryLabel,
  type ExpenseCategoryKey,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { DateField, TextField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type ExpenseRow = {
  id: string;
  date: string;
  label: string;
  description: string;
  amount: number;
  kind: "EXPENSE" | "WITHDRAWAL";
};

export default function ExpensesScreen() {
  const { year, month, monthId } = useMonthContext();
  const qc = useQueryClient();
  const today = todayIso();
  const monthStart = useMemo(
    () => `${year}-${String(month).padStart(2, "0")}-01`,
    [year, month],
  );
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategoryKey>("SHOP");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: dashboard, isLoading: dashLoading, refetch: refetchDash, isFetching: dashFetching } = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => api.getDashboard(monthId!),
    enabled: !!monthId,
  });

  const {
    data: shopExpenses,
    isLoading: shopLoading,
    refetch: refetchShop,
    isFetching: shopFetching,
  } = useQuery({
    queryKey: ["shop-expenses", monthId, from, to],
    queryFn: () => api.getShopExpenses(monthId!, 1, 31, from, to),
    enabled: !!monthId,
  });

  const {
    data: withdrawals,
    isLoading: wLoading,
    refetch: refetchWithdrawals,
    isFetching: wFetching,
  } = useQuery({
    queryKey: ["withdrawals", monthId, from, to],
    queryFn: () => api.getWithdrawals(monthId!, 1, 31, from, to),
    enabled: !!monthId,
  });

  const refreshExpenses = useCallback(
    () => Promise.all([refetchDash(), refetchShop(), refetchWithdrawals()]),
    [refetchDash, refetchShop, refetchWithdrawals],
  );
  const { refreshing, onRefresh } = useQueryRefresh(
    refreshExpenses,
    dashFetching || shopFetching || wFetching,
  );

  const rows = useMemo(() => {
    const list: ExpenseRow[] = [];
    for (const d of (shopExpenses?.data ?? []) as Array<Record<string, unknown>>) {
      const date = String(d.date ?? "");
      const pairs: Array<[string, string, string]> = [
        ["salaryAmount", "salaryDescription", "SALARY"],
        ["teaAmount", "teaDescription", "TEA"],
        ["shopExpAmount", "shopExpDescription", "SHOP"],
      ];
      for (const [amtKey, descKey, cat] of pairs) {
        const amount = Number(d[amtKey] ?? 0);
        if (amount > 0) {
          list.push({
            id: `${date}-${cat}`,
            date,
            label: getExpenseCategoryLabel(cat),
            description: String(d[descKey] ?? cat),
            amount,
            kind: "EXPENSE",
          });
        }
      }
    }
    for (const w of (withdrawals?.data ?? []) as Array<Record<string, unknown>>) {
      const amount = Number(w.total ?? w.cash ?? 0);
      if (amount > 0) {
        list.push({
          id: `w-${String(w.date)}-${amount}`,
          date: String(w.date),
          label: "Withdrawal",
          description: String(w.description ?? "Profit withdrawal"),
          amount,
          kind: "WITHDRAWAL",
        });
      }
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [shopExpenses, withdrawals]);

  const createExpense = useMutation({
    mutationFn: () =>
      api.createExpenseEntry(monthId!, {
        date: expenseDate,
        category: expenseCategory,
        amount: parseMoneyInput(expenseAmount),
        description: expenseDescription || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shop-expenses", monthId] });
      qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
      setExpenseOpen(false);
      setExpenseAmount("");
      setExpenseDescription("");
    },
  });

  const createWithdraw = useMutation({
    mutationFn: () =>
      api.createWithdrawal(monthId!, {
        date: expenseDate,
        amount: parseMoneyInput(withdrawAmount),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["withdrawals", monthId] });
      qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
  });

  const isLoading = dashLoading || shopLoading || wLoading;

  return (
    <MonthGate>
      <ScreenShell
        title="Expenses"
        subtitle="Shop costs & withdrawals"
        showBack
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.actions}>
          <Pressable style={styles.addBtn} onPress={() => setExpenseOpen(true)}>
            <Plus size={16} color="#fff" />
            <Text style={styles.addBtnText}>Add expense</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => setWithdrawOpen(true)}>
            <Text style={styles.secondaryBtnText}>Withdraw profit</Text>
          </Pressable>
        </View>

        {dashboard ? (
          <View style={styles.statsRow}>
            <GradientStatCard
              tone="orange"
              icon={<Text style={styles.icon}>−</Text>}
              label="Total expense"
              value={formatMoney(dashboard.totalExpense)}
            />
            <GradientStatCard
              tone="purple"
              icon={<Text style={styles.icon}>₹</Text>}
              label="Withdrawals"
              value={formatMoney(dashboard.totalWithdrawal)}
            />
          </View>
        ) : null}

        <View style={styles.filterCard}>
          <DateField value={from} onChange={setFrom} label="From" />
          <DateField value={to} onChange={setTo} label="To" />
        </View>

        {isLoading ? <PageLoader message="Loading expenses…" /> : null}
        {!isLoading && rows.length === 0 ? (
          <EmptyState title="No expenses in range" description="Add a shop expense or withdrawal." />
        ) : null}

        {!isLoading && rows.length > 0 ? (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: r }) => (
              <View style={styles.rowCard}>
                <View style={styles.rowTop}>
                  <Text style={styles.rowLabel}>{r.label}</Text>
                  <Text style={styles.rowAmount}>{formatMoney(String(r.amount))}</Text>
                </View>
                <Text style={styles.rowDesc}>{r.description}</Text>
                <Text style={styles.rowDate}>{r.date}</Text>
              </View>
            )}
          />
        ) : null}

        <FormModal visible={expenseOpen} title="Add expense" onClose={() => setExpenseOpen(false)}>
          <DateField value={expenseDate} onChange={setExpenseDate} label="Date" />
          <FieldLabel>Category</FieldLabel>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={expenseCategory}
              onValueChange={(v) => setExpenseCategory(v as ExpenseCategoryKey)}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <Picker.Item key={c.key} label={c.label} value={c.key} />
              ))}
            </Picker>
          </View>
          <FieldLabel>Amount</FieldLabel>
          <TextField value={expenseAmount} onChangeText={setExpenseAmount} keyboardType="numeric" />
          <FieldLabel optional>Description</FieldLabel>
          <TextField value={expenseDescription} onChangeText={setExpenseDescription} />
          {createExpense.error ? (
            <Text style={styles.error}>{(createExpense.error as Error).message}</Text>
          ) : null}
          <ModalActions
            onCancel={() => setExpenseOpen(false)}
            onConfirm={() => createExpense.mutate()}
            loading={createExpense.isPending}
            disabled={!expenseAmount}
          />
        </FormModal>

        <FormModal visible={withdrawOpen} title="Withdraw profit" onClose={() => setWithdrawOpen(false)}>
          <DateField value={expenseDate} onChange={setExpenseDate} label="Date" />
          <FieldLabel>Amount</FieldLabel>
          <TextField value={withdrawAmount} onChangeText={setWithdrawAmount} keyboardType="numeric" />
          {createWithdraw.error ? (
            <Text style={styles.error}>{(createWithdraw.error as Error).message}</Text>
          ) : null}
          <ModalActions
            onCancel={() => setWithdrawOpen(false)}
            onConfirm={() => createWithdraw.mutate()}
            loading={createWithdraw.isPending}
            disabled={!withdrawAmount}
          />
        </FormModal>
      </ScreenShell>
    </MonthGate>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  addBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 12,
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.card,
  },
  secondaryBtnText: { fontWeight: "600", color: colors.text },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  icon: { fontSize: 18, fontWeight: "700", color: colors.amber },
  filterCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  rowCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { fontWeight: "700", color: colors.text },
  rowAmount: { fontWeight: "700", color: colors.red },
  rowDesc: { marginTop: 4, color: colors.muted, fontSize: 14 },
  rowDate: { marginTop: 4, fontSize: 12, color: colors.muted },
  error: { color: colors.red },
});
