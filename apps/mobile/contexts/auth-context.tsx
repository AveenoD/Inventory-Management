import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { clearToken, getToken, loadToken, setToken as persistToken } from "@/lib/auth";
import { setUnauthorizedHandler } from "@/lib/api";

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadToken().then((token) => {
      if (!mounted) return;
      setIsAuthenticated(!!token);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      router.replace("/login");
    });
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      isLoading,
      async login(token: string) {
        await persistToken(token);
        setIsAuthenticated(true);
        await queryClient.invalidateQueries({ queryKey: ["months"] });
        await queryClient.invalidateQueries({ queryKey: ["today"] });
      },
      async logout() {
        await clearToken();
        setIsAuthenticated(false);
        router.replace("/login");
      },
    }),
    [isAuthenticated, isLoading, router, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useHasToken() {
  return !!getToken();
}
