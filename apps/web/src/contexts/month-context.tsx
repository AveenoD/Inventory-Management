"use client";

import { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

type MonthContextValue = {
  monthId: string | null;
  year: number;
  month: number;
  isLoading: boolean;
  error: Error | null;
};

const MonthContext = createContext<MonthContextValue | null>(null);

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function loadMonths() {
  const { year, month } = currentYearMonth();
  const res = await api.getMonths(1, 24);
  const list = res.data ?? [];
  const match = list.find((x) => x.year === year && x.month === month);
  return { res, match };
}

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const { year, month } = currentYearMonth();

  const { data, isLoading, error } = useQuery({
    queryKey: ["months", "context"],
    queryFn: loadMonths,
    enabled: !!getToken(),
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const monthId = useMemo(() => {
    if (data?.match) return data.match.id;
    return data?.res?.data?.[0]?.id ?? null;
  }, [data]);

  return (
    <MonthContext.Provider
      value={{
        monthId,
        year,
        month,
        isLoading,
        error: error as Error | null,
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
