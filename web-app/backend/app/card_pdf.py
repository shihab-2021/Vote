# -*- coding: utf-8 -*-
"""ভোটার কার্ড PDF জেনারেটর -- fpdf2 ব্যবহার করে।

গুরুত্বপূর্ণ: বাংলা জটিল স্ক্রিপ্ট (যুক্তাক্ষর/matra পুনর্বিন্যাস) সঠিকভাবে আঁকতে HarfBuzz
শেপিং (pdf.set_text_shaping(True), uharfbuzz প্যাকেজ লাগে) অবশ্যই চালু রাখতে হবে -- শুধু
ফন্ট যোগ করলেই যথেষ্ট না, নাহলে অক্ষর ভেঙে/উল্টাপাল্টা দেখায় (যেমন "ো" মাত্রা ভুল জায়গায়)।

ফন্ট: Noto Sans Bengali (SIL Open Font License) -- frontend/node_modules-এর
@fontsource-variable/noto-sans-bengali প্যাকেজের bengali+latin সাবসেট ভ্যারিয়েবল ফন্ট থেকে
static Regular/Bold TTF বানিয়ে এখানে (assets/fonts/) রাখা হয়েছে, কারণ fpdf2 সরাসরি
variable font বা .woff2 নেয় না, আর শুধু "bengali" সাবসেটে ইংরেজি/সংখ্যা গ্লিফ নেই।"""
import io
from pathlib import Path

from fpdf import FPDF
from PIL import Image as PILImage

from .models import Candidate, Voter

FONT_DIR = Path(__file__).parent / "assets" / "fonts"

# index.css-এর ব্র্যান্ড রঙের কাছাকাছি sRGB (--primary সবুজ, --destructive লাল) -- fpdf2 CSS
# ভ্যারিয়েবল পড়তে পারে না, তাই এখানে হার্ডকোড করা
GREEN = (25, 84, 59)
RED = (176, 42, 42)
DARK_TEXT = (20, 20, 20)

CARD_COLS, CARD_ROWS = 2, 4
# প্রার্থী-ব্র্যান্ডেড স্লিপে ছবি+প্রতীক+স্লোগান+ভোটার-তথ্য সবকিছু স্পষ্টভাবে ধরাতে সাধারণ
# নিরপেক্ষ কার্ডের (২x৪=৮/পৃষ্ঠা) চেয়ে বড় জায়গা লাগে -- তাই আলাদা, বড় গ্রিড (২x২=৪/পৃষ্ঠা)
CANDIDATE_COLS, CANDIDATE_ROWS = 2, 2
MARGIN_MM = 10
GAP_MM = 5
ADDRESS_MAX_CHARS = 70
LIGHT_GRAY = (235, 235, 235)
MUTED_TEXT = (110, 100, 90)

# একজন প্রার্থীর ব্র্যান্ডেড স্লিপে বাধ্যতামূলক এই সতর্কীকরণ লাইন -- এটা যাতে নির্বাচন কমিশনের
# সরকারি নথি বলে ভুল বোঝাবুঝি না হয়, তার একটা সহজ প্রশমন
DISCLAIMER = "এই স্লিপটি ব্যক্তিগত প্রচারণা উপকরণ, নির্বাচন কমিশনের সরকারি নথি নয়"


def _hex_to_rgb(hex_color: str | None, default: tuple[int, int, int]) -> tuple[int, int, int]:
    if not hex_color:
        return default
    h = hex_color.lstrip("#")
    if len(h) != 6:
        return default
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return default


def _register_fonts(pdf: FPDF) -> None:
    pdf.add_font("NotoBengali", "", str(FONT_DIR / "NotoSansBengali-Regular.ttf"))
    pdf.add_font("NotoBengali", "B", str(FONT_DIR / "NotoSansBengali-Bold.ttf"))
    pdf.set_text_shaping(True)


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _draw_card(pdf: FPDF, x: float, y: float, w: float, h: float, voter: Voter) -> None:
    """নিরপেক্ষ (internal-staff) ভোটার কার্ড -- আগের মতোই অপরিবর্তিত, candidate ব্যাচে এটা আর
    ব্যবহার হয় না (সেগুলোর জন্য নিচের _draw_candidate_slip, অনেক বেশি স্পষ্ট/বড় লেআউট)।"""
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


