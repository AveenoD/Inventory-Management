import StockInPageClient from "./stock-page-client";

import { firebaseInventoryIdParams } from "@/lib/firebase-static";

export function generateStaticParams() {
  return firebaseInventoryIdParams();
}

export default function StockInPage() {
  return <StockInPageClient />;
}
