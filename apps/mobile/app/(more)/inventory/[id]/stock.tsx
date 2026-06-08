import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react-native";
import { PRODUCT_KIND_LABELS } from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { TextField, FieldLabel, PrimaryButton } from "@/components/ui/form-fields";
import { formatMoney } from "@/lib/format";
import { colors, radii, spacing } from "@/theme/tokens";

export default function StockInScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = String(id);
  const router = useRouter();
  const qc = useQueryClient();
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");

  const { data: product, isLoading, error } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => api.getProduct(productId),
  });

  const stockIn = useMutation({
    mutationFn: () =>
      api.stockIn({
        productId,
        quantity: parseInt(quantity, 10),
        unitCost: unitCost ? parseFloat(unitCost) : undefined,
        note: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product", productId] });
      router.replace("/inventory");
    },
  });

  if (isLoading) {
    return (
      <ScreenShell title="Add stock" showBack>
        <PageLoader message="Loading product…" />
      </ScreenShell>
    );
  }

  if (error || !product) {
    return (
      <ScreenShell title="Add stock" showBack>
        <Text style={styles.error}>{error ? (error as Error).message : "Product not found"}</Text>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Add stock" subtitle={product.name} showBack>
      <View style={styles.productCard}>
        <Package size={20} color={colors.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productMeta}>
            {PRODUCT_KIND_LABELS[product.kind]}
            {product.buyPrice ? ` · Cost ${formatMoney(product.buyPrice)}` : ""}
          </Text>
        </View>
        <View style={[styles.stockPill, product.stockQty <= product.minStock && styles.stockLow]}>
          <Text style={styles.stockLabel}>In stock</Text>
          <Text style={styles.stockQty}>{product.stockQty}</Text>
        </View>
      </View>

      <FieldLabel>Quantity to add</FieldLabel>
      <TextField value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="e.g. 5" />

      <FieldLabel optional>Unit cost</FieldLabel>
      <TextField
        value={unitCost}
        onChangeText={setUnitCost}
        keyboardType="numeric"
        placeholder={product.buyPrice ? String(parseFloat(product.buyPrice)) : "Optional"}
      />

      <FieldLabel optional>Note</FieldLabel>
      <TextField value={note} onChangeText={setNote} placeholder="e.g. New supplier batch" />

      {stockIn.error ? <Text style={styles.error}>{(stockIn.error as Error).message}</Text> : null}

      <PrimaryButton
        label={stockIn.isPending ? "Saving…" : "Add stock"}
        loading={stockIn.isPending}
        disabled={!quantity || parseInt(quantity, 10) < 1}
        onPress={() => stockIn.mutate()}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  productCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  productName: { fontWeight: "700", fontSize: 16, color: colors.text },
  productMeta: { fontSize: 13, color: colors.muted, marginTop: 2 },
  stockPill: {
    alignItems: "center",
    backgroundColor: colors.pageBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stockLow: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  stockLabel: { fontSize: 11, color: colors.muted },
  stockQty: { fontWeight: "700", fontSize: 18, color: colors.text },
  error: { color: colors.red, marginVertical: spacing.sm },
});
