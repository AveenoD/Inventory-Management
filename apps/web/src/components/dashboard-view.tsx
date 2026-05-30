import type { DashboardResponse } from "@sk-mobile/shared";
import { formatMoney } from "@/lib/format";

function Stat({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const tone = positive ? "positive" : negative ? "negative" : "";
  return (
    <div className="card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${tone}`}>
        {formatMoney(value)}
      </div>
    </div>
  );
}

export function DashboardView({ data }: { data: DashboardResponse }) {
  return (
    <div>
      <h2>Financial Dashboard</h2>
      <div className="grid-cards" style={{ marginTop: "1rem" }}>
        <Stat label="Opening Balance" value={data.openingBalance} />
        <Stat label="Total Income" value={data.totalIncome} positive />
        <Stat label="Total Expense" value={data.totalExpense} negative />
        <Stat label="Total Withdrawal" value={data.totalWithdrawal} negative />
        <Stat label="Damage & Loss" value={data.totalDamage} negative />
        <Stat label="Net Profit" value={data.netProfit} positive />
      </div>

      <h3 style={{ marginTop: "2rem" }}>Service-wise profit</h3>
      <div className="grid-cards">
        <Stat
          label="Recharge & Transfer"
          value={data.serviceWise.rechargeTransferProfit}
          positive
        />
        <Stat label="Mobile Repairing" value={data.serviceWise.repairProfit} positive />
        <Stat label="Mobile & Accessories" value={data.serviceWise.mobileProfit} positive />
        <Stat label="Extra Income" value={data.serviceWise.extraIncome} positive />
      </div>

      <h3 style={{ marginTop: "2rem" }}>Gross breakdown</h3>
      <div className="grid-cards">
        <Stat label="Money Transfer (profit)" value={data.gross.moneyTransferTotal} />
        <Stat label="Recharge (profit)" value={data.gross.rechargeTotal} />
        <Stat label="Repair Sales" value={data.gross.repairSale} />
        <Stat label="Repair Cost" value={data.gross.repairCost} negative />
        <Stat label="Mobile Sales" value={data.gross.mobileSale} />
        <Stat label="Mobile Cost" value={data.gross.mobileCost} negative />
      </div>
      <p style={{ color: "var(--muted)", marginTop: "0.5rem" }}>
        Repair jobs: {data.totals.repairJobs} | Repair sales: {formatMoney(data.totals.repairSale)} |
        Mobile sales: {formatMoney(data.totals.mobileSale)}
      </p>

      <h3 style={{ marginTop: "2rem" }}>Payment summary</h3>
      <div className="grid-cards">
        <Stat label="Cash & Portal Balance" value={data.paymentSummary.cashPortalBalance} />
        <Stat label="Bank Balance" value={data.paymentSummary.bankBalance} />
        <Stat label="Udhhar (net)" value={data.paymentSummary.udhharNet} />
        <Stat label="Party Payment Outstanding" value={data.paymentSummary.partyOutstanding} negative />
        <Stat label="Grand Total" value={data.paymentSummary.grandTotal} positive />
      </div>
    </div>
  );
}
