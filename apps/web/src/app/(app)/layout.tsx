import { AppLayoutClient } from "@/components/app-shell/app-layout-client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutClient>{children}</AppLayoutClient>;
}
