from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_workspace_membership, require_workspace_role
from app.db.session import get_db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.schemas.workspace import (
    WorkspaceCreateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)

router = APIRouter()


@router.get("", response_model=list[WorkspaceResponse])
def list_workspaces(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    memberships = db.scalars(
        select(WorkspaceMembership).where(WorkspaceMembership.user_id == current_user.id)
    ).all()

    workspaces = []
    for m in memberships:
        ws = db.scalar(select(Workspace).where(Workspace.id == m.workspace_id))
        if ws:
            workspaces.append(
                WorkspaceResponse(
                    id=ws.id,
                    name=ws.name,
                    timezone=ws.timezone,
                    role=m.role,
                    created_at=ws.created_at,
                )
            )
    return workspaces


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace(
    data: WorkspaceCreateRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    workspace = Workspace(
        name=data.name.strip(),
        timezone=data.timezone.strip() if data.timezone else "Europe/London",
    )
    db.add(workspace)
    db.flush()

    membership = WorkspaceMembership(
        user_id=current_user.id,
        workspace_id=workspace.id,
        role="owner",
    )
    db.add(membership)
    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        timezone=workspace.timezone,
        role="owner",
        created_at=workspace.created_at,
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace(
    workspace_id: str,
    membership: Annotated[WorkspaceMembership, Depends(get_workspace_membership)],
    db: Annotated[Session, Depends(get_db)],
):
    workspace = db.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        timezone=workspace.timezone,
        role=membership.role,
        created_at=workspace.created_at,
    )


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace(
    workspace_id: str,
    data: WorkspaceUpdateRequest,
    membership: Annotated[WorkspaceMembership, Depends(require_workspace_role(["owner", "manager"]))],
    db: Annotated[Session, Depends(get_db)],
):
    workspace = db.scalar(select(Workspace).where(Workspace.id == workspace_id))
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found.",
        )

    if data.name is not None:
        workspace.name = data.name.strip()
    if data.timezone is not None:
        workspace.timezone = data.timezone.strip()

    db.commit()
    db.refresh(workspace)

    return WorkspaceResponse(
        id=workspace.id,
        name=workspace.name,
        timezone=workspace.timezone,
        role=membership.role,
        created_at=workspace.created_at,
    )
