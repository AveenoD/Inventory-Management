"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMonthId(year: number, month: number) {
  const { data: months } = useQuery({
    queryKey: ["months", "list"],
    queryFn: () => api.getMonths(1, 100),
  });
  return months?.data.find((m) => m.year === year && m.month === month)?.id;
}
