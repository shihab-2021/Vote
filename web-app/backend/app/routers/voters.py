from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Voter, User
from ..schemas import VoterOut, VoterCreate, VoterUpdate, VoterListResponse
from ..voter_rules import flag_record_by_field

router = APIRouter(prefix="/api/voters", tags=["voters"])

SORTABLE = {"name": Voter.name, "voter_no": Voter.voter_no, "ward": Voter.ward,
            "created_at": Voter.created_at, "updated_at": Voter.updated_at}


@router.get("", response_model=VoterListResponse)
def list_voters(
    search: str = "",
    ward: str = "",
    upazila: str = "",
    union: str = "",
    flagged: bool | None = None,
    sort: str = "name",
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)

    q = select(Voter).where(Voter.deleted_at.is_(None))
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

    total = db.scalar(select(func.count()).select_from(q.subquery()))

    order_col = SORTABLE.get(sort, Voter.name)
    q = q.order_by(order_col).offset((page - 1) * page_size).limit(page_size)
    items = db.scalars(q).all()

    return VoterListResponse(items=items, total=total or 0, page=page, page_size=page_size)


@router.get("/{voter_id}", response_model=VoterOut)
def get_voter(voter_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    voter = db.get(Voter, voter_id)
    if not voter or voter.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ভোটার পাওয়া যায়নি")
    return voter


@router.post("", response_model=VoterOut, status_code=status.HTTP_201_CREATED)
def create_voter(payload: VoterCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
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
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    voter = db.get(Voter, voter_id)
    if not voter or voter.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ভোটার পাওয়া যায়নি")

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
def delete_voter(voter_id: int, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    from datetime import datetime, timezone
    voter = db.get(Voter, voter_id)
    if not voter or voter.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ভোটার পাওয়া যায়নি")
    voter.deleted_at = datetime.now(timezone.utc)
    db.commit()
