import { useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchField, TextField, FieldLabel, DateField } from "@/components/ui/form-fields";
import { formatMoney, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type PartyOption = { id: string; name: string };
type PartyTxRow = {
  id: string;
  date: string;
  partyName: string;
  materialIn: string;
  paymentOut: string;
};

export default function PartiesScreen() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const [partyOpen, setPartyOpen] = useState(false);
  const [txOpen, setTxOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [partyName, setPartyName] = useState("");
  const [partyId, setPartyId] = useState("");
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [materialIn, setMaterialIn] = useState("0");
  const [paymentOut, setPaymentOut] = useState("0");
  const [deleteTarget, setDeleteTarget] = useState<PartyTxRow | null>(null);

  const { data: parties } = useQuery({
    queryKey: ["party-list"],
    queryFn: () => api.getPartyList(),
  });

  const { data: txs, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["party-txs", monthId],
    queryFn: () => api.getPartyTransactions(monthId!, 1),
    enabled: !!monthId,
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const partyList = (parties?.data ?? []) as PartyOption[];
  const transactions = (txs?.data ?? []) as PartyTxRow[];
  const filtered = transactions.filter((r) =>
    r.partyName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const createParty = useMutation({
    mutationFn: () => api.createParty({ name: partyName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-list"] });
      setPartyOpen(false);
      setPartyName("");
    },
  });

  const createTx = useMutation({
    mutationFn: () =>
      api.createPartyTransaction(monthId!, {
        partyId,
        date,
        materialIn: parseFloat(materialIn) || 0,
        paymentOut: parseFloat(paymentOut) || 0,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-txs", monthId] });
      setTxOpen(false);
    },
  });

  const removeTx = useMutation({
    mutationFn: (txId: string) => api.deletePartyTransaction(monthId!, txId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["party-txs", monthId] });
      setDeleteTarget(null);
    },
  });

  return (
    <MonthGate>
      <ScreenShell
        title="Parties"
        subtitle="Supplier ledger"
        showBack
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.actions}>
          <Pressable style={styles.secondaryBtn} onPress={() => setPartyOpen(true)}>
            <Text style={styles.secondaryBtnText}>+ Party</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => setTxOpen(true)}>
            <Text style={styles.addBtnText}>+ Transaction</Text>
          </Pressable>
        </View>

        <SearchField value={search} onChangeText={setSearch} placeholder="Search party…" />

        {isLoading ? <PageLoader message="Loading…" /> : null}
        {error ? (
          <View>
            <Text style={styles.error}>{(error as Error).message}</Text>
            <Pressable onPress={() => refetch()}>
              <Text style={styles.link}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {!isLoading && !error && filtered.length === 0 ? (
          <EmptyState
            title="No party transactions"
            description="Add a party, then record material in or payments."
            action={
              <Pressable style={styles.addBtn} onPress={() => setTxOpen(true)}>
                <Text style={styles.addBtnText}>Add transaction</Text>
              </Pressable>
            }
          />
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(r) => r.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            style={{ marginTop: spacing.md }}
            renderItem={({ item: r }) => {
              const pending = (parseFloat(r.materialIn) || 0) - (parseFloat(r.paymentOut) || 0);
              return (
                <View style={styles.rowCard}>
                  <View style={styles.rowTop}>
                    <Text style={styles.partyName}>{r.partyName}</Text>
                    <Text style={styles.date}>{r.date}</Text>
                  </View>
                  <Text style={styles.meta}>
                    Material in {formatMoney(r.materialIn)} · Paid {formatMoney(r.paymentOut)}
                  </Text>
                  <View style={styles.rowFoot}>
                    <Text style={styles.pending}>
                      Pending {formatMoney(String(pending))}
                    </Text>
                    <Pressable onPress={() => setDeleteTarget(r)}>
                      <Trash2 size={16} color={colors.red} />
                    </Pressable>
                  </View>
                </View>
              );
            }}
          />
        ) : null}

        <FormModal visible={partyOpen} title="New party" onClose={() => setPartyOpen(false)}>
          <FieldLabel>Party name</FieldLabel>
          <TextField value={partyName} onChangeText={setPartyName} placeholder="Supplier name" />
          <ModalActions
            onCancel={() => setPartyOpen(false)}
            onConfirm={() => createParty.mutate()}
            loading={createParty.isPending}
            disabled={!partyName.trim()}
          />
        </FormModal>

        <FormModal visible={txOpen} title="New transaction" onClose={() => setTxOpen(false)}>
          <FieldLabel>Party</FieldLabel>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={partyId} onValueChange={setPartyId}>
              <Picker.Item label="Select party…" value="" />
              {partyList.map((p) => (
                <Picker.Item key={p.id} label={p.name} value={p.id} />
              ))}
            </Picker>
          </View>
          <DateField value={date} onChange={setDate} label="Date" />
          <FieldLabel>Material in (₹)</FieldLabel>
          <TextField value={materialIn} onChangeText={setMaterialIn} keyboardType="numeric" />
          <FieldLabel>Payment out (₹)</FieldLabel>
          <TextField value={paymentOut} onChangeText={setPaymentOut} keyboardType="numeric" />
          <ModalActions
            onCancel={() => setTxOpen(false)}
            onConfirm={() => createTx.mutate()}
            loading={createTx.isPending}
            disabled={!partyId}
          />
        </FormModal>

        <ConfirmDialog
          visible={!!deleteTarget}
          title="Delete transaction?"
          message="Remove this party ledger entry?"
          loading={removeTx.isPending}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deleteTarget && removeTx.mutate(deleteTarget.id)}
        />
      </ScreenShell>
    </MonthGate>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  addBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 12,
    alignItems: "center",
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
  partyName: { fontWeight: "700", color: colors.text, fontSize: 16 },
  date: { color: colors.muted, fontSize: 13 },
  meta: { marginTop: spacing.sm, color: colors.muted, fontSize: 14 },
  rowFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  pending: { fontWeight: "600", color: colors.text },
  error: { color: colors.red },
  link: { color: colors.accent, fontWeight: "600" },
});
