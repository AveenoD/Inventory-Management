import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ScrollView } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  REPAIR_STATUS_LABELS,
  repairCountsInProfit,
  type RepairJobDto,
  type RepairJobStatus,
} from "@sk-mobile/shared";
import { Picker } from "@react-native-picker/picker";
import { Clock, IndianRupee, Search, Trash2, Wrench } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
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
import { Badge } from "@/components/ui/badge";
import {
  SearchField,
  TextField,
  DateField,
  FieldLabel,
} from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type Tab = "all" | "active" | "pending" | "delivered" | "unrepairable";
const PART_OTHER = "__other__";

const TABS: { key: Tab; label: string; status?: RepairJobStatus }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "In shop" },
  { key: "pending", label: "Pending pickup", status: "REPAIRED_PENDING_PICKUP" },
  { key: "delivered", label: "Delivered", status: "DELIVERED" },
  { key: "unrepairable", label: "Unrepairable", status: "UNREPAIRABLE_RETURNED" },
];

function statusTone(status: string): "warning" | "ok" | "default" {
  if (status === "REPAIRED_PENDING_PICKUP") return "warning";
  if (status === "DELIVERED") return "ok";
  return "default";
}

function moneyFieldValue(amount: string | undefined) {
  const n = parseMoneyInput(amount || "");
  return n > 0 ? String(n) : "";
}

