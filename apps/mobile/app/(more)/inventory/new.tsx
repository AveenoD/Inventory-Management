import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Picker } from "@react-native-picker/picker";
import {
  PRODUCT_KIND_LABELS,
  REPAIR_PART_TYPES,
  type ProductKind,
} from "@sk-mobile/shared";
import { api } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import {
  TextField,
  FieldLabel,
  PrimaryButton,
  SecondaryButton,
} from "@/components/ui/form-fields";
import { colors, radii, spacing } from "@/theme/tokens";

type AddProductMode = "cover" | "other_accessory" | "device" | "repair";
type DeviceKind = Extract<ProductKind, "MOBILE" | "SPEAKERS_SOUND" | "CHARGER_CABLE">;

const MODES: Array<{ id: AddProductMode; label: string; hint?: string }> = [
  { id: "cover", label: "Mobile Cover", hint: "Model → cover category → design" },
  { id: "other_accessory", label: "Other Accessory" },
  { id: "device", label: "Mobile / Audio / Cable" },
  { id: "repair", label: "Repair Part" },
];

const DEVICE_KINDS: DeviceKind[] = ["MOBILE", "SPEAKERS_SOUND", "CHARGER_CABLE"];

function parseMode(value: string | undefined): AddProductMode {
  if (value === "accessory" || value === "other_accessory") return "other_accessory";
  if (value === "device" || value === "mobile") return "device";
  if (value === "repair") return "repair";
  return "cover";
}

