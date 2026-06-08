import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { useMutation } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { api, type MobileFileUpload } from "@/lib/api";
import { ScreenShell } from "@/components/screen-shell";
import { TextField, FieldLabel, PrimaryButton } from "@/components/ui/form-fields";
import { colors, radii, spacing } from "@/theme/tokens";

export default function SettingsScreen() {
  const [file, setFile] = useState<MobileFileUpload | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const importExcel = useMutation({
    mutationFn: () => api.importExcel(file!, parseInt(year, 10), parseInt(month, 10)),
    onSuccess: (data) => setResult(data as Record<string, unknown>),
  });

  async function pickFile() {
    const res = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setFile({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType,
    });
    setResult(null);
  }

  return (
    <ScreenShell title="Settings" subtitle="Excel import & preferences" showBack>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Import Excel</Text>
        <Text style={styles.muted}>
          Upload your SK Mobile Shop workbook (.xlsx). Data imports into the selected month.
        </Text>

        <FieldLabel>Year</FieldLabel>
        <TextField value={year} onChangeText={setYear} keyboardType="numeric" />

        <FieldLabel>Month (1–12)</FieldLabel>
        <TextField value={month} onChangeText={setMonth} keyboardType="numeric" />

        <FieldLabel>Excel file</FieldLabel>
        <Pressable style={styles.fileBtn} onPress={() => void pickFile()}>
          <Text style={styles.fileBtnText}>{file ? file.name : "Choose .xlsx file"}</Text>
        </Pressable>

        {importExcel.error ? (
          <Text style={styles.error}>{(importExcel.error as Error).message}</Text>
        ) : null}

        <PrimaryButton
          label={importExcel.isPending ? "Importing…" : "Import"}
          loading={importExcel.isPending}
          disabled={!file}
          onPress={() => importExcel.mutate()}
        />
      </View>

      {result ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Import result</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.resultText}>{JSON.stringify(result, null, 2)}</Text>
          </ScrollView>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  muted: { color: colors.muted, lineHeight: 20, marginBottom: spacing.sm },
  fileBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    padding: spacing.md,
    backgroundColor: colors.pageBg,
    marginBottom: spacing.md,
  },
  fileBtnText: { color: colors.accent, fontWeight: "600" },
  error: { color: colors.red },
  resultText: {
    fontFamily: "monospace",
    fontSize: 12,
    color: colors.text,
  },
});
