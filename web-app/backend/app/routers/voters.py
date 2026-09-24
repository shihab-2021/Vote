import json

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_, case, cast, Integer
from sqlalchemy.orm import Session

from ..area_scope import apply_area_scope
from ..auth import get_current_user, require_permission
from ..db import get_db
from ..models import Voter, User, CustomFieldDef
from ..schemas import VoterOut, VoterCreate, VoterUpdate, VoterListResponse, VOTER_CORE_FIELDS
from ..voter_rules import flag_record_by_field

router = APIRouter(prefix="/api/voters", tags=["voters"])

# "Find By" জেনেরিক ফিল্টার -- core কলাম + extra_fields (কাস্টম ফিল্ড) দুটোতেই কাজ করে।
# নতুন কাস্টম ফিল্ড যোগ হলে (FieldsPage থেকে) এখানে কোনো কোড পরিবর্তন লাগে না -- key দিয়ে
# extra_fields JSONB-তে স্বয়ংক্রিয়ভাবে লুকআপ হয়ে যায়, তাই ফিল্টারিং সিস্টেম স্কেলেবল।
CORE_FILTERABLE = {f: getattr(Voter, f) for f in VOTER_CORE_FIELDS}
# লম্বা ফ্রি-টেক্সট ফিল্ড -- আংশিক মিল (contains); বাকি সব ক্যাটেগরিক্যাল/কোড ফিল্ড -- হুবহু মিল
ILIKE_CORE_FIELDS = {"name", "voter_no", "father_name", "mother_name", "occupation", "area_name"}


def _apply_generic_filters(q, filters_json: str, db: Session):
    """filters -- [{"field": "...", "value": "..."}] আকারে JSON-এনকোড করা কুয়েরি প্যারাম।
    address সহ যেকোনো "Find By" ফিল্টার এই একই মেকানিজম দিয়ে যায় -- ফ্রন্টএন্ডে Address আলাদা
    করে দেখানো হলেও, ব্যাকএন্ডে এটা এই জেনেরিক ফিল্টার লিস্টের আর দশটা এন্ট্রির মতোই।"""
    if not filters_json:
        return q
    try:
        filters = json.loads(filters_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "filters প্যারামিটার সঠিক JSON না")
    if not isinstance(filters, list):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "filters একটা লিস্ট হতে হবে")

    custom_defs: dict[str, CustomFieldDef] | None = None
    for f in filters:
        if not isinstance(f, dict):
            continue
        field, value = f.get("field"), f.get("value")
        if not field or value in (None, ""):
            continue
        if field in CORE_FILTERABLE:
            col = CORE_FILTERABLE[field]
            q = q.where(col.ilike(f"%{value}%") if field in ILIKE_CORE_FIELDS else col == value)
        else:
            if custom_defs is None:
                custom_defs = {d.key: d for d in db.scalars(select(CustomFieldDef)).all()}
            field_def = custom_defs.get(field)
            if field_def is None:
                continue  # অজানা/মুছে ফেলা ফিল্ড -- চুপচাপ উপেক্ষা
            col = Voter.extra_fields[field].astext
            q = q.where(col.ilike(f"%{value}%") if field_def.field_type == "text" else col == str(value))
    return q

# serial_no টেক্সট কলাম (OCR থেকে আসা "০০০১" স্টাইলের বাংলা->ইংরেজি রূপান্তরিত সংখ্যা) --
# সাধারণ টেক্সট সর্ট করলে "10" "2"-এর আগে চলে আসত, তাই সংখ্যাসূচক হলে int-এ কাস্ট করে সর্ট করা হয়
NUMERIC_SERIAL = case(
    (Voter.serial_no.op("~")(r'^\d+$'), cast(Voter.serial_no, Integer)),
    else_=None,
)

SORTABLE = {"name": Voter.name, "voter_no": Voter.voter_no, "ward": Voter.ward,
            "created_at": Voter.created_at, "updated_at": Voter.updated_at}


def _order_by(sort: str):
    if sort == "serial_no":
        # ক্রমিক শুধু একটা কেন্দ্রের ভেতরেই অর্থবহ -- তাই আগে এলাকা/ওয়ার্ড অনুযায়ী গ্রুপ করে
        # তারপর সেই কেন্দ্রের ভেতরে ক্রমিক অনুযায়ী সাজানো হয় (মূল ভোটার তালিকার আসল অর্ডার)।
        # ফিল্টার করা থাকলে (এক ওয়ার্ড/এলাকা) এই কলামগুলো এমনিতেই একই মান হবে, প্রভাব পড়বে না।
        return [Voter.upazila, Voter.union_name, Voter.ward, Voter.area_no,
                NUMERIC_SERIAL.nulls_last(), Voter.serial_no]
    return [SORTABLE.get(sort, Voter.name)]


