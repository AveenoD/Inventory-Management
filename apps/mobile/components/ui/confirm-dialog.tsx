import { Modal, View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function ConfirmDialog({
  visible,
  title,
  message,
  onCancel,
  onConfirm,
  loading,
  confirmLabel = "Delete",
  destructive = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  loading?: boolean;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.secondary]} onPress={onCancel}>
              <Text style={styles.secondaryText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.btn,
                destructive ? styles.danger : styles.primary,
                loading && styles.disabled,
              ]}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  message: { marginTop: spacing.sm, fontSize: 14, color: colors.muted, lineHeight: 20 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.input,
    alignItems: "center",
  },
  primary: { backgroundColor: colors.accent },
  danger: { backgroundColor: colors.red },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { borderWidth: 1, borderColor: colors.border },
  secondaryText: { color: colors.text, fontWeight: "600" },
  disabled: { opacity: 0.6 },
});
