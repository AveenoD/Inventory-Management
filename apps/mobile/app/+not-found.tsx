import { View, Text, StyleSheet, Pressable } from "react-native";
import { Link, Stack } from "expo-router";
import { colors, spacing } from "@/theme/tokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>Page not found</Text>
        <Link href="/" asChild>
          <Pressable style={styles.link}>
            <Text style={styles.linkText}>Go to dashboard</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.pageBg,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginBottom: spacing.lg,
  },
  link: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  linkText: {
    color: colors.accent,
    fontWeight: "600",
    fontSize: 16,
  },
});
