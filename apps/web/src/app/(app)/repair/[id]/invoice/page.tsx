"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useMonthContext } from "@/contexts/month-context";
import { MonthGate } from "@/components/month-gate";
import { PageLoader } from "@/components/ui/page-loader";
import { RepairInvoiceView } from "@/components/repair/repair-invoice";

export default function RepairInvoicePage() {
  const params = useParams();
  const repairId = params.id as string;
  const { monthId } = useMonthContext();

  const { data: job, isPending, error } = useQuery({
    queryKey: ["repair-invoice", monthId, repairId],
    queryFn: () => api.getRepairJob(monthId!, repairId),
    enabled: !!monthId && !!repairId,
  });

  const { data: settings } = useQuery({
    queryKey: ["invoice-settings"],
    queryFn: () => api.getInvoiceSettings(),
  });

  if (isPending) return <PageLoader message="Loading invoice…" />;

  if (error || !job) {
    return (
      <div className="card error-card" style={{ maxWidth: 400, margin: "2rem auto" }}>
        <p className="error" style={{ marginBottom: "1rem" }}>{((error as Error)?.message) || "Invoice not found or API error"}</p>
        <Link href="/repair">← Back to Repairs</Link>
      </div>
    );
  }

  return (
    <MonthGate>
      <div className="invoice-screen">
        <div className="invoice-back no-print">
          <Link href="/repair" className="invoice-back-link">
            <ArrowLeft size={16} />
            Back to Repairs
          </Link>
        </div>
        <RepairInvoiceView
          job={job}
          shopName={settings?.shopName || undefined}
          logoDataUrl={settings?.logoDataUrl || null}
          address={settings?.address || null}
          phone={settings?.phone || null}
          warrantyText={settings?.warrantyText || null}
        />
      </div>
    </MonthGate>
  );
}
