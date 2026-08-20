from datetime import date
from decimal import Decimal
from unittest import TestCase

from pydantic import ValidationError

from app.api.schemas import AccountPayload, EventPayload
from app.domain.models import AccountType, EventType


class AccountPayloadTests(TestCase):
    def test_current_balance_cannot_be_negative(self) -> None:
        with self.assertRaises(ValidationError):
            AccountPayload(
                name="생활비 통장",
                type=AccountType.CASH,
                current_balance=Decimal("-1"),
                as_of_date=date(2026, 8, 20),
            )


class EventPayloadTests(TestCase):
    def payload(self, **overrides) -> EventPayload:
        values = {
            "name": "월급",
            "amount": Decimal("100"),
            "type": EventType.INCOME,
            "event_date": date(2026, 8, 25),
            "destination_account_id": "cash",
        }
        return EventPayload(**(values | overrides))

    def test_recurrence_end_requires_interval(self) -> None:
        with self.assertRaises(ValidationError):
            self.payload(recurrence_until=date(2026, 10, 25))

    def test_recurrence_end_cannot_precede_event_date(self) -> None:
        with self.assertRaises(ValidationError):
            self.payload(recurrence_months=1, recurrence_until=date(2026, 8, 24))
