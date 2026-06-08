import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import { Picker, type PickerProps } from "@react-native-picker/picker";
import { colors, radii } from "@/theme/tokens";

const PICKER_HEIGHT = 52;

export function FilterPicker<T extends string | number>({
  style,
  wrapStyle,
  mode,
  ...props
}: PickerProps<T> & { wrapStyle?: ViewStyle }) {
  return (
    <View style={[styles.wrap, wrapStyle]}>
      <Picker
        {...props}
        mode={Platform.OS === "android" ? "dropdown" : mode}
        style={[styles.picker, style]}
        itemStyle={Platform.OS === "ios" ? styles.item : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.input,
    backgroundColor: colors.card,
    minHeight: PICKER_HEIGHT,
    justifyContent: "center",
    overflow: "hidden",
  },
  picker: {
    width: "100%",
    height: PICKER_HEIGHT,
    color: colors.text,
    ...(Platform.OS === "android" ? { marginVertical: -4 } : {}),
  },
  item: {
    height: PICKER_HEIGHT,
    fontSize: 16,
  },
});
