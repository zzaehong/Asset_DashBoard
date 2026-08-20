import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Account, AccountType, api, Event } from "./lib/api";
import { occurrenceDateForMonth, shiftMonth } from "./lib/recurrence";

const currency = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const formatMoney = (value: string | number) => currency.format(Number(value));
const today = new Date().toISOString().slice(0, 10);
const currentMonth = today.slice(0, 7);

type Page = "dashboard" | "monthly" | "accounts" | "events";
type ChartMetric = "cash" | "netWorth";
type ChartPoint = { month: string; cash: number; netWorth: number; cashChange: number; netWorthChange: number; eventCount: number };

export default function App() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState<Page>("dashboard");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerCloseButtonRef = useRef<HTMLButtonElement>(null);
  const [period, setPeriod] = useState(12);
  const accounts = useQuery({ queryKey: ["accounts"], queryFn: api.accounts });
  const events = useQuery({ queryKey: ["events"], queryFn: api.events });
  const forecast = useQuery({ queryKey: ["forecast", period], queryFn: () => api.forecast(period) });
  const refresh = () => queryClient.invalidateQueries();
  const createAccount = useMutation({ mutationFn: api.createAccount, onSuccess: refresh });
  const updateAccount = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Omit<Account, "id"> }) => api.updateAccount(id, payload), onSuccess: refresh });
  const createEvent = useMutation({ mutationFn: api.createEvent, onSuccess: refresh });
  const updateEvent = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: Omit<Event, "id"> }) => api.updateEvent(id, payload), onSuccess: refresh });
  const deleteEvent = useMutation({ mutationFn: api.deleteEvent, onSuccess: refresh });
  const deleteAccount = useMutation({ mutationFn: api.deleteAccount, onSuccess: refresh });
  const orderedEvents = useMemo(() => [...(events.data ?? [])].sort((a, b) => eventDate(a).localeCompare(eventDate(b))), [events.data]);

  const latest = forecast.data?.months.at(-1);
  const chartData = forecast.data?.months.map((item, index, months) => ({
    month: item.month.slice(0, 7),
    cash: Number(item.cash),
    netWorth: Number(item.net_worth),
    cashChange: Number(item.cash) - Number(months[index - 1]?.cash ?? item.cash),
    netWorthChange: Number(item.net_worth) - Number(months[index - 1]?.net_worth ?? item.net_worth),
    eventCount: orderedEvents.filter((event) => occurrenceDateForMonth(eventDate(event), event.recurrence_months, event.recurrence_until, item.month.slice(0, 7))).length,
  })) ?? [];
  const accountList = accounts.data ?? [];

  useEffect(() => {
    if (!isMenuOpen) return;
    drawerCloseButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    window.setTimeout(() => menuButtonRef.current?.focus(), 0);
  };

  const selectPage = (nextPage: Page) => {
    setPage(nextPage);
    setIsMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <button className={`drawer-backdrop ${isMenuOpen ? "open" : ""}`} aria-label="메뉴 닫기" tabIndex={isMenuOpen ? 0 : -1} onClick={closeMenu} />
      <aside className={`sidebar ${isMenuOpen ? "open" : ""}`} id="main-navigation" aria-label="주 메뉴">
        <div className="sidebar-brand"><div><p className="eyebrow">개인용 MVP</p><strong>월간 자산 흐름 플래너</strong></div><button ref={drawerCloseButtonRef} className="drawer-close" aria-label="메뉴 닫기" onClick={closeMenu}><span aria-hidden="true">×</span></button></div>
        <SidebarNav page={page} onSelect={selectPage} />
      </aside>
      <main className="app-content">
        <header className="app-header">
          <button ref={menuButtonRef} className="menu-button secondary" aria-label="메뉴 열기" aria-controls="main-navigation" aria-expanded={isMenuOpen} onClick={() => setIsMenuOpen(true)}><span aria-hidden="true">☰</span></button>
          <div className="page-intro"><h1>{pageTitle(page)}</h1><p className="intro">앞으로 일어날 중요한 재무 사건을 입력하고, 현금과 순자산의 흐름을 확인하세요.</p></div>
          {page === "dashboard" && <label className="period-control">분석 기간<select value={period} onChange={(event) => setPeriod(Number(event.target.value))}>{[3, 6, 12].map((value) => <option key={value} value={value}>{value}개월</option>)}</select></label>}
        </header>

        {page === "dashboard" && <Dashboard accounts={accountList} events={orderedEvents} chartData={chartData} latest={latest} risks={forecast.data?.risks ?? []} forecastError={forecast.isError} onAddAccount={() => selectPage("accounts")} onManageEvents={() => selectPage("events")} onDeleteAccount={(id) => deleteAccount.mutate(id)} />}
        {page === "monthly" && <MonthlyPlanPage events={orderedEvents} onManageEvents={() => selectPage("events")} />}
        {page === "accounts" && <AccountsPage accounts={accountList} events={orderedEvents} onBack={() => selectPage("dashboard")} onCreate={(payload) => createAccount.mutate(payload)} onUpdate={(id, payload) => updateAccount.mutate({ id, payload })} onDelete={(id) => deleteAccount.mutate(id)} />}
        {page === "events" && <EventsPage accounts={accountList} events={orderedEvents} onBack={() => selectPage("dashboard")} onCreate={(payload) => createEvent.mutate(payload)} onUpdate={(id, payload) => updateEvent.mutate({ id, payload })} onDelete={(id) => deleteEvent.mutate(id)} />}
      </main>
    </div>
  );
}