def build_voter_query(
    db: Session, user: User, *,
    search: str = "", ward: str = "", upazila: str = "", union: str = "",
    flagged: bool | None = None, filters: str = "",
):
    """তালিকা/এক্সপোর্ট/প্রিন্ট-ব্যাচ -- সবাই ঠিক একই ফিল্টার+এলাকা-স্কোপ যুক্তি ব্যবহার করে,
    যাতে "কী দেখা যায়" আর "কী প্রিন্ট/এক্সপোর্ট হয়" কখনো আলাদা হয়ে না যায়। পেজিনেশন এখানে নেই --
    কলার প্রয়োজনমতো .offset()/.limit() যোগ করে নেয়।"""
    q = select(Voter).where(Voter.deleted_at.is_(None))
    q = apply_area_scope(q, user, db)
    if search:
        like = f"%{search}%"
        q = q.where(or_(
            Voter.name.ilike(like), Voter.voter_no.ilike(like),
            Voter.father_name.ilike(like), Voter.mother_name.ilike(like),
            Voter.address.ilike(like),
        ))
    if ward:
        q = q.where(Voter.ward == ward)
    if upazila:
        q = q.where(Voter.upazila == upazila)
    if union:
        q = q.where(Voter.union_name == union)
    if flagged is not None:
        q = q.where(Voter.is_flagged == flagged)
    return _apply_generic_filters(q, filters, db)


@router.get("", response_model=VoterListResponse)
def list_voters(
    search: str = "",
    ward: str = "",
    upazila: str = "",
    union: str = "",
    flagged: bool | None = None,
    filters: str = "",
    sort: str = "serial_no",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)

    q = build_voter_query(
        db, user, search=search, ward=ward, upazila=upazila, union=union,
        flagged=flagged, filters=filters,
    )

    total = db.scalar(select(func.count()).select_from(q.subquery()))

    q = q.order_by(*_order_by(sort)).offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(q).all()

    return VoterListResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/addresses", response_model=list[str])
def list_addresses(
    q: str = "", limit: int = 20,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """ঠিকানা অটোকমপ্লিটের জন্য -- বিদ্যমান ডেটায় থাকা distinct ঠিকানাগুলো থেকে মেলে এমনগুলো
    ফেরত দেয়, যাতে ব্যবহারকারী টাইপ করে একটা নির্দিষ্ট (হুবহু বিদ্যমান) ঠিকানা বেছে নিতে পারেন।
    এই রুটটা অবশ্যই /{voter_id}-এর আগে থাকতে হবে, নাহলে "addresses" voter_id হিসেবে ধরে নিয়ে
    ইন্ট-কনভার্সনে ব্যর্থ হবে।"""
    limit = min(max(limit, 1), 50)
    stmt = select(Voter.address).where(
        Voter.deleted_at.is_(None), Voter.address.isnot(None), Voter.address != "",
    )
    stmt = apply_area_scope(stmt, user, db)
    if q:
        stmt = stmt.where(Voter.address.ilike(f"%{q}%"))
    stmt = stmt.distinct().order_by(Voter.address).limit(limit)
    return db.scalars(stmt).all()


def _get_scoped_voter(voter_id: int, user: User, db: Session) -> Voter:
    """একক ভোটার রেকর্ড fetch করে, এলাকা-স্কোপ যাচাইসহ -- নাহলে scope-বহির্ভূত voter_id সরাসরি
    URL-এ দিয়ে list/search এড়িয়ে গিয়েও দেখা/এডিট/ডিলিট করা যেত।"""
    voter = db.get(Voter, voter_id)
    if not voter or voter.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ভোটার পাওয়া যায়নি")
    if user.role.key != "super_admin":
        in_scope = db.scalar(apply_area_scope(select(Voter.id), user, db).where(Voter.id == voter_id))
        if in_scope is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "ভোটার পাওয়া যায়নি")
    return voter


@router.get("/{voter_id}", response_model=VoterOut)
def get_voter(voter_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _get_scoped_voter(voter_id, user, db)


@router.post("", response_model=VoterOut, status_code=status.HTTP_201_CREATED)
def create_voter(payload: VoterCreate, db: Session = Depends(get_db), user: User = Depends(require_permission("manage_data"))):
    data = payload.model_dump()
    voter = Voter(**data, created_by=user.id, updated_by=user.id)
    voter.flag_reasons = flag_record_by_field(data)
    db.add(voter)
    db.commit()
    db.refresh(voter)
    return voter


@router.patch("/{voter_id}", response_model=VoterOut)
def update_voter(
    voter_id: int, payload: VoterUpdate,
    db: Session = Depends(get_db), user: User = Depends(require_permission("manage_data")),
):
    voter = _get_scoped_voter(voter_id, user, db)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(voter, field, value)
    voter.updated_by = user.id

    # আপডেটের পর পুনরায় ভ্যালিডেশন চালানো হয় -- ফ্ল্যাগ সবসময় বর্তমান অবস্থা প্রতিফলিত করবে
    merged = {f: getattr(voter, f) for f in
              ["name", "voter_no", "father_name", "mother_name", "dob", "address", "occupation"]}
    voter.flag_reasons = flag_record_by_field(merged)

    db.commit()
    db.refresh(voter)
    return voter


@router.delete("/{voter_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_voter(voter_id: int, db: Session = Depends(get_db), user: User = Depends(require_permission("manage_data"))):
    from datetime import datetime, timezone
    voter = _get_scoped_voter(voter_id, user, db)
    voter.deleted_at = datetime.now(timezone.utc)
    db.commit()
