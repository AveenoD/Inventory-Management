import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IndianRupee, Package, Search, ShoppingBag, Trash2 } from "lucide-react-native";
import type { SaleDto } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { GradientStatCard } from "@/components/ui/gradient-stat-card";
import { MetricsGrid, MetricCell } from "@/components/ui/metrics-grid";
import { PrimaryButton } from "@/components/ui/primary-button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchField, DateField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, formatDateLabel, parseMoneyInput, todayIso } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";
import { Picker } from "@react-native-picker/picker";
import { FilterPicker } from "@/components/ui/filter-picker";

const PAYMENT_FILTERS = ["ALL", "CASH", "UPI", "CARD"] as const;

function paymentBadgeTone(method: string): "ok" | "upi" | "card" | "default" {
  if (method === "CASH") return "ok";
  if (method === "UPI") return "upi";
  if (method === "CARD") return "card";
  return "default";
}

function paymentLabel(method: string) {
  if (method === "CASH") return "Cash";
  if (method === "UPI") return "UPI";
  if (method === "CARD") return "Card";
  return method;
}

function formatSaleProducts(lines: SaleDto["lines"]) {
  if (!lines.length) return "—";
  return lines
    .map((l) => (l.quantity > 1 ? `${l.productName} ×${l.quantity}` : l.productName))
    .join(", ");
}

export default function SalesListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayIso();
  const [dateFilter, setDateFilter] = useState(today);
  const [deleteTarget, setDeleteTarget] = useState<SaleDto | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<(typeof PAYMENT_FILTERS)[number]>("ALL");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["sales", dateFilter],
    queryFn: () => api.getSales(1, dateFilter),
  });
  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const removeSale = useMutation({
    mutationFn: (saleId: string) => api.deleteSale(saleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setDeleteTarget(null);
    },
  });

  const sales = data?.data ?? [];

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (paymentFilter !== "ALL" && s.paymentMethod !== paymentFilter) return false;
      if (!searchDebounced) return true;
      const hay = [
        s.customerName ?? "walk-in",
        formatSaleProducts(s.lines),
        s.paymentMethod,
        s.subtotal,
        s.discount,
        s.total,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(searchDebounced);
    });
  }, [sales, paymentFilter, searchDebounced]);

  const summary = useMemo(() => {
    const revenue = filteredSales.reduce((sum, s) => sum + parseMoneyInput(s.total), 0);
    const items = filteredSales.reduce((sum, s) => sum + s.lines.length, 0);
    return { count: filteredSales.length, revenue, items };
  }, [filteredSales]);

  const hasActiveFilters =
    paymentFilter !== "ALL" || searchDebounced.length > 0 || dateFilter !== today;

  const listHeader = (
    <View>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} />
          <SearchField
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer, product…"
          />
        </View>
        <PrimaryButton label="+ New sale" onPress={() => router.push("/sales/new")} />
      </View>

      <MetricsGrid>
        <MetricCell>
          <GradientStatCard
            tone="blue"
            icon={<ShoppingBag size={18} color={colors.accent} />}
            label="Sales"
            value={summary.count}
            sub={hasActiveFilters ? "Matching filter" : "On selected date"}
          />
        </MetricCell>
        <MetricCell>
          <GradientStatCard
            tone="green"
            icon={<IndianRupee size={18} color={colors.green} />}
            label="Revenue"
            value={formatMoney(String(summary.revenue))}
            sub="Total collected"
          />
        </MetricCell>
        <MetricCell fullWidth>
          <GradientStatCard
            tone="purple"
            icon={<Package size={18} color={colors.purple} />}
            label="Line items"
            value={summary.items}
            sub="Products in sales"
          />
        </MetricCell>
      </MetricsGrid>

      <View style={styles.filterCard}>
        <View style={styles.filterRow}>
          <View style={styles.filterCol}>
            <DateField value={dateFilter} onChange={setDateFilter} label="Date" />
            {dateFilter !== today ? (
              <Pressable onPress={() => setDateFilter(today)} style={styles.todayLink}>
                <Text style={styles.link}>Today</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.filterCol}>
            <FieldLabel>Payment</FieldLabel>
            <FilterPicker
              selectedValue={paymentFilter}
              onValueChange={(v) => setPaymentFilter(v)}
            >
              {PAYMENT_FILTERS.map((p) => (
                <Picker.Item
                  key={p}
                  label={p === "ALL" ? "All" : paymentLabel(p)}
                  value={p}
                />
              ))}
            </FilterPicker>
          </View>
        </View>
        {hasActiveFilters ? (
          <Pressable
            onPress={() => {
              setDateFilter(today);
              setPaymentFilter("ALL");
              setSearch("");
            }}
          >
            <Text style={styles.link}>Clear filters</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <ScreenShell title="Sales" subtitle={formatDateLabel(dateFilter)} scroll={false}>
      {isLoading ? <PageLoader message="Loading sales…" /> : null}
      {error ? (
        <Text style={styles.error}>{(error as Error).message}</Text>
      ) : null}

      {!isLoading && !error ? (
        <FlatList
          data={filteredSales}
          keyExtractor={(s) => s.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            sales.length === 0 ? (
              <EmptyState
                title={`No sales on ${formatDateLabel(dateFilter)}`}
                description="Record a sale when a customer buys from your shop."
                action={
                  <PrimaryButton label="+ New sale" onPress={() => router.push("/sales/new")} />
                }
              />
            ) : (
              <EmptyState
                title="No matching sales"
                description="Try a different search or clear filters."
              />
            )
          }
          renderItem={({ item: s }) => (
            <View style={styles.saleCard}>
              <View style={styles.saleTop}>
                <Text style={styles.saleCustomer}>{s.customerName ?? "Walk-in"}</Text>
                <Badge label={paymentLabel(s.paymentMethod)} tone={paymentBadgeTone(s.paymentMethod)} />
              </View>
              <Text style={styles.saleProducts} numberOfLines={2}>
                {formatSaleProducts(s.lines)}
              </Text>
              <View style={styles.saleBottom}>
                <Text style={styles.saleTotal}>{formatMoney(s.total)}</Text>
                <Pressable onPress={() => setDeleteTarget(s)} hitSlop={8}>
                  <Trash2 size={18} color={colors.red} />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : null}

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete sale?"
        message={
          deleteTarget
            ? `Remove this sale (${formatMoney(deleteTarget.total)}) permanently? Stock will be restored.`
            : ""
        }
        loading={removeSale.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeSale.mutate(deleteTarget.id)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  toolbar: { marginBottom: spacing.md, gap: spacing.sm },
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
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  filterCol: {
    flex: 1,
    minWidth: 0,
  },
  todayLink: {
    marginTop: spacing.xs,
  },
  link: { color: colors.accent, fontWeight: "600" },
  list: { flex: 1, minHeight: 0 },
  listContent: { flexGrow: 1, paddingBottom: spacing.md },
  saleCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  saleTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  saleCustomer: { fontWeight: "700", fontSize: 16, color: colors.text },
  saleProducts: { marginTop: spacing.sm, color: colors.muted, fontSize: 14 },
  saleBottom: {
    marginTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  saleTotal: { fontSize: 18, fontWeight: "700", color: colors.text },
  error: { color: colors.red, marginBottom: spacing.md },
});