function SidebarNav({ page, onSelect }: { page: Page; onSelect: (page: Page) => void }) {
  const items: { page: Page; label: string; icon: string }[] = [
    { page: "dashboard", label: "대시보드", icon: "▦" },
    { page: "monthly", label: "월별 계획", icon: "□" },
    { page: "accounts", label: "계좌 관리", icon: "₩" },
    { page: "events", label: "이벤트 관리", icon: "+" },
  ];
  return <nav className="nav">{items.map((item) => <button key={item.page} className={page === item.page ? "active" : "quiet"} aria-current={page === item.page ? "page" : undefined} onClick={() => onSelect(item.page)}><span className="nav-icon" aria-hidden="true">{item.icon}</span>{item.label}</button>)}</nav>;
}

function MonthlyPlanPage({ events, onManageEvents }: { events: Event[]; onManageEvents: () => void }) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const monthlyEvents = useMemo(() => events.flatMap((item) => {
    const occurrenceDate = occurrenceDateForMonth(eventDate(item), item.recurrence_months, item.recurrence_until, selectedMonth);
    return occurrenceDate ? [{ ...item, id: `${item.id}:${occurrenceDate}`, event_date: occurrenceDate }] : [];
  }).sort((a, b) => eventDate(a).localeCompare(eventDate(b))), [events, selectedMonth]);

  return <section className="panel monthly-plan"><SectionHeading title="월별 계획" description="선택한 달의 일회성 이벤트와 반복 이벤트 발생분을 날짜순으로 확인합니다." actions={<button onClick={onManageEvents}>이벤트 추가·수정</button>} /><div className="month-controls"><button className="secondary" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}>이전 달</button><label>계획 월<input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label><button className="secondary" onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}>다음 달</button></div><div className="month-summary"><strong>{selectedMonth}</strong><span>예정된 이벤트 {monthlyEvents.length}건</span></div><EventTimeline events={monthlyEvents} /></section>;
}

