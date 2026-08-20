export type AccountType = "CASH" | "SAVINGS" | "INVESTMENT" | "DEBT" | "OTHER_ASSET";

export type AccountPayload = {
  name: string;
  type: AccountType;
  current_balance: string;
  as_of_date: string;
  currency: string;
  liquidity: "LIQUID" | "ILLIQUID";
  emergency_fund_eligible: boolean;
};

export type Account = AccountPayload & { id: string };

export type EventType = "INCOME" | "EXPENSE" | "TRANSFER" | "INVESTMENT_CONTRIBUTION" | "DEBT_DRAW" | "DEBT_PRINCIPAL_REPAYMENT" | "DEBT_INTEREST" | "SAVINGS_MATURITY";
export type EventStatus = "PLANNED" | "CONFIRMED" | "CHANGED" | "CANCELLED";

export type EventPayload = {
  event_date: string;
  name: string;
  amount: string;
  type: EventType;
  status: EventStatus;
  source_account_id: string | null;
  destination_account_id: string | null;
  recurrence_months: number | null;
  recurrence_until: string | null;
  note: string | null;
};

export type Event = EventPayload & { id: string; month: string };

export type ForecastMonth = {
  month: string;
  balances: Record<string, string>;
  cash: string;
  assets: string;
  debt: string;
  net_worth: string;
  lowest_cash: string;
  lowest_cash_date: string | null;
};

export type Risk = { type: string; date: string; cash_balance: string; event_ids: string[] };
export type Forecast = { months: ForecastMonth[]; risks: Risk[] };

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { detail?: string };
      throw new Error(parsed.detail ?? body);
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error(body || `요청에 실패했습니다. (${response.status})`);
      throw error;
    }
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  accounts: () => request<Account[]>("/accounts"),
  events: () => request<Event[]>("/events"),
  forecast: (period: number) => request<Forecast>(`/forecast?period_months=${period}`),
  createAccount: (payload: AccountPayload) => request<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateAccount: (id: string, payload: AccountPayload) => request<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAccount: (id: string) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  createEvent: (payload: EventPayload) => request<Event>("/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: string, payload: EventPayload) => request<Event>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: "DELETE" }),
};
