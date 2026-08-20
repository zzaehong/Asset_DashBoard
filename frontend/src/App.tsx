import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Account, AccountPayload, AccountType, api, Event, EventPayload, EventType } from "./lib/api";
import { toLocalDateInputValue } from "./lib/date";
import { occurrenceDateForMonth, shiftMonth } from "./lib/recurrence";

const currency = new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 });
const formatMoney = (value: string | number) => currency.format(Number(value));
const today = toLocalDateInputValue();
const currentMonth = today.slice(0, 7);

type Page = "dashboard" | "monthly" | "accounts" | "events";
type ChartMetric = "cash" | "netWorth";
type ChartPoint = { month: string; cash: number; netWorth: number; cashChange: number; netWorthChange: number; eventCount: number };
type EventAccountField = { label: string; description: string; allowedTypes: AccountType[] };
type EventConfig = { label: string; description: string; source?: EventAccountField; destination?: EventAccountField };

const EVENT_CONFIG: Record<EventType, EventConfig> = {
  INCOME: { label: "수입", description: "외부에서 계좌로 돈이 들어오는 사건입니다.", destination: { label: "입금 계좌", description: "외부에서 돈이 들어오는 입출금 또는 저축 계좌입니다.", allowedTypes: ["CASH", "SAVINGS"] } },
  EXPENSE: { label: "지출", description: "계좌에서 외부로 돈이 나가는 사건입니다.", source: { label: "출금 계좌", description: "외부로 돈이 나가는 입출금 계좌입니다.", allowedTypes: ["CASH"] } },
  TRANSFER: { label: "계좌 간 이체", description: "내 계좌 사이에서 돈을 이동하는 사건입니다.", source: { label: "출발 계좌", description: "돈이 빠져나가는 계좌입니다.", allowedTypes: ["CASH", "SAVINGS"] }, destination: { label: "도착 계좌", description: "돈이 들어오는 계좌입니다.", allowedTypes: ["CASH", "SAVINGS"] } },
  INVESTMENT_CONTRIBUTION: { label: "투자금 추가", description: "입출금 계좌에서 투자 계좌로 돈을 옮깁니다.", source: { label: "출금 계좌", description: "투자금이 빠져나가는 입출금 계좌입니다.", allowedTypes: ["CASH"] }, destination: { label: "투자 계좌", description: "투자금이 들어가는 계좌입니다.", allowedTypes: ["INVESTMENT"] } },
  DEBT_DRAW: { label: "대출 실행", description: "대출이 실행되어 현금이 들어오는 사건입니다.", source: { label: "부채 계좌", description: "새로 발생하거나 늘어나는 부채 계좌입니다.", allowedTypes: ["DEBT"] }, destination: { label: "입금될 입출금 계좌", description: "대출금이 들어오는 입출금 계좌입니다.", allowedTypes: ["CASH"] } },
  DEBT_PRINCIPAL_REPAYMENT: { label: "대출 원금 상환", description: "입출금 계좌에서 대출 원금을 갚는 사건입니다.", source: { label: "출금 계좌", description: "상환액이 빠져나가는 입출금 계좌입니다.", allowedTypes: ["CASH"] }, destination: { label: "상환할 부채 계좌", description: "원금이 줄어드는 부채 계좌입니다.", allowedTypes: ["DEBT"] } },
  DEBT_INTEREST: { label: "대출 이자 납부", description: "입출금 계좌에서 대출 이자를 납부하는 사건입니다.", source: { label: "출금 계좌", description: "이자가 빠져나가는 입출금 계좌입니다.", allowedTypes: ["CASH"] } },
  SAVINGS_MATURITY: { label: "예·적금 만기", description: "저축 계좌가 만기되어 입출금 계좌로 받는 사건입니다.", source: { label: "만기 저축 계좌", description: "만기 금액이 빠져나가는 저축 계좌입니다.", allowedTypes: ["SAVINGS"] }, destination: { label: "입금될 입출금 계좌", description: "만기 금액을 받는 입출금 계좌입니다.", allowedTypes: ["CASH"] } },
};
const EVENT_TYPES = Object.keys(EVENT_CONFIG) as EventType[];

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
  const updateAccount = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: AccountPayload }) => api.updateAccount(id, payload), onSuccess: refresh });
  const createEvent = useMutation({ mutationFn: api.createEvent, onSuccess: refresh });
  const updateEvent = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: EventPayload }) => api.updateEvent(id, payload), onSuccess: refresh });
  const mutationError = (error: Error) => window.alert(error.message || "요청을 처리하지 못했습니다.");
  const deleteEvent = useMutation({ mutationFn: api.deleteEvent, onSuccess: refresh, onError: mutationError });
  const deleteAccount = useMutation({ mutationFn: api.deleteAccount, onSuccess: refresh, onError: mutationError });
  const orderedEvents = useMemo(() => [...(events.data ?? [])].sort((a, b) => eventDate(a).localeCompare(eventDate(b))), [events.data]);
  const hasDataError = accounts.isError || events.isError;
  const isDataPending = accounts.isPending || events.isPending;

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

        {isDataPending && <section className="panel data-loading" role="status">저장된 데이터를 불러오는 중입니다.</section>}
        {hasDataError && <section className="panel data-error" role="alert"><div><strong>저장된 데이터를 불러오지 못했습니다.</strong><p>네트워크 연결과 서버 상태를 확인한 뒤 다시 시도해 주세요.</p></div><button onClick={() => { void accounts.refetch(); void events.refetch(); }}>다시 시도</button></section>}

        {!isDataPending && !hasDataError && page === "dashboard" && <Dashboard accounts={accountList} events={orderedEvents} chartData={chartData} latest={latest} risks={forecast.data?.risks ?? []} forecastError={forecast.isError} onAddAccount={() => selectPage("accounts")} onManageEvents={() => selectPage("events")} onDeleteAccount={(id) => deleteAccount.mutate(id)} />}
        {!isDataPending && !hasDataError && page === "monthly" && <MonthlyPlanPage events={orderedEvents} onManageEvents={() => selectPage("events")} />}
        {!isDataPending && !hasDataError && page === "accounts" && <AccountsPage accounts={accountList} events={orderedEvents} onBack={() => selectPage("dashboard")} onCreate={(payload) => createAccount.mutateAsync(payload)} onUpdate={(id, payload) => updateAccount.mutateAsync({ id, payload })} onDelete={(id) => deleteAccount.mutate(id)} />}
        {!isDataPending && !hasDataError && page === "events" && <EventsPage accounts={accountList} events={orderedEvents} onBack={() => selectPage("dashboard")} onCreate={(payload) => createEvent.mutateAsync(payload)} onUpdate={(id, payload) => updateEvent.mutateAsync({ id, payload })} onDelete={(id) => deleteEvent.mutate(id)} />}
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
  const [activeIndex, setActiveIndex] = useState<number>();
  const label = metric === "cash" ? "현금" : "순자산";
  const color = metric === "cash" ? "#d96545" : "#216e67";
  const first = data[0];
  const last = data.at(-1);
  const change = first && last ? last[metric] - first[metric] : 0;
  const lowest = data.length ? data.reduce((minimum, item) => item[metric] < minimum[metric] ? item : minimum) : undefined;
  const range = first && last ? `${formatChartMonth(first.month, true)} – ${formatChartMonth(last.month, true)}` : "분석 기간";
  const selectMetric = (nextMetric: ChartMetric) => { setMetric(nextMetric); setActiveIndex(undefined); };

  return <section className={`panel chart finance-chart ${metric}`}>
    <div className="chart-header"><div><p className="eyebrow">{range}</p><h2>{label} 흐름</h2><p className="chart-description">월말 예상 금액의 변화를 보여줍니다.</p></div><div className="chart-switcher" aria-label="그래프 지표 선택"><button className={metric === "cash" ? "active" : "secondary"} aria-pressed={metric === "cash"} onClick={() => selectMetric("cash")}>현금</button><button className={metric === "netWorth" ? "active" : "secondary"} aria-pressed={metric === "netWorth"} onClick={() => selectMetric("netWorth")}>순자산</button></div></div>
    {hasError ? <Error /> : <><div className="chart-summary"><div><span>기간 말 예상</span><strong>{formatMoney(last?.[metric] ?? 0)}</strong></div><div className={change < 0 ? "negative" : "positive"}><span>시작 대비</span><strong>{change > 0 ? "+" : ""}{formatMoney(change)}</strong></div><div><span>최저 예상</span><strong>{formatMoney(lowest?.[metric] ?? 0)}</strong><small>{lowest ? formatChartMonth(lowest.month, true) : "-"}</small></div></div><LightweightChart data={data} metric={metric} color={color} activeIndex={activeIndex} onActivate={setActiveIndex} /></>}
  </section>;
}

