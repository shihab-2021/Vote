import asyncio
import json
import os
import string
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from sqlalchemy.orm import Session

from .. import ocr_engine
from ..auth import require_admin
from ..config import settings
from ..db import get_db
from ..excel_backup import write_excel_backup
from ..import_logic import VoterUpserter, bengali_row_to_record
from ..models import ImportBatch, User
from ..voter_rules import COLS

router = APIRouter(prefix="/api/convert", tags=["convert"])

JOBS: dict = {}
JOB_LOCK = threading.Lock()
ACTIVE_JOB_ID: str | None = None


@router.get("/status")
def convert_status(_user: User = Depends(require_admin)):
    return {"available": ocr_engine.OCR_AVAILABLE, "reason": ocr_engine.OCR_IMPORT_ERROR}


@router.get("/browse")
def browse(path: str = "", _user: User = Depends(require_admin)):
    if not path:
        roots = [os.path.normpath(os.path.expanduser(settings.convert_output_dir))]
        try:
            roots.extend(os.listdrives())
        except AttributeError:
            for letter in string.ascii_uppercase:
                d = f"{letter}:\\"
                if os.path.exists(d):
                    roots.append(d)
        seen, entries = set(), []
        for r in roots:
            if r not in seen:
                seen.add(r)
                entries.append({"name": r, "path": r, "type": "dir"})
        return {"path": "", "parent": None, "entries": entries}

    p = Path(path)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "ফোল্ডার পাওয়া যায়নি")

    entries = []
    try:
        for child in sorted(p.iterdir(), key=lambda c: (not c.is_dir(), c.name.lower())):
            if child.is_dir():
                entries.append({"name": child.name, "path": str(child), "type": "dir"})
            elif child.suffix.lower() == ".pdf":
                entries.append({
                    "name": child.name, "path": str(child), "type": "pdf",
                    "size_mb": round(child.stat().st_size / 1024 / 1024, 2),
                })
    except PermissionError:
        pass

    parent = str(p.parent) if p.parent != p else None
    return {"path": str(p), "parent": parent, "entries": entries}


def run_conversion_job(job_id: str, pdf_path: str, user_id: int):
    """শুধু PDF থেকে ডেটা বের করে + Excel ব্যাকআপ সেভ করে -- ডাটাবেজে কিছু লেখে না।
    ব্যবহারকারী প্রিভিউ দেখে "ডাটাবেজে যোগ করুন" চাপলে তবেই /commit এন্ডপয়েন্ট ডাটাবেজে লেখে।"""
    job = JOBS[job_id]
    job["status"] = "running"
    t0 = time.time()

    def on_progress(page_idx, total_pages, cell_idx, total_cells, voter_count):
        job["progress"] = {
            "page": page_idx, "total_pages": total_pages,
            "cell": cell_idx, "total_cells": total_cells,
            "voters": voter_count, "elapsed": round(time.time() - t0, 1),
        }

    try:
        p = Path(pdf_path)
        fm = ocr_engine.meta_from_path(p, p)  # single-file মোড, vote-2/app_server.py-এর মতোই
        voters = ocr_engine.process_pdf(p, fm, progress_cb=on_progress)
        elapsed = time.time() - t0

        excel_path = None
        if voters:
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            out_dir = os.path.expanduser(settings.convert_output_dir)
            os.makedirs(out_dir, exist_ok=True)
            excel_path = os.path.join(out_dir, f"voter_data_{ts}.xlsx")
            write_excel_backup(voters, excel_path)

        flagged = sum(1 for v in voters if v.get("_flag"))
        job["voters"] = voters  # ডাটাবেজে commit না করা পর্যন্ত মেমরিতে রাখা হয়
        job["pdf_path"] = pdf_path
        job["status"] = "done"
        job["committed"] = False
        job["result"] = {
            "total_voters": len(voters), "flagged": flagged,
            "elapsed_minutes": round(elapsed / 60, 1), "excel_path": excel_path,
        }
    except Exception as e:
        job["status"] = "error"
        job["error"] = str(e)
    finally:
        global ACTIVE_JOB_ID
        with JOB_LOCK:
            if ACTIVE_JOB_ID == job_id:
                ACTIVE_JOB_ID = None


class ConvertRequest(BaseModel):
    pdf_path: str


