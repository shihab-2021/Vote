from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import Permission, RolePermission, User, UserAreaScope

COOKIE_NAME = "voter_app_token"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.key,
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expire_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_minutes * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def get_current_user(
    voter_app_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
) -> User:
    if not voter_app_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "লগইন প্রয়োজন")
    try:
        payload = jwt.decode(voter_app_token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "সেশন মেয়াদোত্তীর্ণ, আবার লগইন করুন")

    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ব্যবহারকারী পাওয়া যায়নি")
    return user


def user_permission_keys(user: User, db: Session) -> list[str]:
    """super_admin implicitly পায় সব permission; বাকিদের জন্য role_permissions টেবিল থেকে বের করা হয়।"""
    if user.role.key == "super_admin":
        return list(db.scalars(select(Permission.key)).all())
    return list(db.scalars(
        select(Permission.key)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == user.role_id)
    ).all())


def serialize_user(user: User, db: Session) -> dict:
    """UserOut স্কিমার জন্য প্লেইন dict বানায় -- role/permissions/area_scopes ORM অবজেক্ট থেকে
    সরাসরি ম্যাপ করা যায় না (জয়েন লাগে), তাই এখানে হিসেব করে দেওয়া হয়।"""
    scopes = db.scalars(select(UserAreaScope).where(UserAreaScope.user_id == user.id)).all()
    return {
        "id": user.id,
        "username": user.username,
        "role": user.role.key,
        "role_label": user.role.label,
        "is_active": user.is_active,
        "permissions": user_permission_keys(user, db),
        "area_scopes": [
            {"id": s.id, "scope_field": s.scope_field, "scope_value": s.scope_value} for s in scopes
        ],
        "created_at": user.created_at,
        "last_login_at": user.last_login_at,
    }


def require_permission(key: str):
    """একটা নির্দিষ্ট permission লাগবে এমন এন্ডপয়েন্টের জন্য FastAPI dependency তৈরি করে।
    super_admin সবসময় পাস করে যায়; বাকিদের role_permissions-এ সেই key থাকতে হবে।"""
    def dependency(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
        if user.role.key == "super_admin":
            return user
        if key not in user_permission_keys(user, db):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "এই কাজের অনুমতি নেই")
        return user
    return dependency
