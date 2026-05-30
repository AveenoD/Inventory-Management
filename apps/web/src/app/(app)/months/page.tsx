import { AuthGuard } from "@/components/auth-guard";
import { MonthsList } from "./months-list";

export default function MonthsPage() {
  return (
    <AuthGuard>
      <MonthsList />
    </AuthGuard>
  );
}
