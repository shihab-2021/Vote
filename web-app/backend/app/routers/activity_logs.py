# -*- coding: utf-8 -*-
"""অডিট/অ্যাক্টিভিটি লগ ভিউয়ার -- শুধু view_audit_logs পারমিশনধারী (আপাতত super_admin) দেখতে পারেন।"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_permission
from ..db import get_db
from ..models import ActivityLog, User

router = APIRouter(prefix="/api/activity-logs", tags=["audit"])


def _serialize(log: ActivityLog, usernames: dict[int, str]) -> dict:
    return {
        "id": log.id,
        "user_id": log.user_id,
        "username": usernames.get(log.user_id, "—") if log.user_id else "—",
        "action": log.action,
        "detail": log.detail,
        "ip": log.ip,
        "created_at": log.created_at,
    }


@router.get("")
def list_activity_logs(
    page: int = 1, page_size: int = 50,
    db: Session = Depends(get_db), _user: User = Depends(require_permission("view_audit_logs")),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)

    total = db.scalar(select(func.count()).select_from(ActivityLog))
    logs = db.scalars(
        select(ActivityLog).order_by(ActivityLog.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    ).all()

    user_ids = {l.user_id for l in logs if l.user_id}
    usernames: dict[int, str] = {}
    if user_ids:
        rows = db.execute(select(User.id, User.username).where(User.id.in_(user_ids))).all()
        usernames = dict(rows)

    return {
        "items": [_serialize(l, usernames) for l in logs],
        "total": total or 0, "page": page, "page_size": page_size,
    }