def _place_image_fit(pdf: FPDF, img_bytes: bytes, box_x: float, box_y: float, box_w: float, box_h: float) -> None:
    """ছবিকে ফ্রেমের সাথে স্ট্রেচ না করে অনুপাত ঠিক রেখে ফ্রেমের ভেতর কেন্দ্রে বসায় ("contain")
    -- candidate-এর আপলোড করা ছবি/প্রতীক যেকোনো অনুপাতের হতে পারে, সরাসরি w+h দিয়ে আঁকলে
    সেটা বেঁকে/চ্যাপ্টা দেখাত।"""
    try:
        with PILImage.open(io.BytesIO(img_bytes)) as im:
            iw, ih = im.size
        if not iw or not ih:
            return
        scale = min(box_w / iw, box_h / ih)
        draw_w, draw_h = iw * scale, ih * scale
        draw_x = box_x + (box_w - draw_w) / 2
        draw_y = box_y + (box_h - draw_h) / 2
        pdf.image(io.BytesIO(img_bytes), x=draw_x, y=draw_y, w=draw_w, h=draw_h)
    except Exception:
        pass


def _centered_text(pdf: FPDF, x: float, y: float, w: float, text: str) -> None:
    pdf.set_xy(x, y)
    pdf.cell(w, 5, text, align="C", new_x="LMARGIN", new_y="NEXT")


def _label_value_row(pdf: FPDF, x: float, y: float, w: float, label: str, value: str, label_w: float = 24) -> None:
    pdf.set_font("NotoBengali", "B", 9)
    pdf.set_xy(x, y)
    pdf.cell(label_w, 5.5, label, new_x="RIGHT", new_y="TOP")
    pdf.set_font("NotoBengali", "", 9)
    pdf.set_xy(x + label_w, y)
    pdf.cell(w - label_w, 5.5, value, new_x="LMARGIN", new_y="NEXT")


