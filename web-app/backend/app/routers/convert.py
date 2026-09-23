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
from ..db import get_db, SessionLocal
from ..excel_backup import write_excel_backup
from ..import_logic import VoterUpserter, bengali_row_to_record
from ..models import ImportBatch, User
from ..voter_rules import COLS

router = APIRouter(prefix="/api/convert", tags=["convert"])

JOBS: dict = {}
JOB_LOCK = threading.Lock()
ACTIVE_JOB_ID: str | None = None  # একসাথে একটির বেশি কনভার্সন আটকাতে
LAST_JOB_ID: str | None = None    # রিলোড/ট্যাব-সুইচের পর রিকভার করার জন্য -- commit/discard না হওয়া পর্যন্ত থাকে

# ফ্রন্টএন্ডে পাঠানো job dict-এ শুধু এই কী-গুলো যাবে (internal _cancel_event ইত্যাদি বাদ)
def _public_job(job: dict) -> dict:
    return {
        "status": job["status"],
        "progress": job.get("progress"),
        "result": job.get("result"),
        "error": job.get("error"),
    }


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
    ব্যবহারকারী প্রিভিউ দেখে "ডাটাবেজে যোগ করুন" চাপলে তবেই /commit এন্ডপয়েন্ট ডাটাবেজে লেখে।
    একটা background thread-এ চলে, তাই ব্যবহারকারী পেজ ছেড়ে গেলে/রিলোড করলেও থামে না --
    HTTP request/SSE কানেকশনের সাথে এই thread-এর কোনো সম্পর্ক নেই।"""
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
        voters = ocr_engine.process_pdf(p, fm, progress_cb=on_progress, cancel_event=job["_cancel_event"])
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
    except ocr_engine.ConversionCancelled:
        job["status"] = "cancelled"
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
    global ACTIVE_JOB_ID, LAST_JOB_ID
    pdf_path = payload.pdf_path
    if not os.path.isfile(pdf_path) or not pdf_path.lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "বৈধ PDF ফাইল নয়")

    with JOB_LOCK:
        if ACTIVE_JOB_ID and JOBS.get(ACTIVE_JOB_ID, {}).get("status") in ("starting", "running"):
            raise HTTPException(status.HTTP_409_CONFLICT, "ইতিমধ্যে একটি কনভার্সন চলছে")
        if ACTIVE_BATCH_ID and BATCH_JOBS.get(ACTIVE_BATCH_ID, {}).get("status") == "running":
            raise HTTPException(status.HTTP_409_CONFLICT, "একটি ব্যাচ কনভার্সন চলছে -- আগে সেটা বন্ধ করুন")
        job_id = uuid.uuid4().hex[:8]
        JOBS[job_id] = {"status": "starting", "pdf_path": pdf_path, "progress": None,
                        "result": None, "error": None, "_cancel_event": threading.Event()}
        ACTIVE_JOB_ID = job_id
        LAST_JOB_ID = job_id

    threading.Thread(target=run_conversion_job, args=(job_id, pdf_path, user.id), daemon=True).start()
    return {"job_id": job_id}


@router.get("/active")
def active_job(_user: User = Depends(require_admin)):
    """পেজ লোড/রিলোড/ট্যাব-সুইচের পর চলমান বা রিভিউ-অপেক্ষমাণ (commit/discard হয়নি এমন)
    সর্বশেষ job থাকলে সেটা ফেরত দেয়, যাতে ফ্রন্টএন্ড প্রগ্রেস/প্রিভিউ-তে রিকানেক্ট করতে পারে।
    কনভার্সন নিজে ব্যাকগ্রাউন্ড thread-এ চলে বলে এটা ছাড়াই থেমে যায় না -- এটা শুধু UI রিকভারির জন্য।"""
    if not LAST_JOB_ID:
        return {"job_id": None}
    job = JOBS.get(LAST_JOB_ID)
    if job is None or job.get("committed"):
        return {"job_id": None}
    return {"job_id": LAST_JOB_ID, **_public_job(job)}


@router.post("/jobs/{job_id}/stop")
def stop_job(job_id: str, _user: User = Depends(require_admin)):
    job = JOBS.get(job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job পাওয়া যায়নি")
    if job["status"] not in ("starting", "running"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "এই কনভার্সন চলছে না, থামানো যাবে না")
    job["status"] = "cancelling"
    job["_cancel_event"].set()
    return {"status": "cancelling"}


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
            if job["status"] in ("done", "error", "cancelled"):
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


# ──────────────────────────────────────────
# ব্যাচ কনভার্সন -- একটা ফোল্ডার (সাবফোল্ডারসহ) রিকার্সিভভাবে স্ক্যান করে তার ভেতরের সব
# PDF একে একে কনভার্ট করে। একক-PDF মোডের মতো প্রিভিউ দেখিয়ে commit-এর অপেক্ষা করা শত শত
# ফাইলের জন্য অবাস্তব, তাই প্রতিটা ফাইল শেষ হলেই সরাসরি ডাটাবেজে অটো-কমিট হয়ে যায় --
# "যাচাই প্রয়োজন" ফ্ল্যাগই এখানে একমাত্র সেফটি-নেট, পরে ভোটার তালিকা পেজ থেকে যাচাই করে নিতে হবে।
# দিনের পর দিন ধরে চলতে পারে বলে SSE-এর বদলে polling (/batch/active) ব্যবহার হয়েছে --
# এত লম্বা সময় ধরে একটা HTTP/SSE কানেকশন খোলা রাখা অনির্ভরযোগ্য।
# একক-PDF মোডের সাথে একই JOB_LOCK শেয়ার করে, যাতে দুটো কখনো একসাথে না চলে (একটাই OCR
# reader আছে, একসাথে দুই থ্রেড থেকে ব্যবহার নিরাপদ না)।
# ──────────────────────────────────────────

BATCH_JOBS: dict = {}
ACTIVE_BATCH_ID: str | None = None
LAST_BATCH_ID: str | None = None


def _public_batch(batch: dict) -> dict:
    return {
        "status": batch["status"],
        "root": batch["root"],
        "total_files": len(batch["files"]),
        "current_index": batch["current_index"],
        "current_progress": batch.get("current_progress"),
        "files": batch["files"],
        "started_at": batch["started_at"],
    }


def _scan_pdfs(root: Path) -> list[Path]:
    seen: dict[str, Path] = {}
    for p in root.rglob("*.pdf"):
        seen[str(p).lower()] = p
    for p in root.rglob("*.PDF"):
        seen[str(p).lower()] = p
    return sorted(seen.values(), key=lambda p: str(p))


def run_batch_job(batch_id: str, user_id: int):
    batch = BATCH_JOBS[batch_id]
    batch["status"] = "running"
    cancel_event = batch["_cancel_event"]

    for idx, entry in enumerate(batch["files"]):
        if cancel_event.is_set():
            entry["status"] = "skipped"
            continue
        batch["current_index"] = idx
        entry["status"] = "running"
        t0 = time.time()

        def on_progress(page_idx, total_pages, cell_idx, total_cells, voter_count):
            batch["current_progress"] = {
                "page": page_idx, "total_pages": total_pages,
                "cell": cell_idx, "total_cells": total_cells,
                "voters": voter_count, "elapsed": round(time.time() - t0, 1),
            }

        try:
            p = Path(entry["path"])
            fm = ocr_engine.meta_from_path(p, p)
            voters = ocr_engine.process_pdf(p, fm, progress_cb=on_progress, cancel_event=cancel_event)
            elapsed = time.time() - t0

            excel_path = None
            if voters:
                ts = datetime.now().strftime("%Y%m%d_%H%M%S")
                out_dir = os.path.expanduser(settings.convert_output_dir)
                os.makedirs(out_dir, exist_ok=True)
                excel_path = os.path.join(out_dir, f"voter_data_{ts}_{p.stem}.xlsx")
                write_excel_backup(voters, excel_path)

            inserted = updated = row_errors = 0
            if voters:
                db = SessionLocal()
                try:
                    import_batch = ImportBatch(filename=p.name, imported_by=user_id, status="processing")
                    db.add(import_batch)
                    db.flush()
                    upserter = VoterUpserter(db)
                    for v in voters:
                        record = bengali_row_to_record(v, import_batch.id, user_id)
                        if record is None:
                            row_errors += 1
                            continue
                        upserter.add(record)
                    upserter.flush()
                    import_batch.row_count = len(voters)
                    import_batch.inserted_count = upserter.inserted
                    import_batch.updated_count = upserter.updated
                    import_batch.error_count = row_errors
                    import_batch.status = "done"
                    db.commit()
                    inserted, updated = upserter.inserted, upserter.updated
                except Exception as db_exc:
                    db.rollback()
                    entry["status"] = "error"
                    entry["error"] = f"ডাটাবেজে যোগ করা যায়নি: {db_exc}"
                    continue
                finally:
                    db.close()

            flagged = sum(1 for v in voters if v.get("_flag"))
            entry.update(
                status="done", total_voters=len(voters), flagged=flagged,
                inserted=inserted, updated=updated, elapsed_minutes=round(elapsed / 60, 1),
                excel_path=excel_path,
            )
        except ocr_engine.ConversionCancelled:
            entry["status"] = "cancelled"
            for later in batch["files"][idx + 1:]:
                later["status"] = "skipped"
            break
        except Exception as e:
            # একটা PDF খারাপ/করাপ্ট হলেও পুরো ব্যাচ থামবে না -- এই ফাইলটা error হিসেবে
            # চিহ্নিত হয়ে পরের ফাইলে চলে যাবে, যাতে শত শত ফাইলের একটাতে সমস্যা হলে বাকিগুলো আটকে না থাকে
            entry["status"] = "error"
            entry["error"] = str(e)
        finally:
            batch["current_progress"] = None

    batch["status"] = "cancelled" if cancel_event.is_set() else "done"
    batch["current_index"] = None
    global ACTIVE_BATCH_ID
    with JOB_LOCK:
        if ACTIVE_BATCH_ID == batch_id:
            ACTIVE_BATCH_ID = None


class BatchConvertRequest(BaseModel):
    folder_path: str


@router.post("/batch/start")
def start_batch(payload: BatchConvertRequest, user: User = Depends(require_admin)):
    if not ocr_engine.OCR_AVAILABLE:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "এই সার্ভারে OCR লাইব্রেরি ইনস্টল নেই -- PDF কনভার্সন শুধু লোকাল ইনস্টলেশনে চলে",
        )
    global ACTIVE_JOB_ID, ACTIVE_BATCH_ID, LAST_BATCH_ID
    root = Path(payload.folder_path)
    if not root.is_dir():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "বৈধ ফোল্ডার নয়")

    pdfs = _scan_pdfs(root)
    if not pdfs:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "এই ফোল্ডারে (সাবফোল্ডারসহ) কোনো PDF পাওয়া যায়নি")

    with JOB_LOCK:
        if ACTIVE_JOB_ID and JOBS.get(ACTIVE_JOB_ID, {}).get("status") in ("starting", "running"):
            raise HTTPException(status.HTTP_409_CONFLICT, "একটি একক PDF কনভার্সন চলছে -- আগে সেটা শেষ/বন্ধ করুন")
        if ACTIVE_BATCH_ID and BATCH_JOBS.get(ACTIVE_BATCH_ID, {}).get("status") == "running":
            raise HTTPException(status.HTTP_409_CONFLICT, "ইতিমধ্যে একটি ব্যাচ কনভার্সন চলছে")
        batch_id = uuid.uuid4().hex[:8]
        BATCH_JOBS[batch_id] = {
            "status": "running",
            "root": str(root),
            "files": [{"path": str(p), "status": "pending"} for p in pdfs],
            "current_index": None,
            "current_progress": None,
            "started_at": datetime.now().isoformat(),
            "_cancel_event": threading.Event(),
        }
        ACTIVE_BATCH_ID = batch_id
        LAST_BATCH_ID = batch_id

    threading.Thread(target=run_batch_job, args=(batch_id, user.id), daemon=True).start()
    return {"batch_id": batch_id, "total_files": len(pdfs)}


@router.get("/batch/active")
def active_batch(_user: User = Depends(require_admin)):
    """একক-PDF /active-এর মতোই -- পেজ রিলোড/ট্যাব-সুইচ/এমনকি কয়েকদিন পর ফিরে এলেও চলমান বা
    সবশেষ ব্যাচের অবস্থা এখান থেকেই দেখা যাবে। ব্যাচ নিজে ব্যাকগ্রাউন্ড thread-এ চলে বলে এই
    এন্ডপয়েন্ট না দেখলেও থেমে যায় না।"""
    if not LAST_BATCH_ID:
        return {"batch_id": None}
    batch = BATCH_JOBS.get(LAST_BATCH_ID)
    if batch is None:
        return {"batch_id": None}
    return {"batch_id": LAST_BATCH_ID, **_public_batch(batch)}


@router.post("/batch/stop")
def stop_batch(_user: User = Depends(require_admin)):
    """বর্তমান ফাইলটা সাথে সাথে থামিয়ে দেয় এবং বাকি ফাইলগুলো "skipped" হিসেবে চিহ্নিত করে --
    পুরো ব্যাচ থামানোর জন্য, শুধু বর্তমান ফাইল স্কিপ করে পরেরটায় যাওয়ার জন্য না।"""
    if not ACTIVE_BATCH_ID:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "কোনো ব্যাচ কনভার্সন চলছে না")
    batch = BATCH_JOBS.get(ACTIVE_BATCH_ID)
    if batch is None or batch["status"] != "running":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "কোনো ব্যাচ কনভার্সন চলছে না")
    batch["status"] = "cancelling"
    batch["_cancel_event"].set()
    return {"status": "cancelling"}


@router.post("/batch/discard")
def discard_batch(_user: User = Depends(require_admin)):
    global LAST_BATCH_ID
    if LAST_BATCH_ID:
        BATCH_JOBS.pop(LAST_BATCH_ID, None)
        LAST_BATCH_ID = None
    return {"status": "discarded"}
