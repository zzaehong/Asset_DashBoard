export type AccountType = "CASH" | "SAVINGS" | "INVESTMENT" | "DEBT" | "OTHER_ASSET";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  current_balance: string;
  as_of_date: string;
  currency: string;
  liquidity: "LIQUID" | "ILLIQUID";
  emergency_fund_eligible: boolean;
};

export type Event = {
  id: string;
  month: string;
  event_date: string | null;
  name: string;
  amount: string;
  type: string;
  status: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  recurrence_months: number | null;
  recurrence_until: string | null;
  note: string | null;
};

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
  if (!response.ok) throw new Error(await response.text());
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  accounts: () => request<Account[]>("/accounts"),
  events: () => request<Event[]>("/events"),
  forecast: (period: number) => request<Forecast>(`/forecast?period_months=${period}`),
  createAccount: (payload: Omit<Account, "id">) => request<Account>("/accounts", { method: "POST", body: JSON.stringify(payload) }),
  updateAccount: (id: string, payload: Omit<Account, "id">) => request<Account>(`/accounts/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteAccount: (id: string) => request<void>(`/accounts/${id}`, { method: "DELETE" }),
  createEvent: (payload: Omit<Event, "id">) => request<Event>("/events", { method: "POST", body: JSON.stringify(payload) }),
  updateEvent: (id: string, payload: Omit<Event, "id">) => request<Event>(`/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteEvent: (id: string) => request<void>(`/events/${id}`, { method: "DELETE" }),
};
