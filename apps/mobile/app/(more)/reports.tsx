import { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { Download } from "lucide-react-native";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { MetricsGrid, MetricCell } from "@/components/ui/metrics-grid";
import { SimpleBarChart } from "@/components/ui/simple-bar-chart";
import { DateField } from "@/components/ui/form-fields";
import { formatMoney, monthLabel, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { shareCsv } from "@/lib/export-csv";
import { colors, radii, spacing } from "@/theme/tokens";

function calcMargin(net: string, income: string) {
  const n = parseFloat(net) || 0;
  const i = parseFloat(income) || 0;
  if (i <= 0) return "0%";
  return `${Math.round((n / i) * 100)}%`;
}

export default function ReportsScreen() {
  const { monthId, year, month } = useMonthContext();
  const [date, setDate] = useState(todayIso);
  const [serviceFilter, setServiceFilter] = useState<
    "ALL" | "SALE" | "RECHARGE" | "TRANSFER" | "REPAIR"
  >("ALL");

  const { data, isLoading, error, refetch: refetchDash, isFetching: dashFetching } = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => api.getDashboard(monthId!),
    enabled: !!monthId,
  });

  const {
    data: todayData,
    isLoading: todayLoading,
    refetch: refetchToday,
    isFetching: todayFetching,
  } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getToday(date),
  });

  const refreshReports = () => Promise.all([refetchDash(), refetchToday()]);
  const { refreshing, onRefresh } = useQueryRefresh(refreshReports, dashFetching || todayFetching);

  const chartData = useMemo(
    () =>
      (todayData?.salesLast7Days ?? []).map((d) => ({
        label: d.date.slice(5),
        value: Number(d.total) || 0,
      })),
    [todayData?.salesLast7Days],
  );

  const breakdown = useMemo(() => {
    if (!data) return [];
    return [
      { name: "Recharge + Transfer", value: Number(data.serviceWise.rechargeTransferProfit) || 0 },
      { name: "Repairs", value: Number(data.serviceWise.repairProfit) || 0 },
      { name: "Mobile & Accessories", value: Number(data.serviceWise.mobileProfit) || 0 },
      { name: "Extra Income", value: Number(data.serviceWise.extraIncome) || 0 },
    ].filter((i) => i.value > 0);
  }, [data]);

  const recent = useMemo(() => {
    const items = todayData?.recentActivity ?? [];
    if (serviceFilter === "ALL") return items;
    return items.filter((a) => a.type === serviceFilter);
  }, [todayData?.recentActivity, serviceFilter]);

  async function exportCsv() {
    if (!data) return;
    await shareCsv(`sk-mobile-report-${year}-${month}.csv`, [
      ["Metric", "Value"],
      ["Opening Balance", data.openingBalance],
      ["Total Income", data.totalIncome],
      ["Total Expense", data.totalExpense],
      ["Net Profit", data.netProfit],
      ["Recharge+Transfer", data.serviceWise.rechargeTransferProfit],
      ["Repair Profit", data.serviceWise.repairProfit],
      ["Mobile Profit", data.serviceWise.mobileProfit],
    ]);
  }

  return (
    <MonthGate>
      <ScreenShell
        title="Reports"
        subtitle={monthLabel(year, month)}
        showBack
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <View style={styles.toolbar}>
          <DateField value={date} onChange={setDate} />
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={serviceFilter}
              onValueChange={(v) => setServiceFilter(v)}
            >
              <Picker.Item label="All services" value="ALL" />
              <Picker.Item label="Sales" value="SALE" />
              <Picker.Item label="Recharge" value="RECHARGE" />
              <Picker.Item label="Transfer" value="TRANSFER" />
              <Picker.Item label="Repairs" value="REPAIR" />
            </Picker>
          </View>
          <Pressable style={styles.exportBtn} onPress={() => void exportCsv()} disabled={!data}>
            <Download size={16} color={colors.accent} />
            <Text style={styles.exportText}>Export CSV</Text>
          </Pressable>
        </View>

        {isLoading ? <PageLoader message="Loading report…" /> : null}
        {error ? <Text style={styles.error}>{(error as Error).message}</Text> : null}

        {data ? (
          <>
            <MetricsGrid>
              <MetricCell>
                <GradientStatCard
                  tone="blue"
                  icon={<Text style={styles.icon}>₹</Text>}
                  label="Total Income"
                  value={formatMoney(data.totalIncome)}
                  sub="This month"
                />
              </MetricCell>
              <MetricCell>
                <GradientStatCard
                  tone="green"
                  icon={<Text style={styles.icon}>↗</Text>}
                  label="Net Profit"
                  value={formatMoney(data.netProfit)}
                  sub={`Margin ${calcMargin(data.netProfit, data.totalIncome)}`}
                />
              </MetricCell>
              <MetricCell fullWidth style={styles.expenseCell}>
                <GradientStatCard
                  tone="orange"
                  icon={<Text style={styles.icon}>−</Text>}
                  label="Total Expenses"
                  value={formatMoney(data.totalExpense)}
                />
              </MetricCell>
            </MetricsGrid>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Income breakdown</Text>
              {breakdown.map((b) => (
                <View key={b.name} style={styles.breakRow}>
                  <Text style={styles.breakName}>{b.name}</Text>
                  <Text style={styles.breakVal}>{formatMoney(String(b.value))}</Text>
                </View>
              ))}
              {!breakdown.length ? <Text style={styles.muted}>No income recorded yet</Text> : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sales — last 7 days</Text>
              {todayLoading ? (
                <Text style={styles.muted}>Loading chart…</Text>
              ) : (
                <SimpleBarChart data={chartData} />
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent activity ({date})</Text>
              {recent.map((a) => (
                <View key={a.id} style={styles.activityRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityTitle}>{a.title}</Text>
                    {a.subtitle ? <Text style={styles.muted}>{a.subtitle}</Text> : null}
                  </View>
                  {a.amount ? <Text style={styles.activityAmt}>{formatMoney(a.amount)}</Text> : null}
                </View>
              ))}
              {!recent.length ? <Text style={styles.muted}>No activity for filter</Text> : null}
            </View>
          </>
        ) : null}
      </ScreenShell>
    </MonthGate>
  );
}

const styles = StyleSheet.create({
  toolbar: { gap: spacing.sm, marginBottom: spacing.md },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    paddingVertical: spacing.sm,
  },
  exportText: { color: colors.accent, fontWeight: "600" },
  expenseCell: { marginTop: spacing.xs },
  icon: { fontSize: 18, fontWeight: "700", color: colors.accent },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: spacing.md },
  breakRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  breakName: { color: colors.muted },
  breakVal: { fontWeight: "700", color: colors.text },
  activityRow: {
    flexDirection: "row",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityTitle: { fontWeight: "600", color: colors.text },
  activityAmt: { fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.red },
});
