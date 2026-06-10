import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { Plus } from "lucide-react-native";
import {
  EXPENSE_CATEGORIES,
  buildExpenseLineItems,
  type ExpenseCategoryKey,
  type ExpenseLineItem,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RowActionMenu } from "@/components/ui/row-action-menu";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { DateField, TextField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type EditDraft = {
  date: string;
  amount: string;
  description: string;
};

function lineToEditDraft(row: ExpenseLineItem): EditDraft {
  const label = row.type;
  const desc =
    row.description && row.description !== label ? row.description : "";
  return {
    date: row.date,
    amount: String(row.amount),
    description: desc,
  };
}

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
  const [editingRow, setEditingRow] = useState<ExpenseLineItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseLineItem | null>(null);

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
    data: damages,
    isLoading: damageLoading,
    refetch: refetchDamages,
    isFetching: damageFetching,
  } = useQuery({
    queryKey: ["damages", monthId, from, to],
    queryFn: () => api.getDamages(monthId!, 1, 31, from, to),
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
    () => Promise.all([refetchDash(), refetchShop(), refetchDamages(), refetchWithdrawals()]),
    [refetchDash, refetchShop, refetchDamages, refetchWithdrawals],
  );
  const { refreshing, onRefresh } = useQueryRefresh(
    refreshExpenses,
    dashFetching || shopFetching || damageFetching || wFetching,
  );

  const rows = useMemo(
    () =>
      buildExpenseLineItems(
        (shopExpenses?.data ?? []) as Array<Record<string, unknown>>,
        (damages?.data ?? []) as Array<Record<string, unknown>>,
        (withdrawals?.data ?? []) as Array<Record<string, unknown>>,
      ),
    [shopExpenses, damages, withdrawals],
  );

  const availableProfit = Number(dashboard?.netProfit ?? 0) || 0;

  function invalidateExpenseQueries() {
    qc.invalidateQueries({ queryKey: ["shop-expenses", monthId] });
    qc.invalidateQueries({ queryKey: ["damages", monthId] });
    qc.invalidateQueries({ queryKey: ["withdrawals", monthId] });
    qc.invalidateQueries({ queryKey: ["dashboard", monthId] });
  }

  const createExpense = useMutation({
    mutationFn: () =>
      api.createExpenseEntry(monthId!, {
        date: expenseDate,
        category: expenseCategory,
        amount: parseMoneyInput(expenseAmount),
        description: expenseDescription || undefined,
      }),
    onSuccess: () => {
      invalidateExpenseQueries();
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
      invalidateExpenseQueries();
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
  });

  const updateLine = useMutation({
    mutationFn: async ({ row, draft }: { row: ExpenseLineItem; draft: EditDraft }) => {
      const amount = parseMoneyInput(draft.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter a valid amount greater than zero.");
      }

      if (row.lineCategory === "WITHDRAWAL") {
        if (!row.withdrawalId) throw new Error("Cannot edit this withdrawal.");
        if (amount > availableProfit + row.amount) {
          throw new Error(
            `Insufficient profit. Available: ${formatMoney(availableProfit + row.amount)}.`,
          );
        }
        return api.updateWithdrawal(monthId!, row.withdrawalId, {
          date: draft.date,
          amount,
          description: draft.description.trim() || undefined,
        });
      }

      const cat = row.categoryKey as ExpenseCategoryKey;
      if (draft.date !== row.date) {
        await api.deleteExpenseEntry(monthId!, { date: row.date, category: cat });
      }
      return api.updateExpenseEntry(monthId!, {
        date: draft.date,
        category: cat,
        amount,
        description: draft.description.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setEditingRow(null);
      setEditDraft(null);
      updateLine.reset();
    },
  });

  const deleteLine = useMutation({
    mutationFn: async (row: ExpenseLineItem) => {
      if (row.lineCategory === "WITHDRAWAL") {
        if (!row.withdrawalId) throw new Error("Cannot delete this withdrawal.");
        return api.deleteWithdrawal(monthId!, row.withdrawalId);
      }
      return api.deleteExpenseEntry(monthId!, {
        date: row.date,
        category: row.categoryKey as ExpenseCategoryKey,
      });
    },
    onSuccess: () => {
      invalidateExpenseQueries();
      setDeleteTarget(null);
    },
  });

  function startEdit(row: ExpenseLineItem) {
    setEditingRow(row);
    setEditDraft(lineToEditDraft(row));
  }

  const isLoading = dashLoading || shopLoading || damageLoading || wLoading;

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
                  <View style={styles.rowTopMain}>
                    <Text style={styles.rowLabel}>{r.type}</Text>
                    <Text style={styles.rowAmount}>{formatMoney(String(r.amount))}</Text>
                  </View>
                  <RowActionMenu
                    disabled={
                      deleteLine.isPending ||
                      updateLine.isPending ||
                      (r.lineCategory === "WITHDRAWAL" && !r.withdrawalId)
                    }
                    items={[
                      {
                        key: "edit",
                        label: "Edit",
                        onPress: () => startEdit(r),
                      },
                      {
                        key: "delete",
                        label: "Delete",
                        danger: true,
                        onPress: () => setDeleteTarget(r),
                      },
                    ]}
                  />
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

        <FormModal
          visible={!!editingRow && !!editDraft}
          title="Edit transaction"
          onClose={() => {
            setEditingRow(null);
            setEditDraft(null);
            updateLine.reset();
          }}
        >
          {editDraft && editingRow ? (
            <>
              <DateField
                value={editDraft.date}
                onChange={(v) => setEditDraft((prev) => (prev ? { ...prev, date: v } : prev))}
                label="Date"
              />
              {editingRow.lineCategory !== "WITHDRAWAL" ? (
                <>
                  <FieldLabel>Category</FieldLabel>
                  <Text style={styles.readonlyCat}>{editingRow.type}</Text>
                </>
              ) : null}
              <FieldLabel>Amount</FieldLabel>
              <TextField
                value={editDraft.amount}
                onChangeText={(v) => setEditDraft((prev) => (prev ? { ...prev, amount: v } : prev))}
                keyboardType="numeric"
              />
              <FieldLabel optional>Description</FieldLabel>
              <TextField
                value={editDraft.description}
                onChangeText={(v) =>
                  setEditDraft((prev) => (prev ? { ...prev, description: v } : prev))
                }
              />
            </>
          ) : null}
          {updateLine.error ? (
            <Text style={styles.error}>{(updateLine.error as Error).message}</Text>
          ) : null}
          <ModalActions
            onCancel={() => {
              setEditingRow(null);
              setEditDraft(null);
              updateLine.reset();
            }}
            onConfirm={() => editingRow && editDraft && updateLine.mutate({ row: editingRow, draft: editDraft })}
            loading={updateLine.isPending}
            disabled={!editDraft?.amount}
            confirmLabel="Save changes"
          />
        </FormModal>

        <ConfirmDialog
          visible={!!deleteTarget}
          title="Delete transaction?"
          message={
            deleteTarget
              ? `Remove this ${deleteTarget.lineCategory === "WITHDRAWAL" ? "withdrawal" : "expense"} permanently?`
              : ""
          }
          onCancel={() => {
            setDeleteTarget(null);
            deleteLine.reset();
          }}
          onConfirm={() => deleteTarget && deleteLine.mutate(deleteTarget)}
          loading={deleteLine.isPending}
        />
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
  rowTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowTopMain: { flex: 1, flexDirection: "row", justifyContent: "space-between" },
  rowLabel: { fontWeight: "700", color: colors.text, flex: 1 },
  rowAmount: { fontWeight: "700", color: colors.red },
  rowDesc: { marginTop: 4, color: colors.muted, fontSize: 14 },
  rowDate: { marginTop: 4, fontSize: 12, color: colors.muted },
  readonlyCat: { marginBottom: spacing.md, color: colors.muted, fontSize: 15 },
  error: { color: colors.red },
});