function LightweightChart({ data, metric, color, activeIndex, onActivate }: { data: ChartPoint[]; metric: ChartMetric; color: string; activeIndex?: number; onActivate: (index?: number) => void }) {
  const width = 900;
  const height = 250;
  const padding = { top: 16, right: 18, bottom: 30, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const values = data.map((item) => item[metric]);
  const domainValues = metric === "cash" ? [...values, 0] : values;
  const rawMin = Math.min(...domainValues, 0);
  const rawMax = Math.max(...domainValues, 0);
  const span = rawMax - rawMin || Math.max(Math.abs(rawMax), 1);
  const min = rawMin - span * 0.08;
  const max = rawMax + span * 0.08;
  const x = (index: number) => data.length <= 1 ? padding.left + plotWidth / 2 : padding.left + (index / (data.length - 1)) * plotWidth;
  const y = (value: number) => padding.top + ((max - value) / (max - min)) * plotHeight;
  const points = data.map((item, index) => ({ item, index, x: x(index), y: y(item[metric]) }));
  const linePath = points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const areaPath = points.length ? `${linePath} L${points.at(-1)?.x},${padding.top + plotHeight} L${points[0].x},${padding.top + plotHeight} Z` : "";
  const ticks = Array.from({ length: 5 }, (_, index) => min + ((max - min) * index) / 4);
  const lowestValue = values.length ? Math.min(...values) : undefined;
  const labelStep = Math.max(1, Math.ceil(data.length / 6));
  const active = activeIndex === undefined ? undefined : points[activeIndex];
  const gradientId = `chart-gradient-${metric}`;

  return <div className="chart-visual" onMouseLeave={() => onActivate(undefined)}><svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric === "cash" ? "현금" : "순자산"} 월별 예상 흐름`}><defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.28" /><stop offset="100%" stopColor={color} stopOpacity="0.02" /></linearGradient></defs>{ticks.map((tick) => <g key={tick}><line className="chart-grid-line" x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} /><text className="chart-axis-label" x={padding.left - 10} y={y(tick) + 4} textAnchor="end">{formatChartAxis(tick)}</text></g>)}{metric === "cash" && min <= 0 && max >= 0 && <g><line className="chart-zero-line" x1={padding.left} x2={width - padding.right} y1={y(0)} y2={y(0)} /><text className="chart-zero-label" x={padding.left + 4} y={y(0) - 6}>0원</text></g>}<path d={areaPath} fill={`url(#${gradientId})`} /><path className="chart-line" d={linePath} stroke={color} />{points.map((point) => <g key={point.item.month}><circle className="chart-point-hit" cx={point.x} cy={point.y} r="14" tabIndex={0} role="button" aria-label={`${formatChartMonth(point.item.month, true)} ${formatMoney(point.item[metric])}${point.item.eventCount ? `, 이벤트 ${point.item.eventCount}건` : ""}`} onMouseEnter={() => onActivate(point.index)} onFocus={() => onActivate(point.index)} onBlur={() => onActivate(undefined)} onClick={() => onActivate(point.index)} />{point.item.eventCount > 0 && <circle className="chart-event-point" cx={point.x} cy={point.y} r="5" fill={color} />}{point.item[metric] === lowestValue && <circle className="chart-lowest-point" cx={point.x} cy={point.y} r="6" stroke={color} />}</g>)}{active && <g pointerEvents="none"><line className="chart-cursor-line" x1={active.x} x2={active.x} y1={padding.top} y2={padding.top + plotHeight} /><circle cx={active.x} cy={active.y} r="6" fill="white" stroke={color} strokeWidth="3" /></g>}{points.map((point) => (point.index % labelStep === 0 || point.index === points.length - 1) && <text key={`label-${point.item.month}`} className="chart-axis-label" x={point.x} y={height - 8} textAnchor="middle">{formatChartMonth(point.item.month)}</text>)}</svg>{active && <ChartTooltip point={active.item} metric={metric} left={`${Math.min(88, Math.max(12, (active.x / width) * 100))}%`} />}</div>;
}

function ChartTooltip({ point, metric, left }: { point: ChartPoint; metric: ChartMetric; left: string }) {
  const change = metric === "cash" ? point.cashChange : point.netWorthChange;
  return <div className="chart-tooltip" style={{ left }}><strong>{formatChartMonth(point.month, true)}</strong><div><span>{metric === "cash" ? "현금" : "순자산"}</span><b>{formatMoney(point[metric])}</b></div><div className={change < 0 ? "negative" : "positive"}><span>전월 대비</span><b>{change > 0 ? "+" : ""}{formatMoney(change)}</b></div>{point.eventCount > 0 && <div><span>예정 이벤트</span><b>{point.eventCount}건</b></div>}</div>;
}

function AccountsPage({ accounts, events, onBack, onCreate, onUpdate, onDelete }: { accounts: Account[]; events: Event[]; onBack: () => void; onCreate: (payload: AccountPayload) => Promise<Account>; onUpdate: (id: string, payload: AccountPayload) => Promise<Account>; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState<Account | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editAccount = (item: Account) => { setEditing(item); setMobileView("form"); };
  const showList = () => { setEditing(undefined); setSaveError(""); setMobileView("list"); };
  const save = async (payload: AccountPayload) => { setSaveError(""); setIsSaving(true); try { if (editing) await onUpdate(editing.id, payload); else await onCreate(payload); showList(); return true; } catch (error) { setSaveError(errorMessage(error)); return false; } finally { setIsSaving(false); } };
  return <><ManagementActions activeView={mobileView} itemLabel="계좌" onBack={onBack} onShowList={showList} onShowForm={() => { setEditing(undefined); setSaveError(""); setMobileView("form"); }} /><section className="page-grid"><div className={`panel form-panel management-panel ${mobileView !== "form" ? "mobile-hidden" : ""}`}><SectionHeading title={editing ? "계좌 수정" : "계좌 추가"} description="현재 보유한 자산과 부채를 계좌 단위로 등록하세요. 모든 계좌는 같은 현재 상태 기준일을 사용해야 합니다." /><AccountForm key={editing?.id ?? "new"} initial={editing} defaultAsOfDate={accounts[0]?.as_of_date ?? today} submitLabel={editing ? "변경 저장" : "계좌 추가"} onSubmit={save} onCancel={editing ? showList : undefined} isSaving={isSaving} error={saveError} /></div><div className={`panel management-panel ${mobileView !== "list" ? "mobile-hidden" : ""}`}><SectionHeading title="등록된 계좌" description="계좌 정보를 수정할 수 있으며, 연결된 이벤트가 없는 계좌만 삭제할 수 있습니다." /><AccountList accounts={accounts} events={events} onEdit={editAccount} onDelete={onDelete} /></div></section></>;
}

function EventsPage({ accounts, events, onBack, onCreate, onUpdate, onDelete }: { accounts: Account[]; events: Event[]; onBack: () => void; onCreate: (payload: EventPayload) => Promise<Event>; onUpdate: (id: string, payload: EventPayload) => Promise<Event>; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState<Event | undefined>();
  const [mobileView, setMobileView] = useState<"list" | "form">("list");
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const editEvent = (item: Event) => { setEditing(item); setMobileView("form"); };
  const showList = () => { setEditing(undefined); setSaveError(""); setMobileView("list"); };
  const save = async (payload: EventPayload) => { setSaveError(""); setIsSaving(true); try { if (editing) await onUpdate(editing.id, payload); else await onCreate(payload); showList(); return true; } catch (error) { setSaveError(errorMessage(error)); return false; } finally { setIsSaving(false); } };
  return <><ManagementActions activeView={mobileView} itemLabel="이벤트" onBack={onBack} onShowList={showList} onShowForm={() => { setEditing(undefined); setSaveError(""); setMobileView("form"); }} /><section className="page-grid"><div className={`panel form-panel management-panel ${mobileView !== "form" ? "mobile-hidden" : ""}`}><SectionHeading title={editing ? "이벤트 수정" : "이벤트 추가"} description="월급, 지출, 이체처럼 앞으로 일어날 중요한 사건만 기록하세요. 이벤트 유형에 따라 필요한 계좌만 표시됩니다." /><EventForm key={editing?.id ?? "new"} accounts={accounts} initial={editing} submitLabel={editing ? "변경 저장" : "이벤트 추가"} onSubmit={save} onCancel={editing ? showList : undefined} isSaving={isSaving} error={saveError} /></div><div className={`panel management-panel ${mobileView !== "list" ? "mobile-hidden" : ""}`}><SectionHeading title="입력 안내" description="이벤트는 정확한 발생일을 기준으로 계산합니다." /><ul className="guide-list"><li><strong>외부에서 입금</strong><span>수입을 선택하고 입금 계좌만 지정합니다.</span></li><li><strong>외부로 출금</strong><span>지출을 선택하고 출금 계좌만 지정합니다.</span></li><li><strong>계좌 간 이동</strong><span>이체를 선택하고 출발·도착 계좌를 모두 지정합니다.</span></li><li><strong>수정·삭제</strong><span>아래 이벤트 목록에서 내용을 수정하거나 삭제할 수 있습니다.</span></li></ul><div className="event-management"><EventTimeline events={events} onEdit={editEvent} onDelete={onDelete} /></div></div></section></>;
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

function AccountForm({ initial, defaultAsOfDate, submitLabel = "계좌 추가", onSubmit, onCancel, isSaving, error }: { initial?: Account; defaultAsOfDate: string; submitLabel?: string; onSubmit: (payload: AccountPayload) => Promise<boolean>; onCancel?: () => void; isSaving: boolean; error: string }) {
  const [type, setType] = useState<AccountType>(initial?.type ?? "CASH");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const saved = await onSubmit({ name: String(data.get("name")), type, current_balance: String(data.get("balance")), as_of_date: String(data.get("asOf")), currency: initial?.currency ?? "KRW", liquidity: initial?.liquidity ?? "LIQUID", emergency_fund_eligible: Boolean(data.get("emergency")) }); if (saved) { form.reset(); setType("CASH"); } }
  return <form onSubmit={submit}>
    <label>계좌 이름<input name="name" defaultValue={initial?.name} placeholder="예: 생활비 통장" required /><small>사용자가 알아보기 쉬운 이름을 입력하세요.</small></label>
    <label>계좌 종류<select value={type} onChange={(event) => setType(event.target.value as AccountType)}>{(["CASH", "SAVINGS", "INVESTMENT", "DEBT", "OTHER_ASSET"] as AccountType[]).map((item) => <option key={item} value={item}>{accountLabel(item)}</option>)}</select><small>{accountDescription(type)}</small></label>
    <label>현재 잔액 (KRW)<input name="balance" defaultValue={initial?.current_balance} type="number" min="0" placeholder="예: 3000000" required /><small>기준일 현재 계좌에 있는 금액입니다. 부채는 남은 상환액을 입력합니다.</small></label>
    <label>현재 상태 기준일<input name="asOf" type="date" defaultValue={initial?.as_of_date ?? defaultAsOfDate} required /><small>이 날짜의 잔액을 시작점으로 미래를 계산합니다. 모든 계좌가 같은 날짜를 사용해야 합니다.</small></label>
    <label className="check-label"><input name="emergency" type="checkbox" defaultChecked={initial?.emergency_fund_eligible} /> 비상시에 쓸 돈으로 표시<small>예상치 못한 지출이 생겼을 때 사용할 수 있는 돈으로 계산합니다.</small></label>
    <div className="form-actions"><button disabled={isSaving}>{isSaving ? "저장 중…" : submitLabel}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel} disabled={isSaving}>수정 취소</button>}</div>{error && <p className="error" role="alert">{error}</p>}
  </form>;
}

function EventForm({ accounts, initial, submitLabel = "이벤트 추가", onSubmit, onCancel, isSaving, error }: { accounts: Account[]; initial?: Event; submitLabel?: string; onSubmit: (payload: EventPayload) => Promise<boolean>; onCancel?: () => void; isSaving: boolean; error: string }) {
  const [type, setType] = useState<EventType>(initial?.type ?? "INCOME");
  const [repeats, setRepeats] = useState(Boolean(initial?.recurrence_months));
  const [eventDateValue, setEventDateValue] = useState(initial?.event_date ?? today);
  const config = EVENT_CONFIG[type];
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const saved = await onSubmit({ name: String(data.get("name")), event_date: eventDateValue, amount: String(data.get("amount")), type, status: initial?.status ?? "PLANNED", source_account_id: config.source ? String(data.get("source")) || null : null, destination_account_id: config.destination ? String(data.get("destination")) || null : null, recurrence_months: repeats ? Number(data.get("recurrenceMonths")) : null, recurrence_until: repeats ? String(data.get("recurrenceUntil")) || null : null, note: initial?.note ?? null }); if (saved) { form.reset(); setType("INCOME"); setRepeats(false); setEventDateValue(today); } }
  return <form onSubmit={submit}>
    <label>이벤트 이름<input name="name" defaultValue={initial?.name} placeholder="예: 8월 월급, 이사 비용" required /><small>무슨 일이 일어나는지 짧게 적습니다.</small></label>
    <label>이벤트 유형<select name="type" value={type} onChange={(event) => setType(event.target.value as EventType)}>{EVENT_TYPES.map((item) => <option key={item} value={item}>{EVENT_CONFIG[item].label}</option>)}</select><small>{config.description}</small></label>
    <label>금액 (KRW)<input name="amount" defaultValue={initial?.amount} type="number" min="1" placeholder="예: 2800000" required /><small>해당 사건으로 변하는 금액을 입력합니다.</small></label>
    <label>발생일<input name="date" type="date" value={eventDateValue} onChange={(event) => setEventDateValue(event.target.value)} required /><small>이 날짜를 기준으로 월별 흐름과 월중 현금 부족을 계산합니다.</small></label>
    {config.source && <label>{config.source.label}<select key={`source-${type}`} name="source" defaultValue={initial?.type === type ? initial.source_account_id ?? "" : ""} required><option value="">계좌를 선택하세요</option>{accounts.filter((item) => config.source?.allowedTypes.includes(item.type)).map((item) => <option value={item.id} key={item.id}>{item.name} ({accountLabel(item.type)})</option>)}</select><small>{config.source.description}</small></label>}
    {config.destination && <label>{config.destination.label}<select key={`destination-${type}`} name="destination" defaultValue={initial?.type === type ? initial.destination_account_id ?? "" : ""} required><option value="">계좌를 선택하세요</option>{accounts.filter((item) => config.destination?.allowedTypes.includes(item.type)).map((item) => <option value={item.id} key={item.id}>{item.name} ({accountLabel(item.type)})</option>)}</select><small>{config.destination.description}</small></label>}
    <label className="check-label"><input type="checkbox" checked={repeats} onChange={(event) => setRepeats(event.target.checked)} /> 반복 이벤트<small>월급이나 생활비처럼 일정한 개월 간격으로 반복되는 사건을 등록합니다.</small></label>
    {repeats && <><label>반복 간격 (개월)<input name="recurrenceMonths" type="number" min="1" defaultValue={initial?.recurrence_months ?? 1} required /><small>1은 매월, 3은 3개월마다 반복합니다.</small></label><label>반복 종료일<input name="recurrenceUntil" type="date" min={eventDateValue} defaultValue={initial?.recurrence_until ?? ""} /><small>비워두면 선택한 분석 기간 끝까지 반복합니다.</small></label></>}
    <div className="form-actions"><button disabled={!accounts.length || isSaving}>{isSaving ? "저장 중…" : submitLabel}</button>{onCancel && <button type="button" className="secondary" onClick={onCancel} disabled={isSaving}>수정 취소</button>}</div>{!accounts.length && <p className="error">이벤트를 추가하려면 먼저 계좌 관리에서 계좌를 등록하세요.</p>}{error && <p className="error" role="alert">{error}</p>}
  </form>;
}

