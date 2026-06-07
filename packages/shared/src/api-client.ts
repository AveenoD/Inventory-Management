import type { AuthResponse, LoginInput } from "./schemas/auth.js";
import type { BusinessMonthDto, CreateMonthInput, UpdateMonthInput } from "./schemas/month.js";
import type { DashboardResponse } from "./schemas/dashboard.js";
import type { PaginatedResponse } from "./schemas/pagination.js";
import type { TodaySummary } from "./schemas/today.js";
import type {
  CoverTypeDto,
  PhoneModelDto,
  ProductDto,
  ProductKind,
  SaleDto,
} from "./schemas/product.js";
import type {
  CreateProductInput,
  CreateSaleInput,
  StockInInput,
} from "./schemas/product.js";
import type {
  RechargeBatchInput,
  TransferEntryInput,
  RepairJobInput,
  RepairIntakeInput,
  UpdateRepairJobInput,
  RepairJobDto,
  PartyInput,
  PartyTransactionInput,
} from "./schemas/entries.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

export function createApiClient(baseUrl: string, getToken?: () => string | null) {
  async function request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = getToken?.();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        signal: options.signal ?? controller.signal,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new ApiError(
          408,
          "Request timed out. Check that the API is running and the database is reachable.",
        );
      }
      throw new ApiError(
        0,
        e instanceof Error ? e.message : "Network error — is the API running on port 4000?",
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new ApiError(res.status, body.error ?? body.message ?? res.statusText);
    }
    return body as T;
  }

  return {
    login: (data: LoginInput) =>
      request<AuthResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getMonths: (page = 1, limit = 12) =>
      request<PaginatedResponse<BusinessMonthDto>>(
        `/api/v1/months?page=${page}&limit=${limit}`,
      ),
    createMonth: (data: CreateMonthInput) =>
      request<BusinessMonthDto>("/api/v1/months", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getMonth: (id: string) => request<BusinessMonthDto>(`/api/v1/months/${id}`),
    updateMonth: (id: string, data: UpdateMonthInput) =>
      request<BusinessMonthDto>(`/api/v1/months/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    getDashboard: (monthId: string) =>
      request<DashboardResponse>(`/api/v1/months/${monthId}/dashboard`),
    bulkMoneyTransfer: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/money-transfers/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    getMoneyTransfers: (monthId: string, page = 1, limit = 31) =>
      request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/money-transfers?page=${page}&limit=${limit}`,
      ),
    bulkRecharge: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/recharges/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    getRecharges: (monthId: string, page = 1, limit = 31) =>
      request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/recharges?page=${page}&limit=${limit}`,
      ),
    bulkRepair: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/repairs/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    bulkMobile: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/mobile-accessories/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    bulkExtraIncome: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/extra-income/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    bulkShopExpense: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/shop-expenses/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    createExpenseEntry: (
      monthId: string,
      body: { date: string; category: string; amount: number; description?: string },
    ) =>
      request(`/api/v1/months/${monthId}/expenses/entry`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    getShopExpenses: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/shop-expenses?${q}`,
      );
    },
    bulkDamage: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/damages/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    getDamages: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/damages?${q}`,
      );
    },
    bulkParty: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/parties/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    bulkUdhhar: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/udhhar/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    getUdhhar: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/udhhar?${q}`,
      );
    },
    bulkBank: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/bank-balances/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    getBankBalances: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/bank-balances?${q}`,
      );
    },
    bulkWithdrawal: (monthId: string, entries: unknown[]) =>
      request(`/api/v1/months/${monthId}/withdrawals/bulk`, {
        method: "PUT",
        body: JSON.stringify({ entries }),
      }),
    createWithdrawal: (monthId: string, body: { date: string; amount: number; description?: string }) =>
      request<{ ok: boolean; amount: string; availableProfit: string }>(
        `/api/v1/months/${monthId}/withdrawals`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      ),
    getWithdrawals: (monthId: string, page = 1, limit = 31, from?: string, to?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/withdrawals?${q}`,
      );
    },
    getParties: (monthId: string, page = 1, search?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (search) q.set("search", search);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/parties?${q}`,
      );
    },
    health: () => request<{ status: string }>("/health"),
    getToday: (date?: string) => {
      const q = new URLSearchParams();
      if (date) q.set("date", date);
      const suffix = q.toString() ? `?${q.toString()}` : "";
      return request<TodaySummary>(`/api/v1/today${suffix}`);
    },
    getProducts: (
      page = 1,
      search?: string,
      kind?: ProductKind,
      limit = 50,
      excludeKinds?: ProductKind[],
      filters?: {
        phoneModelId?: string;
        coverTypeId?: string;
        coverTypeName?: string;
        segment?: "covers" | "other_accessories";
      },
    ) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) q.set("search", search);
      if (kind) q.set("kind", kind);
      if (excludeKinds?.length) q.set("excludeKinds", excludeKinds.join(","));
      if (filters?.phoneModelId) q.set("phoneModelId", filters.phoneModelId);
      if (filters?.coverTypeId) q.set("coverTypeId", filters.coverTypeId);
      if (filters?.coverTypeName) q.set("coverTypeName", filters.coverTypeName);
      if (filters?.segment) q.set("segment", filters.segment);
      return request<PaginatedResponse<ProductDto>>(`/api/v1/inventory/products?${q}`);
    },
    async getAllProducts(search?: string, kind?: ProductKind) {
      const pageSize = 100;
      const first = await request<PaginatedResponse<ProductDto>>(
        `/api/v1/inventory/products?${new URLSearchParams({
          page: "1",
          limit: String(pageSize),
          ...(search ? { search } : {}),
          ...(kind ? { kind } : {}),
        })}`,
      );
      const items = [...first.data];
      for (let page = 2; page <= first.meta.totalPages; page++) {
        const next = await request<PaginatedResponse<ProductDto>>(
          `/api/v1/inventory/products?${new URLSearchParams({
            page: String(page),
            limit: String(pageSize),
            ...(search ? { search } : {}),
            ...(kind ? { kind } : {}),
          })}`,
        );
        items.push(...next.data);
      }
      return { data: items, meta: first.meta };
    },
    getPhoneModels: () =>
      request<{ data: PhoneModelDto[] }>("/api/v1/inventory/phone-models"),
    createPhoneModel: (name: string) =>
      request<PhoneModelDto>("/api/v1/inventory/phone-models", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    getCoverTypes: (phoneModelId?: string) => {
      const q = phoneModelId
        ? `?${new URLSearchParams({ phoneModelId })}`
        : "";
      return request<{ data: CoverTypeDto[] }>(`/api/v1/inventory/cover-types${q}`);
    },
    createCoverType: (phoneModelId: string, name: string) =>
      request<CoverTypeDto>("/api/v1/inventory/cover-types", {
        method: "POST",
        body: JSON.stringify({ phoneModelId, name }),
      }),
    getLowStock: () =>
      request<{ data: Array<{ id: string; name: string; stockQty: number; minStock: number }> }>(
        "/api/v1/inventory/products/low-stock",
      ),
    getCoverProductStats: () =>
      request<{
        byModel: Array<{ phoneModelId: string; count: number }>;
        byType: Array<{ name: string; count: number }>;
      }>("/api/v1/inventory/products/covers-stats"),
    createProduct: (data: CreateProductInput) =>
      request<ProductDto>("/api/v1/inventory/products", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getProduct: (id: string) =>
      request<ProductDto>(`/api/v1/inventory/products/${id}`),
    updateProduct: (id: string, data: Partial<CreateProductInput>) =>
      request<ProductDto>(`/api/v1/inventory/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteProduct: (id: string) =>
      request<void>(`/api/v1/inventory/products/${id}`, { method: "DELETE" }),
    stockIn: (data: StockInInput) =>
      request<{ stockQty: number }>("/api/v1/inventory/stock/in", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getSales: (page = 1, date?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (date) q.set("date", date);
      return request<PaginatedResponse<SaleDto>>(`/api/v1/inventory/sales?${q}`);
    },
    createSale: (data: CreateSaleInput) =>
      request<SaleDto>("/api/v1/inventory/sales", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteSale: (saleId: string) =>
      request<void>(`/api/v1/inventory/sales/${saleId}`, { method: "DELETE" }),
    getCategories: () =>
      request<{ data: Array<{ id: string; name: string }> }>("/api/v1/inventory/categories"),
    createCategory: (name: string) =>
      request<{ id: string; name: string }>("/api/v1/inventory/categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    getRechargeEntries: (monthId: string, page = 1, date?: string, limit = 50) => {
      const q = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (date) q.set("date", date);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/recharge-entries?${q}`,
      );
    },
    createRechargeEntry: (monthId: string, data: RechargeBatchInput) =>
      request(`/api/v1/months/${monthId}/recharge-entries`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateRechargeEntry: (monthId: string, entryId: string, data: RechargeBatchInput) =>
      request(`/api/v1/months/${monthId}/recharge-entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteRechargeEntry: (monthId: string, entryId: string) =>
      request(`/api/v1/months/${monthId}/recharge-entries/${entryId}`, { method: "DELETE" }),
    getTransferEntries: (monthId: string, page = 1, date?: string) => {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (date) q.set("date", date);
      return request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/transfer-entries?${q}`,
      );
    },
    createTransferEntry: (monthId: string, data: TransferEntryInput) =>
      request(`/api/v1/months/${monthId}/transfer-entries`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteTransferEntry: (monthId: string, entryId: string) =>
      request(`/api/v1/months/${monthId}/transfer-entries/${entryId}`, { method: "DELETE" }),
    getRepairJobs: (monthId: string, page = 1, opts?: { date?: string; status?: string }) => {
      const q = new URLSearchParams({ page: String(page), limit: "50" });
      if (opts?.date) q.set("date", opts.date);
      if (opts?.status) q.set("status", opts.status);
      return request<PaginatedResponse<RepairJobDto>>(
        `/api/v1/months/${monthId}/repair-jobs?${q}`,
      );
    },
    createRepairIntake: (monthId: string, data: RepairIntakeInput) =>
      request<RepairJobDto>(`/api/v1/months/${monthId}/repair-jobs/intake`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    createRepairJob: (monthId: string, data: RepairJobInput) =>
      request<RepairJobDto>(`/api/v1/months/${monthId}/repair-jobs`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    updateRepairJob: (monthId: string, jobId: string, data: UpdateRepairJobInput) =>
      request<RepairJobDto>(`/api/v1/months/${monthId}/repair-jobs/${jobId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    deleteRepairJob: (monthId: string, jobId: string) =>
      request<void>(`/api/v1/months/${monthId}/repair-jobs/${jobId}`, { method: "DELETE" }),
    getPartyList: () =>
      request<{ data: Array<{ id: string; name: string; phone: string | null }> }>(
        "/api/v1/parties",
      ),
    createParty: (data: PartyInput) =>
      request("/api/v1/parties", { method: "POST", body: JSON.stringify(data) }),
    getPartyTransactions: (monthId: string, page = 1) =>
      request<PaginatedResponse<unknown>>(
        `/api/v1/months/${monthId}/party-transactions?page=${page}&limit=50`,
      ),
    createPartyTransaction: (monthId: string, data: PartyTransactionInput) =>
      request(`/api/v1/months/${monthId}/party-transactions`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deletePartyTransaction: (monthId: string, txId: string) =>
      request<void>(`/api/v1/months/${monthId}/party-transactions/${txId}`, {
        method: "DELETE",
      }),
    importExcel: async (file: File, year: number, month: number) => {
      const token = getToken?.();
      const form = new FormData();
      form.append("file", file);
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
  };
}
