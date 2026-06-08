import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  ArrowLeftRight,
  Calendar,
  ChevronRight,
  Package,
  Receipt,
  Settings,
  Users,
} from "lucide-react-native";
import { ScreenShell } from "@/components/screen-shell";
import { useAuth } from "@/contexts/auth-context";
import { colors, radii, spacing } from "@/theme/tokens";

const MENU = [
  { label: "Inventory", href: "/inventory", Icon: Package },
  { label: "Reports", href: "/reports", Icon: Receipt },
  { label: "Expenses", href: "/expenses", Icon: Receipt },
  { label: "Parties", href: "/parties", Icon: Users },
  { label: "Business Months", href: "/months", Icon: Calendar },
  { label: "Settings", href: "/settings", Icon: Settings },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <ScreenShell
      title="Profile"
      subtitle="Inventory, reports & settings"
      showBack
      backLabel="Back to Dashboard"
      onBack={() => router.replace("/")}
    >
      <View style={styles.menu}>
        {MENU.map(({ label, href, Icon }) => (
          <Pressable
            key={href}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => router.push(href as never)}
          >
            <Icon size={20} color={colors.accent} />
            <Text style={styles.rowLabel}>{label}</Text>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        ))}
        <Pressable
          style={({ pressed }) => [styles.row, styles.logout, pressed && styles.pressed]}
          onPress={() => logout()}
        >
          <ArrowLeftRight size={20} color={colors.red} />
          <Text style={[styles.rowLabel, styles.logoutText]}>Logout</Text>
        </Pressable>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  menu: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    fontWeight: "500",
  },
  pressed: { backgroundColor: colors.pageBg },
  logout: { borderBottomWidth: 0 },
  logoutText: { color: colors.red, fontWeight: "600" },
});
