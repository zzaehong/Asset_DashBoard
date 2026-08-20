from datetime import date
from decimal import Decimal
from unittest import TestCase

from pydantic import ValidationError

from app.api.schemas import AccountPayload
from app.domain.models import AccountType


class AccountPayloadTests(TestCase):
    def test_current_balance_cannot_be_negative(self) -> None:
        with self.assertRaises(ValidationError):
            AccountPayload(
                name="생활비 통장",
                type=AccountType.CASH,
                current_balance=Decimal("-1"),
                as_of_date=date(2026, 8, 20),
            )
