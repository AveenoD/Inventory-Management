import { View, Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, UserRound } from "lucide-react-native";
import { colors, radii, spacing } from "@/theme/tokens";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

export function AppHeaderActions() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(1, 1),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    retry: false,
  });

  const unread = data?.meta.unreadCount ?? 0;

  return (
    <View style={styles.row}>
      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={() => router.push("/notifications")}
        accessibilityLabel="Notifications"
      >
        <Bell size={22} color={colors.text} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
          </View>
        ) : null}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        onPress={() => router.push("/profile")}
        accessibilityLabel="Profile menu"
      >
        <UserRound size={22} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.input,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
  },
});
