from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..area_scope import apply_area_scope
from ..auth import get_current_user
from ..db import get_db
from ..models import User, Voter
from ..schemas import StatsSummary

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _counts_by(db: Session, user: User, column) -> dict[str, int]:
    q = select(column, func.count()).where(Voter.deleted_at.is_(None), column.is_not(None), column != "")
    q = apply_area_scope(q, user, db)
    rows = db.execute(q.group_by(column).order_by(func.count().desc()).limit(20)).all()
    return {str(k): v for k, v in rows}


@router.get("/summary", response_model=StatsSummary)
def stats_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    base = apply_area_scope(select(func.count()).where(Voter.deleted_at.is_(None)), user, db)
    total = db.scalar(base) or 0
    flagged = db.scalar(base.where(Voter.is_flagged.is_(True))) or 0

    return StatsSummary(
        total_voters=total,
        flagged_count=flagged,
        by_ward=_counts_by(db, user, Voter.ward),
        by_upazila=_counts_by(db, user, Voter.upazila),
        by_gender=_counts_by(db, user, Voter.gender),
    )
