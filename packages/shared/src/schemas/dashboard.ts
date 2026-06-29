export type DashboardResponse = {
  openingBalance: string;
  totalIncome: string;
  totalExpense: string;
  totalWithdrawal: string;
  totalDamage: string;
  netProfit: string;
  serviceWise: {
    rechargeTransferProfit: string;
    repairProfit: string;
    mobileProfit: string;
    extraIncome: string;
  };
  gross: {
    moneyTransferTotal: string;
    rechargeTotal: string;
    repairSale: string;
    repairCost: string;
    mobileSale: string;
    mobileCost: string;
  };
  paymentSummary: {
    cashPortalBalance: string;
    bankBalance: string;
    udhharNet: string;
    partyOutstanding: string;
    grandTotal: string;
  };
  totals: {
    repairJobs: number;
    salesCount?: number;
    rechargeCount?: number;
    transferCount?: number;
    repairSale: string;
    mobileSale: string;
  };
};
