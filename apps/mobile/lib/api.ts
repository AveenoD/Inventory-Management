import { createApiClient, ApiError } from "@sk-mobile/shared";
import { clearToken, getToken } from "./auth";

const PRODUCTION_API_URL = "https://sk-mobile-api.onrender.com";
const LOCAL_API_URL = "http://localhost:4000";

export function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  return __DEV__ ? LOCAL_API_URL : PRODUCTION_API_URL;
}

const baseUrl = resolveApiBaseUrl();
const client = createApiClient(baseUrl, getToken);

type LogoutHandler = () => void;
let onUnauthorized: LogoutHandler | null = null;

export function setUnauthorizedHandler(handler: LogoutHandler) {
  onUnauthorized = handler;
}

async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      await clearToken();
      onUnauthorized?.();
    }
    throw e;
  }
}

export type MobileFileUpload = {
  uri: string;
  name: string;
  mimeType?: string | null;
};

export const api = {
  login: (data: Parameters<typeof client.login>[0]) => client.login(data),
  getMonths: (page?: number, limit?: number) =>
    withAuth(() => client.getMonths(page, limit)),
  createMonth: (data: Parameters<typeof client.createMonth>[0]) =>
    withAuth(() => client.createMonth(data)),
  getMonth: (id: string) => withAuth(() => client.getMonth(id)),
  updateMonth: (id: string, data: Parameters<typeof client.updateMonth>[1]) =>
    withAuth(() => client.updateMonth(id, data)),
  getDashboard: (monthId: string) => withAuth(() => client.getDashboard(monthId)),
  getToday: (date?: string) => withAuth(() => client.getToday(date)),
  getProducts: (
    page?: number,
    search?: string,
    kind?: import("@sk-mobile/shared").ProductKind,
    limit?: number,
    excludeKinds?: import("@sk-mobile/shared").ProductKind[],
    filters?: Parameters<typeof client.getProducts>[5],
  ) => withAuth(() => client.getProducts(page, search, kind, limit, excludeKinds, filters)),
  getPhoneModels: () => withAuth(() => client.getPhoneModels()),
  createPhoneModel: (name: string) => withAuth(() => client.createPhoneModel(name)),
  getCoverTypes: (phoneModelId?: string) => withAuth(() => client.getCoverTypes(phoneModelId)),
  createCoverType: (phoneModelId: string, name: string) =>
    withAuth(() => client.createCoverType(phoneModelId, name)),
  getCoverProductStats: () => withAuth(() => client.getCoverProductStats()),
  createProduct: (data: Parameters<typeof client.createProduct>[0]) =>
    withAuth(() => client.createProduct(data)),
  getProduct: (id: string) => withAuth(() => client.getProduct(id)),
  updateProduct: (id: string, data: Parameters<typeof client.updateProduct>[1]) =>
    withAuth(() => client.updateProduct(id, data)),
  deleteProduct: (id: string) => withAuth(() => client.deleteProduct(id)),
  stockIn: (data: Parameters<typeof client.stockIn>[0]) =>
    withAuth(() => client.stockIn(data)),
  getCategories: () => withAuth(() => client.getCategories()),
  createCategory: (name: string) => withAuth(() => client.createCategory(name)),
  getSales: (page?: number, date?: string) =>
    withAuth(() => client.getSales(page, date)),
  createSale: (data: Parameters<typeof client.createSale>[0]) =>
    withAuth(() => client.createSale(data)),
  deleteSale: (saleId: string) => withAuth(() => client.deleteSale(saleId)),
  getRechargeEntries: (monthId: string, page?: number, date?: string, limit?: number) =>
    withAuth(() => client.getRechargeEntries(monthId, page, date, limit)),
  createRechargeEntry: (
    monthId: string,
    data: Parameters<typeof client.createRechargeEntry>[1],
  ) => withAuth(() => client.createRechargeEntry(monthId, data)),
  updateRechargeEntry: (
    monthId: string,
    entryId: string,
    data: Parameters<typeof client.updateRechargeEntry>[2],
  ) => withAuth(() => client.updateRechargeEntry(monthId, entryId, data)),
  deleteRechargeEntry: (monthId: string, entryId: string) =>
    withAuth(() => client.deleteRechargeEntry(monthId, entryId)),
  getTransferEntries: (monthId: string, page?: number, date?: string) =>
    withAuth(() => client.getTransferEntries(monthId, page, date)),
  createTransferEntry: (
    monthId: string,
    data: Parameters<typeof client.createTransferEntry>[1],
  ) => withAuth(() => client.createTransferEntry(monthId, data)),
  updateTransferEntry: (
    monthId: string,
    entryId: string,
    data: Parameters<typeof client.updateTransferEntry>[2],
  ) => withAuth(() => client.updateTransferEntry(monthId, entryId, data)),
  deleteTransferEntry: (monthId: string, entryId: string) =>
    withAuth(() => client.deleteTransferEntry(monthId, entryId)),
  getRepairJobs: (
    monthId: string,
    page?: number,
    opts?: Parameters<typeof client.getRepairJobs>[2],
  ) => withAuth(() => client.getRepairJobs(monthId, page, opts)),
  createRepairIntake: (
    monthId: string,
    data: Parameters<typeof client.createRepairIntake>[1],
  ) => withAuth(() => client.createRepairIntake(monthId, data)),
  createRepairJob: (monthId: string, data: Parameters<typeof client.createRepairJob>[1]) =>
    withAuth(() => client.createRepairJob(monthId, data)),
  updateRepairJob: (
    monthId: string,
    jobId: string,
    data: Parameters<typeof client.updateRepairJob>[2],
  ) => withAuth(() => client.updateRepairJob(monthId, jobId, data)),
  deleteRepairJob: (monthId: string, jobId: string) =>
    withAuth(() => client.deleteRepairJob(monthId, jobId)),
  getLowStock: () => withAuth(() => client.getLowStock()),
  getShopExpenses: (monthId: string, page?: number, limit?: number, from?: string, to?: string) =>
    withAuth(() => client.getShopExpenses(monthId, page, limit, from, to)),
  getDamages: (monthId: string, page?: number, limit?: number, from?: string, to?: string) =>
    withAuth(() => client.getDamages(monthId, page, limit, from, to)),
  getWithdrawals: (monthId: string, page?: number, limit?: number, from?: string, to?: string) =>
    withAuth(() => client.getWithdrawals(monthId, page, limit, from, to)),
  createExpenseEntry: (
    monthId: string,
    body: { date: string; category: string; amount: number; description?: string },
  ) => withAuth(() => client.createExpenseEntry(monthId, body)),
  updateExpenseEntry: (
    monthId: string,
    body: { date: string; category: string; amount: number; description?: string },
  ) => withAuth(() => client.updateExpenseEntry(monthId, body)),
  deleteExpenseEntry: (monthId: string, body: { date: string; category: string }) =>
    withAuth(() => client.deleteExpenseEntry(monthId, body)),
  createWithdrawal: (
    monthId: string,
    body: { date: string; amount: number; description?: string },
  ) => withAuth(() => client.createWithdrawal(monthId, body)),
  updateWithdrawal: (
    monthId: string,
    withdrawalId: string,
    body: { date?: string; amount?: number; description?: string },
  ) => withAuth(() => client.updateWithdrawal(monthId, withdrawalId, body)),
  deleteWithdrawal: (monthId: string, withdrawalId: string) =>
    withAuth(() => client.deleteWithdrawal(monthId, withdrawalId)),
  getPartyList: () => withAuth(() => client.getPartyList()),
  createParty: (data: Parameters<typeof client.createParty>[0]) =>
    withAuth(() => client.createParty(data)),
  getPartyTransactions: (monthId: string, page?: number) =>
    withAuth(() => client.getPartyTransactions(monthId, page)),
  createPartyTransaction: (
    monthId: string,
    data: Parameters<typeof client.createPartyTransaction>[1],
  ) => withAuth(() => client.createPartyTransaction(monthId, data)),
  deletePartyTransaction: (monthId: string, txId: string) =>
    withAuth(() => client.deletePartyTransaction(monthId, txId)),
  importExcel: async (file: MobileFileUpload, year: number, month: number) => {
    const token = getToken();
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as unknown as Blob);
    form.append("year", String(year));
    form.append("month", String(month));
    const res = await fetch(`${baseUrl}/api/v1/import/excel`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
    return body;
  },
  getNotifications: (page?: number, limit?: number) =>
    withAuth(() => client.getNotifications(page, limit)),
  markNotificationRead: (id: string) =>
    withAuth(() => client.markNotificationRead(id)),
  markAllNotificationsRead: () =>
    withAuth(() => client.markAllNotificationsRead()),
  registerPushDevice: (data: Parameters<typeof client.registerPushDevice>[0]) =>
    withAuth(() => client.registerPushDevice(data)),
  health: () => client.health(),
};

export { ApiError };
