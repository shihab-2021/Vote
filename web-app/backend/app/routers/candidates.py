# -*- coding: utf-8 -*-
"""প্রার্থীর ব্র্যান্ডিং প্রোফাইল (প্রতীক/ছবি/স্লোগান/রঙ) ব্যবস্থাপনা। manage_candidates
(super_admin) দিয়ে যেকোনো প্রার্থী তৈরি/এডিট করা যায়; manage_own_template দিয়ে একজন candidate
শুধু নিজের প্রোফাইল (/me) এডিট করতে পারেন -- User.candidate_id দিয়ে নিজেরটা খুঁজে বের করা হয়।

গুরুত্বপূর্ণ: /me রুটগুলো /{candidate_id} রুটের আগে ডিফাইন করা -- নাহলে Starlette
"/candidates/me"-কে "/candidates/{candidate_id}" প্যাটার্নে ম্যাচ করে "me"-কে int হিসেবে
পার্স করতে গিয়ে 422 দিত (candidate_id-এর টাইপ-চেক রাউট-ম্যাচিং না, প্যারামিটার-ভ্যালিডেশনের
সময় হয়, তাই আগে রেজিস্টার করা লিটারেল পাথই আগে জেতে)।"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import log_activity
from ..auth import require_permission
from ..db import get_db
from ..models import Candidate, User
from ..schemas import CandidateCreate, CandidateOut, CandidateUpdate

router = APIRouter(prefix="/api/candidates", tags=["candidates"])

MAX_IMAGE_BYTES = 2 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg"}


def _serialize(c: Candidate) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "constituency_label": c.constituency_label,
        "symbol_name": c.symbol_name,
        "slogan": c.slogan,
        "primary_color": c.primary_color,
        "accent_color": c.accent_color,
        "is_active": c.is_active,
        "has_symbol_image": c.symbol_image is not None,
        "has_photo_image": c.photo_image is not None,
        "created_at": c.created_at,
    }


async def _read_validated_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "শুধু PNG/JPEG ছবি সমর্থিত")
    content = await file.read()
    if len(content) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "ছবির আকার সর্বোচ্চ ২ মেগাবাইট হতে পারে")
    return content


@router.get("/me", response_model=CandidateOut)
def get_my_candidate(db: Session = Depends(get_db), user: User = Depends(require_permission("manage_own_template"))):
    if not user.candidate_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "কোনো প্রার্থী প্রোফাইলের সাথে যুক্ত নন")
    candidate = db.get(Candidate, user.candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    return _serialize(candidate)


@router.patch("/me", response_model=CandidateOut)
def update_my_candidate(
    payload: CandidateUpdate, request: Request,
    db: Session = Depends(get_db), user: User = Depends(require_permission("manage_own_template")),
):
    if not user.candidate_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "কোনো প্রার্থী প্রোফাইলের সাথে যুক্ত নন")
    candidate = db.get(Candidate, user.candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    # নিজে name/is_active বদলাতে পারবেন না -- সেগুলো শুধু manage_candidates (super_admin)-এর আওতায়
    changes = payload.model_dump(exclude_unset=True, exclude={"name", "is_active"})
    for k, v in changes.items():
        setattr(candidate, k, v)
    log_activity(db, user, "candidate_template_update", detail={"candidate_id": candidate.id, **changes}, request=request)
    db.commit()
    db.refresh(candidate)
    return _serialize(candidate)


@router.post("/me/image")
async def upload_my_candidate_image(
    request: Request, kind: str, file: UploadFile,
    db: Session = Depends(get_db), user: User = Depends(require_permission("manage_own_template")),
):
    if kind not in ("symbol", "photo"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "kind হতে হবে symbol অথবা photo")
    if not user.candidate_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "কোনো প্রার্থী প্রোফাইলের সাথে যুক্ত নন")
    candidate = db.get(Candidate, user.candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    content = await _read_validated_image(file)
    setattr(candidate, f"{kind}_image", content)
    log_activity(db, user, "candidate_image_upload", detail={"candidate_id": candidate.id, "kind": kind}, request=request)
    db.commit()
    return {"status": "ok"}


@router.get("", response_model=list[CandidateOut])
def list_candidates(db: Session = Depends(get_db), _user: User = Depends(require_permission("manage_candidates"))):
    return [_serialize(c) for c in db.scalars(select(Candidate).order_by(Candidate.id)).all()]


@router.post("", response_model=CandidateOut, status_code=status.HTTP_201_CREATED)
def create_candidate(
    payload: CandidateCreate, request: Request,
    db: Session = Depends(get_db), actor: User = Depends(require_permission("manage_candidates")),
):
    candidate = Candidate(**payload.model_dump(), created_by=actor.id)
    db.add(candidate)
    log_activity(db, actor, "candidate_create", detail={"name": candidate.name}, request=request)
    db.commit()
    db.refresh(candidate)
    return _serialize(candidate)


@router.patch("/{candidate_id}", response_model=CandidateOut)
def update_candidate(
    candidate_id: int, payload: CandidateUpdate, request: Request,
    db: Session = Depends(get_db), actor: User = Depends(require_permission("manage_candidates")),
):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(candidate, k, v)
    log_activity(db, actor, "candidate_update", detail={"candidate_id": candidate_id, **changes}, request=request)
    db.commit()
    db.refresh(candidate)
    return _serialize(candidate)


@router.post("/{candidate_id}/image")
async def upload_candidate_image(
    candidate_id: int, request: Request, kind: str, file: UploadFile,
    db: Session = Depends(get_db), actor: User = Depends(require_permission("manage_candidates")),
):
    if kind not in ("symbol", "photo"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "kind হতে হবে symbol অথবা photo")
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    content = await _read_validated_image(file)
    setattr(candidate, f"{kind}_image", content)
    log_activity(db, actor, "candidate_image_upload", detail={"candidate_id": candidate_id, "kind": kind}, request=request)
    db.commit()
    return {"status": "ok"}


@router.get("/{candidate_id}/image/{kind}")
def get_candidate_image(
    candidate_id: int, kind: str,
    db: Session = Depends(get_db), user: User = Depends(require_permission("view_voter")),
):
    """view_voter থাকা যে কেউ দেখতে পারেন -- এটা প্রার্থীর নিজের প্রকাশ্য ব্র্যান্ডিং ছবি, ভোটার
    ডেটা না, তাই তার নিজের/এজেন্টের প্রিন্ট-প্রিভিউ ও অ্যাডমিনের তালিকা দুই জায়গাতেই লাগে।"""
    if kind not in ("symbol", "photo"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "kind হতে হবে symbol অথবা photo")
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "প্রার্থী পাওয়া যায়নি")
    content = getattr(candidate, f"{kind}_image")
    if not content:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ছবি নেই")
    return Response(content=content, media_type="image/png")