export default function NewProductScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { mode: modeParam } = useLocalSearchParams<{ mode?: string }>();

  const [mode, setMode] = useState<AddProductMode>(() => parseMode(modeParam));
  const [deviceKind, setDeviceKind] = useState<DeviceKind>("MOBILE");
  const [categoryId, setCategoryId] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [name, setName] = useState("");
  const [phoneModelId, setPhoneModelId] = useState("");
  const [newPhoneModel, setNewPhoneModel] = useState("");
  const [phoneModel, setPhoneModel] = useState("");
  const [coverTypeId, setCoverTypeId] = useState("");
  const [newCoverType, setNewCoverType] = useState("");
  const [variantName, setVariantName] = useState("");
  const [partType, setPartType] = useState<string>(REPAIR_PART_TYPES[0]);
  const [buyPrice, setBuyPrice] = useState("");
  const [sellPrice, setSellPrice] = useState("");
  const [repairCharge, setRepairCharge] = useState("");
  const [minStock, setMinStock] = useState("0");
  const [openingStock, setOpeningStock] = useState("0");
  const [formError, setFormError] = useState("");

  const { data: phoneModels } = useQuery({
    queryKey: ["phone-models"],
    queryFn: () => api.getPhoneModels(),
    enabled: mode === "cover",
  });

  const { data: coverTypes, refetch: refetchCoverTypes } = useQuery({
    queryKey: ["cover-types", phoneModelId],
    queryFn: () => api.getCoverTypes(phoneModelId),
    enabled: mode === "cover" && !!phoneModelId,
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => api.getCategories(),
    enabled: mode === "other_accessory",
  });

  const addPhoneModel = useMutation({
    mutationFn: () => api.createPhoneModel(newPhoneModel.trim()),
    onSuccess: (pm) => {
      setPhoneModelId(pm.id);
      setNewPhoneModel("");
      qc.invalidateQueries({ queryKey: ["phone-models"] });
    },
  });

  const addCoverType = useMutation({
    mutationFn: () => api.createCoverType(phoneModelId, newCoverType.trim()),
    onSuccess: (ct) => {
      setCoverTypeId(ct.id);
      setNewCoverType("");
      refetchCoverTypes();
    },
  });

  const addCategory = useMutation({
    mutationFn: () => api.createCategory(newCategory.trim()),
    onSuccess: (c) => {
      setCategoryId(c.id);
      setNewCategory("");
      refetchCategories();
    },
  });

  const create = useMutation({
    mutationFn: () => {
      const kind: ProductKind =
        mode === "cover" || mode === "other_accessory"
          ? "MOBILE_ACCESSORY"
          : mode === "repair"
            ? "REPAIR_PART"
            : deviceKind;

      return api.createProduct({
        kind,
        name: mode === "cover" ? undefined : name.trim() || undefined,
        categoryId: mode === "other_accessory" ? categoryId || undefined : undefined,
        phoneModelId: mode === "cover" && phoneModelId ? phoneModelId : undefined,
        phoneModel: mode === "repair" ? phoneModel : undefined,
        coverTypeId: mode === "cover" ? coverTypeId : undefined,
        variantName: mode === "cover" ? variantName.trim() : undefined,
        partType: mode === "repair" ? partType : undefined,
        buyPrice: parseFloat(buyPrice) || 0,
        sellPrice: parseFloat(sellPrice) || parseFloat(repairCharge) || 0,
        repairCharge:
          mode === "repair"
            ? parseFloat(repairCharge) || parseFloat(sellPrice) || 0
            : undefined,
        minStock: parseInt(minStock, 10) || 0,
        openingStock: parseInt(openingStock, 10) || 0,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      router.replace("/inventory");
    },
  });

  const reservedNames = new Set(Object.values(PRODUCT_KIND_LABELS));
  const catList = (categories?.data ?? []).filter((c) => !reservedNames.has(c.name));

  function submit() {
    setFormError("");
    if (mode === "cover") {
      if (!phoneModelId) return setFormError("Select a phone model.");
      if (!coverTypeId) return setFormError("Select a cover category.");
      if (!variantName.trim()) return setFormError("Design name is required.");
    }
    if ((mode === "other_accessory" || mode === "device") && !name.trim()) {
      return setFormError("Product name is required.");
    }
    if (mode === "repair" && !phoneModel.trim()) {
      return setFormError("Phone model is required.");
    }
    create.mutate();
  }

  return (
    <ScreenShell title="Add product" subtitle="New inventory item" showBack>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs}>
          {MODES.map((m) => (
            <Pressable
              key={m.id}
              style={[styles.tab, mode === m.id && styles.tabActive]}
              onPress={() => setMode(m.id)}
            >
              <Text style={[styles.tabText, mode === m.id && styles.tabTextActive]}>{m.label}</Text>
              {m.hint && mode === m.id ? (
                <Text style={styles.tabHint}>{m.hint}</Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>

        {mode === "cover" ? (
          <>
            <FieldLabel>Phone model</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={phoneModelId}
                onValueChange={(v) => {
                  setPhoneModelId(v);
                  setCoverTypeId("");
                }}
              >
                <Picker.Item label="Select model…" value="" />
                {(phoneModels?.data ?? []).map((m) => (
                  <Picker.Item key={m.id} label={m.name} value={m.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.inlineAdd}>
              <TextField value={newPhoneModel} onChangeText={setNewPhoneModel} placeholder="New model name" />
              <SecondaryButton
                label="Add"
                onPress={() => newPhoneModel.trim() && addPhoneModel.mutate()}
              />
            </View>

            <FieldLabel>Cover category</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={coverTypeId} onValueChange={setCoverTypeId}>
                <Picker.Item label="Select cover category…" value="" />
                {(coverTypes?.data ?? []).map((t) => (
                  <Picker.Item key={t.id} label={t.name} value={t.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.inlineAdd}>
              <TextField value={newCoverType} onChangeText={setNewCoverType} placeholder="New cover category" />
              <SecondaryButton
                label="Add"
                onPress={() => phoneModelId && newCoverType.trim() && addCoverType.mutate()}
              />
            </View>

            <FieldLabel>Design name</FieldLabel>
            <TextField value={variantName} onChangeText={setVariantName} placeholder="e.g. Blue Marble" />
            <Text style={styles.hint}>
              Name auto: Model – Cover category – Design (e.g. Samsung J7 – Silicon – Blue Marble)
            </Text>
          </>
        ) : null}

        {mode === "other_accessory" ? (
          <>
            <FieldLabel>Product name</FieldLabel>
            <TextField value={name} onChangeText={setName} placeholder="e.g. Pendrive 32GB" />
            <FieldLabel>Category</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={categoryId} onValueChange={setCategoryId}>
                <Picker.Item label="Select category…" value="" />
                {catList.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.id} />
                ))}
              </Picker>
            </View>
            <View style={styles.inlineAdd}>
              <TextField value={newCategory} onChangeText={setNewCategory} placeholder="New category" />
              <SecondaryButton
                label="Add"
                onPress={() => newCategory.trim() && addCategory.mutate()}
              />
            </View>
          </>
        ) : null}

        {mode === "device" ? (
          <>
            <FieldLabel>Product type</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker
                selectedValue={deviceKind}
                onValueChange={(v) => setDeviceKind(v as DeviceKind)}
              >
                {DEVICE_KINDS.map((k) => (
                  <Picker.Item key={k} label={PRODUCT_KIND_LABELS[k]} value={k} />
                ))}
              </Picker>
            </View>
            <FieldLabel>Product name</FieldLabel>
            <TextField value={name} onChangeText={setName} placeholder="Product name" />
          </>
        ) : null}

        {mode === "repair" ? (
          <>
            <FieldLabel>Phone model</FieldLabel>
            <TextField value={phoneModel} onChangeText={setPhoneModel} placeholder="e.g. Redmi Note 13" />
            <FieldLabel>Part type</FieldLabel>
            <View style={styles.pickerWrap}>
              <Picker selectedValue={partType} onValueChange={setPartType}>
                {REPAIR_PART_TYPES.map((p) => (
                  <Picker.Item key={p} label={p} value={p} />
                ))}
              </Picker>
            </View>
          </>
        ) : null}

        <FieldLabel>Buy price</FieldLabel>
        <TextField value={buyPrice} onChangeText={setBuyPrice} keyboardType="numeric" />
        <FieldLabel>{mode === "repair" ? "Repair charge" : "Sell price"}</FieldLabel>
        <TextField
          value={mode === "repair" ? repairCharge : sellPrice}
          onChangeText={mode === "repair" ? setRepairCharge : setSellPrice}
          keyboardType="numeric"
        />
        <FieldLabel>Min stock alert</FieldLabel>
        <TextField value={minStock} onChangeText={setMinStock} keyboardType="numeric" />
        <FieldLabel optional>Opening stock</FieldLabel>
        <TextField value={openingStock} onChangeText={setOpeningStock} keyboardType="numeric" />

        {formError ? <Text style={styles.error}>{formError}</Text> : null}
        {create.error ? <Text style={styles.error}>{(create.error as Error).message}</Text> : null}

        <View style={styles.submit}>
          <PrimaryButton
            label={create.isPending ? "Saving…" : "Create product"}
            loading={create.isPending}
            onPress={submit}
          />
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  tabs: { marginBottom: spacing.lg },
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
  tabText: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  tabTextActive: { color: colors.accent },
  tabHint: { fontSize: 10, color: colors.muted, marginTop: 2 },
  hint: { fontSize: 12, color: colors.muted, marginBottom: spacing.md, lineHeight: 18 },
  pickerWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    overflow: "hidden",
    marginBottom: spacing.md,
    backgroundColor: colors.card,
  },
  inlineAdd: { flexDirection: "row", gap: spacing.sm, alignItems: "center", marginBottom: spacing.md },
  error: { color: colors.red, marginVertical: spacing.sm },
  submit: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
