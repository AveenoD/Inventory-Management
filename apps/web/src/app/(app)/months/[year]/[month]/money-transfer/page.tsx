import MoneyTransferPageClient from "./page-client";
import { firebaseYearMonthParams } from "@/lib/firebase-static";

export function generateStaticParams() {
  return firebaseYearMonthParams();
}

export default function MoneyTransferPage() {
  return <MoneyTransferPageClient />;
}
