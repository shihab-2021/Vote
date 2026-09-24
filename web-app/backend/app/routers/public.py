# -*- coding: utf-8 -*-
"""পাবলিক (লগইন ছাড়া) ভোটার-তথ্য যাচাই -- একজন নাগরিক নিজের নাম+পিতার নাম+জন্ম তারিখ দিয়ে
নিজের ভোটার নম্বর ও ভোটকেন্দ্রের তথ্য নিশ্চিত করতে পারেন। এটা কোনো সাধারণ সার্চ না -- হুবহু তিনটা
তথ্য না মিললে কিছুই ফেরত দেয় না (partial/ILIKE ম্যাচ না), তাই শুধু নাম দিয়ে অন্য কারো তথ্য বের
করা যায় না। একাধিক মিল হলে (নাম-সংঘর্ষ) candidate-দের তালিকা দেখানো হয় না -- মাতার নাম চাওয়া হয়
আরও নির্দিষ্ট করার জন্য। রেসপন্সেও শুধু নির্বাচন-সংক্রান্ত তথ্য থাকে -- ঠিকানা/পেশা/পিতামাতার
নাম কখনো ফেরত যায় না।"""
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Voter
from ..rate_limit import check_rate_limit

router = APIRouter(prefix="/api/public", tags=["public"])


class PublicLookupRequest(BaseModel):
    name: str
    father_name: str
    dob: str
    mother_name: str | None = None


class PublicVoterOut(BaseModel):
    name: str
    voter_no: str | None
    serial_no: str | None
    ward: str | None
    upazila: str | None
    union_name: str | None
    area_name: str | None


class PublicLookupResult(BaseModel):
    found: bool
    need_mother_name: bool = False
    voter: PublicVoterOut | None = None


def _to_public(v: Voter) -> PublicVoterOut:
    return PublicVoterOut(
        name=v.name, voter_no=v.voter_no, serial_no=v.serial_no,
        ward=v.ward, upazila=v.upazila, union_name=v.union_name, area_name=v.area_name,
    )


@router.post("/voter-lookup", response_model=PublicLookupResult)
def voter_lookup(payload: PublicLookupRequest, request: Request, db: Session = Depends(get_db)):
    check_rate_limit(request, key="voter-lookup")

    name = payload.name.strip()
    father_name = payload.father_name.strip()
    dob = payload.dob.strip()
    if not name or not father_name or not dob:
        return PublicLookupResult(found=False)

    matches = db.scalars(
        select(Voter).where(
            Voter.deleted_at.is_(None),
            Voter.name == name, Voter.father_name == father_name, Voter.dob == dob,
        ).limit(5)
    ).all()

    if len(matches) == 1:
        return PublicLookupResult(found=True, voter=_to_public(matches[0]))

    if len(matches) > 1:
        mother_name = (payload.mother_name or "").strip()
        if not mother_name:
            return PublicLookupResult(found=False, need_mother_name=True)
        narrowed = [m for m in matches if (m.mother_name or "").strip() == mother_name]
        if len(narrowed) == 1:
            return PublicLookupResult(found=True, voter=_to_public(narrowed[0]))

    return PublicLookupResult(found=False)
