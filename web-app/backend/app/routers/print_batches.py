# -*- coding: utf-8 -*-
"""প্রিন্ট ব্যাচ -- ফিল্টার করা ভোটারদের একসাথে কার্ড PDF তৈরি + প্রিন্ট/বিতরণ অবস্থা ট্র্যাক করা।
ব্যাচ তৈরির সময় VotersPage-এ যে ফিল্টার সক্রিয় থাকে হুবহু সেটাই ব্যবহার হয় (build_voter_query
দিয়ে) -- তাই "কী দেখা যাচ্ছে" আর "কাদের কার্ড তৈরি হবে" সবসময় মিলে যায়।"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_activity
from ..auth import require_permission
from ..card_pdf import build_batch_pdf
from ..db import get_db
from ..models import PrintBatch, PrintBatchItem, User, Voter
from .voters import build_voter_query

router = APIRouter(prefix="/api/print-batches", tags=["print"])

MAX_BATCH_SIZE = 2000  # ভুলবশত পুরো ডেটাসেটের কার্ড তৈরি হয়ে যাওয়া আটকাতে


def _serialize_batch(batch: PrintBatch) -> dict:
    printed = sum(1 for i in batch.items if i.status in ("printed", "distributed"))
    distributed = sum(1 for i in batch.items if i.status == "distributed")
    return {
        "id": batch.id,
        "label": batch.label,
        "voter_count": batch.voter_count,
        "printed_count": printed,
        "distributed_count": distributed,
        "created_at": batch.created_at,
        "printed_at": batch.printed_at,
    }


def _get_owned_batch(batch_id: int, user: User, db: Session) -> PrintBatch:
    batch = db.get(PrintBatch, batch_id)
    if not batch or (user.role.key != "super_admin" and batch.created_by != user.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ব্যাচ পাওয়া যায়নি")
    return batch


@router.post("")
def create_batch(
    request: Request,
    search: str = "", ward: str = "", upazila: str = "", union: str = "",
    flagged: bool | None = None, filters: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("generate_voter_card")),
):
    q = build_voter_query(
        db, user, search=search, ward=ward, upazila=upazila, union=union,
        flagged=flagged, filters=filters,
    )
    voter_ids = db.scalars(q.with_only_columns(Voter.id)).all()
    if not voter_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "এই ফিল্টারে কোনো ভোটার পাওয়া যায়নি")
    if len(voter_ids) > MAX_BATCH_SIZE:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"একটা ব্যাচে সর্বোচ্চ {MAX_BATCH_SIZE} জন -- ফিল্টার আরও নির্দিষ্ট করুন "
            f"({len(voter_ids)} জন মিলেছে)",
        )

    label = search or ward or upazila or union or "সব ভোটার"
    batch = PrintBatch(created_by=user.id, label=f"{label} ({len(voter_ids)} জন)", voter_count=len(voter_ids))
    db.add(batch)
    db.flush()
    for vid in voter_ids:
        db.add(PrintBatchItem(batch_id=batch.id, voter_id=vid, status="pending"))
    log_activity(db, user, "print_batch_create", detail={"batch_id": batch.id, "voter_count": len(voter_ids)}, request=request)
    db.commit()
    db.refresh(batch)
    return _serialize_batch(batch)


@router.get("")
def list_batches(db: Session = Depends(get_db), user: User = Depends(require_permission("print_voter"))):
    q = select(PrintBatch).order_by(PrintBatch.created_at.desc())
    if user.role.key != "super_admin":
        q = q.where(PrintBatch.created_by == user.id)
    batches = db.scalars(q).all()
    return [_serialize_batch(b) for b in batches]


@router.get("/{batch_id}")
def get_batch(batch_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission("print_voter"))):
    batch = _get_owned_batch(batch_id, user, db)
    items = db.scalars(
        select(PrintBatchItem).where(PrintBatchItem.batch_id == batch_id).order_by(PrintBatchItem.id)
    ).all()
    return {
        **_serialize_batch(batch),
        "items": [
            {
                "id": it.id,
                "voter_id": it.voter_id,
                "name": it.voter.name,
                "voter_no": it.voter.voter_no,
                "address": it.voter.address,
                "status": it.status,
                "distributed_at": it.distributed_at,
            }
            for it in items
        ],
    }


@router.get("/{batch_id}/pdf")
def download_batch_pdf(
    batch_id: int, request: Request,
    db: Session = Depends(get_db), user: User = Depends(require_permission("print_voter")),
):
    batch = _get_owned_batch(batch_id, user, db)
    items = db.scalars(select(PrintBatchItem).where(PrintBatchItem.batch_id == batch_id)).all()
    voters = [it.voter for it in items]

    pdf_bytes = build_batch_pdf(voters)

    first_print = batch.printed_at is None
    if first_print:
        batch.printed_at = datetime.now(timezone.utc)
        for it in items:
            if it.status == "pending":
                it.status = "printed"
    log_activity(db, user, "print_batch_pdf_download", detail={"batch_id": batch.id, "first_print": first_print}, request=request)
    db.commit()

    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="print-batch-{batch_id}.pdf"'},
    )


@router.post("/{batch_id}/items/{voter_id}/distribute")
def mark_distributed(
    batch_id: int, voter_id: int, request: Request, db: Session = Depends(get_db),
    user: User = Depends(require_permission("print_voter")),
):
    _get_owned_batch(batch_id, user, db)
    item = db.scalar(
        select(PrintBatchItem).where(PrintBatchItem.batch_id == batch_id, PrintBatchItem.voter_id == voter_id)
    )
    if not item:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "এন্ট্রি পাওয়া যায়নি")
    item.status = "distributed"
    item.distributed_at = datetime.now(timezone.utc)
    log_activity(db, user, "print_batch_distribute_one", detail={"batch_id": batch_id, "voter_id": voter_id}, request=request)
    db.commit()
    return {"status": "ok"}


@router.post("/{batch_id}/distribute-all")
def distribute_all(
    batch_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_permission("print_voter")),
):
    _get_owned_batch(batch_id, user, db)
    now = datetime.now(timezone.utc)
    items = db.scalars(select(PrintBatchItem).where(PrintBatchItem.batch_id == batch_id)).all()
    for it in items:
        if it.status != "distributed":
            it.status = "distributed"
            it.distributed_at = now
    log_activity(db, user, "print_batch_distribute_all", detail={"batch_id": batch_id, "count": len(items)}, request=request)
    db.commit()
    return {"status": "ok", "count": len(items)}
