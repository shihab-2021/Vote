import csv
import io

import openpyxl
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import User, Voter
from ..voter_rules import COLS

router = APIRouter(prefix="/api/export", tags=["export"])

EXPORT_COLS = [(field, label) for _, label, field in COLS if field] + [("flag_reasons", "যাচাই প্রয়োজন")]


def _filtered_voters(db: Session, search: str, ward: str, upazila: str, flagged: bool | None):
    q = select(Voter).where(Voter.deleted_at.is_(None))
    if search:
        like = f"%{search}%"
        q = q.where(or_(Voter.name.ilike(like), Voter.voter_no.ilike(like),
                         Voter.father_name.ilike(like), Voter.mother_name.ilike(like)))
    if ward:
        q = q.where(Voter.ward == ward)
    if upazila:
        q = q.where(Voter.upazila == upazila)
    if flagged is not None:
        q = q.where(Voter.is_flagged == flagged)
    q = q.order_by(Voter.name)
    return db.scalars(q).all()


def _row_value(voter: Voter, field: str):
    if field == "flag_reasons":
        return "; ".join(voter.flag_reasons or [])
    return getattr(voter, field, "") or ""


@router.get("")
def export_voters(
    format: str = "xlsx",
    search: str = "", ward: str = "", upazila: str = "",
    flagged: bool | None = None,
    db: Session = Depends(get_db),
    _user: User = Depends(get_current_user),
):
    voters = _filtered_voters(db, search, ward, upazila, flagged)

    if format == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([label for _, label in EXPORT_COLS])
        for v in voters:
            writer.writerow([_row_value(v, field) for field, _ in EXPORT_COLS])
        buf.seek(0)
        return StreamingResponse(
            iter([buf.getvalue()]), media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=voters_export.csv"},
        )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ভোটার তালিকা"

    header_fill = PatternFill("solid", start_color="162B4D")
    header_font = Font(bold=True, color="FFFFFF", name="Arial", size=10)
    thin = Side(style="thin", color="DDDDDD")
    border = Border(left=thin, right=thin, top=thin, bottom=thin)
    flag_fill = PatternFill("solid", start_color="FDE2E2")
    flag_font = Font(name="Arial", size=9, color="B00020")
    data_font = Font(name="Arial", size=9)

    for ci, (_, label) in enumerate(EXPORT_COLS, 1):
        c = ws.cell(row=1, column=ci, value=label)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = border
        ws.column_dimensions[get_column_letter(ci)].width = 20

    for ri, voter in enumerate(voters, 2):
        is_flagged = bool(voter.flag_reasons)
        for ci, (field, _) in enumerate(EXPORT_COLS, 1):
            c = ws.cell(row=ri, column=ci, value=_row_value(voter, field))
            c.border = border
            c.font = flag_font if is_flagged else data_font
            if is_flagged:
                c.fill = flag_fill

    ws.freeze_panes = "A2"
    out = io.BytesIO()
    wb.save(out)
    out.seek(0)
    return StreamingResponse(
        out, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=voters_export.xlsx"},
    )
