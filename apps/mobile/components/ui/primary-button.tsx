import { Pressable, Text, StyleSheet, type ViewStyle } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export function PrimaryButton({
  label,
  onPress,
  fullWidth = true,
  style,
  disabled,
}: {
  label: string;
  onPress: () => void;
  fullWidth?: boolean;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    borderRadius: radii.input,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
