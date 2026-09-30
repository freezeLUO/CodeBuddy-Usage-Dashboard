from pydantic import BaseModel


class Overview(BaseModel):
    total_input_tokens: int
    total_output_tokens: int
    total_tokens: int
    total_credit: float
    request_count: int
    conversation_count: int
    workspace_count: int
    cache_hit_ratio: float
    thinking_tokens: int
    avg_elapsed_ms: float
    date_min: int | None
    date_max: int | None


class TimePoint(BaseModel):
    bucket: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    credit: float
    requests: int


class Timeseries(BaseModel):
    items: list[TimePoint]


class ProjectUsage(BaseModel):
    workspace_hash: str
    display_name: str
    path: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    credit: float
    requests: int
    conversations: int


class Projects(BaseModel):
    items: list[ProjectUsage]


class ModelUsage(BaseModel):
    model_id: str
    model_name: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    credit: float
    requests: int
    cache_hit_ratio: float


class Models(BaseModel):
    items: list[ModelUsage]


class ConversationListItem(BaseModel):
    conversation_id: str
    title: str | None
    workspace_hash: str
    display_name: str
    path: str
    started_at_ms: int | None
    ended_at_ms: int | None
    request_count: int
    message_count: int
    total_tokens: int
    input_tokens: int
    output_tokens: int
    credit: float
    models: list[str]


class ConversationList(BaseModel):
    total: int
    page: int
    size: int
    items: list[ConversationListItem]


class RequestItem(BaseModel):
    request_id: str
    started_at_ms: int
    model_id: str | None
    model_name: str | None
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cache_tokens: int
    cached_miss_tokens: int
    last_tokens: int
    credit: float
    thinking_tokens: int
    elapsed_ms: int | None
    agent_message_count: int
    cache_hit_ratio: float


class ConversationDetail(BaseModel):
    conversation_id: str
    title: str | None
    workspace_hash: str
    display_name: str
    path: str
    started_at_ms: int | None
    ended_at_ms: int | None
    request_count: int
    message_count: int
    total_tokens: int
    credit: float
    requests: list[RequestItem]


class RefreshResult(BaseModel):
    added: int
    updated: int
    deleted: int
    errors: int
    scanned: int
    duration_ms: int
    db_path: str


class Meta(BaseModel):
    last_refresh_ms: int | None
    db_path: str
    workspace_count: int
    conversation_count: int
