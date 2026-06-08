import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

export async function hapticSuccess() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics unavailable on some devices/simulators
  }
}

export async function hapticLight() {
  if (Platform.OS === "web") return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // ignore
  }
}
