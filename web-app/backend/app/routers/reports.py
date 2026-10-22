# -*- coding: utf-8 -*-
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import case, cast, func, select, Integer
from sqlalchemy.orm import Session

from ..area_scope import apply_area_scope
from ..auth import require_any_permission
from ..db import get_db
from ..models import User, Voter
from ..schemas import (
    AddressVoterStats,
    AreaReportSummary,
    LocationOptionsResponse,
    VoterReportResponse,
    WardReport,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _distinct_values(
    db: Session,
    user: User,
    column: Any,
    filters: list[Any] | None = None,
    order_numeric: bool = False,
) -> list[str]:
    q = select(column).where(
        Voter.deleted_at.is_(None),
        column.isnot(None),
        column != "",
    )
    q = apply_area_scope(q, user, db)
    if filters:
        for f in filters:
            q = q.where(f)

    q = q.distinct()
    items = [str(r[0]).strip() for r in db.execute(q).all() if r[0] and str(r[0]).strip()]

    if order_numeric:
        return sorted(items, key=lambda x: (0, int(x)) if x.isdigit() else (1, x))
    return sorted(items)


@router.get("/locations", response_model=LocationOptionsResponse)
def get_report_locations(
    district: str = "",
    municipality: str = "",
    upazila: str = "",
    union_name: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("view_reports", "view_voter")),
):
    """ক্যাসকেডিং ফিল্টারের জন্য ভৌগোলিক এলাকা অপশন সরবরাহ করে।
    প্যারেন্ট সিলেকশন অনুযায়ী চাইল্ড অপশনগুলো প্রাসঙ্গিকভাবে ফিল্টার হয়।
    """
    # জেলা তালিকা
    districts = _distinct_values(db, user, Voter.district)

    # পৌরসভা তালিকা -- জেলা সিলেক্ট থাকলে সেই জেলার পৌরসভাগুলো
    m_filters = []
    if district:
        m_filters.append(Voter.district == district)
    municipalities = _distinct_values(db, user, Voter.municipality, m_filters)

    # উপজেলা তালিকা -- জেলা ও/বা পৌরসভা সিলেক্ট থাকলে সে অনুযায়ী
    u_filters = []
    if district:
        u_filters.append(Voter.district == district)
    if municipality:
        u_filters.append(Voter.municipality == municipality)
    upazilas = _distinct_values(db, user, Voter.upazila, u_filters)

    # ইউনিয়ন/ওয়ার্ড তালিকা -- প্যারেন্ট সিলেকশন অনুযায়ী
    un_filters = []
    if district:
        un_filters.append(Voter.district == district)
    if municipality:
        un_filters.append(Voter.municipality == municipality)
    if upazila:
        un_filters.append(Voter.upazila == upazila)
    unions = _distinct_values(db, user, Voter.union_name, un_filters)

    # ওয়ার্ড তালিকা -- জেলা, পৌরসভা, উপজেলা, ইউনিয়ন অনুযায়ী
    w_filters = []
    if district:
        w_filters.append(Voter.district == district)
    if municipality:
        w_filters.append(Voter.municipality == municipality)
    if upazila:
        w_filters.append(Voter.upazila == upazila)
    if union_name:
        w_filters.append(Voter.union_name == union_name)
    wards = _distinct_values(db, user, Voter.ward, w_filters, order_numeric=True)

    return LocationOptionsResponse(
        districts=districts,
        municipalities=municipalities,
        upazilas=upazilas,
        unions=unions,
        wards=wards,
    )


