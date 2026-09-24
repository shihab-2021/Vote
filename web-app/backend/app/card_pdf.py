# -*- coding: utf-8 -*-
"""ভোটার কার্ড PDF জেনারেটর -- fpdf2 ব্যবহার করে।

গুরুত্বপূর্ণ: বাংলা জটিল স্ক্রিপ্ট (যুক্তাক্ষর/matra পুনর্বিন্যাস) সঠিকভাবে আঁকতে HarfBuzz
শেপিং (pdf.set_text_shaping(True), uharfbuzz প্যাকেজ লাগে) অবশ্যই চালু রাখতে হবে -- শুধু
ফন্ট যোগ করলেই যথেষ্ট না, নাহলে অক্ষর ভেঙে/উল্টাপাল্টা দেখায় (যেমন "ো" মাত্রা ভুল জায়গায়)।

ফন্ট: Noto Sans Bengali (SIL Open Font License) -- frontend/node_modules-এর
@fontsource-variable/noto-sans-bengali প্যাকেজের bengali+latin সাবসেট ভ্যারিয়েবল ফন্ট থেকে
static Regular/Bold TTF বানিয়ে এখানে (assets/fonts/) রাখা হয়েছে, কারণ fpdf2 সরাসরি
variable font বা .woff2 নেয় না, আর শুধু "bengali" সাবসেটে ইংরেজি/সংখ্যা গ্লিফ নেই।"""
from pathlib import Path

from fpdf import FPDF

from .models import Voter

FONT_DIR = Path(__file__).parent / "assets" / "fonts"

# index.css-এর ব্র্যান্ড রঙের কাছাকাছি sRGB (--primary সবুজ, --destructive লাল) -- fpdf2 CSS
# ভ্যারিয়েবল পড়তে পারে না, তাই এখানে হার্ডকোড করা
GREEN = (25, 84, 59)
RED = (176, 42, 42)
DARK_TEXT = (20, 20, 20)

CARD_COLS, CARD_ROWS = 2, 4
MARGIN_MM = 10
GAP_MM = 5
ADDRESS_MAX_CHARS = 70


def _register_fonts(pdf: FPDF) -> None:
    pdf.add_font("NotoBengali", "", str(FONT_DIR / "NotoSansBengali-Regular.ttf"))
    pdf.add_font("NotoBengali", "B", str(FONT_DIR / "NotoSansBengali-Bold.ttf"))
    pdf.set_text_shaping(True)


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _draw_card(pdf: FPDF, x: float, y: float, w: float, h: float, voter: Voter) -> None:
    pdf.set_draw_color(*GREEN)
    pdf.set_line_width(0.4)
    pdf.rect(x, y, w, h)

    pdf.set_fill_color(*GREEN)
    pdf.rect(x, y, w, 7, style="F")
    pdf.set_xy(x + 2, y + 1)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("NotoBengali", "B", 9)
    pdf.cell(w - 4, 5, "ভোটার তালিকা অ্যাপ", new_x="LMARGIN", new_y="NEXT")

    pdf.set_text_color(*DARK_TEXT)
    line_h = 4.6
    ty = y + 9

    pdf.set_font("NotoBengali", "B", 10)
    pdf.set_xy(x + 3, ty)
    pdf.cell(w - 6, line_h, _truncate(voter.name or "নাম নেই", 26), new_x="LMARGIN", new_y="NEXT")
    ty += line_h + 0.5

    pdf.set_font("NotoBengali", "", 8.5)
    rows = [
        f"ভোটার নং: {voter.voter_no or '-'}",
        f"পিতা: {_truncate(voter.father_name or '-', 28)}",
        f"মাতা: {_truncate(voter.mother_name or '-', 28)}",
        f"জন্ম তারিখ: {voter.dob or '-'}   লিঙ্গ: {voter.gender or '-'}",
        f"ওয়ার্ড: {voter.ward or '-'}",
    ]
    for row in rows:
        pdf.set_xy(x + 3, ty)
        pdf.cell(w - 6, line_h, row, new_x="LMARGIN", new_y="NEXT")
        ty += line_h

    pdf.set_xy(x + 3, ty)
    pdf.multi_cell(w - 6, line_h, f"ঠিকানা: {_truncate(voter.address or '-', ADDRESS_MAX_CHARS)}")

    pdf.set_draw_color(*RED)
    pdf.set_line_width(0.8)
    pdf.line(x, y + h - 1.5, x + w, y + h - 1.5)


def build_batch_pdf(voters: list[Voter]) -> bytes:
    """একটা প্রিন্ট-ব্যাচের সব ভোটারের কার্ড ধারণকারী PDF বানায় -- A4 পৃষ্ঠায় ৮টা কার্ড
    (২ কলাম x ৪ সারি)। কোনো ভোটার না থাকলেও অন্তত একটা ফাঁকা-বার্তা পৃষ্ঠা ফেরত দেয়।"""
    pdf = FPDF(format="A4", unit="mm")
    _register_fonts(pdf)

    if not voters:
        pdf.add_page()
        pdf.set_font("NotoBengali", "", 12)
        pdf.cell(0, 10, "এই ব্যাচে কোনো ভোটার নেই")
        return bytes(pdf.output())

    page_w, page_h = 210, 297
    usable_w = page_w - 2 * MARGIN_MM
    usable_h = page_h - 2 * MARGIN_MM
    card_w = (usable_w - (CARD_COLS - 1) * GAP_MM) / CARD_COLS
    card_h = (usable_h - (CARD_ROWS - 1) * GAP_MM) / CARD_ROWS
    per_page = CARD_COLS * CARD_ROWS

    for i, voter in enumerate(voters):
        pos = i % per_page
        if pos == 0:
            pdf.add_page()
        row, col = divmod(pos, CARD_COLS)
        x = MARGIN_MM + col * (card_w + GAP_MM)
        y = MARGIN_MM + row * (card_h + GAP_MM)
        _draw_card(pdf, x, y, card_w, card_h, voter)

    return bytes(pdf.output())
