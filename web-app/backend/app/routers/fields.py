from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_admin
from ..db import get_db
from ..models import CustomFieldDef, User
from ..schemas import FieldDefCreate, FieldDefOut

router = APIRouter(prefix="/api/field-defs", tags=["fields"])


@router.get("", response_model=list[FieldDefOut])
def list_field_defs(db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    return db.scalars(select(CustomFieldDef).order_by(CustomFieldDef.created_at)).all()


@router.post("", response_model=FieldDefOut, status_code=status.HTTP_201_CREATED)
def create_field_def(payload: FieldDefCreate, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    field_def = CustomFieldDef(**payload.model_dump(), created_by=user.id)
    db.add(field_def)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "এই কী দিয়ে ইতিমধ্যে একটি ফিল্ড আছে")
    db.refresh(field_def)
    return field_def


@router.delete("/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_field_def(field_id: int, db: Session = Depends(get_db), _user: User = Depends(require_admin)):
    field_def = db.get(CustomFieldDef, field_id)
    if not field_def:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ফিল্ড পাওয়া যায়নি")
    db.delete(field_def)
    db.commit()
