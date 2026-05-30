"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { getToken } from "@/lib/auth";

/**
 * Client-only auth gate. Avoids useSyncExternalStore + SSR mismatch
 * that can leave the app stuck on the loading spinner.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useLayoutEffect(() => {
    if (getToken()) {
      setAllowed(true);
    } else {
      window.location.replace("/login");
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    const failSafe = setTimeout(() => {
      if (getToken()) {
        setAllowed(true);
      } else {
        window.location.replace("/login");
      }
    }, 800);
    return () => clearTimeout(failSafe);
  }, []);

  if (allowed !== true) {
    return (
      <div className="page-loader" aria-busy="true">
        <div className="spinner" />
      </div>
    );
  }

  return <>{children}</>;
}
