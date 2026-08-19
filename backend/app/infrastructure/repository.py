from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.models import Account, AccountType, Event, EventStatus, EventType, Liquidity

from .tables import AccountRow, EventRow


class PlannerRepository:
    def __init__(self, session: Session):
        self.session = session

    def list_accounts(self) -> list[Account]:
        return [self._account_from_row(row) for row in self.session.scalars(select(AccountRow).order_by(AccountRow.name))]

    def get_account(self, account_id: str) -> AccountRow | None:
        return self.session.get(AccountRow, account_id)

    def save_account(self, row: AccountRow) -> AccountRow:
        self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return row

    def delete_account(self, account_id: str) -> bool:
        row = self.get_account(account_id)
        if not row:
            return False
        self.session.delete(row)
        self.session.commit()
        return True

    def list_events(self) -> list[Event]:
        return [self._event_from_row(row) for row in self.session.scalars(select(EventRow).order_by(EventRow.month, EventRow.event_date))]

    def get_event(self, event_id: str) -> EventRow | None:
        return self.session.get(EventRow, event_id)

    def save_event(self, row: EventRow) -> EventRow:
        self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return row

    def delete_event(self, event_id: str) -> bool:
        row = self.get_event(event_id)
        if not row:
            return False
        self.session.delete(row)
        self.session.commit()
        return True

    @staticmethod
    def _account_from_row(row: AccountRow) -> Account:
        return Account(row.id, row.name, AccountType(row.type), row.current_balance, row.as_of_date, row.currency,
                       Liquidity(row.liquidity), row.emergency_fund_eligible)

    @staticmethod
    def _event_from_row(row: EventRow) -> Event:
        return Event(row.id, row.month, row.name, row.amount, EventType(row.type), EventStatus(row.status),
                     row.event_date, row.source_account_id, row.destination_account_id, row.recurrence_months,
                     row.recurrence_until, row.note)