function Dashboard({ accounts, events, chartData, latest, risks, forecastError, onAddAccount, onManageEvents, onDeleteAccount }: { accounts: Account[]; events: Event[]; chartData: ChartPoint[]; latest?: { balances: Record<string, string>; cash: string; net_worth: string }; risks: { type: string; date: string; cash_balance: string }[]; forecastError: boolean; onAddAccount: () => void; onManageEvents: () => void; onDeleteAccount: (id: string) => void }) {
  return <>
    <section className={`panel risk-guard ${risks.length ? "has-risk" : "is-safe"}`}><SectionHeading title="Risk Guard" description="행동을 추천하지 않고, 현금 부족이 언제 발생하는지만 알려줍니다." />{risks.length ? <ul className="risks">{risks.map((risk, index) => <li key={`${risk.type}-${index}`}><strong>{risk.type === "CASH_SHORTAGE" ? "현금 부족" : "투자자금 이동 후 현금 부족"}</strong><span>{risk.date} · {formatMoney(risk.cash_balance)}</span></li>)}</ul> : <p className="muted">현재 선택한 기간에 감지된 현금 위험이 없습니다.</p>}</section>
    <section className="metrics">
      <Metric title="기간 말 현금" value={formatMoney(latest?.cash ?? "0")} />
      <Metric title="기간 말 순자산" value={formatMoney(latest?.net_worth ?? "0")} />
      <Metric title="감지된 위험" value={`${risks.length}건`} danger={Boolean(risks.length)} />
    </section>
    <ForecastChart data={chartData} hasError={forecastError} />
    <section className="grid dashboard-grid">
      <div className="panel"><SectionHeading title="계좌별 예상 잔액" description="선택한 분석 기간의 마지막 시점에 예상되는 계좌 잔액입니다." actions={<button onClick={onAddAccount}>계좌 추가</button>} /><AccountList accounts={accounts} events={events} projectedBalances={latest?.balances} onDelete={onDeleteAccount} /></div>
      <div className="panel"><SectionHeading title="이벤트 타임라인" description="등록한 재무 사건을 발생 예정일 순서로 보여줍니다." actions={<button onClick={onManageEvents}>이벤트 추가·수정하기</button>} /><EventTimeline events={events} /></div>
    </section>
  </>;
}

function ForecastChart({ data, hasError }: { data: ChartPoint[]; hasError: boolean }) {
  const [metric, setMetric] = useState<ChartMetric>("cash");
  const label = metric === "cash" ? "현금" : "순자산";
  const color = metric === "cash" ? "#d96545" : "#216e67";
  const gradientId = metric === "cash" ? "cash-gradient" : "net-worth-gradient";
  const first = data[0];
  const last = data.at(-1);
  const change = first && last ? last[metric] - first[metric] : 0;
  const lowest = data.length ? data.reduce((minimum, item) => item[metric] < minimum[metric] ? item : minimum) : undefined;
  const range = first && last ? `${formatChartMonth(first.month, true)} – ${formatChartMonth(last.month, true)}` : "분석 기간";

  return <section className={`panel chart finance-chart ${metric}`}>
    <div className="chart-header"><div><p className="eyebrow">{range}</p><h2>{label} 흐름</h2><p className="chart-description">월말 예상 금액의 변화를 보여줍니다.</p></div><div className="chart-switcher" aria-label="그래프 지표 선택"><button className={metric === "cash" ? "active" : "secondary"} aria-pressed={metric === "cash"} onClick={() => setMetric("cash")}>현금</button><button className={metric === "netWorth" ? "active" : "secondary"} aria-pressed={metric === "netWorth"} onClick={() => setMetric("netWorth")}>순자산</button></div></div>
    {hasError ? <Error /> : <><div className="chart-summary"><div><span>기간 말 예상</span><strong>{formatMoney(last?.[metric] ?? 0)}</strong></div><div className={change < 0 ? "negative" : "positive"}><span>시작 대비</span><strong>{change > 0 ? "+" : ""}{formatMoney(change)}</strong></div><div><span>최저 예상</span><strong>{formatMoney(lowest?.[metric] ?? 0)}</strong><small>{lowest ? formatChartMonth(lowest.month, true) : "-"}</small></div></div><div className="chart-visual"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 14, right: 12, bottom: 0, left: 0 }}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.28} /><stop offset="100%" stopColor={color} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e5ece8" strokeDasharray="3 5" /><XAxis dataKey="month" axisLine={false} tickLine={false} minTickGap={28} tick={{ fontSize: 11, fill: "#71807b" }} tickFormatter={(value) => formatChartMonth(String(value))} /><YAxis width={54} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#71807b" }} tickFormatter={formatChartAxis} />{metric === "cash" && <ReferenceLine y={0} stroke="#b8422f" strokeDasharray="5 5" label={{ value: "0원", position: "insideBottomLeft", fill: "#b8422f", fontSize: 11 }} />}<Tooltip cursor={{ stroke: "#9aaba5", strokeDasharray: "3 3" }} content={<ForecastTooltip metric={metric} />} /><Area type="linear" dataKey={metric} name={label} stroke={color} strokeWidth={3} fill={`url(#${gradientId})`} dot={<EventDot color={color} />} activeDot={{ r: 6, strokeWidth: 3, fill: "white" }} />{lowest && <ReferenceDot x={lowest.month} y={lowest[metric]} r={5} fill="white" stroke={color} strokeWidth={3} />}</AreaChart></ResponsiveContainer></div></>}
  </section>;
}

