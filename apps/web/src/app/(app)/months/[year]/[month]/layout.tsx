import MonthLayoutClient from "./month-layout-client";

import { firebaseYearMonthParams } from "@/lib/firebase-static";

export function generateStaticParams() {
  return firebaseYearMonthParams();
}

export default function MonthLayout({ children }: { children: React.ReactNode }) {
  return <MonthLayoutClient>{children}</MonthLayoutClient>;
}
