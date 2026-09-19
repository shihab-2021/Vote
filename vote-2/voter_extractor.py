#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
বাংলাদেশ ভোটার তালিকা PDF এক্সট্রাক্টর v2.5 (Grid & Unicode CMap Fixed)
==================================================================
৩-কলাম ভোটার বক্স গ্রিড লেআউট এবং বাংলা ফন্ট সিআইডি রিকভারি সাপোর্ট করে।

ব্যবহার:
  python voter_extractor.py
  python voter_extractor.py "F:\চট্টগ্রাম-৬"
"""

import os, sys, re, json, time, traceback
from pathlib import Path
from datetime import datetime

# Windows UTF-8 Output support
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
if hasattr(sys.stderr, 'reconfigure'):
    try:
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import pdfplumber
except ImportError:
    print("pdfplumber ইনস্টল করুন: pip install pdfplumber"); sys.exit(1)

try:
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter
except ImportError:
    print("openpyxl ইনস্টল করুন: pip install openpyxl"); sys.exit(1)

try:
    import fitz  # PyMuPDF — পেজ রেন্ডার করার জন্য
except ImportError:
    print("pymupdf ইনস্টল করুন: pip install pymupdf"); sys.exit(1)

try:
    import numpy as np
    from PIL import Image
    import easyocr
except ImportError:
    print("OCR লাইব্রেরি ইনস্টল করুন: pip install easyocr numpy pillow"); sys.exit(1)

# ──────────────────────────────────────────
# কনফিগারেশন
# ──────────────────────────────────────────
DEFAULT_ROOT = r"F:\\"
OUTPUT_DIR   = os.path.expanduser("~/Desktop")
BATCH_SAVE   = 1000   # প্রতি ১০০০ ভোটারে চেকপয়েন্ট
MAX_PER_FILE = 500000 # প্রতি Excel-এ সর্বোচ্চ ৫ লাখ
OCR_ZOOM     = 3       # পেজ রেন্ডার জুম — বেশি জুম = ভালো OCR কিন্তু ধীর

# ──────────────────────────────────────────
# OCR ইঞ্জিন — একবার লোড হয়ে পুরো ব্যাচে পুনর্ব্যবহৃত হয়
# ──────────────────────────────────────────
_OCR_READER = None
def get_ocr_reader():
    global _OCR_READER
    if _OCR_READER is None:
        print("OCR মডেল লোড হচ্ছে (প্রথমবার কিছুটা সময় লাগবে)...")
        _OCR_READER = easyocr.Reader(['bn'], gpu=False, verbose=False)
    return _OCR_READER

# ──────────────────────────────────────────
# ইউটিলিটি
# ──────────────────────────────────────────
def bn2en(s):
    s = str(s)
    for b, e in zip('০১২৩৪৫৬৭৮৯', '0123456789'):
        s = s.replace(b, e)
    return s

def norm_date(s):
    s = bn2en(str(s))
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})', s)
    if m:
        d, m_val, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2: y = "19" + y
        return f"{d.zfill(2)}/{m_val.zfill(2)}/{y}"
    return ""

def render_page_image(fitz_page, zoom=OCR_ZOOM):
    """পেজকে PIL ইমেজে রেন্ডার করে -- OCR-এর জন্য"""
    pix = fitz_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

def ocr_region(pil_img, bbox, zoom, reader):
    """bbox (x0, top, x1, bottom) -- PDF পয়েন্ট কো-অর্ডিনেট -- OCR করে টেক্সট ফেরত দেয়"""
    x0, top, x1, bottom = bbox
    crop = pil_img.crop((x0 * zoom, top * zoom, x1 * zoom, bottom * zoom))
    lines = reader.readtext(np.array(crop), detail=0, paragraph=True)
    return '\n'.join(lines)

# ──────────────────────────────────────────
# পেজ ১ -- কেন্দ্র মেটা (পুরো পেজ OCR করে পার্স করা হয়)
# ──────────────────────────────────────────
def parse_page1(page, fitz_page, folder_meta=None):
    meta = {}
    reader = get_ocr_reader()
    img = render_page_image(fitz_page)
    text = ocr_region(img, (0, 0, page.width, page.height), OCR_ZOOM, reader)

    head = text[:250]
    if 'মহিলা' in head: meta['লিঙ্গ'] = 'মহিলা'
    elif 'পুরুষ' in head: meta['লিঙ্গ'] = 'পুরুষ'

    m = re.search(r'জেলা\s*[:ঃ]\s*([^\n]+)', text)
    if m: meta['জেলা'] = m.group(1).strip()

    m = re.search(r'উপজেলা[^\n]*\n\s*([^\n]+)', text)
    if m: meta['উপজেলা'] = m.group(1).strip()

    m = re.search(r'পৌরসভা\s*\n\s*([^\n]+)', text)
    if m: meta['পৌরসভা'] = m.group(1).strip()

    m = re.search(r'ইউনিয়ন[^\n]*ওয়ার্ড\s+(\S+)', text)
    if m: meta['ইউনিয়ন'] = m.group(1).strip()

    m = re.search(r'ভোটার এলাকা\s*\n\s*([^\n]+)', text)
    if m: meta['এলাকা_নাম'] = m.group(1).strip()

    m = re.search(r'এলাকার[^\d\n]*([০-৯\d]{3,6})', text)
    if m: meta['এলাকা_নং'] = bn2en(m.group(1))

    # ওয়ার্ড নং -- শুধু সংখ্যা, তাই raw text থেকেও নির্ভরযোগ্যভাবে পাওয়া যায়
    for w in page.extract_words():
        if 335 < w['top'] < 370 and w['x0'] > 600:
            d = bn2en(w['text']).strip('()')
            if d.isdigit() and len(d) <= 3:
                meta['ওয়ার্ড'] = d
                break

    if not meta.get('ইউনিয়ন') and folder_meta and folder_meta.get('_union_folder'):
        meta['ইউনিয়ন'] = folder_meta['_union_folder']
    if not meta.get('উপজেলা') and folder_meta and folder_meta.get('_upazila_folder'):
        meta['উপজেলা'] = folder_meta['_upazila_folder']

    return meta

# ──────────────────────────────────────────
# ভোটার বক্স পার্সার
# ──────────────────────────────────────────
def clean_value(val):
    if not val: return ''
    val = str(val).replace('_', ' ')
    val = re.sub(r'\s+', ' ', val).strip(' ,.-')
    return val

def get_field_from_text(text, pattern):
    m = re.search(pattern, text)
    return clean_value(m.group(1)) if m else ''

def extract_cell_digits(page, bbox):
    """সংখ্যাসূচক ফিল্ড (ক্রমিক, ভোটার নং, জন্ম তারিখ) -- raw টেক্সট থেকে,
    কারণ সংখ্যার গ্লিফ সবসময় সঠিকভাবে এক্সট্র্যাক্ট হয়, যুক্তাক্ষরের সমস্যা এখানে প্রযোজ্য না।"""
    raw = page.crop(bbox).extract_text() or ''
    text = bn2en(raw)
    out = {'ক্রমিক': '', 'ভোটার_নং': '', 'জন্ম_তারিখ': ''}

    m_sl = re.match(r'\s*(\d{4,5})', text)
    if m_sl: out['ক্রমিক'] = m_sl.group(1)

    m_vno = re.search(r'(\d{10,14})', text)
    if m_vno: out['ভোটার_নং'] = m_vno.group(1)

    out['জন্ম_তারিখ'] = norm_date(text)
    return out

def parse_cell_ocr_fields(ocr_text):
    """নাম/পিতা/মাতা/পেশা/ঠিকানা -- OCR করা পরিষ্কার টেক্সট থেকে"""
    t = ocr_text.replace('\n', ' ')
    v = {}
    v['নাম']    = get_field_from_text(t, r'নাম\s*[:ঃ]\s*(.+?)(?=ভোটার|পিতা|$)')
    v['পিতা']   = get_field_from_text(t, r'পিতা\s*[:ঃ]\s*(.+?)(?=মাতা|$)')
    v['মাতা']   = get_field_from_text(t, r'মাতা\s*[:ঃ]\s*(.+?)(?=পেশা|জন্ম|$)')
    v['পেশা']   = get_field_from_text(t, r'পেশা\s*[:ঃ]\s*(.+?)(?=[,;]|\s*জন|\s*ঠিকানা|$)')
    v['ঠিকানা'] = get_field_from_text(t, r'ঠিকানা\s*[:ঃ]\s*(.+)$')
    return v

# ──────────────────────────────────────────
# রেকর্ড যাচাই — সন্দেহজনক/অসম্পূর্ণ ডেটা চিহ্নিতকরণ
# ──────────────────────────────────────────
_SUSPICIOUS_CHARS = re.compile(r'[?^~]|[a-zA-Z]')
_STRAY_PAREN = re.compile(r'\([^ঀ-৿\s]{1,4}\)')
_LEAK_LABEL = re.compile(r'জন্ম|তারিখ|ঠিকানা')

def flag_record(v):
    """রেকর্ডে সন্দেহজনক/অসম্পূর্ণ কিছু থাকলে কারণসহ তালিকা ফেরত দেয়; সব ঠিক থাকলে ফাঁকা তালিকা।"""
    reasons = []

    required = [('নাম','নাম'), ('ভোটার_নং','ভোটার নং'), ('পিতা','পিতার নাম'),
                ('মাতা','মাতার নাম'), ('জন্ম_তারিখ','জন্ম তারিখ'), ('ঠিকানা','ঠিকানা')]
    missing = [label for key, label in required if not v.get(key)]
    if missing:
        reasons.append('অসম্পূর্ণ: ' + ', '.join(missing))

    for key, label in [('নাম','নাম'), ('পিতা','পিতা'), ('মাতা','মাতা'), ('ঠিকানা','ঠিকানা'), ('পেশা','পেশা')]:
        val = v.get(key, '')
        if not val:
            continue
        if _SUSPICIOUS_CHARS.search(val) or _STRAY_PAREN.search(val):
            reasons.append(f'সন্দেহজনক অক্ষর: {label}')
        if key in ('পিতা', 'মাতা') and len(val) > 35:
            reasons.append(f'অস্বাভাবিক দৈর্ঘ্য: {label}')
        if key == 'পেশা' and _LEAK_LABEL.search(val):
            reasons.append('পেশা ফিল্ডে অন্য তথ্য মিশে গেছে')

    vno = v.get('ভোটার_নং', '')
    if vno and not (10 <= len(vno) <= 14):
        reasons.append('অস্বাভাবিক ভোটার নং দৈর্ঘ্য')

    return reasons

# ──────────────────────────────────────────
# PDF প্রসেসর — গ্রিড টেবিল শনাক্তকরণ + OCR হাইব্রিড
# ──────────────────────────────────────────
def process_pdf(pdf_path, folder_meta=None):
    voters = []
    meta   = (folder_meta or {}).copy()
    reader = get_ocr_reader()

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return voters

            fitz_doc = fitz.open(str(pdf_path))
            try:
                # পেজ ১ — কেন্দ্র মেটা
                p1_meta = parse_page1(pdf.pages[0], fitz_doc[0], folder_meta)
                meta.update({k: v for k, v in p1_meta.items() if v})

                # পেজ ২+ — ভোটার গ্রিড
                for page_idx in range(1, len(pdf.pages)):
                    pg = pdf.pages[page_idx]
                    try:
                        tables = pg.find_tables()
                        if not tables:
                            continue
                        table = tables[0]
                        pil_img = render_page_image(fitz_doc[page_idx])

                        for row in table.rows:
                            for cell in row.cells:
                                if not cell:
                                    continue
                                try:
                                    digits = extract_cell_digits(pg, cell)
                                    ocr_text = ocr_region(pil_img, cell, OCR_ZOOM, reader)
                                    fields = parse_cell_ocr_fields(ocr_text)
                                    if not fields.get('নাম') or len(fields['নাম']) < 2:
                                        continue
                                    v = {}
                                    v.update(digits)
                                    v.update(fields)
                                    for k in ['লিঙ্গ', 'জেলা', 'উপজেলা', 'পৌরসভা',
                                              'ইউনিয়ন', 'ওয়ার্ড', 'এলাকা_নং', 'এলাকা_নাম']:
                                        v[k] = meta.get(k, '')
                                    flags = flag_record(v)
                                    v['_flag'] = '; '.join(flags)
                                    voters.append(v)
                                except Exception:
                                    pass
                    except Exception:
                        pass
            finally:
                fitz_doc.close()

    except Exception as e:
        print(f"\n    ⚠ {os.path.basename(str(pdf_path))}: {e}")

    # ক্রমিক ফাঁকা থাকলে (বিরল OCR/টেক্সট মিস) ধারাবাহিকভাবে পূরণ করা হয়
    last_sl = 0
    for v in voters:
        if v.get('ক্রমিক') and v['ক্রমিক'].isdigit():
            last_sl = int(v['ক্রমিক'])
        elif last_sl > 0:
            last_sl += 1
            v['ক্রমিক'] = f"{last_sl:04d}"

    return voters



# ──────────────────────────────────────────
# ফোল্ডার → মেটা
# ──────────────────────────────────────────
def meta_from_path(pdf_path, root):
    pdf_path = Path(pdf_path)
    root = Path(root)
    try:
        rel   = pdf_path.relative_to(root)
        parts = rel.parts
    except ValueError:
        parts = []

    m = {}
    if len(parts) >= 3: m['_upazila_folder'] = parts[2]
    if len(parts) >= 4: m['_union_folder']   = parts[3]
    if len(parts) >= 5: m['_area_folder']    = parts[4]

    # Fallback to parent directory names if metadata fields are missing
    if '_area_folder' not in m and len(pdf_path.parents) > 0:
        m['_area_folder'] = pdf_path.parent.name
    if '_union_folder' not in m and len(pdf_path.parents) > 1:
        m['_union_folder'] = pdf_path.parent.parent.name
    if '_upazila_folder' not in m and len(pdf_path.parents) > 2:
        m['_upazila_folder'] = pdf_path.parent.parent.parent.name

    m['source_file'] = pdf_path.name
    return m


# ──────────────────────────────────────────
# Excel রাইটার
# ──────────────────────────────────────────
COLS = [
    ('ক্রমিক',      'ক্রমিক নং',        8),
    ('নাম',          'নাম',              22),
    ('ভোটার_নং',    'ভোটার নং',         20),
    ('পিতা',         'পিতার নাম',        22),
    ('মাতা',         'মাতার নাম',        22),
    ('পেশা',         'পেশা',             12),
    ('জন্ম_তারিখ',  'জন্ম তারিখ',       14),
    ('লিঙ্গ',        'লিঙ্গ',             8),
    ('জেলা',         'জেলা',             12),
    ('পৌরসভা',       'পৌরসভা',           16),
    ('উপজেলা',       'উপজেলা',           14),
    ('ইউনিয়ন',      'ইউনিয়ন/ওয়ার্ড',   16),
    ('ওয়ার্ড',      'ওয়ার্ড নং',        8),
    ('এলাকা_নং',    'এলাকা নং',         10),
    ('এলাকা_নাম',   'এলাকার নাম',        18),
    ('ঠিকানা',       'ঠিকানা',           35),
    ('_upazila_folder','ফোল্ডার উপজেলা', 14),
    ('_union_folder',  'ফোল্ডার ইউনিয়ন', 14),
    ('_area_folder',   'ফোল্ডার এলাকা',  12),
    ('source_file',    'উৎস ফাইল',        20),
    ('_flag',          'যাচাই প্রয়োজন',   30),
]

def write_excel(voters, out_path, stats):
    wb = openpyxl.Workbook(write_only=False)
    ws = wb.active
    ws.title = "ভোটার তালিকা"

    hfill  = PatternFill("solid", start_color="162B4D")
    hfont  = Font(bold=True, color="FFFFFF", name="Arial", size=10)
    halign = Alignment(horizontal="center", vertical="center", wrap_text=True)
    thin   = Side(style="thin", color="DDDDDD")
    brd    = Border(left=thin, right=thin, top=thin, bottom=thin)
    altf   = PatternFill("solid", start_color="EEF3FF")
    flagf  = PatternFill("solid", start_color="FDE2E2")
    flagfont = Font(name="Arial", size=9, color="B00020")
    dfont  = Font(name="Arial", size=9)
    dctr   = Alignment(horizontal="center", vertical="center")
    dlft   = Alignment(horizontal="left",   vertical="center")

    # হেডার
    for ci, (_, display, _w) in enumerate(COLS, 1):
        c = ws.cell(row=1, column=ci, value=display)
        c.font = hfont; c.fill = hfill
        c.alignment = halign; c.border = brd
    ws.row_dimensions[1].height = 28

    # ডেটা
    center_cols = {1, 7, 8, 13, 14}  # ক্রমিক, তারিখ, লিঙ্গ, ওয়ার্ড, এলাকা নং
    flagged_count = 0
    for ri, v in enumerate(voters, 2):
        is_flagged = bool(v.get('_flag'))
        if is_flagged: flagged_count += 1
        for ci, (key, _, _w) in enumerate(COLS, 1):
            c = ws.cell(row=ri, column=ci, value=v.get(key, ''))
            c.alignment = dctr if ci in center_cols else dlft
            c.border = brd
            if is_flagged:
                c.font = flagfont
                c.fill = flagf
            else:
                c.font = dfont
                if ri % 2 == 0: c.fill = altf

    # কলাম প্রস্থ
    for ci, (_, _, w) in enumerate(COLS, 1):
        ws.column_dimensions[get_column_letter(ci)].width = w

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}1"

    # সারসংক্ষেপ শীট
    ws2 = wb.create_sheet("সারসংক্ষেপ")
    ws2['A1'] = "বাংলাদেশ ভোটার তালিকা — প্রক্রিয়াকরণ রিপোর্ট"
    ws2['A1'].font = Font(bold=True, size=13, color="162B4D", name="Arial")
    rows = [
        ("মোট ভোটার",         stats.get('total_voters', 0)),
        ("যাচাই প্রয়োজন",     flagged_count),
        ("মোট PDF ফাইল",      stats.get('total_pdfs',   0)),
        ("সফল ফাইল",          stats.get('success',      0)),
        ("ব্যর্থ ফাইল",       stats.get('failed',       0)),
        ("মোট সময়",           stats.get('elapsed',      '')),
        ("তৈরির তারিখ",       datetime.now().strftime('%d/%m/%Y %H:%M')),
    ]
    for ri, (lbl, val) in enumerate(rows, 3):
        ws2.cell(row=ri, column=1, value=lbl).font = Font(bold=True, name="Arial", size=10)
        c2 = ws2.cell(row=ri, column=2, value=val)
        c2.font = Font(name="Arial", size=10, color="B00020" if lbl == "যাচাই প্রয়োজন" and flagged_count else "000000")
    ws2.column_dimensions['A'].width = 22
    ws2.column_dimensions['B'].width = 22
    ws2['A10'] = "লাল রঙে চিহ্নিত সারিগুলো ম্যানুয়ালি যাচাই করে নিন (অসম্পূর্ণ বা সন্দেহজনক তথ্য)।"
    ws2['A10'].font = Font(italic=True, size=9, color="6b7280", name="Arial")

    wb.save(out_path)
    return out_path


# ──────────────────────────────────────────
# মেইন
# ──────────────────────────────────────────
def safe_input(prompt=""):
    if sys.stdin.isatty():
        try:
            return input(prompt)
        except (EOFError, KeyboardInterrupt):
            pass
    return ""

def main():
    if len(sys.argv) > 1:
        root = sys.argv[1]
    else:
        root = DEFAULT_ROOT
        print(f"\n📁 ডিফল্ট ফোল্ডার: {root}")
        c = safe_input("অন্য ফোল্ডার পাথ দিন (খালি = ডিফল্ট): ").strip()
        if c: root = c

    root = Path(root)
    if not root.exists():
        print(f"❌ ফোল্ডার বা ফাইল পাওয়া যায়নি: {root}"); sys.exit(1)

    ts          = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_base    = os.path.join(OUTPUT_DIR, f"voter_data_{ts}")
    checkpoint  = out_base + "_checkpoint.json"

    print(f"\n{'='*62}")
    print(f"  বাংলাদেশ ভোটার তালিকা এক্সট্রাক্টর v2.5")
    print(f"{'='*62}")
    print(f"  রুট    : {root}")
    print(f"  আউটপুট : {out_base}.xlsx")
    print(f"{'='*62}\n")

    # সব PDF
    print("📂 PDF খোঁজা হচ্ছে...")
    if root.is_file():
        all_pdfs = [root]
    else:
        all_pdfs = sorted(list(root.rglob("*.pdf")) + list(root.rglob("*.PDF")))
    total    = len(all_pdfs)
    print(f"   {total:,}টি PDF পাওয়া গেছে\n")
    if total == 0:
        print("❌ কোনো PDF নেই!"); sys.exit(1)

    all_voters = []
    success = failed = 0
    t0 = time.time()

    for idx, pdf_path in enumerate(all_pdfs, 1):
        fm = meta_from_path(pdf_path, root)
        elapsed = time.time() - t0
        eta_s   = (elapsed / idx * (total - idx)) if idx > 1 else 0

        short = f"{pdf_path.parent.name}/{pdf_path.name}"
        print(f"  [{idx:5d}/{total}] {short[:55]:<55}", end=' ', flush=True)

        vv = process_pdf(pdf_path, fm)
        if vv:
            all_voters.extend(vv)
            success += 1
            print(f"✓ {len(vv):4d} জন")
        else:
            failed += 1
            print("⚠  ০ জন")

        # চেকপয়েন্ট
        if idx % BATCH_SAVE == 0 and all_voters:
            with open(checkpoint, 'w', encoding='utf-8') as f:
                json.dump(all_voters[-BATCH_SAVE:], f, ensure_ascii=False)
            print(f"\n  💾 চেকপয়েন্ট: {len(all_voters):,} ভোটার সেভ | "
                  f"ETA: {eta_s/60:.1f} মিনিট\n")

    elapsed_total = time.time() - t0

    flagged = sum(1 for v in all_voters if v.get('_flag'))

    print(f"\n{'='*62}")
    print(f"  ✅ প্রক্রিয়াকরণ সম্পন্ন!")
    print(f"  মোট ভোটার     : {len(all_voters):,}")
    print(f"  যাচাই প্রয়োজন : {flagged:,}")
    print(f"  সফল ফাইল      : {success:,}")
    print(f"  ব্যর্থ ফাইল    : {failed:,}")
    print(f"  মোট সময়       : {elapsed_total/60:.1f} মিনিট")
    print(f"{'='*62}\n")

    if not all_voters:
        print("❌ কোনো ভোটার ডেটা পাওয়া যায়নি!")
        print("   কারণ হতে পারে: PDF-এ টেক্সট লেয়ার নেই (স্ক্যান)।")
        safe_input("Enter চাপুন..."); sys.exit(1)

    stats = dict(total_voters=len(all_voters), total_pdfs=total,
                 success=success, failed=failed,
                 elapsed=f"{elapsed_total/60:.1f} মিনিট")

    # বড় ডেটা → ভাগ করে সেভ
    chunks = [all_voters[i:i+MAX_PER_FILE]
              for i in range(0, len(all_voters), MAX_PER_FILE)]
    saved_files = []
    for ci, chunk in enumerate(chunks, 1):
        suffix = f"_part{ci}" if len(chunks) > 1 else ""
        path   = out_base + suffix + ".xlsx"
        print(f"📊 Excel সেভ হচ্ছে ({len(chunk):,} ভোটার) → {os.path.basename(path)}")
        write_excel(chunk, path, stats)
        saved_files.append(path)
        print(f"   ✅ {path}")

    # চেকপয়েন্ট পরিষ্কার
    if os.path.exists(checkpoint):
        os.remove(checkpoint)

    print(f"\n🎉 সম্পন্ন! {len(saved_files)}টি Excel ফাইল তৈরি হয়েছে:")
    for fpath in saved_files:
        print(f"   📁 {fpath}")
    print("   এই Excel ফাইলগুলো voter_app.html-এ আমদানি করুন।")
    safe_input("\nEnter চাপুন বন্ধ করতে...")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠ বন্ধ করা হয়েছে। চেকপয়েন্ট থেকে পরে চালু করা যাবে।")
    except Exception as e:
        print(f"\n❌ ত্রুটি: {e}")
        traceback.print_exc()
        safe_input("Enter চাপুন...")
