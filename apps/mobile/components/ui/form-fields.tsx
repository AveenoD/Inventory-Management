import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  type TextStyle,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Calendar } from "lucide-react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function FieldLabel({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <Text style={styles.label}>
      {children}
      {optional ? <Text style={styles.optional}> (optional)</Text> : null}
    </Text>
  );
}

export function TextField({
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
  secureTextEntry,
  style,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address" | "phone-pad";
  multiline?: boolean;
  secureTextEntry?: boolean;
  style?: TextStyle;
}) {
  return (
    <TextInput
      style={[styles.input, multiline && styles.multiline, style]}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      multiline={multiline}
      secureTextEntry={secureTextEntry}
    />
  );
}

export function DateField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(`${value}T12:00:00`) : new Date();

  function onPick(_: DateTimePickerEvent, picked?: Date) {
    if (Platform.OS === "android") setOpen(false);
    if (picked) onChange(picked.toISOString().slice(0, 10));
  }

  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable style={styles.dateBtn} onPress={() => setOpen(true)}>
        <Calendar size={16} color={colors.muted} />
        <Text style={styles.dateText}>{value || "Select date"}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker value={date} mode="date" display="default" onChange={onPick} />
      ) : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, (loading || disabled) && styles.disabled]}
      onPress={onPress}
      disabled={loading || disabled}
    >
      <Text style={styles.primaryBtnText}>{loading ? "Please wait…" : label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[styles.secondaryBtn, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.secondaryBtnText, disabled && styles.secondaryBtnTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <TextInput
      style={styles.search}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  optional: { textTransform: "none", fontWeight: "400", color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    minHeight: 52,
    backgroundColor: colors.card,
  },
  dateText: { fontSize: 16, lineHeight: 20, color: colors.text },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    minWidth: 88,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  secondaryBtnText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  secondaryBtnTextDisabled: { color: colors.muted },
  disabled: { opacity: 0.6 },
  search: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.card,
  },
});
