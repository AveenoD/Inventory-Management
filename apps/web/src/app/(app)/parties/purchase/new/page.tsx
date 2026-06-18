import { Suspense } from "react";
import { PageLoader } from "@/components/ui/page-loader";
import NewPartyPurchasePage from "./purchase-form";

export default function PartyPurchaseNewPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading…" />}>
      <NewPartyPurchasePage />
    </Suspense>
  );
}