function ForecastTooltip({ active, payload, label, metric }: { active?: boolean; payload?: readonly { payload?: ChartPoint }[]; label?: string | number; metric: ChartMetric }) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const change = metric === "cash" ? point.cashChange : point.netWorthChange;
  return <div className="chart-tooltip"><strong>{formatChartMonth(String(label), true)}</strong><div><span>{metric === "cash" ? "현금" : "순자산"}</span><b>{formatMoney(point[metric])}</b></div><div className={change < 0 ? "negative" : "positive"}><span>전월 대비</span><b>{change > 0 ? "+" : ""}{formatMoney(change)}</b></div>{point.eventCount > 0 && <div className="event-count"><span>예정 이벤트</span><b>{point.eventCount}건</b></div>}</div>;
}

function EventDot({ cx, cy, payload, color }: { cx?: number; cy?: number; payload?: ChartPoint; color: string }) {
  if (cx === undefined || cy === undefined || !payload?.eventCount) return <g />;
  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="white" strokeWidth={2.5} />;
}

function AccountsPage({ accounts, events, onBack, onCreate, onUpdate, onDelete }: { accounts: Account[]; events: Event[]; onBack: () => void; onCreate: (payload: Omit<Account, "id">) => void; onUpdate: (id: string, payload: Omit<Account, "id">) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState<Account | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const editAccount = (item: Account) => { setEditing(item); setMobileView("form"); };
  const showList = () => { setEditing(undefined); setMobileView("list"); };
  return <><ManagementActions activeView={mobileView} itemLabel="계좌" onBack={onBack} onShowList={showList} onShowForm={() => { setEditing(undefined); setMobileView("form"); }} /><section className="page-grid"><div className={`panel form-panel management-panel ${mobileView !== "form" ? "mobile-hidden" : ""}`}><SectionHeading title={editing ? "계좌 수정" : "계좌 추가"} description="현재 보유한 자산과 부채를 계좌 단위로 등록하세요. 모든 계좌는 같은 현재 상태 기준일을 사용해야 합니다." /><AccountForm key={editing?.id ?? "new"} initial={editing} submitLabel={editing ? "변경 저장" : "계좌 추가"} onSubmit={(payload) => { if (editing) onUpdate(editing.id, payload); else onCreate(payload); showList(); }} onCancel={editing ? showList : undefined} /></div><div className={`panel management-panel ${mobileView !== "list" ? "mobile-hidden" : ""}`}><SectionHeading title="등록된 계좌" description="계좌 정보를 수정할 수 있으며, 연결된 이벤트가 없는 계좌만 삭제할 수 있습니다." /><AccountList accounts={accounts} events={events} onEdit={editAccount} onDelete={onDelete} /></div></section></>;
}

function EventsPage({ accounts, events, onBack, onCreate, onUpdate, onDelete }: { accounts: Account[]; events: Event[]; onBack: () => void; onCreate: (payload: Omit<Event, "id">) => void; onUpdate: (id: string, payload: Omit<Event, "id">) => void; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState<Event | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const editEvent = (item: Event) => { setEditing(item); setMobileView("form"); };
  const showList = () => { setEditing(undefined); setMobileView("list"); };
  return <><ManagementActions activeView={mobileView} itemLabel="이벤트" onBack={onBack} onShowList={showList} onShowForm={() => { setEditing(undefined); setMobileView("form"); }} /><section className="page-grid"><div className={`panel form-panel management-panel ${mobileView !== "form" ? "mobile-hidden" : ""}`}><SectionHeading title={editing ? "이벤트 수정" : "이벤트 추가"} description="월급, 지출, 이체처럼 앞으로 일어날 중요한 사건만 기록하세요. 이벤트 유형에 따라 필요한 계좌만 표시됩니다." /><EventForm key={editing?.id ?? "new"} accounts={accounts} initial={editing} submitLabel={editing ? "변경 저장" : "이벤트 추가"} onSubmit={(payload) => { if (editing) onUpdate(editing.id, payload); else onCreate(payload); showList(); }} onCancel={editing ? showList : undefined} /></div><div className={`panel management-panel ${mobileView !== "list" ? "mobile-hidden" : ""}`}><SectionHeading title="입력 안내" description="이벤트는 정확한 발생일을 기준으로 계산합니다." /><ul className="guide-list"><li><strong>외부에서 입금</strong><span>수입을 선택하고 입금 계좌만 지정합니다.</span></li><li><strong>외부로 출금</strong><span>지출을 선택하고 출금 계좌만 지정합니다.</span></li><li><strong>계좌 간 이동</strong><span>이체를 선택하고 출발·도착 계좌를 모두 지정합니다.</span></li><li><strong>수정·삭제</strong><span>아래 이벤트 목록에서 내용을 수정하거나 삭제할 수 있습니다.</span></li></ul><div className="event-management"><EventTimeline events={events} onEdit={editEvent} onDelete={onDelete} /></div></div></section></>;
}

function ManagementActions({ activeView, itemLabel, onBack, onShowList, onShowForm }: { activeView: "list" | "form"; itemLabel: string; onBack: () => void; onShowList: () => void; onShowForm: () => void }) {
  return <div className="management-actions"><button className="secondary back-button" onClick={onBack}><span aria-hidden="true">←</span> 대시보드</button><div className="mobile-view-switcher" aria-label={`${itemLabel} 화면 선택`}><button className={activeView === "list" ? "active" : "secondary"} aria-pressed={activeView === "list"} onClick={onShowList}>목록</button><button className={activeView === "form" ? "active" : "secondary"} aria-pressed={activeView === "form"} onClick={onShowForm}>{itemLabel} 추가</button></div></div>;
}

function Metric({ title, value, danger = false }: { title: string; value: string; danger?: boolean }) { return <article className={`metric ${danger ? "danger" : ""}`}><p>{title}</p><strong>{value}</strong></article>; }
function SectionHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) { return <div className="section-heading"><div className="heading-row"><h2>{title}</h2>{actions && <div className="heading-actions">{actions}</div>}</div>{description && <p>{description}</p>}</div>; }
function Error() { return <p className="error">예측 결과를 불러오지 못했습니다. 먼저 동일 기준일의 계좌를 등록해 주세요.</p>; }
function List<T>({ rows, render }: { rows?: T[]; render: (item: T) => ReactNode }) { return <ul className="list">{rows?.length ? rows.map((row, index) => <li key={index}>{render(row)}</li>) : <li className="muted">등록된 항목이 없습니다.</li>}</ul>; }
function EventTimeline({ events, onEdit, onDelete }: { events: Event[]; onEdit?: (item: Event) => void; onDelete?: (id: string) => void }) { return events.length ? <ol className="timeline">{events.map((item) => <li key={item.id}><time>{eventDate(item)}</time><div><strong>{item.name}</strong><span>{eventLabel(item.type)} · {formatMoney(item.amount)}{item.recurrence_months ? ` · ${item.recurrence_months}개월마다 반복${item.recurrence_until ? ` (${item.recurrence_until}까지)` : ""}` : ""}</span></div>{onEdit && onDelete && <div className="row-actions"><button className="secondary" onClick={() => onEdit(item)}>수정</button><button className="danger-button" onClick={() => { if (window.confirm("이 이벤트를 삭제할까요?")) onDelete(item.id); }}>삭제</button></div>}</li>)}</ol> : <p className="muted">등록된 이벤트가 없습니다.</p>; }
function AccountList({ accounts, events, projectedBalances, onEdit, onDelete }: { accounts: Account[]; events: Event[]; projectedBalances?: Record<string, string>; onEdit?: (item: Account) => void; onDelete: (id: string) => void }) { return accounts.length ? <ul className="account-list">{accounts.map((item) => { const projected = projectedBalances?.[item.id]; const linkedEvents = events.filter((event) => event.source_account_id === item.id || event.destination_account_id === item.id).length; return <li key={item.id}><div><strong>{item.name}</strong><span>{accountLabel(item.type)} · {projected === undefined ? `현재 ${formatMoney(item.current_balance)}` : `예상 ${formatMoney(projected)}`}</span>{projected !== undefined && Number(projected) !== Number(item.current_balance) && <small>현재 기준 {formatMoney(item.current_balance)}</small>}</div><div className="row-actions">{onEdit && <button className="secondary" onClick={() => onEdit(item)}>수정</button>}<button className="danger-button" onClick={() => { if (linkedEvents > 0) { window.alert(`연결된 이벤트가 ${linkedEvents}개 있어 삭제할 수 없습니다. 이벤트를 먼저 삭제하거나 계좌 연결을 해제하세요.`); return; } if (window.confirm("이 계좌를 삭제할까요? 초기 잔액은 삭제 가능 여부에 영향을 주지 않습니다.")) onDelete(item.id); }}>삭제</button></div></li>; })}</ul> : <p className="muted">등록된 계좌가 없습니다.</p>; }

function AccountForm({ initial, submitLabel = "계좌 추가", onSubmit, onCancel }: { initial?: Account; submitLabel?: string; onSubmit: (payload: Omit<Account, "id">) => void; onCancel?: () => void }) {
  const [type, setType] = useState<AccountType>(initial?.type ?? "CASH");
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); onSubmit({ name: String(data.get("name")), type, current_balance: String(data.get("balance")), as_of_date: String(data.get("asOf")), currency: initial?.currency ?? "KRW", liquidity: initial?.liquidity ?? "LIQUID", emergency_fund_eligible: Boolean(data.get("emergency")) }); event.currentTarget.reset(); setType("CASH"); }
  return <form onSubmit={submit}>
    <label>계좌 이름<input name="name" defaultValue={initial?.name} placeholder="예: 생활비 통장" required /><small>사용자가 알아보기 쉬운 이름을 입력하세요.</small></label>
    <label>계좌 종류<select value={type} onChange={(event) => setType(event.target.value as AccountType)}>{(["CASH", "SAVINGS", "INVESTMENT", "DEBT", "OTHER_ASSET"] as AccountType[]).map((item) => <option key={item} value={item}>{accountLabel(item)}</option>)}</select><small>{accountDescription(type)}</small></label>
    <label>현재 잔액 (KRW)<input name="balance" defaultValue={initial?.current_balance} type="number" min="0" placeholder="예: 3000000" required /><small>기준일 현재 계좌에 있는 금액입니다. 부채는 남은 상환액을 입력합니다.</small></label>
    <label>현재 상태 기준일<input name="asOf" type="date" defaultValue={initial?.as_of_date ?? today} required /><small>이 날짜의 잔액을 시작점으로 미래를 계산합니다. 모든 계좌가 같은 날짜를 사용해야 합니다.</small></label>
    <label className="check-label"><input name="emergency" type="checkbox" defaultChecked={initial?.emergency_fund_eligible} /> 비상시에 쓸 돈으로 표시<small>예상치 못한 지출이 생겼을 때 사용할 수 있는 돈으로 계산합니다.</small></label>
    <div className="form-actions"><button>{submitLabel}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel}>수정 취소</button>}</div>
  </form>;
}

