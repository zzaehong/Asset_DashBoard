from dataclasses import asdict
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.domain.calculator import DomainValidationError, calculate_forecast, validate_event
from app.domain.models import Event
from app.infrastructure.database import SessionLocal
from app.infrastructure.repository import PlannerRepository
from app.infrastructure.tables import AccountRow, EventRow

from .schemas import AccountPayload, AccountResponse, EventPayload, EventResponse

router = APIRouter()


def get_session():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def account_response(row: AccountRow) -> AccountResponse:
    return AccountResponse.model_validate(row, from_attributes=True)


def event_response(row: EventRow) -> EventResponse:
    return EventResponse.model_validate(row, from_attributes=True)


def validate_event_payload(payload: EventPayload, repo: PlannerRepository, event_id: str) -> None:
    candidate = Event(
        id=event_id,
        month=payload.month,
        name=payload.name,
        amount=payload.amount,
        type=payload.type,
        status=payload.status,
        event_date=payload.event_date,
        source_account_id=payload.source_account_id,
        destination_account_id=payload.destination_account_id,
        recurrence_months=payload.recurrence_months,
        recurrence_until=payload.recurrence_until,
        note=payload.note,
    )
    try:
        validate_event(candidate, {account.id: account for account in repo.list_accounts()})
    except DomainValidationError as error:
        raise HTTPException(422, str(error)) from error


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/accounts", response_model=list[AccountResponse])
def list_accounts(session: Session = Depends(get_session)) -> list[AccountResponse]:
    repo = PlannerRepository(session)
    return [account_response(repo.get_account(account.id)) for account in repo.list_accounts()]


@router.post("/accounts", response_model=AccountResponse, status_code=201)
def create_account(payload: AccountPayload, session: Session = Depends(get_session)) -> AccountResponse:
    repo = PlannerRepository(session)
    existing = repo.list_accounts()
    if existing and any(account.as_of_date != payload.as_of_date for account in existing):
        raise HTTPException(422, "All active accounts must use the same as_of_date.")
    row = repo.save_account(AccountRow(id=str(uuid4()), **payload.model_dump()))
    return account_response(row)


@router.patch("/accounts/{account_id}", response_model=AccountResponse)
def update_account(account_id: str, payload: AccountPayload, session: Session = Depends(get_session)) -> AccountResponse:
    repo = PlannerRepository(session)
    row = repo.get_account(account_id)
    if not row:
        raise HTTPException(404, "Account not found.")
    if any(account.id != account_id and account.as_of_date != payload.as_of_date for account in repo.list_accounts()):
        raise HTTPException(422, "All active accounts must use the same as_of_date.")
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    return account_response(repo.save_account(row))


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: str, session: Session = Depends(get_session)) -> None:
    if not PlannerRepository(session).delete_account(account_id):
        raise HTTPException(404, "Account not found.")


@router.get("/events", response_model=list[EventResponse])
def list_events(session: Session = Depends(get_session)) -> list[EventResponse]:
    repo = PlannerRepository(session)
    return [event_response(repo.get_event(event.id)) for event in repo.list_events()]


@router.post("/events", response_model=EventResponse, status_code=201)
def create_event(payload: EventPayload, session: Session = Depends(get_session)) -> EventResponse:
    repo = PlannerRepository(session)
    event_id = str(uuid4())
    validate_event_payload(payload, repo, event_id)
    row = repo.save_event(EventRow(id=event_id, **payload.model_dump()))
    return event_response(row)


@router.patch("/events/{event_id}", response_model=EventResponse)
def update_event(event_id: str, payload: EventPayload, session: Session = Depends(get_session)) -> EventResponse:
    repo = PlannerRepository(session)
    row = repo.get_event(event_id)
    if not row:
        raise HTTPException(404, "Event not found.")
    validate_event_payload(payload, repo, event_id)
    for key, value in payload.model_dump().items():
        setattr(row, key, value)
    return event_response(repo.save_event(row))


@router.delete("/events/{event_id}", status_code=204)
def delete_event(event_id: str, session: Session = Depends(get_session)) -> None:
    if not PlannerRepository(session).delete_event(event_id):
        raise HTTPException(404, "Event not found.")


@router.get("/forecast")
def forecast(
    period_months: int = Query(12),
    cash_safety_threshold: Decimal = Query(Decimal("0")),
    session: Session = Depends(get_session),
) -> dict:
    repo = PlannerRepository(session)
    try:
        result = calculate_forecast(repo.list_accounts(), repo.list_events(), period_months, cash_safety_threshold)
    except DomainValidationError as error:
        raise HTTPException(422, str(error)) from error
    return {
        "months": [asdict(item) for item in result.months],
        "risks": [asdict(item) for item in result.risks],
    }
