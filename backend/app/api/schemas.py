from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.models import AccountType, EventStatus, EventType, Liquidity


class AccountPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)
    type: AccountType
    current_balance: Decimal = Field(ge=0)
    as_of_date: date
    currency: str = "KRW"
    liquidity: Liquidity = Liquidity.LIQUID
    emergency_fund_eligible: bool = False


class AccountResponse(AccountPayload):
    id: str


class EventPayload(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

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

    @model_validator(mode="after")
    def validate_recurrence(self) -> "EventPayload":
        if self.recurrence_until and not self.recurrence_months:
            raise ValueError("recurrence_until requires recurrence_months.")
        if self.recurrence_until and self.recurrence_until < self.event_date:
            raise ValueError("recurrence_until cannot be earlier than event_date.")
        return self


class EventResponse(EventPayload):
    id: str
    month: date