export default function RepairScreen() {
  const { monthId } = useMonthContext();
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ intake?: string }>();
  const today = todayIso();
  const [tab, setTab] = useState<Tab>("all");
  const [filterDate, setFilterDate] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerSearchDebounced, setCustomerSearchDebounced] = useState("");
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [actionJob, setActionJob] = useState<RepairJobDto | null>(null);
  const [actionKind, setActionKind] = useState<"complete" | "deliver" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RepairJobDto | null>(null);

  const [date, setDate] = useState(today);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [device, setDevice] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [intakeRepairCost, setIntakeRepairCost] = useState("");
  const [intakeCustomerCharge, setIntakeCustomerCharge] = useState("");

  const [repairCost, setRepairCost] = useState("");
  const [customerCharge, setCustomerCharge] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [otherPartName, setOtherPartName] = useState("");
  const [deliveredAt, setDeliveredAt] = useState(today);

  const tabDef = TABS.find((t) => t.key === tab)!;

  useEffect(() => {
    const t = setTimeout(() => setCustomerSearchDebounced(customerSearch.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [customerSearch]);

  useEffect(() => {
    if (searchParams.intake === "1") {
      setIntakeOpen(true);
      router.setParams({ intake: undefined });
    }
  }, [searchParams.intake, router]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["repair-jobs", monthId, tabDef.status ?? "all", filterDate],
    queryFn: () =>
      api.getRepairJobs(monthId!, 1, {
        ...(tabDef.status && { status: tabDef.status }),
        ...(filterDate && { date: filterDate }),
      }),
    enabled: !!monthId,
  });

  const { data: repairPartsData } = useQuery({
    queryKey: ["products", "REPAIR_PART"],
    queryFn: () => api.getProducts(1, undefined, "REPAIR_PART", 100),
  });

  const { data: todayData } = useQuery({
    queryKey: ["today"],
    queryFn: () => api.getToday(),
    enabled: !!monthId,
  });

  const repairParts = repairPartsData?.data ?? [];
  const jobs: RepairJobDto[] = data?.data ?? [];

  const filteredJobs = useMemo(() => {
    let list = jobs;
    if (tab === "active") {
      list = list.filter((j) => j.status === "RECEIVED" || j.status === "IN_PROGRESS");
    }
    if (customerSearchDebounced) {
      list = list.filter((j) =>
        (j.customerName ?? "").toLowerCase().includes(customerSearchDebounced),
      );
    }
    return list;
  }, [jobs, tab, customerSearchDebounced]);

  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const pendingSummary = useMemo(
    () => ({
      count: todayData?.repairPendingCount ?? 0,
      balance: parseMoneyInput(todayData?.repairPendingBalance ?? "0"),
    }),
    [todayData],
  );

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repair-jobs", monthId] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["today"] });
  };

  const intake = useMutation({
    mutationFn: () =>
      api.createRepairIntake(monthId!, {
        date,
        customerName,
        customerPhone: customerPhone || undefined,
        device,
        issueDescription,
        repairCost: parseMoneyInput(intakeRepairCost),
        customerCharge: parseMoneyInput(intakeCustomerCharge),
      }),
    onSuccess: () => {
      invalidate();
      setIntakeOpen(false);
      setCustomerName("");
      setCustomerPhone("");
      setDevice("");
      setIssueDescription("");
      setIntakeRepairCost("");
      setIntakeCustomerCharge("");
    },
  });

  const removeJob = useMutation({
    mutationFn: (jobId: string) => api.deleteRepairJob(monthId!, jobId),
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  const updateStatus = useMutation({
    mutationFn: (payload: {
      jobId: string;
      status: RepairJobStatus;
      repairCost?: number;
      customerCharge?: number;
      partsUsed?: Array<{ productId: string; quantity: number }>;
      otherPartUsed?: string;
      deliveredAt?: string;
    }) =>
      api.updateRepairJob(monthId!, payload.jobId, {
        status: payload.status,
        repairCost: payload.repairCost,
        customerCharge: payload.customerCharge,
        partsUsed: payload.partsUsed,
        otherPartUsed: payload.otherPartUsed,
        deliveredAt: payload.deliveredAt,
      }),
    onSuccess: () => {
      invalidate();
      setActionJob(null);
      setActionKind(null);
      setRepairCost("");
      setCustomerCharge("");
      setSelectedPartId("");
      setOtherPartName("");
    },
  });

  function openComplete(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("complete");
    setRepairCost(moneyFieldValue(job.repairCost));
    setCustomerCharge(moneyFieldValue(job.customerCharge || job.salePrice));
    if (job.otherPartUsed) {
      setSelectedPartId(PART_OTHER);
      setOtherPartName(job.otherPartUsed);
    } else {
      setSelectedPartId(job.partsUsed?.[0]?.productId ?? "");
      setOtherPartName("");
    }
  }

  function handlePartChange(partId: string) {
    setSelectedPartId(partId);
    if (partId === PART_OTHER || !partId) {
      if (!partId) setOtherPartName("");
      return;
    }
    setOtherPartName("");
    const part = repairParts.find((p) => p.id === partId);
    if (part) setRepairCost(moneyFieldValue(part.buyPrice));
  }

  function openDeliver(job: RepairJobDto) {
    setActionJob(job);
    setActionKind("deliver");
    setDeliveredAt(today);
  }

  const content = (
    <>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} />
          <SearchField value={customerSearch} onChangeText={setCustomerSearch} placeholder="Search customer…" />
        </View>
        <PrimaryButton label="+ New intake" onPress={() => setIntakeOpen(true)} />
      </View>

      <MetricsGrid>
        <MetricCell>
          <GradientStatCard
            tone="amber"
            icon={<Clock size={18} color={colors.amber} />}
            label="Pending pickup"
            value={pendingSummary.count}
            sub="Ready for customer"
          />
        </MetricCell>
        <MetricCell>
          <GradientStatCard
            tone="purple"
            icon={<IndianRupee size={18} color={colors.purple} />}
            label="Pending balance"
            value={formatMoney(String(pendingSummary.balance))}
          />
        </MetricCell>
        <MetricCell fullWidth>
          <GradientStatCard
            tone="green"
            icon={<Wrench size={18} color={colors.green} />}
            label="Today's profit"
            value={formatMoney(todayData?.repairProfit ?? "0")}
            sub={`${todayData?.repairDelivered ?? 0} delivered today`}
          />
        </MetricCell>
      </MetricsGrid>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.filterCard}>
        <DateField value={filterDate} onChange={setFilterDate} label="Filter date" />
        {filterDate ? (
          <Pressable onPress={() => setFilterDate("")}>
            <Text style={styles.link}>All dates</Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? <PageLoader message="Loading jobs…" /> : null}
      {error ? (
        <View>
          <Text style={styles.error}>{(error as Error).message}</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && filteredJobs.length === 0 ? (
        <EmptyState
          title="No repair jobs"
          description="Register a device when the customer drops it off."
          action={<PrimaryButton label="New intake" onPress={() => setIntakeOpen(true)} />}
        />
      ) : null}

      {!isLoading && !error && filteredJobs.length > 0 ? (
        <FlatList
          data={filteredJobs}
          keyExtractor={(j) => j.id}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: r }) => (
            <View style={styles.jobCard}>
              <View style={styles.jobTop}>
                <Text style={styles.jobDevice}>{r.device ?? "—"}</Text>
                <Badge
                  label={REPAIR_STATUS_LABELS[r.status as RepairJobStatus] ?? r.status}
                  tone={statusTone(r.status)}
                />
              </View>
              <Text style={styles.jobCustomer}>{r.customerName ?? "—"}</Text>
              <Text style={styles.jobIssue} numberOfLines={2}>
                {r.issueDescription ?? "—"}
              </Text>
              <Text style={styles.jobMeta}>
                Charge: {formatMoney(r.customerCharge || r.salePrice)} · Profit:{" "}
                {repairCountsInProfit(r.status as RepairJobStatus)
                  ? formatMoney(r.profit)
                  : r.status === "REPAIRED_PENDING_PICKUP"
                    ? "On pickup"
                    : "—"}
              </Text>
              <View style={styles.jobActions}>
                {r.status === "RECEIVED" ? (
                  <>
                    <Pressable
                      style={styles.actionBtn}
                      onPress={() => updateStatus.mutate({ jobId: r.id, status: "IN_PROGRESS" })}
                    >
                      <Text style={styles.actionBtnText}>Start</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() =>
                        updateStatus.mutate({ jobId: r.id, status: "UNREPAIRABLE_RETURNED" })
                      }
                    >
                      <Text style={styles.secondaryBtnText}>Unrepairable</Text>
                    </Pressable>
                  </>
                ) : null}
                {r.status === "IN_PROGRESS" ? (
                  <>
                    <Pressable style={styles.actionBtn} onPress={() => openComplete(r)}>
                      <Text style={styles.actionBtnText}>Repair done</Text>
                    </Pressable>
                    <Pressable
                      style={styles.secondaryBtn}
                      onPress={() =>
                        updateStatus.mutate({ jobId: r.id, status: "UNREPAIRABLE_RETURNED" })
                      }
                    >
                      <Text style={styles.secondaryBtnText}>Unrepairable</Text>
                    </Pressable>
                  </>
                ) : null}
                {r.status === "REPAIRED_PENDING_PICKUP" ? (
                  <Pressable style={styles.actionBtn} onPress={() => openDeliver(r)}>
                    <Text style={styles.actionBtnText}>Picked up</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setDeleteTarget(r)}>
                  <Trash2 size={18} color={colors.red} />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : null}

      <FormModal
        visible={intakeOpen}
        title="New repair intake"
        subtitle="Register device dropped off for repair"
        onClose={() => setIntakeOpen(false)}
      >
        <DateField value={date} onChange={setDate} label="Date received" />
        <FieldLabel>Customer name</FieldLabel>
        <TextField value={customerName} onChangeText={setCustomerName} placeholder="Customer name" />
        <FieldLabel optional>Phone</FieldLabel>
        <TextField value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" />
        <FieldLabel>Device / model</FieldLabel>
        <TextField value={device} onChangeText={setDevice} placeholder="e.g. Redmi Note 13" />
        <FieldLabel>Issue</FieldLabel>
        <TextField value={issueDescription} onChangeText={setIssueDescription} multiline />
        <FieldLabel optional>Repair cost</FieldLabel>
        <TextField value={intakeRepairCost} onChangeText={setIntakeRepairCost} keyboardType="numeric" />
        <FieldLabel optional>Customer charge</FieldLabel>
        <TextField value={intakeCustomerCharge} onChangeText={setIntakeCustomerCharge} keyboardType="numeric" />
        {intake.error ? <Text style={styles.error}>{(intake.error as Error).message}</Text> : null}
        <ModalActions
          onCancel={() => setIntakeOpen(false)}
          onConfirm={() => intake.mutate()}
          confirmLabel="Save intake"
          loading={intake.isPending}
          disabled={!customerName || !device || !issueDescription}
        />
      </FormModal>

      <FormModal
        visible={!!actionJob && actionKind === "complete"}
        title="Repair completed"
        subtitle="Mark ready for pickup"
        onClose={() => {
          setActionJob(null);
          setActionKind(null);
        }}
      >
        {actionJob ? (
          <>
            <Text style={styles.hint}>
              {actionJob.device} — {actionJob.customerName}
            </Text>
            <FieldLabel>Part from inventory</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={selectedPartId} onValueChange={handlePartChange}>
                <Picker.Item label="None — no part from stock" value="" />
                {repairParts.map((p) => (
                  <Picker.Item
                    key={p.id}
                    label={`${p.name} (${p.stockQty} in stock)`}
                    value={p.id}
                  />
                ))}
                <Picker.Item label="Other — not in stock" value={PART_OTHER} />
              </Picker>
            </View>
            {selectedPartId === PART_OTHER ? (
              <>
                <FieldLabel>Other part used</FieldLabel>
                <TextField value={otherPartName} onChangeText={setOtherPartName} />
              </>
            ) : null}
            <FieldLabel>Repair cost</FieldLabel>
            <TextField value={repairCost} onChangeText={setRepairCost} keyboardType="numeric" />
            <FieldLabel>Customer charge</FieldLabel>
            <TextField value={customerCharge} onChangeText={setCustomerCharge} keyboardType="numeric" />
            <ModalActions
              onCancel={() => {
                setActionJob(null);
                setActionKind(null);
              }}
              onConfirm={() => {
                const isOther = selectedPartId === PART_OTHER;
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "REPAIRED_PENDING_PICKUP",
                  repairCost: parseMoneyInput(repairCost),
                  customerCharge: parseMoneyInput(customerCharge),
                  partsUsed:
                    selectedPartId && !isOther
                      ? [{ productId: selectedPartId, quantity: 1 }]
                      : [],
                  otherPartUsed: isOther ? otherPartName.trim() : undefined,
                });
              }}
              confirmLabel="Mark ready"
              loading={updateStatus.isPending}
            />
          </>
        ) : null}
      </FormModal>

      <FormModal
        visible={!!actionJob && actionKind === "deliver"}
        title="Customer picked up"
        subtitle="Record delivery and count profit"
        onClose={() => {
          setActionJob(null);
          setActionKind(null);
        }}
      >
        {actionJob ? (
          <>
            <Text style={styles.hint}>
              Charge {formatMoney(actionJob.customerCharge || actionJob.salePrice)} will count in
              profit.
            </Text>
            <DateField value={deliveredAt} onChange={setDeliveredAt} label="Delivery date" />
            <ModalActions
              onCancel={() => {
                setActionJob(null);
                setActionKind(null);
              }}
              onConfirm={() =>
                updateStatus.mutate({
                  jobId: actionJob.id,
                  status: "DELIVERED",
                  deliveredAt,
                })
              }
              confirmLabel="Mark delivered"
              loading={updateStatus.isPending}
            />
          </>
        ) : null}
      </FormModal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete repair job?"
        message={
          deleteTarget
            ? `Remove repair for ${deleteTarget.device ?? "device"}? Parts return to stock.`
            : ""
        }
        loading={removeJob.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeJob.mutate(deleteTarget.id)}
      />
    </>
  );

  return (
    <MonthGate>
      <ScreenShell
        title="Repairs"
        subtitle="Intake → repair → pickup"
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
  tabs: { marginVertical: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  tabText: { color: colors.muted, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  filterCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  link: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.red },
  jobCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  jobTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  jobDevice: { fontWeight: "700", fontSize: 16, color: colors.text, flex: 1 },
  jobCustomer: { marginTop: 4, color: colors.text, fontWeight: "600" },
  jobIssue: { marginTop: 4, color: colors.muted, fontSize: 14 },
  jobMeta: { marginTop: spacing.sm, fontSize: 13, color: colors.muted },
  jobActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: "wrap",
  },
  actionBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.input,
    minHeight: 40,
    justifyContent: "center",
  },
  actionBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.input,
    minHeight: 40,
    justifyContent: "center",
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    marginBottom: spacing.md,
  },
  hint: { color: colors.muted, marginBottom: spacing.md, lineHeight: 20 },
});
