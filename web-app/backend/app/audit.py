# -*- coding: utf-8 -*-
"""সিস্টেম-ব্যাপী action লগ করার হেল্পার (কে, কী, কখন করলো) -- Voter-এর ফিল্ড-লেভেল history
(models.AuditLog)-এর থেকে আলাদা উদ্দেশ্য। কমিট caller-এর দায়িত্ব -- এই ফাংশন শুধু db.add() করে,
যাতে একই ট্রানজেকশনে মূল অ্যাকশনের সাথে একবারেই কমিট হয়।"""
from fastapi import Request
from sqlalchemy.orm import Session

from .models import ActivityLog, User


def _client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def log_activity(
    db: Session, user: User | None, action: str,
    detail: dict | None = None, request: Request | None = None,
) -> None:
    db.add(ActivityLog(
        user_id=user.id if user else None,
        action=action,
        detail=detail,
        ip=_client_ip(request),
    ))
