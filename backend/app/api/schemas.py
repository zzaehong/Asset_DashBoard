from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.domain.models import AccountType, EventStatus, EventType, Liquidity


class AccountPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: AccountType
    current_balance: Decimal
    as_of_date: date
    currency: str = "KRW"
    liquidity: Liquidity = Liquidity.LIQUID
    emergency_fund_eligible: bool = False


class AccountResponse(AccountPayload):
    id: str


class EventPayload(BaseModel):
    month: date | None = None
    name: str = Field(min_length=1, max_length=120)
    amount: Decimal = Field(gt=0)
    type: EventType
    status: EventStatus = EventStatus.PLANNED
    event_date: date
    source_account_id: str | None = None
    destination_account_id: str | None = None
    recurrence_months: int | None = Field(default=None, gt=0)
    recurrence_until: date | None = None
    note: str | None = None


class EventResponse(EventPayload):
    id: str
    month: date
    event_date: date | None = None
