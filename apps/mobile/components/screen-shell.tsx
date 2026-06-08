import { View, ScrollView, StyleSheet, RefreshControl, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { colors, spacing } from "@/theme/tokens";
import { AppHeaderActions } from "@/components/app-header-actions";
import { PageHeader } from "@/components/ui/page-header";

export function ScreenShell({
  title,
  subtitle,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  showBack,
  backLabel,
  onBack,
  hideHeaderActions,
  headerAction,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  hideHeaderActions?: boolean;
  headerAction?: React.ReactNode;
}) {
  const router = useRouter();

  const header = (
    <View>
      {showBack ? (
        <Pressable
          style={styles.backRow}
          onPress={onBack ?? (() => router.back())}
        >
          <ChevronLeft size={22} color={colors.accent} />
          <Text style={styles.backText}>{backLabel ?? "Back"}</Text>
        </Pressable>
      ) : null}
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          headerAction ??
          (showBack || hideHeaderActions ? undefined : <AppHeaderActions />)
        }
      />
    </View>
  );

  if (!scroll) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.containerFlex}>
          <View style={styles.headerSection}>{header}</View>
          <View style={styles.bodyFlex}>{children}</View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.containerFlex}>
        <View style={styles.headerSection}>{header}</View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  containerFlex: {
    flex: 1,
    minHeight: 0,
  },
  bodyFlex: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: spacing.lg,
  },
  headerSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: spacing.sm,
  },
  backText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 15,
  },
});