def _draw_candidate_slip(pdf: FPDF, x: float, y: float, w: float, h: float, voter: Voter, candidate: Candidate) -> None:
    """বাংলাদেশের বাস্তব নির্বাচনী ভোটার স্লিপের মতো লেআউট: উপরে প্রার্থীর আসন/প্রতীক/ছবি/নাম/
    স্লোগান স্পষ্টভাবে, একটা পুরু বিভাজক রেখা, তারপর ভোটারের তথ্য লেবেল-ভ্যালু আকারে সাজানো --
    আগের কমপ্যাক্ট ৮-প্রতি-পৃষ্ঠা ডিজাইনের তুলনায় অনেক বড় (২x২/পৃষ্ঠা) যাতে সবকিছু সহজে পড়া যায়।"""
    primary = _hex_to_rgb(candidate.primary_color, GREEN)
    accent = _hex_to_rgb(candidate.accent_color, RED)

    pdf.set_draw_color(*primary)
    pdf.set_line_width(0.5)
    pdf.rect(x, y, w, h)

    pad = 4
    inner_w = w - 2 * pad
    ty = y + 3

    # নির্বাচনী এলাকা/আসন (থাকলে)
    if candidate.constituency_label:
        pdf.set_text_color(*DARK_TEXT)
        pdf.set_font("NotoBengali", "B", 11)
        _centered_text(pdf, x + pad, ty, inner_w, _truncate(candidate.constituency_label, 34))
        ty += 6.5

    # ছবি (বামে) + প্রতীক (ডানে), দুটোই নির্দিষ্ট মাপের ফ্রেমে -- ছবি না থাকলে ফাঁকা ফ্রেম + লেবেল
    photo_w, photo_h = inner_w * 0.44, 40.0
    symbol_w, symbol_h = inner_w * 0.44, 36.0
    photo_x, photo_y = x + pad, ty
    symbol_x, symbol_y = x + w - pad - symbol_w, ty + 2

    pdf.set_draw_color(*LIGHT_GRAY)
    pdf.set_line_width(0.3)
    pdf.rect(photo_x, photo_y, photo_w, photo_h)
    if candidate.photo_image:
        _place_image_fit(pdf, candidate.photo_image, photo_x, photo_y, photo_w, photo_h)
    pdf.rect(symbol_x, symbol_y, symbol_w, symbol_h)
    if candidate.symbol_image:
        _place_image_fit(pdf, candidate.symbol_image, symbol_x, symbol_y, symbol_w, symbol_h)
    if candidate.symbol_name:
        pdf.set_font("NotoBengali", "", 8)
        pdf.set_text_color(*MUTED_TEXT)
        _centered_text(pdf, symbol_x, symbol_y + symbol_h + 1, symbol_w, _truncate(candidate.symbol_name, 16))

    ty += max(photo_h, symbol_h + 2) + 3

    # প্রার্থীর নাম -- রঙিন ব্যাজ-বার, সাদা বোল্ড টেক্সট (ভোটার-নাম বারের থেকে আলাদা করতে)
    pdf.set_fill_color(*primary)
    pdf.rect(x + pad, ty, inner_w, 8, style="F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("NotoBengali", "B", 11)
    _centered_text(pdf, x + pad, ty + 1.5, inner_w, _truncate(candidate.name, 30))
    ty += 10

    # স্লোগান: নিজেরটা থাকলে সেটা, নাহলে প্রতীকের নাম দিয়ে একটা সাধারণ "---মার্কায় ভোট দিন" লাইন
    slogan = candidate.slogan or (f"{candidate.symbol_name} মার্কায় ভোট দিন" if candidate.symbol_name else None)
    if slogan:
        pdf.set_text_color(*accent)
        pdf.set_font("NotoBengali", "B", 9.5)
        _centered_text(pdf, x + pad, ty, inner_w, _truncate(slogan, 42))
        ty += 6.5

    ty += 1.5

    # পুরু বিভাজক -- হেডার (প্রার্থী) বনাম ভোটার-তথ্য জোনকে স্পষ্টভাবে আলাদা করে
    pdf.set_draw_color(*primary)
    pdf.set_line_width(0.8)
    pdf.line(x + pad, ty, x + w - pad, ty)
    ty += 4

    pdf.set_text_color(*DARK_TEXT)
    pdf.set_font("NotoBengali", "B", 11)
    pdf.set_xy(x + pad, ty)
    pdf.cell(inner_w, 6, _truncate(voter.name or "নাম নেই", 30), new_x="LMARGIN", new_y="NEXT")
    ty += 7

    # voter_no/dob-এর মতো লম্বা মান দুই-কলাম সারিতে দিলে পাশের লেবেলের উপর উপচে পড়ে (fpdf2 cell
    # ক্লিপ/wrap করে না) -- তাই শুধু নিশ্চিতভাবে ছোট মান (ক্রমিক নং/লিঙ্গ) জোড়ায়, বাকি সব পূর্ণ-প্রস্থ
    half_w = inner_w / 2
    _label_value_row(pdf, x + pad, ty, inner_w, "ভোটার নং:", voter.voter_no or "-", label_w=24)
    ty += 5.8
    _label_value_row(pdf, x + pad, ty, inner_w, "পিতার নাম:", _truncate(voter.father_name or "-", 36), label_w=24)
    ty += 5.8
    _label_value_row(pdf, x + pad, ty, inner_w, "মাতার নাম:", _truncate(voter.mother_name or "-", 36), label_w=24)
    ty += 5.8
    _label_value_row(pdf, x + pad, ty, inner_w, "জন্ম তারিখ:", voter.dob or "-", label_w=24)
    ty += 5.8
    _label_value_row(pdf, x + pad, ty, half_w, "ক্রমিক নং:", voter.serial_no or "-", label_w=24)
    _label_value_row(pdf, x + pad + half_w, ty, half_w, "লিঙ্গ:", voter.gender or "-", label_w=18)
    ty += 5.8
    center_label = voter.ward or voter.area_name or "-"
    _label_value_row(pdf, x + pad, ty, inner_w, "কেন্দ্র/ওয়ার্ড:", _truncate(center_label, 36), label_w=24)
    ty += 5.8
    pdf.set_font("NotoBengali", "B", 9)
    pdf.set_xy(x + pad, ty)
    pdf.cell(24, 5.5, "ঠিকানা:", new_x="RIGHT", new_y="TOP")
    pdf.set_font("NotoBengali", "", 9)
    pdf.set_xy(x + pad + 24, ty)
    pdf.multi_cell(inner_w - 24, 5, _truncate(voter.address or "-", ADDRESS_MAX_CHARS))

    pdf.set_font("NotoBengali", "", 5.8)
    pdf.set_text_color(*MUTED_TEXT)
    pdf.set_xy(x + pad, y + h - 5.5)
    pdf.multi_cell(inner_w, 2.6, DISCLAIMER)

    pdf.set_draw_color(*accent)
    pdf.set_line_width(0.8)
    pdf.line(x, y + h - 1.2, x + w, y + h - 1.2)


def build_batch_pdf(voters: list[Voter], candidate: Candidate | None = None) -> bytes:
    """একটা প্রিন্ট-ব্যাচের সব ভোটারের স্লিপ ধারণকারী PDF বানায়। কোনো ভোটার না থাকলেও অন্তত
    একটা ফাঁকা-বার্তা পৃষ্ঠা ফেরত দেয়।

    candidate দেওয়া থাকলে (candidate/candidate_agent-এর তৈরি ব্যাচ) বাস্তব বাংলাদেশি নির্বাচনী
    ভোটার স্লিপের মতো বড়, স্পষ্ট লেআউটে (২x২=৪/পৃষ্ঠা) প্রতীক/ছবি/নাম/স্লোগান দেখানো হয় --
    না দিলে (internal-staff ব্যাচ) আগের কমপ্যাক্ট নিরপেক্ষ ডিজাইন (২x৪=৮/পৃষ্ঠা) অপরিবর্তিত থাকে।"""
    pdf = FPDF(format="A4", unit="mm")
    # পৃষ্ঠাব্যবস্থা এখানে ম্যানুয়ালি (per_page হিসেব করে pdf.add_page()) করা হয় -- fpdf2-এর
    # ডিফল্ট auto-page-break চালু থাকলে একটা কার্ডের মাঝে (যেমন ঠিকানা multi_cell আঁকার সময়)
    # পৃষ্ঠার নিচের margin ছুঁয়ে ফেললে চুপচাপ একটা নতুন পৃষ্ঠা শুরু করে দেয় -- তখন সেই কার্ডের
    # বাকি অংশ (ফুটার/ডিসক্লেইমার/অ্যাকসেন্ট রেখা) পুরনো পৃষ্ঠায় আর আঁকা হয় না, উধাও হয়ে যায়
    pdf.set_auto_page_break(False)
    _register_fonts(pdf)

    if not voters:
        pdf.add_page()
        pdf.set_font("NotoBengali", "", 12)
        pdf.cell(0, 10, "এই ব্যাচে কোনো ভোটার নেই")
        return bytes(pdf.output())

    cols, rows = (CANDIDATE_COLS, CANDIDATE_ROWS) if candidate else (CARD_COLS, CARD_ROWS)
    page_w, page_h = 210, 297
    usable_w = page_w - 2 * MARGIN_MM
    usable_h = page_h - 2 * MARGIN_MM
    card_w = (usable_w - (cols - 1) * GAP_MM) / cols
    card_h = (usable_h - (rows - 1) * GAP_MM) / rows
    per_page = cols * rows

    for i, voter in enumerate(voters):
        pos = i % per_page
        if pos == 0:
            pdf.add_page()
        row, col = divmod(pos, cols)
        x = MARGIN_MM + col * (card_w + GAP_MM)
        y = MARGIN_MM + row * (card_h + GAP_MM)
        if candidate:
            _draw_candidate_slip(pdf, x, y, card_w, card_h, voter, candidate)
        else:
            _draw_card(pdf, x, y, card_w, card_h, voter)

    return bytes(pdf.output())
