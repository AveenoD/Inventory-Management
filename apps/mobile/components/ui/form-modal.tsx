import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function FormModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const body = scroll ? (
    <ScrollView
      style={styles.body}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.body}>{children}</View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {body}
        </View>
      </View>
    </Modal>
  );
}

export function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel = "Save",
  cancelLabel = "Cancel",
  loading,
  disabled,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={styles.actions}>
      <Pressable style={[styles.btn, styles.secondary]} onPress={onCancel}>
        <Text style={styles.secondaryText}>{cancelLabel}</Text>
      </Pressable>
      <Pressable
        style={[styles.btn, styles.primary, (loading || disabled) && styles.disabled]}
        onPress={onConfirm}
        disabled={loading || disabled}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>{confirmLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  sheet: {
    maxHeight: "90%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, paddingRight: spacing.md },
  title: { fontSize: 18, fontWeight: "700", color: colors.text },
  subtitle: { marginTop: 4, fontSize: 14, color: colors.muted },
  close: { fontSize: 20, color: colors.muted, padding: 4 },
  body: { padding: spacing.lg },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.input,
    alignItems: "center",
  },
  primary: { backgroundColor: colors.accent },
  primaryText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.text, fontWeight: "600", fontSize: 15 },
  disabled: { opacity: 0.6 },
});
