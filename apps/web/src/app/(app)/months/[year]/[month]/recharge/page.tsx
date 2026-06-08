import RechargePageClient from "./page-client";
import { firebaseYearMonthParams } from "@/lib/firebase-static";

export function generateStaticParams() {
  return firebaseYearMonthParams();
}

export default function RechargePage() {
  return <RechargePageClient />;
}
