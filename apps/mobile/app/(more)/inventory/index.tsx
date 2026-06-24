import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import { PackagePlus, Pencil, Search, Trash2 } from "lucide-react-native";
import {
  PRODUCT_KIND_LABELS,
  type ProductDto,
  type ProductKind,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { FormModal, ModalActions } from "@/components/ui/form-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SearchField, TextField, FieldLabel } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput } from "@/lib/format";
import { useQueryRefresh } from "@/lib/use-query-refresh";
import { colors, radii, spacing } from "@/theme/tokens";

type InventoryFilter =
  | "ALL"
  | "COVERS"
  | "OTHER_ACCESSORIES"
  | "ANDROID_MOBILE"
  | "BASIC_MOBILE"
  | "REPAIR_PART";

const FILTER_TABS: Array<{ id: InventoryFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "COVERS", label: "Covers" },
  { id: "OTHER_ACCESSORIES", label: "Accessories" },
  { id: "ANDROID_MOBILE", label: "Android Mobile" },
  { id: "BASIC_MOBILE", label: "Basic Mobile" },
  { id: "REPAIR_PART", label: "Repair" },
];

const PAGE_SIZE = 25;

function queryForFilter(filter: InventoryFilter) {
  switch (filter) {
    case "COVERS":
      return { kind: "MOBILE_ACCESSORY" as ProductKind, filters: { segment: "covers" as const } };
    case "OTHER_ACCESSORIES":
      return {
        kind: "MOBILE_ACCESSORY" as ProductKind,
        filters: { segment: "other_accessories" as const },
      };
    case "ALL":
      return { kind: undefined, filters: undefined };
    default:
      return { kind: filter as ProductKind, filters: undefined };
  }
}

function addProductMode(filter: InventoryFilter) {
  if (filter === "COVERS") return "cover";
  if (filter === "OTHER_ACCESSORIES") return "accessory";
  if (filter === "REPAIR_PART") return "repair";
  if (filter === "ANDROID_MOBILE" || filter === "BASIC_MOBILE")
    return "device";
  return "";
}

type EditDraft = {
  name: string;
  buyPrice: string;
  sellPrice: string;
  repairCharge: string;
  minStock: string;
};

function productToDraft(p: ProductDto): EditDraft {
  return {
    name: p.name,
    buyPrice: p.buyPrice,
    sellPrice: p.sellPrice,
    repairCharge: p.repairCharge ?? "",
    minStock: String(p.minStock),
  };
}

function sellPriceLabel(p: ProductDto, filter: InventoryFilter) {
  if (filter === "REPAIR_PART" || p.kind === "REPAIR_PART") {
    return formatMoney(p.repairCharge ?? p.sellPrice);
  }
  return formatMoney(p.sellPrice);
}

