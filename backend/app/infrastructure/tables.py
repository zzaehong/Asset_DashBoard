from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class AccountRow(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(30))
    currency: Mapped[str] = mapped_column(String(3), default="KRW")
    current_balance: Mapped[Decimal] = mapped_column(Numeric(18, 0))
    as_of_date: Mapped[date] = mapped_column(Date)
    liquidity: Mapped[str] = mapped_column(String(20), default="LIQUID")
    emergency_fund_eligible: Mapped[bool] = mapped_column(Boolean, default=False)


class EventRow(Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    month: Mapped[date] = mapped_column(Date)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    name: Mapped[str] = mapped_column(String(120))
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 0))
    type: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20))
    source_account_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    destination_account_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    recurrence_months: Mapped[int | None] = mapped_column(nullable=True)
    recurrence_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
