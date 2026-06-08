import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PRODUCT_KIND_LABELS, type ProductDto, type ProductKind } from "@sk-mobile/shared";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react-native";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { SearchField, TextField, PrimaryButton, SecondaryButton } from "@/components/ui/form-fields";
import { formatMoney, parseMoneyInput, todayIso } from "@/lib/format";
import { hapticSuccess } from "@/lib/haptics";
import { colors, radii, spacing } from "@/theme/tokens";

type CartLine = {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  maxStock: number;
  kind: ProductKind;
};

const PAGE_SIZE = 20;
const EXCLUDE_KINDS: ProductKind[] = ["REPAIR_PART"];

const TABS: Array<{ key: "ALL" | ProductKind; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "MOBILE", label: "Mobile" },
  { key: "MOBILE_ACCESSORY", label: "Accessories" },
  { key: "SPEAKERS_SOUND", label: "Speakers" },
  { key: "CHARGER_CABLE", label: "Charger" },
];

function unitSalePrice(p: ProductDto) {
  return parseFloat(p.sellPrice) || 0;
}

export default function PosScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const today = todayIso();
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartError, setCartError] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [discount, setDiscount] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: productsRes, isPending, isFetching, error } = useQuery({
    queryKey: ["products", "sale", page, searchDebounced, tab],
    queryFn: () =>
      api.getProducts(
        page,
        searchDebounced || undefined,
        tab === "ALL" ? undefined : tab,
        PAGE_SIZE,
        EXCLUDE_KINDS,
      ),
    staleTime: 5 * 60_000,
  });

  const products = productsRes?.data ?? [];
  const meta = productsRes?.meta;
  const totalPages = meta?.totalPages ?? 1;

  const create = useMutation({
    mutationFn: () =>
      api.createSale({
        date: today,
        customerName: customerName || undefined,
        paymentMethod,
        discount: discountValue,
        lines: cart.map((c) => ({
          productId: c.productId,
          quantity: c.qty,
          unitPrice: c.unitPrice,
        })),
      }),
    onSuccess: async () => {
      await hapticSuccess();
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["today"] });
      router.replace("/sales");
    },
  });

  function addToCart(p: ProductDto) {
    setCartError("");
    const inCart = cart.find((c) => c.productId === p.id);
    const alreadyInCart = inCart?.qty ?? 0;
    if (alreadyInCart + 1 > p.stockQty) {
      setCartError(`Only ${p.stockQty} in stock for ${p.name}`);
      return;
    }
    if (inCart) {
      setCart((prev) =>
        prev.map((c) => (c.productId === p.id ? { ...c, qty: c.qty + 1 } : c)),
      );
    } else {
      setCart((prev) => [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          qty: 1,
          unitPrice: unitSalePrice(p),
          maxStock: p.stockQty,
          kind: p.kind,
        },
      ]);
    }
  }

  const subtotal = cart.reduce((a, c) => a + c.qty * c.unitPrice, 0);
  const discountValue = parseMoneyInput(discount);
  const total = Math.max(0, subtotal - discountValue);
  const received = parseMoneyInput(amountReceived);
  const change = Math.max(0, received - total);

  if (isPending) {
    return (
      <ScreenShell title="New sale" subtitle="POS" showBack hideHeaderActions>
        <PageLoader message="Loading inventory…" />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="New sale" subtitle="Point of sale billing" showBack hideHeaderActions>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        {error ? <Text style={styles.error}>{(error as Error).message}</Text> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => {
                setTab(t.key);
                setPage(1);
              }}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.searchWrap}>
          <Search size={16} color={colors.muted} />
          <SearchField
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search products…"
          />
        </View>

        {isFetching ? <ActivityIndicator style={{ marginBottom: 8 }} color={colors.accent} /> : null}

        {products.map((p) => {
          const out = p.stockQty <= 0;
          const inCart = cart.find((c) => c.productId === p.id);
          return (
            <View key={p.id} style={[styles.productRow, out && styles.productDisabled]}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.name}</Text>
                <Text style={styles.productMeta}>
                  {PRODUCT_KIND_LABELS[p.kind]} · {out ? "Out of stock" : `${p.stockQty} in stock`}
                  {inCart ? ` · In cart: ${inCart.qty}` : ""}
                </Text>
              </View>
              <View style={styles.productRight}>
                <Text style={styles.productPrice}>{formatMoney(p.sellPrice)}</Text>
                <Pressable
                  style={[styles.addBtn, out && styles.addBtnDisabled]}
                  disabled={out}
                  onPress={() => addToCart(p)}
                >
                  <Text style={styles.addBtnText}>+ Add</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.pagination}>
          <SecondaryButton
            label="Prev"
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          />
          <Text style={styles.pageLabel}>
            {page} / {totalPages}
          </Text>
          <SecondaryButton
            label="Next"
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </View>

        <View style={styles.cartCard}>
          <View style={styles.cartHeader}>
            <ShoppingCart size={18} color={colors.text} />
            <Text style={styles.cartTitle}>Cart ({cart.length})</Text>
            <Pressable onPress={() => setCart([])} disabled={!cart.length}>
              <Trash2 size={16} color={cart.length ? colors.red : colors.muted} />
            </Pressable>
          </View>

          {(cartError || create.error) && (
            <Text style={styles.error}>{cartError || (create.error as Error).message}</Text>
          )}

          {cart.length === 0 ? (
            <Text style={styles.muted}>No items in cart</Text>
          ) : (
            cart.map((c) => (
              <View key={c.productId} style={styles.cartLine}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartLineName}>{c.name}</Text>
                  <Text style={styles.muted}>{PRODUCT_KIND_LABELS[c.kind]}</Text>
                </View>
                <View style={styles.qtyRow}>
                  <Pressable
                    onPress={() =>
                      setCart((prev) =>
                        prev
                          .map((x) =>
                            x.productId === c.productId ? { ...x, qty: x.qty - 1 } : x,
                          )
                          .filter((x) => x.qty > 0),
                      )
                    }
                  >
                    <Minus size={18} color={colors.text} />
                  </Pressable>
                  <Text style={styles.qty}>{c.qty}</Text>
                  <Pressable
                    disabled={c.qty >= c.maxStock}
                    onPress={() =>
                      setCart((prev) =>
                        prev.map((x) =>
                          x.productId === c.productId ? { ...x, qty: x.qty + 1 } : x,
                        ),
                      )
                    }
                  >
                    <Plus size={18} color={colors.text} />
                  </Pressable>
                </View>
                <Text style={styles.lineTotal}>{formatMoney(String(c.qty * c.unitPrice))}</Text>
              </View>
            ))
          )}

          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text>{formatMoney(String(subtotal))}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.muted}>Discount</Text>
            <View style={styles.discountField}>
              <TextField
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                placeholder="0"
                style={styles.discountInput}
              />
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatMoney(String(total))}</Text>
          </View>

          <Text style={styles.fieldLabel}>Payment</Text>
          <View style={styles.payRow}>
            {(["CASH", "UPI", "CARD"] as const).map((m) => (
              <Pressable
                key={m}
                style={[styles.payBtn, paymentMethod === m && styles.payBtnActive]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text style={[styles.payBtnText, paymentMethod === m && styles.payBtnTextActive]}>
                  {m === "CASH" ? "Cash" : m === "UPI" ? "UPI" : "Card"}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Customer (optional)</Text>
          <TextField value={customerName} onChangeText={setCustomerName} placeholder="Walk-in" />

          <View style={styles.payGrid}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Received</Text>
              <TextField
                value={amountReceived}
                onChangeText={setAmountReceived}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Change</Text>
              <Text style={styles.changeValue}>{formatMoney(String(change))}</Text>
            </View>
          </View>

          <PrimaryButton
            label={create.isPending ? "Processing…" : "Complete Sale"}
            loading={create.isPending}
            disabled={cart.length === 0}
            onPress={() => {
              if (discountValue > subtotal) {
                setCartError("Discount cannot exceed subtotal.");
                return;
              }
              setCartError("");
              create.mutate();
            }}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: spacing.md },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.accentLight, borderColor: colors.accent },
  tabText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: colors.accent },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingLeft: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  productRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  productDisabled: { opacity: 0.55 },
  productInfo: { flex: 1 },
  productName: { fontWeight: "600", color: colors.text },
  productMeta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  productRight: { alignItems: "flex-end", gap: spacing.sm },
  productPrice: { fontWeight: "700", color: colors.text },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBtnDisabled: { backgroundColor: colors.muted },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    marginVertical: spacing.md,
  },
  pageLabel: { fontWeight: "600", color: colors.text },
  cartCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  cartHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  cartTitle: { flex: 1, fontWeight: "700", fontSize: 16, color: colors.text },
  cartLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartLineName: { fontWeight: "600", color: colors.text },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qty: { fontWeight: "700", minWidth: 24, textAlign: "center" },
  lineTotal: { fontWeight: "700", color: colors.text },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  discountField: {
    flex: 1,
    maxWidth: 160,
    marginLeft: spacing.sm,
  },
  discountInput: {
    textAlign: "right",
    minHeight: 44,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: spacing.sm,
  },
  totalLabel: { fontSize: 16, fontWeight: "600", color: colors.muted },
  totalValue: { fontSize: 22, fontWeight: "700", color: colors.text },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.muted,
    textTransform: "uppercase",
    marginTop: spacing.sm,
  },
  payRow: { flexDirection: "row", gap: spacing.sm },
  payBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  payBtnActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  payBtnText: { fontWeight: "600", color: colors.text },
  payBtnTextActive: { color: "#fff" },
  payGrid: { flexDirection: "row", gap: spacing.md },
  changeValue: { fontSize: 20, fontWeight: "700", color: colors.text, marginTop: spacing.sm },
  muted: { color: colors.muted, fontSize: 14 },
  error: { color: colors.red, marginBottom: spacing.sm },
});