export default function InventoryScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<InventoryFilter>("ALL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [coverPhoneModelId, setCoverPhoneModelId] = useState("");
  const [coverTypeName, setCoverTypeName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<ProductDto | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);

  const { kind, filters } = queryForFilter(filter);

  const productFilters = useMemo(() => {
    if (filter !== "COVERS") return filters;
    return {
      segment: "covers" as const,
      ...(coverPhoneModelId && { phoneModelId: coverPhoneModelId }),
      ...(coverTypeName && { coverTypeName }),
    };
  }, [filter, filters, coverPhoneModelId, coverTypeName]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
    if (filter !== "COVERS") {
      setCoverPhoneModelId("");
      setCoverTypeName("");
    }
  }, [filter]);

  const { data: phoneModelsData } = useQuery({
    queryKey: ["phone-models"],
    queryFn: () => api.getPhoneModels(),
    enabled: filter === "COVERS",
  });

  const { data: coverTypesData } = useQuery({
    queryKey: ["cover-types", "catalog"],
    queryFn: () => api.getCoverTypes(),
    enabled: filter === "COVERS",
  });

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["products", filter, page, searchDebounced, coverPhoneModelId, coverTypeName],
    queryFn: () =>
      api.getProducts(
        page,
        searchDebounced || undefined,
        kind,
        PAGE_SIZE,
        undefined,
        productFilters,
      ),
  });

  const { refreshing, onRefresh } = useQueryRefresh(refetch, isFetching);

  const updateProduct = useMutation({
    mutationFn: ({ id, draft, kind: pk }: { id: string; draft: EditDraft; kind: ProductKind }) =>
      api.updateProduct(id, {
        name: draft.name.trim(),
        buyPrice: parseMoneyInput(draft.buyPrice),
        sellPrice: parseMoneyInput(draft.sellPrice),
        ...(pk === "REPAIR_PART" && { repairCharge: parseMoneyInput(draft.repairCharge) }),
        minStock: Math.max(0, parseInt(draft.minStock, 10) || 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      setEditTarget(null);
      setEditDraft(null);
    },
  });

  const removeProduct = useMutation({
    mutationFn: (productId: string) => api.deleteProduct(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setDeleteTarget(null);
    },
  });

  const products = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;
  const mode = addProductMode(filter);

  return (
    <ScreenShell
      title="Inventory"
      subtitle="Products & stock"
      showBack
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Search size={16} color={colors.muted} />
          <SearchField value={search} onChangeText={setSearch} placeholder="Search products…" />
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() =>
            router.push((mode ? `/inventory/new?mode=${mode}` : "/inventory/new") as never)
          }
        >
          <Text style={styles.addBtnText}>+ Add product</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
        {FILTER_TABS.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, filter === tab.id && styles.tabActive]}
            onPress={() => setFilter(tab.id)}
          >
            <Text style={[styles.tabText, filter === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filter === "COVERS" ? (
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Cover category</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={coverTypeName} onValueChange={setCoverTypeName}>
              <Picker.Item label="All cover categories" value="" />
              {[...new Set((coverTypesData?.data ?? []).map((t) => t.name))].map((name) => (
                <Picker.Item key={name} label={name} value={name} />
              ))}
            </Picker>
          </View>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={coverPhoneModelId} onValueChange={setCoverPhoneModelId}>
              <Picker.Item label="All phone models" value="" />
              {(phoneModelsData?.data ?? []).map((m) => (
                <Picker.Item key={m.id} label={m.name} value={m.id} />
              ))}
            </Picker>
          </View>
        </View>
      ) : null}

      {isLoading ? <PageLoader message="Loading products…" /> : null}
      {error ? (
        <View>
          <Text style={styles.error}>{(error as Error).message}</Text>
          <Pressable onPress={() => refetch()}>
            <Text style={styles.link}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!isLoading && !error && products.length === 0 ? (
        <EmptyState
          title="No products"
          description="Add your first product to start tracking stock."
          action={
            <Pressable style={styles.addBtn} onPress={() => router.push("/inventory/new" as never)}>
              <Text style={styles.addBtnText}>+ Add product</Text>
            </Pressable>
          }
        />
      ) : null}

      {!isLoading && !error && products.length > 0 ? (
        <>
          <FlatList
            data={products}
            keyExtractor={(p) => p.id}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
            renderItem={({ item: p }) => (
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{p.name}</Text>
                    <Text style={styles.cardSub}>
                      {PRODUCT_KIND_LABELS[p.kind]}
                      {p.phoneModel ? ` · ${p.phoneModel}` : ""}
                    </Text>
                  </View>
                  <View style={[styles.stockPill, p.stockQty <= p.minStock && styles.stockLow]}>
                    <Text style={[styles.stockText, p.stockQty <= p.minStock && styles.stockLowText]}>
                      {p.stockQty}
                    </Text>
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <Text style={styles.stat}>Cost {formatMoney(p.buyPrice)}</Text>
                  <Text style={styles.stat}>Sell {sellPriceLabel(p, filter)}</Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => {
                      setEditTarget(p);
                      setEditDraft(productToDraft(p));
                    }}
                  >
                    <Pencil size={14} color={colors.text} />
                    <Text style={styles.secondaryBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primarySmall}
                    onPress={() => router.push(`/inventory/${p.id}/stock` as never)}
                  >
                    <PackagePlus size={14} color="#fff" />
                    <Text style={styles.primarySmallText}>Stock</Text>
                  </Pressable>
                  <Pressable onPress={() => setDeleteTarget({ id: p.id, name: p.name })}>
                    <Trash2 size={18} color={colors.red} />
                  </Pressable>
                </View>
              </View>
            )}
          />
          <View style={styles.pagination}>
            <Pressable
              style={styles.pageBtn}
              disabled={page <= 1}
              onPress={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Text style={styles.pageBtnText}>Prev</Text>
            </Pressable>
            <Text style={styles.pageLabel}>
              {page} / {totalPages}
            </Text>
            <Pressable
              style={styles.pageBtn}
              disabled={page >= totalPages}
              onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <Text style={styles.pageBtnText}>Next</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      <FormModal
        visible={!!editTarget && !!editDraft}
        title="Edit product"
        onClose={() => {
          setEditTarget(null);
          setEditDraft(null);
        }}
      >
        {editTarget && editDraft ? (
          <>
            <FieldLabel>Name</FieldLabel>
            <TextField
              value={editDraft.name}
              onChangeText={(v) => setEditDraft({ ...editDraft, name: v })}
            />
            <FieldLabel>Buy price</FieldLabel>
            <TextField
              value={editDraft.buyPrice}
              onChangeText={(v) => setEditDraft({ ...editDraft, buyPrice: v })}
              keyboardType="numeric"
            />
            <FieldLabel>Sell price</FieldLabel>
            <TextField
              value={editDraft.sellPrice}
              onChangeText={(v) => setEditDraft({ ...editDraft, sellPrice: v })}
              keyboardType="numeric"
            />
            {editTarget.kind === "REPAIR_PART" ? (
              <>
                <FieldLabel>Repair charge</FieldLabel>
                <TextField
                  value={editDraft.repairCharge}
                  onChangeText={(v) => setEditDraft({ ...editDraft, repairCharge: v })}
                  keyboardType="numeric"
                />
              </>
            ) : null}
            <FieldLabel>Min stock alert</FieldLabel>
            <TextField
              value={editDraft.minStock}
              onChangeText={(v) => setEditDraft({ ...editDraft, minStock: v })}
              keyboardType="numeric"
            />
            <ModalActions
              onCancel={() => {
                setEditTarget(null);
                setEditDraft(null);
              }}
              onConfirm={() =>
                updateProduct.mutate({
                  id: editTarget.id,
                  draft: editDraft,
                  kind: editTarget.kind,
                })
              }
              loading={updateProduct.isPending}
            />
          </>
        ) : null}
      </FormModal>

      <ConfirmDialog
        visible={!!deleteTarget}
        title="Delete product?"
        message={deleteTarget ? `Remove "${deleteTarget.name}" permanently?` : ""}
        loading={removeProduct.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeProduct.mutate(deleteTarget.id)}
      />
    </ScreenShell>
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
  addBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 12,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontWeight: "700" },
  tabs: { marginBottom: spacing.md },
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
  tabText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.accent },
  filterCard: { gap: spacing.sm, marginBottom: spacing.md },
  filterLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    overflow: "hidden",
    backgroundColor: colors.card,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  cardTitle: { fontWeight: "700", fontSize: 16, color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  stockPill: {
    backgroundColor: colors.pageBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockLow: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  stockText: { fontWeight: "700", color: colors.text },
  stockLowText: { color: colors.red },
  statsRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.sm },
  stat: { fontSize: 13, color: colors.muted },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnText: { fontWeight: "600", color: colors.text, fontSize: 13 },
  primarySmall: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primarySmallText: { fontWeight: "600", color: "#fff", fontSize: 13 },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pageBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.card,
  },
  pageBtnText: { fontWeight: "600", color: colors.text },
  pageLabel: { fontWeight: "600" },
  error: { color: colors.red },
  link: { color: colors.accent, fontWeight: "600" },
});
