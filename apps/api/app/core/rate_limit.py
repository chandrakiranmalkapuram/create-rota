import threading
from collections import defaultdict
from datetime import UTC, datetime

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """
    In-memory thread-safe sliding window rate limiter for security-sensitive endpoints.
    Tracks timestamps of requests per bucket key.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._buckets: dict[str, list[float]] = defaultdict(list)
        self.enabled: bool = True

    def check_rate_limit(self, key: str, max_requests: int, window_seconds: int) -> None:
        if not self.enabled:
            return

        now = datetime.now(UTC).timestamp()
        window_start = now - window_seconds

        with self._lock:
            # Filter out timestamps outside the active sliding window
            timestamps = [ts for ts in self._buckets[key] if ts > window_start]
            if len(timestamps) >= max_requests:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many attempts. Please wait a few minutes before trying again.",
                )
            timestamps.append(now)
            self._buckets[key] = timestamps

    def reset(self) -> None:
        with self._lock:
            self._buckets.clear()


limiter = SlidingWindowRateLimiter()


def rate_limit_auth(
    action: str,
    max_requests: int = 10,
    window_seconds: int = 300,
):
    """FastAPI dependency to rate limit by client IP and action."""
    def dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        bucket_key = f"{action}:{client_ip}"
        limiter.check_rate_limit(bucket_key, max_requests, window_seconds)
    return dependency
