from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import select

from app.models.token import EmailVerificationToken
from app.models.user import User
from app.services.email import memory_email_sink


def test_register_success(client, db_session):
    payload = {
        "first_name": "Jordan",
        "last_name": "Miller",
        "email": "jordan.miller@example.com",
        "password": "SecurePassword123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "jordan.miller@example.com"
    assert data["user"]["first_name"] == "Jordan"
    assert data["user"]["is_verified"] is False

    # Verify user exists in database
    user = db_session.scalar(select(User).where(User.email == "jordan.miller@example.com"))
    assert user is not None
    assert user.is_verified is False

    # Verify verification email was queued
    email_record = memory_email_sink.get_latest_for("jordan.miller@example.com")
    assert email_record is not None
    assert email_record.link_type == "verification"


def test_register_rejects_disposable_email(client):
    payload = {
        "first_name": "Spam",
        "last_name": "User",
        "email": "fake.user@mailinator.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "disposable" in response.json()["detail"].lower()


def test_register_duplicate_email_fails(client):
    payload = {
        "first_name": "Alex",
        "last_name": "Smith",
        "email": "alex.smith@example.com",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == status.HTTP_201_CREATED

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in res2.json()["detail"]


def test_login_flow(client):
    # Register first
    client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Sam",
            "last_name": "Ray",
            "email": "sam.ray@example.com",
            "password": "ValidPassword99#",
        },
    )

    # Valid login
    res = client.post(
        "/api/v1/auth/login",
        json={"email": "sam.ray@example.com", "password": "ValidPassword99#"},
    )
    assert res.status_code == status.HTTP_200_OK
    assert "access_token" in res.json()

    # Invalid password
    res_bad = client.post(
        "/api/v1/auth/login",
        json={"email": "sam.ray@example.com", "password": "WrongPassword"},
    )
    assert res_bad.status_code == status.HTTP_401_UNAUTHORIZED

    # Non-existent email
    res_no = client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@example.com", "password": "WrongPassword"},
    )
    assert res_no.status_code == status.HTTP_401_UNAUTHORIZED


def test_email_verification_flow(client, db_session):
    client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Taylor",
            "last_name": "Swift",
            "email": "taylor@example.com",
            "password": "Password123!",
        },
    )
    email_rec = memory_email_sink.get_latest_for("taylor@example.com")
    token = email_rec.token

    # Verify email
    res = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert res.status_code == status.HTTP_200_OK
    assert "verified" in res.json()["message"].lower()

    # User in db should be verified
    user = db_session.scalar(select(User).where(User.email == "taylor@example.com"))
    assert user.is_verified is True

    # Reusing the token should fail (single-use constraint)
    res_reuse = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert res_reuse.status_code == status.HTTP_400_BAD_REQUEST


def test_email_verification_expired_token(client, db_session):
    client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Casey",
            "last_name": "Lee",
            "email": "casey@example.com",
            "password": "Password123!",
        },
    )
    email_rec = memory_email_sink.get_latest_for("casey@example.com")
    token = email_rec.token

    # Manually expire the token in database
    token_obj = db_session.scalar(select(EmailVerificationToken).where(EmailVerificationToken.token == token))
    token_obj.expires_at = datetime.now(UTC) - timedelta(hours=1)
    db_session.commit()

    # Attempt verification with expired token
    res = client.post("/api/v1/auth/verify-email", json={"token": token})
    assert res.status_code == status.HTTP_400_BAD_REQUEST


def test_password_reset_flow(client, db_session):
    # Register user
    client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Morgan",
            "last_name": "Freeman",
            "email": "morgan@example.com",
            "password": "OldPassword123!",
        },
    )

    # Forgot password
    res_forgot = client.post("/api/v1/auth/forgot-password", json={"email": "morgan@example.com"})
    assert res_forgot.status_code == status.HTTP_200_OK

    email_rec = memory_email_sink.get_latest_for("morgan@example.com")
    assert email_rec is not None
    assert email_rec.link_type == "password_reset"
    reset_token = email_rec.token

    # Reset password
    res_reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "NewStrongPassword456!"},
    )
    assert res_reset.status_code == status.HTTP_200_OK

    # Old password no longer works
    res_old = client.post(
        "/api/v1/auth/login",
        json={"email": "morgan@example.com", "password": "OldPassword123!"},
    )
    assert res_old.status_code == status.HTTP_401_UNAUTHORIZED

    # New password works
    res_new = client.post(
        "/api/v1/auth/login",
        json={"email": "morgan@example.com", "password": "NewStrongPassword456!"},
    )
    assert res_new.status_code == status.HTTP_200_OK

    # Reusing reset token fails
    res_reuse = client.post(
        "/api/v1/auth/reset-password",
        json={"token": reset_token, "new_password": "AnotherPassword789!"},
    )
    assert res_reuse.status_code == status.HTTP_400_BAD_REQUEST


def test_get_me_endpoint(client):
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Chris",
            "last_name": "Pine",
            "email": "chris.pine@example.com",
            "password": "PinePassword123!",
        },
    )
    token = reg.json()["access_token"]

    # Without token -> 401
    res_unauth = client.get("/api/v1/auth/me")
    assert res_unauth.status_code == status.HTTP_401_UNAUTHORIZED

    # With valid token -> 200
    res_me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_me.status_code == status.HTTP_200_OK
    data = res_me.json()
    assert data["user"]["email"] == "chris.pine@example.com"
    assert len(data["workspaces"]) == 1
    assert data["workspaces"][0]["name"] == "Chris's Workspace"
    assert data["workspaces"][0]["role"] == "owner"


def test_resend_verification_flow(client):
    client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Robin",
            "last_name": "Hood",
            "email": "robin@sherwood.com",
            "password": "Password123!",
        },
    )
    res = client.post("/api/v1/auth/resend-verification", json={"email": "robin@sherwood.com"})
    assert res.status_code == status.HTTP_200_OK
    assert "verification link has been sent" in res.json()["message"]


def test_rate_limiting_protection(client):
    # Registration endpoint limit is 10 requests per window
    payload = {
        "first_name": "Spam",
        "last_name": "Bot",
        "email": "bot@legitimate-provider.com",
        "password": "Password123!",
    }
    for i in range(10):
        p = {**payload, "email": f"bot{i}@legitimate-provider.com"}
        res = client.post("/api/v1/auth/register", json=p)
        assert res.status_code == status.HTTP_201_CREATED

    # 11th request from same IP should trigger 429
    res_throttled = client.post(
        "/api/v1/auth/register",
        json={**payload, "email": "bot11@legitimate-provider.com"},
    )
    assert res_throttled.status_code == status.HTTP_429_TOO_MANY_REQUESTS
    assert "too many attempts" in res_throttled.json()["detail"].lower()
