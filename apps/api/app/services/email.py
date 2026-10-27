from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.core.config import settings
from app.core.logging import logger


@dataclass
class EmailRecord:
    to_email: str
    subject: str
    text_content: str
    token: str
    link_type: str  # "verification" or "password_reset"


class BaseEmailService(ABC):
    @abstractmethod
    def send_verification_email(self, to_email: str, first_name: str, token: str) -> bool:
        """Send account email verification link."""
        ...

    @abstractmethod
    def send_password_reset_email(self, to_email: str, first_name: str, token: str) -> bool:
        """Send password reset link."""
        ...


class MemoryEmailSink(BaseEmailService):
    """
    In-memory email sink for testing and local zero-dependency development.
    Stores sent email records in an accessible outbox.
    """

    def __init__(self):
        self.outbox: list[EmailRecord] = []

    def clear(self) -> None:
        self.outbox.clear()

    def get_latest_for(self, email: str) -> EmailRecord | None:
        for record in reversed(self.outbox):
            if record.to_email.lower() == email.lower():
                return record
        return None

    def send_verification_email(self, to_email: str, first_name: str, token: str) -> bool:
        text = f"Hi {first_name}, please verify your email using token: {token}"
        self.outbox.append(EmailRecord(to_email, "Verify your Create Rota account", text, token, "verification"))
        logger.debug("[MemoryEmailSink] Verification email queued for %s", to_email)
        return True

    def send_password_reset_email(self, to_email: str, first_name: str, token: str) -> bool:
        text = f"Hi {first_name}, please reset your password using token: {token}"
        self.outbox.append(EmailRecord(to_email, "Reset your Create Rota password", text, token, "password_reset"))
        logger.debug("[MemoryEmailSink] Password reset email queued for %s", to_email)
        return True


class ConsoleEmailService(BaseEmailService):
    """
    Console email service for local development.
    Prints formatted email notifications and verification/reset links to the development terminal.
    """

    def send_verification_email(self, to_email: str, first_name: str, token: str) -> bool:
        verification_link = f"http://localhost:5173/verify-email?token={token}"
        logger.info(
            "\n" + "=" * 60 + "\n"
            + f"📧 [LOCAL DEV EMAIL] Verification sent to: {to_email}\n"
            + f"Hi {first_name}! Verify your account:\n"
            + f"🔗 Verification URL: {verification_link}\n"
            + "=" * 60 + "\n"
        )
        return True

    def send_password_reset_email(self, to_email: str, first_name: str, token: str) -> bool:
        reset_link = f"http://localhost:5173/reset-password?token={token}"
        logger.info(
            "\n" + "=" * 60 + "\n"
            + f"📧 [LOCAL DEV EMAIL] Password reset sent to: {to_email}\n"
            + f"Hi {first_name}! Reset your password:\n"
            + f"🔗 Password Reset URL: {reset_link}\n"
            + "=" * 60 + "\n"
        )
        return True


# Global in-memory sink instance used for testing and sink mode
memory_email_sink = MemoryEmailSink()


def get_email_service() -> BaseEmailService:
    provider = settings.EMAIL_PROVIDER.lower()
    if provider == "sink":
        return memory_email_sink
    return ConsoleEmailService()
