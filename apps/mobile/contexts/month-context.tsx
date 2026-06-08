import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

type MonthContextValue = {
  monthId: string | null;
  year: number;
  month: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

const MonthContext = createContext<MonthContextValue | null>(null);

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function pickMonthId(
  list: Array<{ id: string; year: number; month: number }>,
  year: number,
  month: number,
) {
  if (!list.length) return null;
  const match = list.find((x) => x.year === year && x.month === month);
  if (match) return match.id;
  const sorted = [...list].sort((a, b) => b.year - a.year || b.month - a.month);
  return sorted[0]?.id ?? null;
}

async function loadMonths() {
  const { year, month } = currentYearMonth();
  const res = await api.getMonths(1, 24);
  const list = res.data ?? [];
  const match = list.find((x) => x.year === year && x.month === month);
  return { res, match, monthId: pickMonthId(list, year, month) };
}

export function MonthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { year, month } = currentYearMonth();

  const { data, isLoading, error, isFetched, refetch } = useQuery({
    queryKey: ["months", "context"],
    queryFn: loadMonths,
    enabled: isAuthenticated && !authLoading,
    retry: 2,
    staleTime: 60_000,
  });

  const monthId = useMemo(() => {
    if (data?.monthId) return data.monthId;
    if (data?.match) return data.match.id;
    const list = data?.res?.data ?? [];
    return pickMonthId(list, year, month);
  }, [data, year, month]);

  const contextLoading =
    authLoading || (isAuthenticated && !isFetched && !error);

  return (
    <MonthContext.Provider
      value={{
        monthId,
        year,
        month,
        isLoading: contextLoading,
        error: error as Error | null,
        refetch: () => {
          void refetch();
        },
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonthContext() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonthContext must be used within MonthProvider");
  return ctx;
}
