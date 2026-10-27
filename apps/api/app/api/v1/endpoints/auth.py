from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.rate_limit import rate_limit_auth
from app.core.security import (
    create_access_token,
    generate_secure_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.token import EmailVerificationToken, PasswordResetToken
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership
from app.schemas.token import (
    EmailVerificationRequest,
    ForgotPasswordRequest,
    GenericMessageResponse,
    ResendVerificationRequest,
    ResetPasswordRequest,
    TokenResponse,
)
from app.schemas.user import UserLoginRequest, UserRegisterRequest, UserResponse
from app.services.disposable_email import disposable_email_checker
from app.services.email import get_email_service

router = APIRouter()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit_auth("register", max_requests=10, window_seconds=300))],
)
def register(
    data: UserRegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    email_clean = data.email.lower().strip()

    # 1. Disposable email verification check
    if disposable_email_checker.is_disposable(email_clean):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Temporary or disposable email addresses are not accepted. Please use a permanent email address.",
        )

    # 2. Check for duplicate email
    existing_user = db.scalar(select(User).where(User.email == email_clean))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # 3. Create user, personal workspace, membership, and verification token in atomic transaction
    hashed_pwd = get_password_hash(data.password)
    user = User(
        email=email_clean,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        hashed_password=hashed_pwd,
        is_active=True,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # Populates user.id

    # Create default personal workspace
    workspace_name = f"{user.first_name}'s Workspace"
    workspace = Workspace(
        name=workspace_name,
        timezone="Europe/London",
    )
    db.add(workspace)
    db.flush()

    # Add owner membership
    membership = WorkspaceMembership(
        user_id=user.id,
        workspace_id=workspace.id,
        role="owner",
    )
    db.add(membership)

    # Create email verification token (24 hours expiry)
    verify_token_str = generate_secure_token()
    token_obj = EmailVerificationToken(
        user_id=user.id,
        token=verify_token_str,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
        is_used=False,
    )
    db.add(token_obj)
    db.commit()
    db.refresh(user)

    # Send verification email via configured service
    email_service = get_email_service()
    email_service.send_verification_email(
        to_email=user.email,
        first_name=user.first_name,
        token=verify_token_str,
    )

    access_token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit_auth("login", max_requests=15, window_seconds=300))],
)
def login(
    data: UserLoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    email_clean = data.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email_clean))
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been deactivated. Please contact support.",
        )

    access_token = create_access_token(subject=user.id)
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/logout", response_model=GenericMessageResponse)
def logout():
    return GenericMessageResponse(message="Logged out successfully.")


def ensure_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


@router.post("/verify-email", response_model=GenericMessageResponse)
def verify_email(
    data: EmailVerificationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    stmt = select(EmailVerificationToken).where(EmailVerificationToken.token == data.token.strip())
    token_obj = db.scalar(stmt)
    now = datetime.now(UTC)

    if not token_obj or token_obj.is_used or ensure_utc(token_obj.expires_at) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The verification link is invalid or has expired. Please request a new verification email.",
        )

    # Mark token used and verify user
    token_obj.is_used = True
    user = db.scalar(select(User).where(User.id == token_obj.user_id))
    if user:
        user.is_verified = True
    db.commit()

    return GenericMessageResponse(message="Email verified successfully. You now have full access to your workspace.")


@router.post(
    "/resend-verification",
    response_model=GenericMessageResponse,
    dependencies=[Depends(rate_limit_auth("resend_verify", max_requests=5, window_seconds=600))],
)
def resend_verification(
    data: ResendVerificationRequest,
    db: Annotated[Session, Depends(get_db)],
):
    email_clean = data.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email_clean))

    # Anti-enumeration: always return generic message
    generic_msg = "If an account exists for that email and is unverified, a new verification link has been sent."

    if user and not user.is_verified:
        verify_token_str = generate_secure_token()
        token_obj = EmailVerificationToken(
            user_id=user.id,
            token=verify_token_str,
            expires_at=datetime.now(UTC) + timedelta(hours=24),
            is_used=False,
        )
        db.add(token_obj)
        db.commit()

        email_service = get_email_service()
        email_service.send_verification_email(
            to_email=user.email,
            first_name=user.first_name,
            token=verify_token_str,
        )

    return GenericMessageResponse(message=generic_msg)


@router.post(
    "/forgot-password",
    response_model=GenericMessageResponse,
    dependencies=[Depends(rate_limit_auth("forgot_pwd", max_requests=5, window_seconds=600))],
)
def forgot_password(
    data: ForgotPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    email_clean = data.email.lower().strip()
    user = db.scalar(select(User).where(User.email == email_clean))

    # Anti-enumeration generic response
    generic_msg = "If an account with that email exists, password reset instructions have been sent."

    if user and user.is_active:
        reset_token_str = generate_secure_token()
        token_obj = PasswordResetToken(
            user_id=user.id,
            token=reset_token_str,
            expires_at=datetime.now(UTC) + timedelta(hours=1),
            is_used=False,
        )
        db.add(token_obj)
        db.commit()

        email_service = get_email_service()
        email_service.send_password_reset_email(
            to_email=user.email,
            first_name=user.first_name,
            token=reset_token_str,
        )

    return GenericMessageResponse(message=generic_msg)


@router.post("/reset-password", response_model=GenericMessageResponse)
def reset_password(
    data: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
):
    stmt = select(PasswordResetToken).where(PasswordResetToken.token == data.token.strip())
    token_obj = db.scalar(stmt)
    now = datetime.now(UTC)

    if not token_obj or token_obj.is_used or ensure_utc(token_obj.expires_at) < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The password reset link is invalid or has expired. Please request a new one.",
        )

    token_obj.is_used = True
    user = db.scalar(select(User).where(User.id == token_obj.user_id))
    if user:
        user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    return GenericMessageResponse(message="Password has been reset successfully. You can now sign in with your new password.")


@router.get("/me")
def get_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
):
    # Fetch user memberships and workspaces
    memberships = db.scalars(
        select(WorkspaceMembership).where(WorkspaceMembership.user_id == current_user.id)
    ).all()

    workspaces = []
    for m in memberships:
        ws = db.scalar(select(Workspace).where(Workspace.id == m.workspace_id))
        if ws:
            workspaces.append({
                "id": ws.id,
                "name": ws.name,
                "timezone": ws.timezone,
                "role": m.role,
                "created_at": ws.created_at,
            })

    return {
        "user": UserResponse.model_validate(current_user),
        "workspaces": workspaces,
    }
