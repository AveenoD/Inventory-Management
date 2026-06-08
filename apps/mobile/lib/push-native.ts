import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getEasProjectId(): string | null {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!id || id === "YOUR_EAS_PROJECT_ID" || !/^[0-9a-f-]{36}$/i.test(id)) {
    return null;
  }
  return id;
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId = getEasProjectId();
  if (!projectId) return null;

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export function setupPushNotifications() {
  void (async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      await api.registerPushDevice({
        platform: Platform.OS === "ios" ? "ios" : "android",
        token,
      });
    } catch {
      // ignore
    }
  })();
}
