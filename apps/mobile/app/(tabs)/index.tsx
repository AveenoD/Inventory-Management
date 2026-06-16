import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  ChevronDown,
  CircleDollarSign,
  Package,
  Pencil,
  Smartphone,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react-native";
import { api } from "@/lib/api";
import { getPref, setPref } from "@/lib/prefs";
import { formatMoney, monthLabel, parseMoneyInput, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { TextField } from "@/components/ui/form-fields";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { MetricsGrid, MetricCell } from "@/components/ui/metrics-grid";
import { SimpleBarChart } from "@/components/ui/simple-bar-chart";
import { DateField } from "@/components/ui/form-fields";
import { colors, radii, spacing } from "@/theme/tokens";

function openingDismissKey(year: number, month: number) {
  return `sk-opening-dismissed-${year}-${month}`;
}

export default function DashboardScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso);
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false);
  const [editOpeningOpen, setEditOpeningOpen] = useState(false);
  const [openingInput, setOpeningInput] = useState("");
  const [day1PromptOpen, setDay1PromptOpen] = useState(false);

  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getToday(date),
    retry: 1,
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const updateOpening = useMutation({
    mutationFn: (amount: number) => {
      if (!data?.monthId) throw new Error("Month not loaded");
      return api.updateMonth(data.monthId, { openingBalance: amount });
    },
    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditOpeningOpen(false);
      setDay1PromptOpen(false);
      if (data) {
        await setPref(openingDismissKey(data.year, data.month), "1");
      }
    },
  });

  useEffect(() => {
    if (!data) return;
    if (!data.isFirstDayOfMonth) {
      setDay1PromptOpen(false);
      return;
    }
    getPref(openingDismissKey(data.year, data.month)).then((dismissed) => {
      if (dismissed) return;
      if (data.showOpeningBalancePrompt || data.openingBalance === "0.00") {
        setOpeningInput(data.suggestedOpeningBalance ?? data.openingBalance);
        setDay1PromptOpen(true);
      }
    });
  }, [data]);

  const chartData = useMemo(
    () =>
      (data?.salesLast7Days ?? []).map((d) => ({
        label: d.date.slice(5),
        value: Number(d.total) || 0,
      })),
    [data?.salesLast7Days],
  );

  const showLoading = isPending || (isFetching && !data);
  const monthLbl = data ? monthLabel(data.year, data.month) : undefined;
  const showError = !showLoading && (error || !data);

  function saveOpeningBalance() {
    const amount = parseMoneyInput(openingInput);
    if (!Number.isFinite(amount) || amount < 0) return;
    updateOpening.mutate(amount);
  }

  async function dismissDay1Prompt() {
    if (!data) return;
    await setPref(openingDismissKey(data.year, data.month), "1");
    setDay1PromptOpen(false);
  }

  function dotStyle(type: string) {
    switch (type) {
      case "SALE":
        return styles.dotSale;
      case "RECHARGE":
        return styles.dotRecharge;
      case "TRANSFER":
        return styles.dotTransfer;
      case "REPAIR":
        return styles.dotRepair;
      default:
        return styles.dotSale;
    }
  }

  const content = (
    <>
      {showLoading ? <PageLoader message="Loading dashboard…" /> : null}
      {showError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not load dashboard</Text>
          <Text style={styles.errorText}>
            {error instanceof Error ? error.message : "Could not reach the server. Pull down to retry."}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!showLoading && !showError && data ? (
        <>
        <View style={styles.dateRow}>
          <DateField value={date} onChange={setDate} />
        </View>

        <Text style={styles.sectionLabel}>Today — {data.date}</Text>
        <MetricsGrid>
          <MetricCell>
            <GradientStatCard
              tone="blue"
              icon={<CircleDollarSign size={18} color={colors.accent} />}
              label="Today's Sales"
              value={formatMoney(data.salesTotal)}
              sub={`${data.salesCount} bills`}
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="green"
              icon={<TrendingUp size={18} color={colors.green} />}
              label="Today's Profit"
              value={formatMoney(data.salesProfit)}
              sub="Sales profit"
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="orange"
              icon={<Wrench size={18} color={colors.amber} />}
              label="Repair Profit"
              value={formatMoney(data.repairProfit)}
              sub={`${data.repairDelivered} delivered · ${data.repairUndeliveredCount} undelivered`}
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="purple"
              icon={<Smartphone size={18} color={colors.purple} />}
              label="Recharge"
              value={formatMoney(data.rechargeTotal)}
              sub="Recharge income"
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="teal"
              icon={<ArrowLeftRight size={18} color="#0d9488" />}
              label="Transfer"
              value={formatMoney(data.transferTotal)}
              sub="Money transfer"
            />
          </MetricCell>
          <MetricCell>
            <GradientStatCard
              tone="purple"
              icon={<TrendingUp size={18} color={colors.purple} />}
              label="Total Profit"
              value={formatMoney(data.todayTotalProfit)}
              sub="All sources today"
            />
          </MetricCell>
        </MetricsGrid>

        <Pressable
          style={styles.summaryToggle}
          onPress={() => setMonthSummaryOpen((v) => !v)}
        >
          <Text style={styles.summaryToggleText}>
            {monthSummaryOpen ? "Hide month summary" : "View month summary"}
          </Text>
          <ChevronDown
            size={16}
            color={colors.muted}
            style={{ transform: [{ rotate: monthSummaryOpen ? "180deg" : "0deg" }] }}
          />
        </Pressable>

        {monthSummaryOpen ? (
          <MetricsGrid>
            <MetricCell>
              <GradientStatCard
                tone="blue"
                icon={<CircleDollarSign size={18} color={colors.accent} />}
                label="Month Sales"
                value={formatMoney(data.monthSalesTotal)}
                sub="Mobile & accessories"
              />
            </MetricCell>
            <MetricCell>
              <GradientStatCard
                tone="green"
                icon={<Smartphone size={18} color={colors.green} />}
                label="Recharge + Transfer"
                value={formatMoney(data.monthRechargeTransferTotal)}
              />
            </MetricCell>
            <MetricCell>
              <GradientStatCard
                tone="orange"
                icon={<Wrench size={18} color={colors.amber} />}
                label="Repair Profit"
                value={formatMoney(data.monthRepairProfit)}
                sub={
                  data.repairPendingCount > 0
                    ? `Undelivered: ${formatMoney(data.repairPendingBalance)} (${data.repairPendingCount})`
                    : "No undelivered"
                }
              />
            </MetricCell>
            <MetricCell>
              <GradientStatCard
                tone="purple"
                icon={<Package size={18} color={colors.purple} />}
                label="Stock Value"
                value={formatMoney(data.stockValue)}
              />
            </MetricCell>
            <MetricCell>
              <View style={styles.openingCard}>
                <GradientStatCard
                  tone="teal"
                  icon={<Wallet size={18} color="#0d9488" />}
                  label="Opening Balance"
                  value={formatMoney(data.openingBalance)}
                  sub="Tap edit to change"
                />
                <Pressable
                  style={styles.editOpening}
                  onPress={() => {
                    setOpeningInput(data.openingBalance);
                    setEditOpeningOpen(true);
                  }}
                >
                  <Pencil size={12} color={colors.accent} />
                  <Text style={styles.editOpeningText}>Edit</Text>
                </Pressable>
              </View>
            </MetricCell>
            <MetricCell>
              <GradientStatCard
                tone="blue"
                icon={<Banknote size={18} color={colors.accent} />}
                label="Month Net Profit"
                value={formatMoney(data.monthNetProfit)}
              />
            </MetricCell>
          </MetricsGrid>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>
          <Text style={styles.cardSub}>Shortcuts for common tasks</Text>
          <View style={styles.actionsGrid}>
            <QuickAction title="+ New Sale" sub="Create invoice" tone="blue" onPress={() => router.push("/sales/new")} />
            <QuickAction title="+ Recharge" sub="Add recharge" tone="green" onPress={() => router.push("/recharge")} />
            <QuickAction title="+ Repair" sub="New intake" tone="orange" onPress={() => router.push("/repair?intake=1" as never)} />
            <QuickAction title="+ Product" sub="Inventory" tone="purple" onPress={() => router.push("/inventory")} />
            <QuickAction title="+ Transfer" sub="Money transfer" tone="teal" onPress={() => router.push("/transfer")} />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Today&apos;s Activity</Text>
            <Pressable onPress={() => router.push("/sales")}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          </View>
          {(data.recentActivity ?? []).map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <View style={[styles.dot, dotStyle(a.type)]} />
              <View style={styles.activityBody}>
                <Text style={styles.activityTitle}>{a.title}</Text>
                {a.subtitle ? <Text style={styles.activitySub}>{a.subtitle}</Text> : null}
              </View>
              {a.amount ? <Text style={styles.activityAmt}>{formatMoney(a.amount)}</Text> : null}
            </View>
          ))}
          {!data.recentActivity?.length ? (
            <Text style={styles.empty}>No activity today yet</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Low Stock Alerts</Text>
            <Pressable onPress={() => router.push("/inventory")}>
              <Text style={styles.link}>View all</Text>
            </Pressable>
          </View>
          {(data.lowStockItems ?? []).map((p) => (
            <View key={p.id} style={styles.listRow}>
              <View>
                <Text style={styles.listTitle}>{p.name}</Text>
                <Text style={styles.listSub}>Min {p.minStock}</Text>
              </View>
              <View style={[styles.stockBadge, p.stockQty <= 0 && styles.stockDanger]}>
                <Text style={[styles.stockBadgeText, p.stockQty <= 0 && styles.stockDangerText]}>
                  {p.stockQty <= 0 ? "Out of stock" : `${p.stockQty} left`}
                </Text>
              </View>
            </View>
          ))}
          {!data.lowStockItems?.length ? (
            <View style={styles.emptyRow}>
              <AlertTriangle size={16} color={colors.muted} />
              <Text style={styles.empty}>No low stock items</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sales Overview</Text>
          <Text style={styles.cardSub}>Last 7 days</Text>
          <SimpleBarChart data={chartData} />
        </View>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <ScreenShell
        title="Dashboard"
        subtitle={monthLbl}
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        {content}
      </ScreenShell>

      {data ? (
      <>
      <FormModal
        visible={editOpeningOpen}
        title="Edit Opening Balance"
        subtitle={`Opening balance for ${monthLbl}`}
        onClose={() => setEditOpeningOpen(false)}
      >
        <TextField
          value={openingInput}
          onChangeText={setOpeningInput}
          placeholder="Amount"
          keyboardType="numeric"
        />
        {updateOpening.error ? (
          <Text style={styles.errorText}>{(updateOpening.error as Error).message}</Text>
        ) : null}
        <ModalActions
          onCancel={() => setEditOpeningOpen(false)}
          onConfirm={saveOpeningBalance}
          confirmLabel="Save"
          loading={updateOpening.isPending}
        />
      </FormModal>

      <FormModal
        visible={day1PromptOpen}
        title="Set Opening Balance"
        subtitle={`New month started (${monthLbl})`}
        onClose={() => void dismissDay1Prompt()}
      >
        {data.suggestedOpeningBalance ? (
          <Text style={styles.hint}>
            Previous month closing: {formatMoney(data.suggestedOpeningBalance)}
          </Text>
        ) : null}
        <TextField
          value={openingInput}
          onChangeText={setOpeningInput}
          placeholder="Opening balance"
          keyboardType="numeric"
        />
        <ModalActions
          onCancel={() => void dismissDay1Prompt()}
          onConfirm={saveOpeningBalance}
          confirmLabel="Set Balance"
          cancelLabel="Later"
          loading={updateOpening.isPending}
        />
      </FormModal>
      </>
      ) : null}
    </>
  );
}

function QuickAction({
  title,
  sub,
  tone,
  onPress,
}: {
  title: string;
  sub: string;
  tone: "blue" | "green" | "orange" | "purple" | "teal";
  onPress: () => void;
}) {
  const bg: Record<string, string> = {
    blue: "#eff6ff",
    green: "#f0fdf4",
    orange: "#fff7ed",
    purple: "#faf5ff",
    teal: "#f0fdfa",
  };
  return (
    <Pressable style={[styles.actionBtn, { backgroundColor: bg[tone] }]} onPress={onPress}>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSub}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dateRow: { marginBottom: spacing.md },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  summaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryToggleText: { fontWeight: "600", color: colors.text },
  openingCard: { position: "relative", flex: 1, width: "100%", alignSelf: "stretch" },
  editOpening: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  editOpeningText: { fontSize: 12, color: colors.accent, fontWeight: "600" },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  cardSub: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: spacing.md },
  link: { color: colors.accent, fontWeight: "600", fontSize: 14 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  actionBtn: {
    width: "48%",
    borderRadius: radii.input,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionTitle: { fontWeight: "700", color: colors.text, fontSize: 14 },
  actionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  activityRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  dotSale: { backgroundColor: colors.accent },
  dotRecharge: { backgroundColor: colors.green },
  dotTransfer: { backgroundColor: "#0d9488" },
  dotRepair: { backgroundColor: colors.amber },
  activityBody: { flex: 1 },
  activityTitle: { fontWeight: "600", color: colors.text, fontSize: 14 },
  activitySub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  activityAmt: { fontWeight: "700", color: colors.text, fontSize: 14 },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listTitle: { fontWeight: "600", color: colors.text },
  listSub: { fontSize: 12, color: colors.muted },
  stockBadge: {
    backgroundColor: colors.amberBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  stockDanger: { backgroundColor: "#fef2f2" },
  stockBadgeText: { fontSize: 12, fontWeight: "600", color: colors.amber },
  stockDangerText: { color: colors.red },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: spacing.md },
  emptyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  errorText: { marginTop: spacing.sm, color: colors.red, fontSize: 14 },
  retryBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 12,
    alignItems: "center",
  },
  retryText: { color: "#fff", fontWeight: "700" },
  hint: { fontSize: 14, color: colors.muted, marginBottom: spacing.md },
});
