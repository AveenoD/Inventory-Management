"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@sk-mobile/shared";
import { clearToken } from "@/lib/auth";

function onQueryError(error: unknown) {
  if (error instanceof ApiError && error.status === 401 && typeof window !== "undefined") {
    clearToken();
    window.location.href = "/login";
  }
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => {
              if (error instanceof ApiError) {
                if (error.status === 401 || error.status === 408 || error.status === 0) {
                  return false;
                }
              }
              return count < 1;
            },
          },
          mutations: {
            onError: onQueryError,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
