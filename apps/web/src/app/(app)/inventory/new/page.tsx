"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ProductForm } from "@/components/inventory/product-form";

export default function NewProductPage() {
  return (
    <div className="page-centered">
      <PageHeader title="Add product" subtitle="Mobile, covers, repair parts, audio & chargers" />
      <ProductForm />
    </div>
  );
}
