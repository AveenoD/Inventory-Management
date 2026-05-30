import { createApiClient, ApiError } from "@sk-mobile/shared";
import { getToken, clearToken } from "./auth";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const client = createApiClient(baseUrl, getToken);

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  } catch (e) {
    throw new ApiError(
      0,
      e instanceof Error ? e.message : "Network error — is the API running on port 4000?",
    );
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? body.message ?? res.statusText);
  return body as T;
}

async function withAuth<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401 && typeof window !== "undefined") {
      clearToken();
      window.location.replace("/login");
    }
    throw e;
  }
}

export const api = {
  login: (data: Parameters<typeof client.login>[0]) =>
    withAuth(() => client.login(data)),
  getMonths: (page?: number, limit?: number) =>
    withAuth(() => client.getMonths(page, limit)),
  createMonth: (data: Parameters<typeof client.createMonth>[0]) =>
    withAuth(() => client.createMonth(data)),
  getMonth: (id: string) => withAuth(() => client.getMonth(id)),
  getDashboard: (monthId: string) => withAuth(() => client.getDashboard(monthId)),
  getToday: (date?: string) => withAuth(() => client.getToday(date)),
  getProducts: (
    page?: number,
    search?: string,
    kind?: import("@sk-mobile/shared").ProductKind,
    limit?: number,
    excludeKinds?: import("@sk-mobile/shared").ProductKind[],
  ) => withAuth(() => client.getProducts(page, search, kind, limit, excludeKinds)),
  getAllProducts: (search?: string, kind?: import("@sk-mobile/shared").ProductKind) =>
    withAuth(() => client.getAllProducts(search, kind)),
  getCoverTypes: () => withAuth(() => client.getCoverTypes()),
  createCoverType: (name: string) => withAuth(() => client.createCoverType(name)),
  getLowStock: () => withAuth(() => client.getLowStock()),
  createProduct: (data: Parameters<typeof client.createProduct>[0]) =>
    withAuth(() => client.createProduct(data)),
  stockIn: (data: Parameters<typeof client.stockIn>[0]) =>
    withAuth(() => client.stockIn(data)),
  getSales: (page?: number, date?: string) =>
    withAuth(() => client.getSales(page, date)),
  createSale: (data: Parameters<typeof client.createSale>[0]) =>
    withAuth(() => client.createSale(data)),
  getCategories: () => withAuth(() => client.getCategories()),
  createCategory: (name: string) =>
    withAuth(() =>
      requestJson<{ id: string; name: string }>(`/api/v1/inventory/categories`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    ),
  getRechargeEntries: (monthId: string, page?: number, date?: string, limit?: number) =>
    withAuth(() => client.getRechargeEntries(monthId, page, date, limit)),
  createRechargeEntry: (
    monthId: string,
    data: Parameters<typeof client.createRechargeEntry>[1],
  ) => withAuth(() => client.createRechargeEntry(monthId, data)),
  deleteRechargeEntry: (monthId: string, entryId: string) =>
    withAuth(() => client.deleteRechargeEntry(monthId, entryId)),
  getTransferEntries: (monthId: string, page?: number, date?: string) =>
    withAuth(() => client.getTransferEntries(monthId, page, date)),
  createTransferEntry: (
    monthId: string,
    data: Parameters<typeof client.createTransferEntry>[1],
  ) => withAuth(() => client.createTransferEntry(monthId, data)),
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
  getPartyList: () => withAuth(() => client.getPartyList()),
  createParty: (data: Parameters<typeof client.createParty>[0]) =>
    withAuth(() => client.createParty(data)),
  getPartyTransactions: (monthId: string, page?: number) =>
    withAuth(() => client.getPartyTransactions(monthId, page)),
  createPartyTransaction: (
    monthId: string,
    data: Parameters<typeof client.createPartyTransaction>[1],
  ) => withAuth(() => client.createPartyTransaction(monthId, data)),
  importExcel: (file: File, year: number, month: number) =>
    client.importExcel(file, year, month),
  bulkMoneyTransfer: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkMoneyTransfer(monthId, entries)),
  getMoneyTransfers: (monthId: string, page?: number, limit?: number) =>
    withAuth(() => client.getMoneyTransfers(monthId, page, limit)),
  bulkRecharge: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkRecharge(monthId, entries)),
  getRecharges: (monthId: string, page?: number, limit?: number) =>
    withAuth(() => client.getRecharges(monthId, page, limit)),
  bulkRepair: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkRepair(monthId, entries)),
  bulkMobile: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkMobile(monthId, entries)),
  bulkExtraIncome: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkExtraIncome(monthId, entries)),
  bulkShopExpense: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkShopExpense(monthId, entries)),
  getShopExpenses: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return withAuth(() =>
      requestJson(`/api/v1/months/${monthId}/shop-expenses?${q.toString()}`),
    );
  },
  bulkDamage: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkDamage(monthId, entries)),
  getDamages: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return withAuth(() =>
      requestJson(`/api/v1/months/${monthId}/damages?${q.toString()}`),
    );
  },
  bulkParty: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkParty(monthId, entries)),
  bulkUdhhar: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkUdhhar(monthId, entries)),
  getUdhhar: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return withAuth(() =>
      requestJson(`/api/v1/months/${monthId}/udhhar?${q.toString()}`),
    );
  },
  bulkBank: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkBank(monthId, entries)),
  getBankBalances: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return withAuth(() =>
      requestJson(`/api/v1/months/${monthId}/bank-balances?${q.toString()}`),
    );
  },
  bulkWithdrawal: (monthId: string, entries: unknown[]) =>
    withAuth(() => client.bulkWithdrawal(monthId, entries)),
  getWithdrawals: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    return withAuth(() =>
      requestJson(`/api/v1/months/${monthId}/withdrawals?${q.toString()}`),
    );
  },
  getParties: (monthId: string, page?: number, search?: string) =>
    withAuth(() => client.getParties(monthId, page, search)),
  health: () => client.health(),
};
