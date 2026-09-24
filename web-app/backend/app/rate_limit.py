# -*- coding: utf-8 -*-
"""পাবলিক (লগইন ছাড়া) এন্ডপয়েন্টের জন্য সাধারণ ইন-মেমরি rate limiter -- IP অনুযায়ী সময়-জানালায়
সর্বোচ্চ কতবার চেষ্টা করা যাবে তা সীমিত করে, যাতে কেউ স্ক্রিপ্ট দিয়ে বারবার লুকআপ চেষ্টা করে
ডেটা হাতড়াতে না পারে। সার্ভার রিস্টার্ট হলে বা একাধিক সার্ভার ইনস্ট্যান্স থাকলে এই কাউন্টার
শেয়ার হয় না -- বর্তমান স্কেলে যথেষ্ট, বড় পাবলিক ট্রাফিক এলে প্রকৃত CAPTCHA যোগ করা উচিত।"""
import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status

_LOCK = threading.Lock()
_ATTEMPTS: dict[str, list[datetime]] = defaultdict(list)

DEFAULT_LIMIT = 8
DEFAULT_WINDOW = timedelta(minutes=15)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(
    request: Request, key: str, limit: int = DEFAULT_LIMIT, window: timedelta = DEFAULT_WINDOW,
) -> None:
    bucket_key = f"{key}:{_client_ip(request)}"
    now = datetime.now(timezone.utc)
    with _LOCK:
        attempts = [t for t in _ATTEMPTS[bucket_key] if now - t < window]
        if len(attempts) >= limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "অনেকবার চেষ্টা করা হয়েছে -- কিছুক্ষণ পর আবার চেষ্টা করুন",
            )
        attempts.append(now)
        _ATTEMPTS[bucket_key] = attempts
