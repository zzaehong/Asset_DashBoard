import { FormEvent, ReactNode, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Account, AccountType, api, Event } from "./lib/api";

const currency = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const formatMoney = (value: string | number) => currency.format(Number(value));
const today = new Date().toISOString().slice(0, 10);
const month = `${today.slice(0, 7)}-01`;

export default function App() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(12);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: api.accounts });
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const forecast = useQuery({ queryKey: ["forecast", period], queryFn: () => api.forecast(period) });
  const refresh = () => queryClient.invalidateQueries();
  const createAccount = useMutation({ mutationFn: api.createAccount, onSuccess: refresh });
  const createEvent = useMutation({ mutationFn: api.createEvent, onSuccess: refresh });

  const latest = forecast.data?.months.at(-1);
  const cash = latest?.cash ?? "0";
  const netWorth = latest?.net_worth ?? "0";
  const chartData = forecast.data?.months.map((item) => ({
    month: item.month.slice(0, 7), cash: Number(item.cash), netWorth: Number(item.net_worth),
  })) ?? [];

  return (
    <main>
      <header>
        <div><p className="eyebrow">개인용 MVP</p><h1>월간 자산 흐름 플래너</h1></div>
        <label>분석 기간 <select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{[3, 6, 12].map((value) => <option key={value} value={value}>{value}개월</option>)}</select></label>
      </header>
      <section className="metrics">
        <Metric title="기간 말 현금" value={formatMoney(cash)} />
        <Metric title="기간 말 순자산" value={formatMoney(netWorth)} />
        <Metric title="감지된 위험" value={`${forecast.data?.risks.length ?? 0}건`} danger={Boolean(forecast.data?.risks.length)} />
      </section>
      <section className="panel chart"><h2>현금과 순자산 흐름</h2>{forecast.isError ? <Error /> : <ResponsiveContainer width="100%" height={260}><LineChart data={chartData}><XAxis dataKey="month" /><YAxis tickFormatter={(value) => `${Math.round(value / 10000)}만`} /><Tooltip formatter={(value) => formatMoney(value as number)} /><Line type="monotone" dataKey="cash" stroke="#e36d4f" strokeWidth={2} /><Line type="monotone" dataKey="netWorth" stroke="#216e67" strokeWidth={2} /></LineChart></ResponsiveContainer>}</section>
      <section className="grid">
        <div className="panel"><h2>계좌</h2><AccountForm onSubmit={(payload) => createAccount.mutate(payload)} /><List rows={accounts.data} render={(item) => <><strong>{item.name}</strong><span>{item.type} · {formatMoney(item.current_balance)}</span></>} /></div>
        <div className="panel"><h2>월별 이벤트</h2><EventForm accounts={accounts.data ?? []} onSubmit={(payload) => createEvent.mutate(payload)} /><List rows={events.data} render={(item) => <><strong>{item.name}</strong><span>{item.month.slice(0, 7)} · {item.type} · {formatMoney(item.amount)}</span></>} /></div>
      </section>
      <section className="panel"><h2>Risk Guard</h2>{forecast.data?.risks.length ? <ul className="risks">{forecast.data.risks.map((risk, index) => <li key={`${risk.type}-${index}`}><strong>{risk.type === "CASH_SHORTAGE" ? "현금 부족" : "투자자금 이동 후 현금 부족"}</strong><span>{risk.date} · {formatMoney(risk.cash_balance)}</span></li>)}</ul> : <p className="muted">현재 선택한 기간에 감지된 현금 위험이 없습니다.</p>}</section>
    </main>
  );
}

function Metric({ title, value, danger = false }: { title: string; value: string; danger?: boolean }) { return <article className={`metric ${danger ? "danger" : ""}`}><p>{title}</p><strong>{value}</strong></article>; }
function Error() { return <p className="error">예측 결과를 불러오지 못했습니다. 먼저 동일 기준일의 계좌를 등록해 주세요.</p>; }
function List<T>({ rows, render }: { rows?: T[]; render: (item: T) => ReactNode }) { return <ul className="list">{rows?.length ? rows.map((row, index) => <li key={index}>{render(row)}</li>) : <li className="muted">등록된 항목이 없습니다.</li>}</ul>; }

function AccountForm({ onSubmit }: { onSubmit: (payload: Omit<Account, "id">) => void }) {
  const [type, setType] = useState<AccountType>("CASH");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: String(data.get("name")), type, current_balance: String(data.get("balance")), as_of_date: String(data.get("asOf")), currency: "KRW", liquidity: "LIQUID", emergency_fund_eligible: Boolean(data.get("emergency")) }); event.currentTarget.reset(); }
  return <form onSubmit={submit}><input name="name" placeholder="계좌 이름" required /><select value={type} onChange={(event) => setType(event.target.value as AccountType)}>{["CASH", "SAVINGS", "INVESTMENT", "DEBT", "OTHER_ASSET"].map((item) => <option key={item}>{item}</option>)}</select><input name="balance" type="number" min="0" placeholder="현재 잔액" required /><input name="asOf" type="date" defaultValue={today} required /><button>계좌 추가</button></form>;
}

function EventForm({ accounts, onSubmit }: { accounts: Account[]; onSubmit: (payload: Omit<Event, "id">) => void }) {
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: String(data.get("name")), month: String(data.get("month")), event_date: String(data.get("date")) || null, amount: String(data.get("amount")), type: String(data.get("type")), status: "PLANNED", source_account_id: String(data.get("source")) || null, destination_account_id: String(data.get("destination")) || null }); event.currentTarget.reset(); }
  return <form onSubmit={submit}><input name="name" placeholder="사건 이름" required /><select name="type">{["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT_CONTRIBUTION", "DEBT_DRAW", "DEBT_PRINCIPAL_REPAYMENT", "DEBT_INTEREST", "SAVINGS_MATURITY"].map((item) => <option key={item}>{item}</option>)}</select><input name="amount" type="number" min="1" placeholder="금액" required /><input name="month" type="date" defaultValue={month} required /><input name="date" type="date" /><select name="source"><option value="">출발 계좌</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><select name="destination"><option value="">도착 계좌</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button disabled={!accounts.length}>이벤트 추가</button></form>;
}
