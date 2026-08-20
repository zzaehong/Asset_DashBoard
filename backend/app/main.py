from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.infrastructure.database import Base, engine
from app.infrastructure import tables  # noqa: F401

app = FastAPI(title="Monthly Asset Flow Planner", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
