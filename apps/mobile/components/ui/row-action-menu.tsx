import { useState } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { MoreVertical } from "lucide-react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export type RowActionMenuItem = {
  key: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

export function RowActionMenu({
  items,
  disabled = false,
}: {
  items: RowActionMenuItem[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  function handlePress(item: RowActionMenuItem) {
    close();
    item.onPress();
  }

  if (items.length === 0) return null;

  return (
    <>
      <Pressable
        style={[styles.trigger, disabled && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
        disabled={disabled}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Actions"
      >
        <MoreVertical size={18} color={colors.text} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.overlay} onPress={close}>
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            {items.map((item, index) => (
              <Pressable
                key={item.key}
                style={[styles.item, index < items.length - 1 && styles.itemBorder]}
                onPress={() => handlePress(item)}
              >
                <Text style={[styles.itemText, item.danger && styles.itemDanger]}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.item, styles.cancelItem]} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 32,
    height: 32,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerDisabled: { opacity: 0.5 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  itemText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  itemDanger: { color: colors.red },
  cancelItem: { backgroundColor: colors.pageBg },
  cancelText: { fontSize: 16, fontWeight: "600", color: colors.muted },
});
