"use client";

import { MonthNav } from "@/components/month-nav";
import { useMonthId } from "@/hooks/use-month";
import { useParams } from "next/navigation";

export default function MonthLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const year = parseInt(String(params.year), 10);
  const monthNum = parseInt(String(params.month), 10);
  const monthId = useMonthId(year, monthNum);

  return (
    <>
      {monthId && <MonthNav year={year} month={monthNum} monthId={monthId} />}
      <div>{children}</div>
    </>
  );
}
