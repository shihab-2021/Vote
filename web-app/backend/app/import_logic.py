"""Excel-আপলোড এবং সরাসরি-PDF-কনভার্সন -- দুই পথই এই একই আপসার্ট লজিক ব্যবহার করে,
যাতে ডুপ্লিকেট-হ্যান্ডলিং/extra_fields-সংরক্ষণ আচরণ সবসময় অভিন্ন থাকে।"""
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from .models import Voter
from .voter_rules import BENGALI_KEYS, BENGALI_TO_FIELD, flag_record

CHUNK_SIZE = 500
VOTER_NO_CONFLICT_WHERE = text("voter_no IS NOT NULL AND voter_no <> '' AND deleted_at IS NULL")


def bengali_row_to_record(v: dict, batch_id: int, user_id: int) -> dict | None:
    """একটা বাংলা-কী dict (Excel সারি বা OCR আউটপুট থেকে) -- DB রেকর্ডে রূপান্তর করে।
    নাম না থাকলে None ফেরত দেয় (কলার এটাকে error হিসেবে গণনা করবে)।"""
    flags = flag_record(v)
    record = {BENGALI_TO_FIELD[k]: (v.get(k) or None) for k in BENGALI_KEYS if k in BENGALI_TO_FIELD}
    if not record.get("name"):
        return None
    record["flag_reasons"] = flags
    record["import_batch_id"] = batch_id
    record["created_by"] = user_id
    record["updated_by"] = user_id
    record["extra_fields"] = {}
    return record


class VoterUpserter:
    """রেকর্ড জমা করে chunk-এ chunk-এ DB-তে upsert করে; insert/update সংখ্যা গোনে।
    extra_fields (কাস্টম ফিল্ড) কখনো ওভাররাইট হয় না -- শুধু core কলাম আপডেট হয়।"""

    def __init__(self, db: Session):
        self.db = db
        self.buffer: list[dict] = []
        self.inserted = 0
        self.updated = 0

    def add(self, record: dict):
        self.buffer.append(record)
        if len(self.buffer) >= CHUNK_SIZE:
            self.flush()

    def flush(self):
        if not self.buffer:
            return
        with_vno = [r for r in self.buffer if r.get("voter_no")]
        without_vno = [r for r in self.buffer if not r.get("voter_no")]

        if with_vno:
            vnos = [r["voter_no"] for r in with_vno]
            existing = set(self.db.scalars(
                select(Voter.voter_no).where(Voter.voter_no.in_(vnos), Voter.deleted_at.is_(None))
            ).all())
            self.updated += sum(1 for r in with_vno if r["voter_no"] in existing)
            self.inserted += sum(1 for r in with_vno if r["voter_no"] not in existing)

            from sqlalchemy import func as sa_func
            stmt = pg_insert(Voter).values(with_vno)
            update_cols = {c: stmt.excluded[c] for c in with_vno[0].keys()
                           if c not in ("voter_no", "extra_fields")}
            update_cols["updated_at"] = sa_func.now()
            stmt = stmt.on_conflict_do_update(
                index_elements=["voter_no"],
                index_where=VOTER_NO_CONFLICT_WHERE,
                set_=update_cols,
            )
            self.db.execute(stmt)
        if without_vno:
            self.db.execute(pg_insert(Voter), without_vno)
            self.inserted += len(without_vno)
        self.buffer.clear()
