from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import StrEnum


class AccountType(StrEnum):
    CASH = "CASH"
    SAVINGS = "SAVINGS"
    INVESTMENT = "INVESTMENT"
    DEBT = "DEBT"
    OTHER_ASSET = "OTHER_ASSET"


class Liquidity(StrEnum):
    LIQUID = "LIQUID"
    ILLIQUID = "ILLIQUID"


class EventType(StrEnum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"
    TRANSFER = "TRANSFER"
    INVESTMENT_CONTRIBUTION = "INVESTMENT_CONTRIBUTION"
    INVESTMENT_WITHDRAWAL = "INVESTMENT_WITHDRAWAL"
    ASSET_VALUE_UPDATE = "ASSET_VALUE_UPDATE"
    DEBT_DRAW = "DEBT_DRAW"
    DEBT_PRINCIPAL_REPAYMENT = "DEBT_PRINCIPAL_REPAYMENT"
    DEBT_INTEREST = "DEBT_INTEREST"
    SAVINGS_MATURITY = "SAVINGS_MATURITY"


class EventStatus(StrEnum):
    PLANNED = "PLANNED"
    CONFIRMED = "CONFIRMED"
    CHANGED = "CHANGED"
    CANCELLED = "CANCELLED"


@dataclass(frozen=True, slots=True)
class Account:
    id: str
    name: str
    type: AccountType
    current_balance: Decimal
    as_of_date: date
    currency: str = "KRW"
    liquidity: Liquidity = Liquidity.LIQUID
    emergency_fund_eligible: bool = False


@dataclass(frozen=True, slots=True)
class Event:
    id: str
    month: date
    name: str
    amount: Decimal
    type: EventType
    status: EventStatus = EventStatus.PLANNED
    event_date: date | None = None
    source_account_id: str | None = None
    destination_account_id: str | None = None
    recurrence_months: int | None = None
    recurrence_until: date | None = None
    note: str | None = None

    @property
    def effective_date(self) -> date:
        return self.event_date or self.month.replace(day=1)


@dataclass(frozen=True, slots=True)
class EventContribution:
    event_id: str
    event_name: str
    amount: Decimal
    account_deltas: dict[str, Decimal]


@dataclass(frozen=True, slots=True)
class RiskResult:
    type: str
    date: date
    cash_balance: Decimal
    event_ids: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class MonthlyForecast:
    month: date
    balances: dict[str, Decimal]
    cash: Decimal
    assets: Decimal
    debt: Decimal
    net_worth: Decimal
    lowest_cash: Decimal
    lowest_cash_date: date | None
    contributions: tuple[EventContribution, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class Forecast:
    months: tuple[MonthlyForecast, ...]
    risks: tuple[RiskResult, ...]
