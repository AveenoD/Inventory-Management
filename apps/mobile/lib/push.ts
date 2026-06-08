import Constants from "expo-constants";
import { useEffect } from "react";

/** Remote push is not available in Expo Go (SDK 53+). In-app inbox still works via API. */
export function usePushNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Constants.appOwnership === "expo") return;

    let cancelled = false;

    void import("./push-native")
      .then((mod) => {
        if (!cancelled) mod.setupPushNotifications();
      })
      .catch(() => {
        // Push optional in dev builds too
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
