"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyExpensesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/expenses");
  }, [router]);

  return null;
}
