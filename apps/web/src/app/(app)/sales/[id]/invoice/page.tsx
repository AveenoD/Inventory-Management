"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { PageLoader } from "@/components/ui/page-loader";
import { SaleInvoiceView } from "@/components/sales/sale-invoice";

export default function SaleInvoicePage() {
  const params = useParams();
  const saleId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ["sale-invoice", saleId],
    queryFn: () => api.getSaleInvoice(saleId),
    enabled: !!saleId,
  });

  if (isLoading) return <PageLoader message="Loading invoice…" />;
  if (error || !data) {
    return (
      <div className="card error-card">
        <p className="error">{(error as Error)?.message ?? "Invoice not found"}</p>
        <Link href="/sales">Back to sales</Link>
      </div>
    );
  }

  return (
    <div className="invoice-screen">
      <div className="invoice-back no-print">
        <Link href="/sales" className="invoice-back-link">
          <ArrowLeft size={16} />
          Back to sales
        </Link>
      </div>
      <SaleInvoiceView invoice={data} />
    </div>
  );
}
