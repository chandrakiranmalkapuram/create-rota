from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    timezone: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    timezone: str = Field(default="Europe/London", max_length=50)


class WorkspaceUpdateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=150)
    timezone: str | None = Field(None, max_length=50)
