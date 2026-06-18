import { redirect } from "next/navigation";

export default function PurchaseRedirectPage() {
  redirect("/parties/purchase/new");
}
