"use client";

import { useMonthContext } from "@/contexts/month-context";
import { PageLoader } from "@/components/ui/page-loader";

export function MonthGate({ children }: { children: React.ReactNode }) {
  const { monthId, isLoading, error } = useMonthContext();

  if (isLoading) {
    return <PageLoader message="Preparing business month…" />;
  }

  if (error) {
    const timedOut = error.message.toLowerCase().includes("timed out");
    return (
      <div className="card error-card">
        <h3>Could not load month</h3>
        <p className="error">{error.message}</p>
        <p className="muted">
          {timedOut
            ? "Database connection is slow or down. Check Supabase status and restart the API."
            : "Check that the API is running on port 4000 and you are logged in."}
        </p>
      </div>
    );
  }

  if (!monthId) {
    return (
      <div className="card error-card">
        <h3>No business month</h3>
        <p className="muted">
          Go to <a href="/months">Months</a> and create a month for the current period.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
