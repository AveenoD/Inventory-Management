export type TodaySummary = {
  date: string;
  monthId: string;
  year: number;
  month: number;
  salesTotal: string;
  salesProfit: string;
  salesCount: number;
  rechargeTotal: string;
  transferTotal: string;
  activeRepairs: number;
  repairDelivered: number;
  repairProfit: string;
  repairPendingCount: number;
  repairPendingBalance: string;
  /** All repaired-but-not-delivered jobs (any date/month) */
  repairUndeliveredCount: number;
  lowStockCount: number;
  lowStockItems: Array<{
    id: string;
    name: string;
    stockQty: number;
    minStock: number;
  }>;
  salesLast7Days: Array<{
    date: string;
    total: string;
    profit: string;
  }>;
  recentActivity: Array<{
    at: string;
    type: "SALE" | "RECHARGE" | "TRANSFER" | "REPAIR";
    title: string;
    subtitle?: string;
    amount?: string;
  }>;
  /** Month-to-date business totals (Vyapar-style) */
  openingBalance: string;
  remainingBalance: string;
  monthSalesTotal: string;
  monthRechargeTotal: string;
  monthRechargeTransferTotal: string;
  monthRepairProfit: string;
  monthNetProfit: string;
  todayTotalProfit: string;
  stockValue: string;
  productCount: number;
  isFirstDayOfMonth: boolean;
  suggestedOpeningBalance: string | null;
  showOpeningBalancePrompt: boolean;
};
