"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(
  () => import("./app-shell").then((m) => ({ default: m.AppShell })),
  {
    ssr: false,
    loading: () => (
      <div className="page-loader" aria-busy="true">
        <div className="spinner" />
      </div>
    ),
  },
);

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
