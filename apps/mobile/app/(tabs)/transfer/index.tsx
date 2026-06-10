import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import {
  TRANSFER_CATEGORIES,
  TRANSFER_SERVICES,
  getTransferLabel,
  getCategoryForKey,
  getSubServicesForCategory,
  type TransferCategoryId,
  type TransferServiceKey,
} from "@sk-mobile/shared";
import { Pencil, Search, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { MetricsGrid, MetricCell } from "@/components/ui/metrics-grid";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SearchField, TextField, DateField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, sumMoney, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type TransferRow = {
  id: string;
  date: string;
  serviceKey: string;
  amount: string;
  note?: string | null;
};

const DEFAULT_CATEGORY: TransferCategoryId = "dmt99";

type EditDraft = {
  date: string;
  categoryId: TransferCategoryId;
  serviceKey: TransferServiceKey;
  amount: string;
  note: string;
};

function rowToEditDraft(row: TransferRow): EditDraft {
  const categoryId = getCategoryForKey(row.serviceKey) ?? DEFAULT_CATEGORY;
  return {
    date: row.date,
    categoryId,
    serviceKey: row.serviceKey as TransferServiceKey,
    amount: row.amount,
    note: row.note ?? "",
  };
}

function emptyAmountsFor(categoryId: TransferCategoryId): Record<string, string> {
  return Object.fromEntries(
    getSubServicesForCategory(categoryId).map((sub) => [sub.key, ""]),
  );
}

export default function TransferScreen() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const today = todayIso();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState<TransferCategoryId>(DEFAULT_CATEGORY);
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    emptyAmountsFor(DEFAULT_CATEGORY),
  );
  const [dateFilter, setDateFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [subFilter, setSubFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const amountFields = getSubServicesForCategory(categoryId);
  const filterSubServices =
    categoryFilter === "ALL"
      ? TRANSFER_SERVICES
      : getSubServicesForCategory(categoryFilter as TransferCategoryId).map((sub) => {
          const cat = TRANSFER_CATEGORIES.find((c) => c.id === categoryFilter)!;
          return { key: sub.key, label: `${cat.label} — ${sub.label}` };
        });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["transfer-entries", monthId, dateFilter],
    queryFn: () => api.getTransferEntries(monthId!, 1, dateFilter || undefined),
    enabled: !!monthId,
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const entries = (data?.data ?? []) as TransferRow[];

  const create = useMutation({
    mutationFn: async () => {
      const subs = getSubServicesForCategory(categoryId);
      const payloads = subs
        .map((sub) => ({
          serviceKey: sub.key as TransferServiceKey,
          amount: parseMoneyInput(amounts[sub.key] ?? ""),
        }))
        .filter((p) => p.amount > 0);

      if (payloads.length === 0) {
        throw new Error("Enter at least one amount greater than 0");
      }

      for (const p of payloads) {
        await api.createTransferEntry(monthId!, { date, serviceKey: p.serviceKey, amount: p.amount });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setOpen(false);
      setAmounts(emptyAmountsFor(categoryId));
    },
  });

  const update = useMutation({
    mutationFn: ({ entryId, draft }: { entryId: string; draft: EditDraft }) =>
      api.updateTransferEntry(monthId!, entryId, {
        date: draft.date,
        serviceKey: draft.serviceKey,
        amount: parseMoneyInput(draft.amount),
        note: draft.note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditingId(null);
      setEditDraft(null);
      update.reset();
    },
  });

  const del = useMutation({
    mutationFn: (entryId: string) => api.deleteTransferEntry(monthId!, entryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfer-entries", monthId] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTargetId(null);
      del.reset();
    },
  });

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const entryCategory = getCategoryForKey(e.serviceKey);
      if (categoryFilter !== "ALL" && entryCategory !== categoryFilter) return false;
      if (subFilter !== "ALL" && e.serviceKey !== subFilter) return false;
      if (!searchDebounced) return true;
      const hay = `${e.serviceKey} ${getTransferLabel(e.serviceKey)} ${e.amount} ${e.date}`.toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [entries, categoryFilter, subFilter, searchDebounced]);

  const pageTotal = sumMoney(filteredEntries.map((r) => r.amount));
  const todayTotal = sumMoney(
    filteredEntries.filter((r) => r.date === today).map((r) => r.amount),
  );

  function handleCategoryChange(next: TransferCategoryId) {
    setCategoryId(next);
    setAmounts(emptyAmountsFor(next));
  }

  function openAddModal() {
    setCategoryId(DEFAULT_CATEGORY);
    setAmounts(emptyAmountsFor(DEFAULT_CATEGORY));
    setDate(today);
    setOpen(true);
  }

  function startEdit(row: TransferRow) {
    setEditingId(row.id);
    setEditDraft(rowToEditDraft(row));
  }

  function closeEdit() {
    setEditingId(null);
    setEditDraft(null);
    update.reset();
  }

  function handleEditCategoryChange(nextCategory: TransferCategoryId) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      const subs = getSubServicesForCategory(nextCategory);
      return {
        ...prev,
        categoryId: nextCategory,
        serviceKey: (subs[0]?.key ?? prev.serviceKey) as TransferServiceKey,
      };
    });
  }

  const editSubServices = useMemo(() => {
    if (!editDraft) return [];
    const subs = getSubServicesForCategory(editDraft.categoryId);
    if (subs.some((s) => s.key === editDraft.serviceKey)) return subs;
    return [
      ...subs,
      {
        key: editDraft.serviceKey,
        label: getTransferLabel(editDraft.serviceKey).replace(/^[^—]+ — /, ""),
      },
    ];
  }, [editDraft]);

  const content = (
    <>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} />
          <SearchField value={search} onChangeText={setSearch} placeholder="Search service, amount…" />
        </View>
        <PrimaryButton label="+ Add Transfer" onPress={openAddModal} />
      </View>

      {!isLoading && !error ? (
        <MetricsGrid>
          <MetricCell>
            <GradientStatCard
              tone="blue"
              icon={<Text style={styles.statIcon}>⇄</Text>}
              label="Today's Transfer"
              value={formatMoney(String(todayTotal))}
              sub={`${filteredEntries.filter((r) => r.date === today).length} txns`}
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="green"
              icon={<Text style={styles.statIcon}>↗</Text>}
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
          <Picker selectedValue={categoryFilter} onValueChange={(v) => {
            setCategoryFilter(v);
            setSubFilter("ALL");
          }}>
            <Picker.Item label="All Services" value="ALL" />
            {TRANSFER_CATEGORIES.map((c) => (
              <Picker.Item key={c.id} label={c.label} value={c.id} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerWrap}>
          <Picker selectedValue={subFilter} onValueChange={setSubFilter}>
            <Picker.Item label="All Sub-types" value="ALL" />
            {filterSubServices.map((s) => (
              <Picker.Item key={s.key} label={s.label} value={s.key} />
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
        <EmptyState
          title="No transfer entries"
          description="Add DMT, AEPS, or other money transfer records."
          action={<PrimaryButton label="Add transfer" onPress={openAddModal} />}
        />
      ) : null}

      {!isLoading && !error && filteredEntries.length > 0 ? (
        <FlatList
          data={filteredEntries}
          keyExtractor={(r) => r.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: r }) => {
            const catId = getCategoryForKey(r.serviceKey);
            const catLabel = TRANSFER_CATEGORIES.find((c) => c.id === catId)?.label ?? "—";
            const subLabel =
              TRANSFER_SERVICES.find((s) => s.key === r.serviceKey)?.subLabel ??
              getTransferLabel(r.serviceKey);
            return (
              <Pressable style={styles.rowCard} onPress={() => startEdit(r)}>
                <View style={styles.rowTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.serviceName}>{catLabel}</Text>
                    <Text style={styles.subLabel}>{subLabel}</Text>
                  </View>
                  <Text style={styles.amount}>{formatMoney(r.amount)}</Text>
                </View>
                <View style={styles.rowFoot}>
                  <Text style={styles.date}>{r.date}</Text>
                  <View style={styles.rowActions}>
                    <Pressable
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        startEdit(r);
                      }}
                    >
                      <Pencil size={16} color={colors.accent} />
                    </Pressable>
                    <Pressable
                      hitSlop={8}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setDeleteTargetId(r.id);
                      }}
                    >
                      <Trash2 size={16} color={colors.red} />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
        />
      ) : null}

      <FormModal visible={open} title="Add money transfer" onClose={() => setOpen(false)}>
        <DateField value={date} onChange={setDate} label="Date" />
        <FieldLabel>Service</FieldLabel>
        <View style={styles.pickerWrap}>
          <Picker
            selectedValue={categoryId}
            onValueChange={(v) => handleCategoryChange(v as TransferCategoryId)}
          >
            {TRANSFER_CATEGORIES.map((c) => (
              <Picker.Item key={c.id} label={c.label} value={c.id} />
            ))}
          </Picker>
        </View>
        <FieldLabel>Amount (₹) — leave blank for 0</FieldLabel>
        <View style={styles.amountGrid}>
          {amountFields.map((field) => (
            <View key={field.key} style={styles.amountField}>
              <FieldLabel optional>{field.label}</FieldLabel>
              <TextField
                value={amounts[field.key] ?? ""}
                onChangeText={(v) => setAmounts((prev) => ({ ...prev, [field.key]: v }))}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          ))}
        </View>
        {create.error ? <Text style={styles.error}>{(create.error as Error).message}</Text> : null}
        <ModalActions
          onCancel={() => setOpen(false)}
          onConfirm={() => create.mutate()}
          confirmLabel="Save"
          loading={create.isPending}
        />
      </FormModal>

      <FormModal visible={!!editingId && !!editDraft} title="Edit money transfer" onClose={closeEdit}>
        {editDraft ? (
          <>
            <DateField
              value={editDraft.date}
              onChange={(v) => setEditDraft((prev) => (prev ? { ...prev, date: v } : prev))}
              label="Date"
            />
            <FieldLabel>Service</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={editDraft.categoryId}
                onValueChange={(v) => handleEditCategoryChange(v as TransferCategoryId)}
              >
                {TRANSFER_CATEGORIES.map((c) => (
                  <Picker.Item key={c.id} label={c.label} value={c.id} />
                ))}
              </Picker>
            </View>
            <FieldLabel>Sub-type</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={editDraft.serviceKey}
                onValueChange={(v) =>
                  setEditDraft((prev) =>
                    prev ? { ...prev, serviceKey: v as TransferServiceKey } : prev,
                  )
                }
              >
                {editSubServices.map((s) => (
                  <Picker.Item key={s.key} label={s.label} value={s.key} />
                ))}
              </Picker>
            </View>
            <FieldLabel>Amount (₹)</FieldLabel>
            <TextField
              value={editDraft.amount}
              onChangeText={(v) => setEditDraft((prev) => (prev ? { ...prev, amount: v } : prev))}
              keyboardType="numeric"
            />
            <FieldLabel optional>Note</FieldLabel>
            <TextField
              value={editDraft.note}
              onChangeText={(v) => setEditDraft((prev) => (prev ? { ...prev, note: v } : prev))}
            />
            {update.error ? (
              <Text style={styles.error}>{(update.error as Error).message}</Text>
            ) : null}
            <ModalActions
              onCancel={closeEdit}
              onConfirm={() => editingId && editDraft && update.mutate({ entryId: editingId, draft: editDraft })}
              confirmLabel="Save changes"
              loading={update.isPending}
            />
          </>
        ) : null}
      </FormModal>

      <ConfirmDialog
        visible={!!deleteTargetId}
        title="Delete transfer?"
        message="Remove this money transfer entry permanently?"
        loading={del.isPending}
        onCancel={() => {
          setDeleteTargetId(null);
          del.reset();
        }}
        onConfirm={() => deleteTargetId && del.mutate(deleteTargetId)}
      />
    </>
  );

  return (
    <MonthGate>
      <ScreenShell
        title="Money Transfer"
        subtitle="DMT 99, DMT 86, IME"
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
  statIcon: { fontSize: 18, fontWeight: "700", color: colors.accent },
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
  amountGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  amountField: {
    width: "48%",
    minWidth: 140,
    flexGrow: 1,
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
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  serviceName: { fontWeight: "700", fontSize: 16, color: colors.text },
  subLabel: { fontSize: 13, color: colors.muted, marginTop: 2 },
  amount: { fontWeight: "700", fontSize: 16, color: colors.text },
  rowFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  date: { fontSize: 13, color: colors.muted },
  rowActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
