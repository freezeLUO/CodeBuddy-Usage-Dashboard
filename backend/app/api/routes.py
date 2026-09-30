from datetime import date
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from ..refresh import refresh
from . import queries
from .models import (
    ConversationDetail,
    ConversationList,
    Meta,
    Models,
    Overview,
    Projects,
    RefreshResult,
    Timeseries,
)

router = APIRouter(prefix="/api")


def _filters(
    start_date: date | None,
    end_date: date | None,
    workspace: list[str] | None,
    model: list[str] | None,
) -> queries.Filters:
    return queries.Filters(start_date, end_date, workspace, model)


@router.get("/overview", response_model=Overview)
def get_overview(
    start_date: date | None = Query(None, description="起始日期（含），本地时区"),
    end_date: date | None = Query(None, description="结束日期（含），本地时区"),
    workspace: list[str] | None = Query(None, description="工作区 hash，可重复"),
    model: list[str] | None = Query(None, description="模型 id，可重复"),
):
    return queries.overview(_filters(start_date, end_date, workspace, model))


@router.get("/timeseries", response_model=Timeseries)
def get_timeseries(
    granularity: Literal["day", "week"] = "day",
    start_date: date | None = None,
    end_date: date | None = None,
    workspace: list[str] | None = Query(None),
    model: list[str] | None = Query(None),
):
    items = queries.timeseries(
        _filters(start_date, end_date, workspace, model), granularity
    )
    return {"items": items}


@router.get("/projects", response_model=Projects)
def get_projects(
    start_date: date | None = None,
    end_date: date | None = None,
    workspace: list[str] | None = Query(None),
    model: list[str] | None = Query(None),
):
    return {"items": queries.projects(_filters(start_date, end_date, workspace, model))}


@router.get("/models", response_model=Models)
def get_models(
    start_date: date | None = None,
    end_date: date | None = None,
    workspace: list[str] | None = Query(None),
    model: list[str] | None = Query(None),
):
    return {"items": queries.models(_filters(start_date, end_date, workspace, model))}


@router.get("/conversations", response_model=ConversationList)
def get_conversations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=200),
    q: str | None = None,
    sort: str = "ended_at_ms",
    order: Literal["asc", "desc"] = "desc",
    start_date: date | None = None,
    end_date: date | None = None,
    workspace: list[str] | None = Query(None),
    model: list[str] | None = Query(None),
):
    return queries.conversations(
        _filters(start_date, end_date, workspace, model), page, size, q, sort, order
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
def get_conversation(
    conversation_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    workspace: list[str] | None = Query(None),
    model: list[str] | None = Query(None),
):
    detail = queries.conversation_detail(
        _filters(start_date, end_date, workspace, model), conversation_id
    )
    if detail is None:
        raise HTTPException(status_code=404, detail="conversation not found")
    return detail


@router.post("/refresh", response_model=RefreshResult)
def post_refresh():
    return refresh()


@router.get("/meta", response_model=Meta)
def get_meta():
    return queries.meta()
