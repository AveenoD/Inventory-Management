import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import {
  RECHARGE_OPERATORS,
  RECHARGE_AMOUNT_FIELDS,
  formatRechargeTypeLabel,
  getRechargeBreakdownParts,
  rechargeEntryHasType,
  type RechargeOperator,
} from "@sk-mobile/shared";
import { Search, Smartphone, Zap } from "lucide-react-native";
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
import { MetricsGrid, MetricCell } from "@/components/ui/metrics-grid";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Badge } from "@/components/ui/badge";
import { SearchField, TextField, DateField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, sumMoney, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type RechargeRow = {
  id: string;
  date: string;
  operator: string;
  entryType: string;
  amount: string;
  rechargeAmount?: string | null;
  note?: string | null;
  saleProfit?: string | null;
  chillar?: string | null;
  act?: string | null;
  mnp?: string | null;
};

const EMPTY_AMOUNTS = { saleProfit: "", chillar: "", act: "", mnp: "" };

function formatProfitBreakdown(row: RechargeRow): string {
  const parts = getRechargeBreakdownParts(row);
  if (!parts.length) return "—";
  return parts.map((p) => formatMoney(p.amount)).join(" + ");
}

export default function RechargeScreen() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const today = todayIso();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [operator, setOperator] = useState<RechargeOperator>("AIRTEL");
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [amounts, setAmounts] = useState(EMPTY_AMOUNTS);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["recharge-entries", monthId, page, dateFilter],
    queryFn: () => api.getRechargeEntries(monthId!, page, dateFilter || undefined, 50),
    enabled: !!monthId,
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const entries = (data?.data ?? []) as RechargeRow[];

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (operatorFilter !== "ALL" && e.operator !== operatorFilter) return false;
      if (typeFilter !== "ALL" && !rechargeEntryHasType(e, typeFilter)) return false;
      if (!searchDebounced) return true;
      const hay = `${e.operator} ${formatRechargeTypeLabel(e)} ${e.amount} ${e.date}`.toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [entries, operatorFilter, typeFilter, searchDebounced]);

  const pageTotal = sumMoney(filteredEntries.map((r) => r.amount));
  const todayTotal = sumMoney(filteredEntries.filter((r) => r.date === today).map((r) => r.amount));

  const create = useMutation({
    mutationFn: () =>
      api.createRechargeEntry(monthId!, {
        date,
        operator,
        rechargeAmount: parseMoneyInput(rechargeAmount),
        saleProfit: parseMoneyInput(amounts.saleProfit),
        chillar: parseMoneyInput(amounts.chillar),
        act: parseMoneyInput(amounts.act),
        mnp: parseMoneyInput(amounts.mnp),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setOpen(false);
      setRechargeAmount("");
      setAmounts(EMPTY_AMOUNTS);
    },
  });

  const update = useMutation({
    mutationFn: () =>
      api.updateRechargeEntry(monthId!, editingId!, {
        date,
        operator,
        rechargeAmount: parseMoneyInput(rechargeAmount),
        saleProfit: parseMoneyInput(amounts.saleProfit),
        chillar: parseMoneyInput(amounts.chillar),
        act: parseMoneyInput(amounts.act),
        mnp: parseMoneyInput(amounts.mnp),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditingId(null);
      setOpen(false);
    },
  });

  const del = useMutation({
    mutationFn: (entryId: string) => api.deleteRechargeEntry(monthId!, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recharge-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTargetId(null);
    },
  });

  function startEdit(row: RechargeRow) {
    setEditingId(row.id);
    setDate(row.date);
    setOperator(row.operator as RechargeOperator);
    setRechargeAmount(row.rechargeAmount ?? "");
    setAmounts({
      saleProfit: row.saleProfit ?? "",
      chillar: row.chillar ?? "",
      act: row.act ?? "",
      mnp: row.mnp ?? "",
    });
    setOpen(true);
  }

  const content = (
    <>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} />
          <SearchField value={search} onChangeText={setSearch} placeholder="Search operator, type…" />
        </View>
        <PrimaryButton
          label="+ Create Recharge"
          onPress={() => {
            setEditingId(null);
            setDate(today);
            setRechargeAmount("");
            setAmounts(EMPTY_AMOUNTS);
            setOpen(true);
          }}
        />
      </View>

      {!isLoading && !error ? (
        <MetricsGrid>
          <MetricCell>
            <GradientStatCard
              tone="blue"
              icon={<Smartphone size={18} color={colors.accent} />}
              label="Today's Recharge"
              value={formatMoney(String(todayTotal))}
              sub={`${filteredEntries.filter((r) => r.date === today).length} txns`}
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="green"
              icon={<Zap size={18} color={colors.green} />}
              label="Filtered Total"
              value={formatMoney(String(pageTotal))}
              sub={`${filteredEntries.length} entries`}
            />
          </MetricCell>
        </MetricsGrid>
      ) : null}

      <View style={styles.filterCard}>
        <DateField value={dateFilter} onChange={setDateFilter} label="Date filter" />
        {dateFilter ? (
          <Pressable onPress={() => setDateFilter("")}>
            <Text style={styles.link}>Clear date</Text>
          </Pressable>
        ) : null}
        <View style={styles.pickerWrap}>
          <Picker selectedValue={operatorFilter} onValueChange={setOperatorFilter}>
            <Picker.Item label="All Operators" value="ALL" />
            {RECHARGE_OPERATORS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={typeFilter} onValueChange={setTypeFilter}>
            <Picker.Item label="All Types" value="ALL" />
            {RECHARGE_AMOUNT_FIELDS.map((t) => (
              <Picker.Item key={t.entryType} label={t.label} value={t.entryType} />
            ))}
          </Picker>
        </View>
      </View>

      {isLoading ? <PageLoader message="Loading entries…" /> : null}
      {error ? (
        <View>
          <Text style={styles.error}>{(error as Error).message}</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && filteredEntries.length === 0 ? (
        <EmptyState title="No recharge entries" description="Create a recharge entry or clear filters." />
      ) : null}

      {!isLoading && !error && filteredEntries.length > 0 ? (
        <FlatList
          data={filteredEntries}
          keyExtractor={(r) => r.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: r }) => (
            <View style={styles.rowCard}>
              <View style={styles.rowTop}>
                <View style={styles.rowTopMain}>
                  <Text style={styles.operator}>{r.operator}</Text>
                  <Text style={styles.amount}>{formatMoney(r.amount)}</Text>
                </View>
                <RowActionMenu
                  disabled={del.isPending || update.isPending}
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
                      onPress: () => setDeleteTargetId(r.id),
                    },
                  ]}
                />
              </View>
              <Badge label={formatRechargeTypeLabel(r)} tone="default" />
              <Text style={styles.meta}>
                {r.date} · Profit: {formatProfitBreakdown(r)}
              </Text>
            </View>
          )}
        />
      ) : null}

      <FormModal
        visible={open}
        title={editingId ? "Edit recharge" : "Create recharge"}
        onClose={() => {
          setOpen(false);
          setEditingId(null);
        }}
      >
        <DateField value={date} onChange={setDate} label="Date" />
        <FieldLabel>Operator</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={operator}
            onValueChange={(v) => setOperator(v as RechargeOperator)}
          >
            {RECHARGE_OPERATORS.map((o) => (
              <Picker.Item key={o} label={o} value={o} />
            ))}
          </Picker>
        </View>
        <FieldLabel optional>Recharge amount</FieldLabel>
        <TextField
          value={rechargeAmount}
          onChangeText={setRechargeAmount}
          keyboardType="numeric"
          placeholder="Optional"
        />
        {RECHARGE_AMOUNT_FIELDS.map((f) => (
          <View key={f.key}>
            <FieldLabel optional>{f.label}</FieldLabel>
            <TextField
              value={amounts[f.key as keyof typeof amounts]}
              onChangeText={(v) => setAmounts((a) => ({ ...a, [f.key]: v }))}
              keyboardType="numeric"
            />
          </View>
        ))}
        {(create.error || update.error) && (
          <Text style={styles.error}>
            {((create.error || update.error) as Error).message}
          </Text>
        )}
        <ModalActions
          onCancel={() => {
            setOpen(false);
            setEditingId(null);
          }}
          onConfirm={() => (editingId ? update.mutate() : create.mutate())}
          confirmLabel={editingId ? "Update" : "Save"}
          loading={create.isPending || update.isPending}
        />
      </FormModal>

      <ConfirmDialog
        visible={!!deleteTargetId}
        title="Delete recharge?"
        message="Remove this recharge entry permanently?"
        loading={del.isPending}
        onCancel={() => setDeleteTargetId(null)}
        onConfirm={() => deleteTargetId && del.mutate(deleteTargetId)}
      />
    </>
  );

  return (
    <MonthGate>
      <ScreenShell
        title="Recharge"
        subtitle="Mobile recharge entries"
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {content}
      </ScreenShell>
    </MonthGate>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingLeft: spacing.md,
    backgroundColor: colors.card,
  },
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
  },
  link: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.red },
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
  rowTopMain: { flex: 1, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  operator: { fontWeight: "700", fontSize: 16, color: colors.text, flex: 1 },
  amount: { fontWeight: "700", fontSize: 16, color: colors.text },
  meta: { marginTop: spacing.sm, fontSize: 13, color: colors.muted },
});
