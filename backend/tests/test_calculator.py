from dataclasses import replace
from datetime import date
from decimal import Decimal
from unittest import TestCase

from app.domain.calculator import DomainValidationError, calculate_forecast
from app.domain.models import Account, AccountType, Event, EventStatus, EventType


AS_OF = date(2026, 7, 31)


def account(account_id: str, kind: AccountType, balance: str) -> Account:
    return Account(account_id, account_id, kind, Decimal(balance), AS_OF)


def event(
    event_id: str,
    kind: EventType,
    amount: str,
    source: str | None = None,
    destination: str | None = None,
    when: date | None = None,
) -> Event:
    return Event(
        id=event_id,
        month=(when or date(2026, 8, 2)).replace(day=1),
        event_date=when,
        name=event_id,
        amount=Decimal(amount),
        type=kind,
        status=EventStatus.PLANNED,
        source_account_id=source,
        destination_account_id=destination,
    )


class CalculationEngineTests(TestCase):
    def test_transfer_does_not_change_net_worth(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "1000"), account("savings", AccountType.SAVINGS, "500")],
            [event("save", EventType.TRANSFER, "300", "cash", "savings")],
            3,
        )
        august = result.months[1]
        self.assertEqual(august.cash, Decimal("700"))
        self.assertEqual(august.net_worth, Decimal("1500"))

    def test_debt_draw_keeps_net_worth_constant(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "1000"), account("loan", AccountType.DEBT, "800")],
            [event("draw", EventType.DEBT_DRAW, "200", "loan", "cash")],
            3,
        )
        august = result.months[1]
        self.assertEqual(august.cash, Decimal("1200"))
        self.assertEqual(august.debt, Decimal("1000"))
        self.assertEqual(august.net_worth, Decimal("200"))

    def test_principal_repayment_keeps_net_worth_constant(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "1000"), account("loan", AccountType.DEBT, "800")],
            [event("repay", EventType.DEBT_PRINCIPAL_REPAYMENT, "200", "cash", "loan")],
            3,
        )
        self.assertEqual(result.months[1].net_worth, Decimal("200"))

    def test_interest_reduces_cash_and_net_worth(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "1000"), account("loan", AccountType.DEBT, "800")],
            [event("interest", EventType.DEBT_INTEREST, "20", "cash")],
            3,
        )
        self.assertEqual(result.months[1].cash, Decimal("980"))
        self.assertEqual(result.months[1].net_worth, Decimal("180"))

    def test_same_day_events_are_batched(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "100")],
            [
                event("income", EventType.INCOME, "100", destination="cash"),
                event("expense", EventType.EXPENSE, "150", source="cash"),
            ],
            3,
        )
        self.assertEqual(result.months[1].cash, Decimal("50"))
        self.assertEqual(result.risks, ())

    def test_cash_shortage_records_lowest_cash_and_date(self) -> None:
        result = calculate_forecast(
            [account("cash", AccountType.CASH, "100")],
            [
                event("rent", EventType.EXPENSE, "150", "cash", when=date(2026, 8, 5)),
                event("payday", EventType.INCOME, "100", destination="cash", when=date(2026, 8, 25)),
            ],
            3,
        )
        self.assertEqual(result.months[1].lowest_cash, Decimal("-50"))
        self.assertEqual(result.months[1].lowest_cash_date, date(2026, 8, 5))
        self.assertEqual(result.risks[0].type, "CASH_SHORTAGE")

    def test_cancelled_event_is_ignored(self) -> None:
        cancelled = event("cancelled", EventType.EXPENSE, "100", "cash")
        cancelled = replace(cancelled, status=EventStatus.CANCELLED)
        result = calculate_forecast([account("cash", AccountType.CASH, "100")], [cancelled], 3)
        self.assertEqual(result.months[1].cash, Decimal("100"))

    def test_all_accounts_need_same_as_of_date(self) -> None:
        mismatched = Account("savings", "savings", AccountType.SAVINGS, Decimal("0"), date(2026, 8, 2))
        with self.assertRaises(DomainValidationError):
            calculate_forecast([account("cash", AccountType.CASH, "100"), mismatched], [], 3)
