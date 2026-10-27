import re
from typing import ClassVar, Protocol


class DisposableEmailChecker(Protocol):
    def is_disposable(self, email: str) -> bool:
        """Return True if the email domain is identified as a disposable/temporary email provider."""
        ...

    def is_valid_email_format(self, email: str) -> bool:
        """Return True if the email format is structurally valid."""
        ...


class DefaultDisposableEmailChecker:
    """
    Server-side disposable email checker.
    Maintains a curated list of high-confidence disposable email provider domains.
    Provides methods to check domains and validate email syntax without blocking legitimate providers.
    """

    EMAIL_REGEX = re.compile(
        r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
    )

    DISPOSABLE_DOMAINS: ClassVar[set[str]] = {
        # High confidence temporary/throwaway email providers
        "10minutemail.com",
        "10minutemail.net",
        "10minutemail.org",
        "dispostable.com",
        "dropmail.me",
        "fakeinbox.com",
        "getairmail.com",
        "guerrillamail.biz",
        "guerrillamail.com",
        "guerrillamail.de",
        "guerrillamail.net",
        "guerrillamail.org",
        "guerrillamailblock.com",
        "mailinator.com",
        "mailinator.net",
        "mailinator2.com",
        "nada.ltd",
        "sharklasers.com",
        "temp-mail.org",
        "tempmail.com",
        "tempmail.net",
        "throwawaymail.com",
        "trashmail.com",
        "trashmail.net",
        "trashmail.org",
        "yopmail.com",
        "yopmail.fr",
        "yopmail.net",
    }

    def __init__(self, additional_domains: set[str] | None = None):
        self._domains = set(self.DISPOSABLE_DOMAINS)
        if additional_domains:
            self._domains.update(d.lower() for d in additional_domains)

    def is_valid_email_format(self, email: str) -> bool:
        if not email or not isinstance(email, str):
            return False
        email = email.strip()
        if len(email) > 254 or len(email) < 3:
            return False
        if ".." in email or email.startswith(".") or email.endswith("."):
            return False
        return bool(self.EMAIL_REGEX.match(email))

    def is_disposable(self, email: str) -> bool:
        if not self.is_valid_email_format(email):
            return False
        domain = email.strip().split("@")[-1].lower()
        return domain in self._domains


# Global singleton instance
disposable_email_checker = DefaultDisposableEmailChecker()
