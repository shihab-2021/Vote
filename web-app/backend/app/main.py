from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy import select

from .auth import hash_password
from .config import settings
from .db import SessionLocal
from .models import User
from .routers import auth, convert, export, fields, imports, stats, voters

app = FastAPI(title="ভোটার তালিকা অ্যাপ (হোস্টেড)")

app.include_router(auth.router)
app.include_router(voters.router)
app.include_router(fields.router)
app.include_router(imports.router)
app.include_router(export.router)
app.include_router(stats.router)
app.include_router(convert.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.on_event("startup")
def bootstrap_admin():
    db = SessionLocal()
    try:
        has_user = db.scalar(select(User).limit(1))
        if not has_user:
            admin = User(
                username=settings.admin_bootstrap_username,
                password_hash=hash_password(settings.admin_bootstrap_password),
                role="admin",
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


# ফ্রন্টএন্ড (React বিল্ড) সার্ভ করা -- production-এ frontend/dist এখানে কপি হয়ে আসে (Dockerfile দেখুন)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "static"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
