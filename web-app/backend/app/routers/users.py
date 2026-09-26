# -*- coding: utf-8 -*-
"""ইউজার ম্যানেজমেন্ট -- সাধারণত manage_users পারমিশনধারী (super_admin) ব্যবহার করেন। একটা
দ্বিতীয় সংকীর্ণ পথও আছে: manage_own_agents থাকা একজন candidate নিজের এজেন্ট (candidate_agent
রোল) তৈরি/এডিট করতে পারেন, কিন্তু শুধু নিজের candidate_id-এর আওতায় ও নিজের এলাকা-স্কোপের
উপসেট পর্যন্ত -- এলাকা বাড়াতে পারেন না, শুধু ভাগ করতে পারেন।"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..audit import log_activity
from ..auth import hash_password, require_any_permission, require_permission, serialize_user
from ..db import get_db
from ..models import Candidate, Role, User, UserAreaScope
from ..schemas import AreaScopeIn, RoleOut, UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/api/users", tags=["users"])
roles_router = APIRouter(prefix="/api/roles", tags=["users"])

CANDIDATE_AGENT_ROLE_KEY = "candidate_agent"


def _is_candidate_actor(actor: User, db: Session) -> bool:
    """actor-এর manage_users না থাকলেও manage_own_agents থাকলে True -- অর্থাৎ এটা একজন
    candidate যিনি শুধু নিজের এজেন্ট নিয়ন্ত্রণ করতে পারবেন, বাকি সব ইউজার না।"""
    from ..auth import user_permission_keys
    if actor.role.key == "super_admin" or "manage_users" in user_permission_keys(actor, db):
        return False
    return "manage_own_agents" in user_permission_keys(actor, db)


def _validate_scope_subset(scopes: list[AreaScopeIn], actor: User, db: Session) -> None:
    owned = db.scalars(select(UserAreaScope).where(UserAreaScope.user_id == actor.id)).all()
    owned_pairs = {(s.scope_field, s.scope_value) for s in owned}
    for s in scopes:
        if (s.scope_field, s.scope_value) not in owned_pairs:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "আপনার নিজের এলাকা-স্কোপের বাইরে কোনো এলাকা এজেন্টকে দেওয়া যাবে না",
            )


@roles_router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _user: User = Depends(require_permission("manage_users"))):
    return db.scalars(select(Role).order_by(Role.id)).all()


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    actor: User = Depends(require_any_permission("manage_users", "manage_own_agents")),
):
    q = select(User).order_by(User.id)
    if _is_candidate_actor(actor, db):
        q = q.where(User.candidate_id == actor.candidate_id, User.id != actor.id)
    users = db.scalars(q).all()
    return [serialize_user(u, db) for u in users]


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_any_permission("manage_users", "manage_own_agents")),
):
    if db.scalar(select(User).where(User.username == payload.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "এই ইউজারনেম ইতিমধ্যে ব্যবহৃত হচ্ছে")

    role_id = payload.role_id
    candidate_id = payload.candidate_id

    if _is_candidate_actor(actor, db):
        agent_role = db.scalar(select(Role).where(Role.key == CANDIDATE_AGENT_ROLE_KEY))
        if not agent_role:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "candidate_agent রোল পাওয়া যায়নি")
        role_id = agent_role.id
        candidate_id = actor.candidate_id
        _validate_scope_subset(payload.area_scopes, actor, db)
    else:
        if role_id is None or not db.get(Role, role_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "রোল পাওয়া যায়নি")
        if candidate_id is not None and not db.get(Candidate, candidate_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "প্রার্থী পাওয়া যায়নি")

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        role_id=role_id,
        candidate_id=candidate_id,
    )
    db.add(user)
    db.flush()
    for s in payload.area_scopes:
        db.add(UserAreaScope(user_id=user.id, scope_field=s.scope_field, scope_value=s.scope_value))
    log_activity(db, actor, "user_create", detail={"username": user.username, "role_id": role_id, "candidate_id": candidate_id}, request=request)
    db.commit()
    db.refresh(user)
    return serialize_user(user, db)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_any_permission("manage_users", "manage_own_agents")),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ব্যবহারকারী পাওয়া যায়নি")

    is_candidate_actor = _is_candidate_actor(actor, db)
    if is_candidate_actor:
        if user.candidate_id != actor.candidate_id or user.id == actor.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "ব্যবহারকারী পাওয়া যায়নি")
        if payload.role_id is not None or payload.candidate_id is not None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "রোল বা প্রার্থী বদলানো যাবে না")
        if payload.area_scopes is not None:
            _validate_scope_subset(payload.area_scopes, actor, db)

    changes: dict = {}
    if payload.role_id is not None:
        if not db.get(Role, payload.role_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "রোল পাওয়া যায়নি")
        changes["role_id"] = payload.role_id
        user.role_id = payload.role_id
    # model_fields_set দিয়ে "পাঠানো হয়নি" আর "স্পষ্টভাবে null পাঠানো হয়েছে" আলাদা করা হয় --
    # role candidate/candidate_agent থেকে সরিয়ে অন্য রোলে আনলে candidate_id-কে null-এ
    # ক্লিয়ার করাটাও একটা বৈধ আপডেট, শুধু payload.candidate_id is not None চেক করলে সেটা ধরা পড়ত না
    if "candidate_id" in payload.model_fields_set and not is_candidate_actor:
        if payload.candidate_id is not None and not db.get(Candidate, payload.candidate_id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "প্রার্থী পাওয়া যায়নি")
        changes["candidate_id"] = payload.candidate_id
        user.candidate_id = payload.candidate_id
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
