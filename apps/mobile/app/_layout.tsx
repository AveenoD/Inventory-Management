import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { MonthProvider } from "@/contexts/month-context";
import { OfflineBanner } from "@/components/offline-banner";
import { usePushNotifications } from "@/lib/push";
import { colors } from "@/theme/tokens";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  usePushNotifications(isAuthenticated);

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/login");
    } else if (isAuthenticated && inAuthGroup) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, segments, router]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) return null;

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MonthProvider>
          <AuthGate>
            <StatusBar style="dark" />
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.pageBg } }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="(more)" />
            </Stack>
          </AuthGate>
        </MonthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
