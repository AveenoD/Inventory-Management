"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useMonthId } from "@/hooks/use-month";
import { DashboardView } from "@/components/dashboard-view";

export default function MonthDashboardPage() {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", monthId],
    queryFn: () => api.getDashboard(monthId!),
    enabled: !!monthId,
  });

  if (!monthId) return <p>Month not found. Create it from All months.</p>;
  if (isLoading) return <p>Loading dashboard…</p>;
  if (error) return <p className="error">{(error as Error).message}</p>;
  if (!data) return null;

  return <DashboardView data={data} />;
}
