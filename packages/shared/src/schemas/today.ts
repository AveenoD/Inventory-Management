export type TodaySummary = {
  date: string;
  monthId: string;
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
};
