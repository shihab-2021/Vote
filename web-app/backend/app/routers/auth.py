from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..audit import log_activity
from ..auth import create_token, get_current_user, serialize_user, set_auth_cookie, clear_auth_cookie, verify_password
from ..db import get_db
from ..models import User
from ..schemas import LoginRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == payload.username))
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ইউজারনেম বা পাসওয়ার্ড ভুল")

    user.last_login_at = datetime.now(timezone.utc)
    log_activity(db, user, "login", request=request)
    db.commit()

    token = create_token(user)
    set_auth_cookie(response, token)
    return serialize_user(user, db)


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookie(response)
    return {"status": "ok"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return serialize_user(user, db)