function EventForm({ accounts, initial, submitLabel = "이벤트 추가", onSubmit, onCancel }: { accounts: Account[]; initial?: Event; submitLabel?: string; onSubmit: (payload: Omit<Event, "id">) => void; onCancel?: () => void }) {
  const [type, setType] = useState(initial?.type ?? "INCOME");
  const [repeats, setRepeats] = useState(Boolean(initial?.recurrence_months));
  const sourceLabel = type === "EXPENSE" || type === "DEBT_INTEREST" ? "출금 계좌" : type === "DEBT_DRAW" ? "부채 계좌" : type === "DEBT_PRINCIPAL_REPAYMENT" || type === "SAVINGS_MATURITY" ? "출발 계좌" : "출발 계좌";
  const destinationLabel = type === "INCOME" ? "입금 계좌" : type === "DEBT_DRAW" ? "입금될 입출금 계좌" : type === "DEBT_PRINCIPAL_REPAYMENT" ? "상환할 부채 계좌" : type === "SAVINGS_MATURITY" ? "만기 금액을 받을 입출금 계좌" : "도착 계좌";
  const needsSource = !["INCOME"].includes(type);
  const needsDestination = !["EXPENSE", "DEBT_INTEREST"].includes(type);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); const eventDate = String(data.get("date")); onSubmit({ name: String(data.get("name")), month: `${eventDate.slice(0, 7)}-01`, event_date: eventDate, amount: String(data.get("amount")), type, status: initial?.status ?? "PLANNED", source_account_id: needsSource ? String(data.get("source")) || null : null, destination_account_id: needsDestination ? String(data.get("destination")) || null : null, recurrence_months: repeats ? Number(data.get("recurrenceMonths")) : null, recurrence_until: repeats ? String(data.get("recurrenceUntil")) || null : null, note: initial?.note ?? null }); event.currentTarget.reset(); setType("INCOME"); setRepeats(false); }
  return <form onSubmit={submit}>
    <label>이벤트 이름<input name="name" defaultValue={initial?.name} placeholder="예: 8월 월급, 이사 비용" required /><small>무슨 일이 일어나는지 짧게 적습니다.</small></label>
    <label>이벤트 유형<select name="type" value={type} onChange={(event) => setType(event.target.value)}>{["INCOME", "EXPENSE", "TRANSFER", "INVESTMENT_CONTRIBUTION", "DEBT_DRAW", "DEBT_PRINCIPAL_REPAYMENT", "DEBT_INTEREST", "SAVINGS_MATURITY"].map((item) => <option key={item} value={item}>{eventLabel(item)}</option>)}</select><small>{eventDescription(type)}</small></label>
    <label>금액 (KRW)<input name="amount" defaultValue={initial?.amount} type="number" min="1" placeholder="예: 2800000" required /><small>해당 사건으로 변하는 금액을 입력합니다.</small></label>
    <label>발생일<input name="date" type="date" defaultValue={initial?.event_date ?? `${initial?.month.slice(0, 7) ?? currentMonth}-01`} required /><small>이 날짜를 기준으로 월별 흐름과 월중 현금 부족을 계산합니다.</small></label>
    {needsSource && <label>{sourceLabel}<select name="source" defaultValue={initial?.source_account_id ?? ""} required><option value="">계좌를 선택하세요</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name} ({accountLabel(item.type)})</option>)}</select><small>{type === "EXPENSE" ? "외부로 돈이 나가는 입출금 계좌입니다." : "돈이 빠져나가거나 부채가 발생하는 계좌입니다."}</small></label>}
    {needsDestination && <label>{destinationLabel}<select name="destination" defaultValue={initial?.destination_account_id ?? ""} required><option value="">계좌를 선택하세요</option>{accounts.map((item) => <option value={item.id} key={item.id}>{item.name} ({accountLabel(item.type)})</option>)}</select><small>{type === "INCOME" ? "외부에서 돈이 들어오는 입출금 계좌입니다." : "돈이 들어오거나 이동하는 계좌입니다."}</small></label>}
    <label className="check-label"><input type="checkbox" checked={repeats} onChange={(event) => setRepeats(event.target.checked)} /> 반복 이벤트<small>월급이나 생활비처럼 일정한 개월 간격으로 반복되는 사건을 등록합니다.</small></label>
    {repeats && <><label>반복 간격 (개월)<input name="recurrenceMonths" type="number" min="1" defaultValue={initial?.recurrence_months ?? 1} required /><small>1은 매월, 3은 3개월마다 반복합니다.</small></label><label>반복 종료일<input name="recurrenceUntil" type="date" min={initial?.event_date ?? today} defaultValue={initial?.recurrence_until ?? ""} /><small>비워두면 선택한 분석 기간 끝까지 반복합니다.</small></label></>}
    <div className="form-actions"><button disabled={!accounts.length}>{submitLabel}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel}>수정 취소</button>}</div>{!accounts.length && <p className="error">이벤트를 추가하려면 먼저 계좌 관리에서 계좌를 등록하세요.</p>}
  </form>;
}