@router.post("/start")
def start_convert(payload: ConvertRequest, user: User = Depends(require_admin)):
    if not ocr_engine.OCR_AVAILABLE:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "এই সার্ভারে OCR লাইব্রেরি ইনস্টল নেই -- PDF কনভার্সন শুধু লোকাল ইনস্টলেশনে চলে",
        )
    global ACTIVE_JOB_ID
    pdf_path = payload.pdf_path
    if not os.path.isfile(pdf_path) or not pdf_path.lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "বৈধ PDF ফাইল নয়")

    with JOB_LOCK:
        if ACTIVE_JOB_ID and JOBS.get(ACTIVE_JOB_ID, {}).get("status") in ("starting", "running"):
            raise HTTPException(status.HTTP_409_CONFLICT, "ইতিমধ্যে একটি কনভার্সন চলছে")
        job_id = uuid.uuid4().hex[:8]
        JOBS[job_id] = {"status": "starting", "pdf_path": pdf_path, "progress": None,
                        "result": None, "error": None}
        ACTIVE_JOB_ID = job_id

    threading.Thread(target=run_conversion_job, args=(job_id, pdf_path, user.id), daemon=True).start()
    return {"job_id": job_id}


@router.get("/jobs/{job_id}/stream")
async def stream_job(job_id: str, _user: User = Depends(require_admin)):
    if job_id not in JOBS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job পাওয়া যায়নি")

    async def gen():
        last = None
        while True:
            job = JOBS.get(job_id)
            if job is None:
                break
            payload = {"status": job["status"], "progress": job["progress"]}
            if job["status"] in ("done", "error"):
                payload["result"] = job.get("result")
                payload["error"] = job.get("error")
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                break
            if payload != last:
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
                last = payload
            await asyncio.sleep(0.4)

    return StreamingResponse(gen(), media_type="text/event-stream")


PREVIEW_COLS = [c for c in COLS if c[0] in
                ('ক্রমিক', 'নাম', 'ভোটার_নং', 'পিতা', 'মাতা', 'জন্ম_তারিখ', 'ঠিকানা', '_flag')]


def _get_pending_job(job_id: str) -> dict:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job পাওয়া যায়নি (সার্ভার রিস্টার্ট হলে মুছে যায়)")
    if job["status"] != "done":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "কনভার্সন এখনো শেষ হয়নি")
    if job.get("committed"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "এই ডেটা ইতিমধ্যে ডাটাবেজে যোগ করা হয়েছে")
    return job


@router.get("/jobs/{job_id}/preview")
def preview_job(job_id: str, page: int = 1, page_size: int = 20, _user: User = Depends(require_admin)):
    job = _get_pending_job(job_id)
    voters = job.get("voters", [])
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    start = (page - 1) * page_size
    chunk = voters[start:start + page_size]
    rows = [{bkey: v.get(bkey, '') for bkey, _label, _f in PREVIEW_COLS} for v in chunk]
    return {
        "columns": [{"key": bkey, "label": label} for bkey, label, _f in PREVIEW_COLS],
        "rows": rows,
        "total": len(voters),
        "page": page,
        "page_size": page_size,
    }


@router.post("/jobs/{job_id}/commit")
def commit_job(job_id: str, user: User = Depends(require_admin), db: Session = Depends(get_db)):
    job = _get_pending_job(job_id)
    voters = job.get("voters", [])
    if not voters:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "কোনো ভোটার ডেটা নেই")

    batch = ImportBatch(filename=os.path.basename(job["pdf_path"]), imported_by=user.id, status="processing")
    db.add(batch)
    db.flush()

    upserter = VoterUpserter(db)
    errors = 0
    for v in voters:
        record = bengali_row_to_record(v, batch.id, user.id)
        if record is None:
            errors += 1
            continue
        upserter.add(record)
    upserter.flush()

    batch.row_count = len(voters)
    batch.inserted_count = upserter.inserted
    batch.updated_count = upserter.updated
    batch.error_count = errors
    batch.status = "done"
    db.commit()

    job["committed"] = True
    job["voters"] = []  # মেমরি খালি করা, আর দরকার নেই
    return {
        "import_batch_id": batch.id, "inserted": upserter.inserted,
        "updated": upserter.updated, "errors": errors, "total_rows": len(voters),
    }


@router.post("/jobs/{job_id}/discard")
def discard_job(job_id: str, _user: User = Depends(require_admin)):
    JOBS.pop(job_id, None)
    return {"status": "discarded"}
