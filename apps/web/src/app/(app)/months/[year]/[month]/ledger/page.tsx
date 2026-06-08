import LedgerPageClient from "./page-client";
import { firebaseYearMonthParams } from "@/lib/firebase-static";

export function generateStaticParams() {
  return firebaseYearMonthParams();
}

export default function LedgerPage() {
  return <LedgerPageClient />;
}
