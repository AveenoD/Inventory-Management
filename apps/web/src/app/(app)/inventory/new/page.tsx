"use client";

import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/inventory/product-form";
import { PageLoader } from "@/components/ui/page-loader";

export default function NewProductPage() {
  return (
    <div className="page-centered">
      <Link href="/inventory" className="page-back-link">
        <ArrowLeft size={16} aria-hidden />
        Back to inventory
      </Link>
      <PageHeader title="Add product" subtitle="Choose what you are adding, then fill the form" />
      <Suspense fallback={<PageLoader message="Loading form…" />}>
        <ProductForm />
      </Suspense>
    </div>
  );
}