function eventDate(item: Event) { return item.event_date; }
function formatChartMonth(month: string, includeYear = false) { const [year, monthNumber] = month.split("-"); return includeYear ? `${year}년 ${Number(monthNumber)}월` : `${Number(monthNumber)}월`; }
function formatChartAxis(value: number) { const absolute = Math.abs(value); if (absolute >= 100000000) return `${Math.round(value / 100000000)}억`; if (absolute >= 10000) return `${Math.round(value / 10000)}만`; return new Intl.NumberFormat("ko-KR", { notation: "compact", maximumFractionDigits: 0 }).format(value); }
function pageTitle(page: Page) { return ({ dashboard: "대시보드", monthly: "월별 계획", accounts: "계좌 관리", events: "이벤트 관리" }[page]); }
function accountLabel(type: AccountType) { return ({ CASH: "입출금", SAVINGS: "저축", INVESTMENT: "투자", DEBT: "부채", OTHER_ASSET: "기타 자산" }[type]); }
function accountDescription(type: AccountType) { return ({ CASH: "생활비·급여·비상금처럼 바로 사용할 수 있는 계좌", SAVINGS: "예금·적금처럼 저축 목적의 계좌", INVESTMENT: "주식·ETF·암호화폐 등 투자 계좌", DEBT: "대출처럼 상환해야 하는 부채 계좌", OTHER_ASSET: "보증금·차량처럼 계좌 외 자산" }[type]); }
function eventLabel(type: EventType) { return EVENT_CONFIG[type].label; }
function errorMessage(error: unknown) { return error instanceof globalThis.Error ? error.message : "요청을 처리하지 못했습니다."; }
