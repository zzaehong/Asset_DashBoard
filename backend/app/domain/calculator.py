from __future__ import annotations

from collections import defaultdict
from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Iterable

from .models import (
    Account,
    AccountType,
    Event,
    EventContribution,
    EventStatus,
    EventType,
    Forecast,
    MonthlyForecast,
    RiskResult,
)

SUPPORTED_PERIODS = {3, 6, 12}
PHASE_TWO_EVENT_TYPES = {
    EventType.INCOME,
    EventType.EXPENSE,
    EventType.TRANSFER,
    EventType.INVESTMENT_CONTRIBUTION,
    EventType.DEBT_DRAW,
    EventType.DEBT_PRINCIPAL_REPAYMENT,
    EventType.DEBT_INTEREST,
    EventType.SAVINGS_MATURITY,
}


class DomainValidationError(ValueError):
    pass


def month_start(value: date) -> date:
    return value.replace(day=1)


def add_months(value: date, months: int) -> date:
    serial = value.year * 12 + value.month - 1 + months
    return date(serial // 12, serial % 12 + 1, 1)


def validate_accounts(accounts: Iterable[Account]) -> dict[str, Account]:
    account_list = list(accounts)
    by_id = {account.id: account for account in account_list}
    if not by_id:
        raise DomainValidationError("At least one account is required.")
    as_of_dates = {account.as_of_date for account in by_id.values()}
    if len(as_of_dates) != 1:
        raise DomainValidationError("All accounts must share the same as_of_date.")
    if len(by_id) != len(account_list):
        raise DomainValidationError("Account ids must be unique.")
    if any(account.current_balance < Decimal("0") for account in account_list):
        raise DomainValidationError("Account balances cannot be negative.")
    return by_id


def _require_type(accounts: dict[str, Account], account_id: str | None, expected: set[AccountType]) -> Account:
    if account_id is None or account_id not in accounts:
        raise DomainValidationError("A required account is missing.")
    account = accounts[account_id]
    if account.type not in expected:
        expected_values = ", ".join(sorted(item.value for item in expected))
        raise DomainValidationError(f"Account '{account.name}' must be one of: {expected_values}.")
    return account


def validate_event(event: Event, accounts: dict[str, Account]) -> None:
    if event.amount <= Decimal("0"):
        raise DomainValidationError("Event amount must be greater than zero.")
    if event.type not in PHASE_TWO_EVENT_TYPES:
        raise DomainValidationError(f"{event.type.value} is not available in the Phase 2 MVP.")
    if event.event_date and month_start(event.event_date) != month_start(event.month):
        raise DomainValidationError("event_date must belong to event month.")
    if event.recurrence_until and not event.recurrence_months:
        raise DomainValidationError("recurrence_until requires recurrence_months.")
    if event.recurrence_months is not None and event.recurrence_months <= 0:
        raise DomainValidationError("recurrence_months must be greater than zero.")
    if event.recurrence_until and event.recurrence_until < event.effective_date:
        raise DomainValidationError("recurrence_until cannot be earlier than event_date.")

    if event.type is EventType.INCOME:
        _require_type(accounts, event.destination_account_id, {AccountType.CASH, AccountType.SAVINGS})
    elif event.type in {EventType.EXPENSE, EventType.DEBT_INTEREST}:
        _require_type(accounts, event.source_account_id, {AccountType.CASH})
    elif event.type is EventType.TRANSFER:
        source = _require_type(accounts, event.source_account_id, {AccountType.CASH, AccountType.SAVINGS})
        destination = _require_type(accounts, event.destination_account_id, {AccountType.CASH, AccountType.SAVINGS})
        if source.id == destination.id:
            raise DomainValidationError("Transfer accounts must be different.")
    elif event.type is EventType.INVESTMENT_CONTRIBUTION:
        _require_type(accounts, event.source_account_id, {AccountType.CASH})
        _require_type(accounts, event.destination_account_id, {AccountType.INVESTMENT})
    elif event.type is EventType.DEBT_DRAW:
        _require_type(accounts, event.source_account_id, {AccountType.DEBT})
        _require_type(accounts, event.destination_account_id, {AccountType.CASH})
    elif event.type is EventType.DEBT_PRINCIPAL_REPAYMENT:
        _require_type(accounts, event.source_account_id, {AccountType.CASH})
        _require_type(accounts, event.destination_account_id, {AccountType.DEBT})
    elif event.type is EventType.SAVINGS_MATURITY:
        _require_type(accounts, event.source_account_id, {AccountType.SAVINGS})
        _require_type(accounts, event.destination_account_id, {AccountType.CASH})


def _event_deltas(event: Event) -> dict[str, Decimal]:
    amount = event.amount
    if event.type is EventType.INCOME:
        return {event.destination_account_id: amount}  # type: ignore[dict-item]
    if event.type in {EventType.EXPENSE, EventType.DEBT_INTEREST}:
        return {event.source_account_id: -amount}  # type: ignore[dict-item]
    if event.type in {EventType.TRANSFER, EventType.INVESTMENT_CONTRIBUTION, EventType.SAVINGS_MATURITY}:
        return {event.source_account_id: -amount, event.destination_account_id: amount}  # type: ignore[dict-item]
    if event.type is EventType.DEBT_DRAW:
        return {event.source_account_id: amount, event.destination_account_id: amount}  # type: ignore[dict-item]
    if event.type is EventType.DEBT_PRINCIPAL_REPAYMENT:
        return {event.source_account_id: -amount, event.destination_account_id: -amount}  # type: ignore[dict-item]
    raise DomainValidationError(f"No ledger rule for {event.type.value}.")


def _expand_recurrence(event: Event, horizon_end: date) -> list[Event]:
    if not event.recurrence_months:
        return [event]
    until = min(event.recurrence_until or horizon_end, horizon_end)
    result: list[Event] = []
    offset = 0
    while True:
        occurrence_month = add_months(month_start(event.month), offset)
        if occurrence_month > month_start(until):
            break
        event_date = None
        if event.event_date:
            occurrence_start = add_months(event.event_date.replace(day=1), offset)
            event_date = occurrence_start.replace(day=min(event.event_date.day, monthrange(occurrence_start.year, occurrence_start.month)[1]))
        result.append(
            Event(
                id=f"{event.id}:{offset}",
                month=occurrence_month,
                event_date=event_date,
                name=event.name,
                amount=event.amount,
                type=event.type,
                status=event.status,
                source_account_id=event.source_account_id,
                destination_account_id=event.destination_account_id,
                note=event.note,
            )
        )
        offset += event.recurrence_months
    return result


def calculate_forecast(
    accounts: Iterable[Account],
    events: Iterable[Event],
    period_months: int = 12,
    cash_safety_threshold: Decimal = Decimal("0"),
) -> Forecast:
    if period_months not in SUPPORTED_PERIODS:
        raise DomainValidationError("period_months must be one of 3, 6, or 12.")
    account_list = list(accounts)
    accounts_by_id = validate_accounts(account_list)
    as_of_date = next(iter(accounts_by_id.values())).as_of_date
    start_month = month_start(as_of_date)
    horizon_end = add_months(start_month, period_months - 1)

    expanded: list[Event] = []
    for event in events:
        validate_event(event, accounts_by_id)
        if event.status is EventStatus.CANCELLED or event.effective_date <= as_of_date:
            continue
        expanded.extend(_expand_recurrence(event, horizon_end))

    grouped: dict[date, list[Event]] = defaultdict(list)
    for event in expanded:
        if start_month <= month_start(event.effective_date) <= horizon_end:
            grouped[event.effective_date].append(event)

    balances = {account.id: account.current_balance for account in account_list}
    forecasts: list[MonthlyForecast] = []
    risks: list[RiskResult] = []
    for month_offset in range(period_months):
        month = add_months(start_month, month_offset)
        month_events = sorted(
            (item for event_date, items in grouped.items() if month_start(event_date) == month for item in items),
            key=lambda item: (item.effective_date, item.id),
        )
        contributions: list[EventContribution] = []
        lowest_cash = _cash_total(balances, accounts_by_id)
        lowest_cash_date: date | None = None

        by_date: dict[date, list[Event]] = defaultdict(list)
        for event in month_events:
            by_date[event.effective_date].append(event)
        for event_date in sorted(by_date):
            daily_deltas: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
            daily_events = by_date[event_date]
            for event in daily_events:
                deltas = _event_deltas(event)
                for account_id, delta in deltas.items():
                    daily_deltas[account_id] += delta
                contributions.append(EventContribution(event.id, event.name, event.amount, deltas))
            for account_id, delta in daily_deltas.items():
                balances[account_id] += delta
            cash = _cash_total(balances, accounts_by_id)
            if cash < lowest_cash:
                lowest_cash, lowest_cash_date = cash, event_date
            if cash < Decimal("0"):
                risks.append(RiskResult("CASH_SHORTAGE", event_date, cash, tuple(item.id for item in daily_events)))
            if any(item.type is EventType.INVESTMENT_CONTRIBUTION for item in daily_events) and cash < cash_safety_threshold:
                risks.append(RiskResult("INVESTMENT_CASH_SHORTAGE", event_date, cash, tuple(item.id for item in daily_events)))

        assets = sum(
            (balance for account_id, balance in balances.items() if accounts_by_id[account_id].type is not AccountType.DEBT),
            Decimal("0"),
        )
        debt = sum(
            (balance for account_id, balance in balances.items() if accounts_by_id[account_id].type is AccountType.DEBT),
            Decimal("0"),
        )
        forecasts.append(
            MonthlyForecast(
                month=month,
                balances=dict(balances),
                cash=_cash_total(balances, accounts_by_id),
                assets=assets,
                debt=debt,
                net_worth=assets - debt,
                lowest_cash=lowest_cash,
                lowest_cash_date=lowest_cash_date,
                contributions=tuple(contributions),
            )
        )
    return Forecast(tuple(forecasts), tuple(risks))


def _cash_total(balances: dict[str, Decimal], accounts: dict[str, Account]) -> Decimal:
    return sum(
        (balance for account_id, balance in balances.items() if accounts[account_id].type is AccountType.CASH),
        Decimal("0"),
    )