@router.get("/voters", response_model=VoterReportResponse)
def get_voter_report(
    district: str = "",
    municipality: str = "",
    upazila: str = "",
    union_name: str = "",
    ward: str = "",
    db: Session = Depends(get_db),
    user: User = Depends(require_any_permission("view_reports", "view_voter")),
):
    """নির্বাচিত এলাকার ওয়ার্ড ও ঠিকানা/বাড়ি ভিত্তিক ভোটার রিপোর্ট।
    প্রতিটি ঠিকানার পুরুষ, মহিলা ও মোট ভোটার সংখ্যা, প্রতি ওয়ার্ডের উপমোট
    এবং সর্বমোট গ্র্যান্ড টোটাল নির্ভুলভাবে হিসেব করে।
    """
    q = select(
        func.coalesce(Voter.ward, "অনির্দিষ্ট").label("ward"),
        func.coalesce(Voter.address, "").label("address"),
        func.count(case((func.trim(Voter.gender) == "পুরুষ", 1))).label("male_count"),
        func.count(case((func.trim(Voter.gender) == "মহিলা", 1))).label("female_count"),
        func.count(Voter.id).label("total_count"),
    ).where(Voter.deleted_at.is_(None))

    q = apply_area_scope(q, user, db)

    if district:
        q = q.where(Voter.district == district)
    if municipality:
        q = q.where(Voter.municipality == municipality)
    if upazila:
        q = q.where(Voter.upazila == upazila)
    if union_name:
        q = q.where(Voter.union_name == union_name)
    if ward and ward.lower() not in ("all", "__all__", "সকল"):
        q = q.where(Voter.ward == ward)

    numeric_ward = case(
        (Voter.ward.op("~")(r"^\d+$"), cast(Voter.ward, Integer)),
        else_=None,
    )
    # ওয়ার্ড অনুযায়ী গ্রুপ এবং সাজানো (প্রথমে ওয়ার্ড, তারপর খালি ঠিকানা শেষে রেখে ঠিকানা অনুযায়ী সাজানো)
    q = q.group_by(Voter.ward, Voter.address).order_by(
        numeric_ward.nulls_last(),
        Voter.ward,
        case((func.coalesce(Voter.address, "") == "", 1), else_=0),
        Voter.address,
    )

    rows = db.execute(q).all()

    wards_map: dict[str, dict] = {}
    total_male = 0
    total_female = 0
    total_voters = 0

    for r in rows:
        w = str(r.ward) if r.ward else "অনির্দিষ্ট"
        addr = r.address or ""
        m = r.male_count or 0
        f = r.female_count or 0
        tot = r.total_count or 0

        total_male += m
        total_female += f
        total_voters += tot

        if w not in wards_map:
            wards_map[w] = {
                "ward": w,
                "addresses": [],
                "male_subtotal": 0,
                "female_subtotal": 0,
                "total_subtotal": 0,
            }

        wards_map[w]["addresses"].append(
            AddressVoterStats(
                address=addr,
                male_count=m,
                female_count=f,
                total_count=tot,
            )
        )
        wards_map[w]["male_subtotal"] += m
        wards_map[w]["female_subtotal"] += f
        wards_map[w]["total_subtotal"] += tot

    wards_list = [
        WardReport(
            ward=w_data["ward"],
            addresses=w_data["addresses"],
            male_subtotal=w_data["male_subtotal"],
            female_subtotal=w_data["female_subtotal"],
            total_subtotal=w_data["total_subtotal"],
        )
        for w_data in wards_map.values()
    ]

    heading_parts = []
    if district:
        heading_parts.append(f"জেলা: {district}")
    if municipality:
        heading_parts.append(f"পৌরসভা: {municipality}")
    if upazila:
        heading_parts.append(f"উপজেলা: {upazila}")
    if union_name:
        heading_parts.append(f"ইউনিয়ন/ওয়ার্ড: {union_name}")
    if ward and ward.lower() not in ("all", "__all__", "সকল"):
        bn_ward = str(ward)
        for e, b in zip("0123456789", "০১২৩৪৫৬৭৮৯"):
            bn_ward = bn_ward.replace(e, b)
        heading_parts.append(f"ওয়ার্ড নং: {bn_ward}")
    elif heading_parts:
        heading_parts.append("ওয়ার্ড: সকল")
    else:
        heading_parts.append("সমগ্র এলাকা (সকল ওয়ার্ড)")

    area_heading = " | ".join(heading_parts)

    selected_ward_val = ward if (ward and ward.lower() not in ("all", "__all__", "সকল")) else None

    return VoterReportResponse(
        selected_area={
            "district": district or None,
            "municipality": municipality or None,
            "upazila": upazila or None,
            "union_name": union_name or None,
            "ward": selected_ward_val,
        },
        area_heading=area_heading,
        summary=AreaReportSummary(
            total_male=total_male,
            total_female=total_female,
            total_voters=total_voters,
        ),
        wards=wards_list,
        grand_total=AreaReportSummary(
            total_male=total_male,
            total_female=total_female,
            total_voters=total_voters,
        ),
    )
