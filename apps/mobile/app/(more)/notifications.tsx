import { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck } from "lucide-react-native";
import { ScreenShell } from "@/components/screen-shell";
import { PageLoader } from "@/components/ui/page-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { api } from "@/lib/api";
import { colors, radii, spacing } from "@/theme/tokens";
import type { NotificationDto } from "@sk-mobile/shared";

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

function typeLabel(type: NotificationDto["type"]) {
  switch (type) {
    case "LOW_STOCK":
      return "Stock";
    case "REPAIR_PICKUP":
      return "Pickup";
    case "REPAIR_RECEIVED":
      return "Repair";
    default:
      return "Alert";
  }
}

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(1, 50),
    refetchInterval: 60_000,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const unread = data?.meta.unreadCount ?? 0;
  const items = data?.data ?? [];

  return (
    <ScreenShell
      title="Notifications"
      subtitle={unread > 0 ? `${unread} unread` : "In-app inbox"}
      showBack
      headerAction={
        unread > 0 ? (
          <Pressable
            style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}
            onPress={() => markAll.mutate()}
            disabled={markAll.isPending}
            accessibilityLabel="Mark all read"
          >
            <CheckCheck size={20} color={colors.accent} />
          </Pressable>
        ) : undefined
      }
    >
      {isLoading ? (
        <PageLoader />
      ) : items.length === 0 ? (
        <EmptyState title="No notifications yet" description="Stock and repair alerts will appear here." />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />
          }
        >
          {items.map((n) => (
            <Pressable
              key={n.id}
              style={({ pressed }) => [
                styles.card,
                !n.readAt && styles.unread,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                if (!n.readAt) markRead.mutate(n.id);
              }}
            >
              <View style={styles.row}>
                <Text style={styles.type}>{typeLabel(n.type)}</Text>
                <Text style={styles.when}>{formatWhen(n.createdAt)}</Text>
              </View>
              <Text style={styles.title}>{n.title}</Text>
              <Text style={styles.body}>{n.body}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  unread: {
    borderColor: colors.accent,
    backgroundColor: "#f8fafc",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  type: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.accent,
  },
  when: { fontSize: 12, color: colors.muted },
  title: { fontSize: 15, fontWeight: "700", color: colors.text },
  body: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  markAll: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.7 },
});