function eventDate(item: Event) { return item.event_date ?? `${item.month.slice(0, 7)}-01`; }
function formatChartMonth(month: string, includeYear = false) { const [year, monthNumber] = month.split("-"); return includeYear ? `${year}년 ${Number(monthNumber)}월` : `${Number(monthNumber)}월`; }
function formatChartAxis(value: number) { const absolute = Math.abs(value); if (absolute >= 100000000) return `${Math.round(value / 100000000)}억`; if (absolute >= 10000) return `${Math.round(value / 10000)}만`; return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 0 }).format(value); }
function pageTitle(page: Page) { return ({ dashboard: "대시보드", monthly: "월별 계획", accounts: "계좌 관리", events: "이벤트 관리" }[page]); }
function accountLabel(type: AccountType) { return ({ CASH: "입출금", SAVINGS: "저축", INVESTMENT: "투자", DEBT: "부채", OTHER_ASSET: "기타 자산" }[type]); }
function accountDescription(type: AccountType) { return ({ CASH: "생활비·급여·비상금처럼 바로 사용할 수 있는 계좌", SAVINGS: "예금·적금처럼 저축 목적의 계좌", INVESTMENT: "주식·ETF·암호화폐 등 투자 계좌", DEBT: "대출처럼 상환해야 하는 부채 계좌", OTHER_ASSET: "보증금·차량처럼 계좌 외 자산" }[type]); }
function eventLabel(type: string) { return ({ INCOME: "수입", EXPENSE: "지출", TRANSFER: "계좌 간 이체", INVESTMENT_CONTRIBUTION: "투자금 추가", DEBT_DRAW: "대출 실행", DEBT_PRINCIPAL_REPAYMENT: "대출 원금 상환", DEBT_INTEREST: "대출 이자 납부", SAVINGS_MATURITY: "예·적금 만기" }[type] ?? type); }
function eventDescription(type: string) { return ({ INCOME: "외부에서 계좌로 돈이 들어오는 사건입니다.", EXPENSE: "계좌에서 외부로 돈이 나가는 사건입니다.", TRANSFER: "내 계좌 사이에서 돈을 이동하는 사건입니다.", INVESTMENT_CONTRIBUTION: "입출금 계좌에서 투자 계좌로 돈을 옮깁니다.", DEBT_DRAW: "대출이 실행되어 현금이 들어오는 사건입니다.", DEBT_PRINCIPAL_REPAYMENT: "입출금 계좌에서 대출 원금을 갚는 사건입니다.", DEBT_INTEREST: "입출금 계좌에서 대출 이자를 납부하는 사건입니다.", SAVINGS_MATURITY: "저축 계좌가 만기되어 입출금 계좌로 받는 사건입니다." }[type] ?? ""); }
