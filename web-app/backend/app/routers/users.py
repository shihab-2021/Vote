# -*- coding: utf-8 -*-
"""ইউজার ম্যানেজমেন্ট -- শুধু manage_users পারমিশনধারী (আপাতত শুধু super_admin) ব্যবহার করতে
পারেন। রোল বদলানো/এলাকা-স্কোপ অ্যাসাইন করা/অ্যাক্টিভ-ইনঅ্যাক্টিভ করা -- সব এখানে।"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..audit import log_activity
from ..auth import hash_password, require_permission, serialize_user
from ..db import get_db
from ..models import Role, User, UserAreaScope
from ..schemas import RoleOut, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])
roles_router = APIRouter(prefix="/api/roles", tags=["users"])


@roles_router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _user: User = Depends(require_permission("manage_users"))):
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db), _user: User = Depends(require_permission("manage_users"))):
    users = db.scalars(select(User).order_by(User.id)).all()
    return [serialize_user(u, db) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("manage_users")),
):
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "এই ইউজারনেম ইতিমধ্যে ব্যবহৃত হচ্ছে")
    if not db.get(Role, payload.role_id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "রোল পাওয়া যায়নি")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
    )
    db.add(user)
    db.flush()
    for s in payload.area_scopes:
        db.add(UserAreaScope(user_id=user.id, scope_field=s.scope_field, scope_value=s.scope_value))
    log_activity(db, actor, "user_create", detail={"username": user.username, "role_id": user.role_id}, request=request)
    db.commit()
    db.refresh(user)
    return serialize_user(user, db)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_permission("manage_users")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ব্যবহারকারী পাওয়া যায়নি")

    changes: dict = {}
    if payload.role_id is not None:
        if not db.get(Role, payload.role_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "রোল পাওয়া যায়নি")
        changes["role_id"] = payload.role_id
        user.role_id = payload.role_id
    if payload.is_active is not None:
        changes["is_active"] = payload.is_active
        user.is_active = payload.is_active
    if payload.password:
        changes["password"] = True
        user.password_hash = hash_password(payload.password)
    if payload.area_scopes is not None:
        changes["area_scopes"] = len(payload.area_scopes)
        db.execute(delete(UserAreaScope).where(UserAreaScope.user_id == user.id))
        for s in payload.area_scopes:
            db.add(UserAreaScope(user_id=user.id, scope_field=s.scope_field, scope_value=s.scope_value))

    log_activity(db, actor, "user_update", detail={"user_id": user.id, **changes}, request=request)
    db.commit()
    db.refresh(user)
    return serialize_user(user, db)
