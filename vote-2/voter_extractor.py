#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
বাংলাদেশ ভোটার তালিকা PDF এক্সট্রাক্টর v2.0
===============================================
৩-কলাম ভোটার বক্স ফরম্যাট সাপোর্ট করে।

ব্যবহার:
  python voter_extractor.py
  python voter_extractor.py "F:\\চট্টগ্রাম-৬"
"""

import os, sys, re, json, time, traceback
from pathlib import Path
from datetime import datetime

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

# ──────────────────────────────────────────
# কনফিগারেশন
# ──────────────────────────────────────────
DEFAULT_ROOT = r"F:\\"
OUTPUT_DIR   = os.path.expanduser("~/Desktop")
BATCH_SAVE   = 1000   # প্রতি ১০০০ ভোটারে চেকপয়েন্ট
MAX_PER_FILE = 500000 # প্রতি Excel-এ সর্বোচ্চ ৫ লাখ

# ──────────────────────────────────────────
# ইউটিলিটি
# ──────────────────────────────────────────
def clean(s):
    if not s: return ""
    return re.sub(r'\s+', ' ', str(s)).strip()

def bn2en(s):
    s = str(s)
    for b, e in zip('০১২৩৪৫৬৭৮৯', '0123456789'):
        s = s.replace(b, e)
    return s

def norm_date(s):
    s = bn2en(str(s)).strip()
    m = re.search(r'(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{4})', s)
    if m:
        return f"{m.group(1).zfill(2)}/{m.group(2).zfill(2)}/{m.group(3)}"
    return s

def get_field(text, *keys):
    """একাধিক কীওয়ার্ড দিয়ে ভ্যালু বের করে"""
    for key in keys:
        idx = text.find(key)
        if idx == -1: continue
        rest = text[idx + len(key):].lstrip(' :।\t')
        val  = rest.split('\n')[0].strip()
        if val and len(val) > 0:
            return clean(val)
    return ""

# ──────────────────────────────────────────
# পেজ ১ — কেন্দ্র মেটা
# ──────────────────────────────────────────
def parse_page1(text):
    meta = {}
    meta['জেলা']       = get_field(text, 'জেলা:', 'জেলা :')
    meta['উপজেলা']     = get_field(text, 'উপজেলা/থানা', 'উপজেলা')
    meta['পৌরসভা']     = get_field(text, 'সিটি কর্পোরেশন/ পৌরসভা', 'পৌরসভা')
    meta['ইউনিয়ন']    = get_field(text, 'ইউনিয়ন/পৌর ওয়ার্ড/\nক্যান্টনমেন্ট বোর্ড',
                                         'ইউনিয়ন/', 'ইউনিয়ন')
    meta['ওয়ার্ড']    = bn2en(get_field(text, 'ওয়ার্ড নম্বর (ইউনিয়ন পরিষদের জন্য)',
                                               'ওয়ার্ড নং', 'ওয়ার্ড নম্বর'))
    meta['এলাকা_নং']  = bn2en(get_field(text, 'ভোটার এলাকার নম্বর', 'ভোটার এলাকার নখর'))
    meta['এলাকা_নাম'] = get_field(text, 'ভোটার এলাকা\n', 'ভোটার এলাকার নাম', 'ভোটার এলাকা')

    # ওয়ার্ড / এলাকা নং থেকে শুধু সংখ্যা নাও
    for k in ['ওয়ার্ড', 'এলাকা_নং']:
        m = re.search(r'\d+', meta.get(k, ''))
        if m: meta[k] = m.group()

    # লিঙ্গ
    if 'মহিলা' in text[:600]:
        meta['লিঙ্গ'] = 'মহিলা'
    elif 'পুরুষ' in text[:600]:
        meta['লিঙ্গ'] = 'পুরুষ'
    else:
        meta['লিঙ্গ'] = ''

    return {k: v for k, v in meta.items() if v}


# ──────────────────────────────────────────
# ভোটার ব্লক পার্সার
# ──────────────────────────────────────────
def parse_one_block(block, meta):
    """একটা ভোটার ব্লক (টেক্সট) থেকে dict বানায়"""
    v = {}

    # ক্রমিক নং — ব্লকের শুরুতে ৪-৫ ডিজিট
    m = re.match(r'\s*(\d{4,5})', block)
    v['ক্রমিক'] = m.group(1) if m else ''

    v['নাম']         = clean(get_field(block, 'নাম:','নাম :','নাম'))
    v['ভোটার_নং']   = clean(bn2en(get_field(block,
                                'ভোটার নং:', 'ভোটার নখর:', 'ভোটার নম্বর:', 'ভোটার নং')))
    v['পিতা']        = clean(get_field(block, 'পিতা:', 'পিতা :'))
    v['মাতা']        = clean(get_field(block, 'মাতা:', 'মাতা :'))

    # পেশা ও জন্ম তারিখ — প্রায়ই একই লাইনে
    # "পেশা: গৃহিণী,জন্ম তারিখ:০৪/০১/১৯৫২"
    m2 = re.search(
        r'পেশা\s*[:\s।]+([^,\n]+)[,\s]*জন্ম\s*তারিখ\s*[:\s।]*([^\nঠ\r]+)',
        block)
    if m2:
        v['পেশা']        = clean(m2.group(1))
        v['জন্ম_তারিখ'] = norm_date(m2.group(2))
    else:
        v['পেশা']        = clean(get_field(block, 'পেশা:', 'পেশা :'))
        dob = get_field(block, 'জন্ম তারিখ:', 'জন্ম তারিখ :')
        v['জন্ম_তারিখ'] = norm_date(dob) if dob else ''

    # ঠিকানা
    m3 = re.search(r'ঠিকানা\s*[:\s।]+(.+?)(?=\n\d{4,5}|\Z)', block, re.DOTALL)
    v['ঠিকানা'] = clean(m3.group(1).replace('\n', ' ')) if m3 else ''

    # মেটা কপি
    v['লিঙ্গ']      = meta.get('লিঙ্গ', '')
    v['জেলা']       = meta.get('জেলা', '')
    v['উপজেলা']     = meta.get('উপজেলা', '')
    v['পৌরসভা']     = meta.get('পৌরসভা', '')
    v['ইউনিয়ন']    = meta.get('ইউনিয়ন', '')
    v['ওয়ার্ড']    = meta.get('ওয়ার্ড', '')
    v['এলাকা_নং']  = meta.get('এলাকা_নং', '')
    v['এলাকা_নাম'] = meta.get('এলাকা_নাম', '')

    return v


# ──────────────────────────────────────────
# ৩-কলাম পেজ পার্সার  ← মূল উদ্ভাবন
# ──────────────────────────────────────────
def extract_3col_blocks(page):
    """
    pdfplumber দিয়ে প্রতিটা word-এর x স্থানাঙ্ক দেখে
    পেজটাকে ৩টা ভার্টিক্যাল কলামে ভাগ করে আলাদা টেক্সট তোলে।
    তারপর প্রতিটা কলামকে ভোটার ব্লকে ভাগ করে।
    """
    words = page.extract_words(x_tolerance=3, y_tolerance=3,
                                keep_blank_chars=False,
                                use_text_flow=False)
    if not words:
        # fallback — সাধারণ টেক্সট
        return [page.extract_text() or ""]

    # পেজ প্রস্থ
    page_w = page.width

    # কলাম সীমানা নির্ধারণ (মোটামুটি ১/৩, ২/৩)
    c1_end = page_w * 0.36
    c2_end = page_w * 0.67

    # words → কলাম অনুযায়ী গ্রুপ
    cols = {0: [], 1: [], 2: []}
    for w in words:
        xm = (w['x0'] + w['x1']) / 2
        if xm < c1_end:
            cols[0].append(w)
        elif xm < c2_end:
            cols[1].append(w)
        else:
            cols[2].append(w)

    col_texts = []
    for ci in range(3):
        ws = cols[ci]
        if not ws: continue
        # y অনুযায়ী sort → লাইন বানাই
        ws.sort(key=lambda w: (round(w['top'] / 5) * 5, w['x0']))
        lines = []
        cur_y  = None
        cur_line = []
        for w in ws:
            y = round(w['top'] / 5) * 5
            if cur_y is None or abs(y - cur_y) <= 5:
                cur_line.append(w['text'])
                cur_y = y
            else:
                lines.append(' '.join(cur_line))
                cur_line = [w['text']]
                cur_y = y
        if cur_line:
            lines.append(' '.join(cur_line))
        col_texts.append('\n'.join(lines))

    return col_texts


def split_into_voter_blocks(col_text):
    """একটা কলামের টেক্সটকে ভোটার ব্লকে ভাগ করে"""
    # ক্রমিক নম্বর দিয়ে split — যেমন "০০০১." বা "0001."
    parts = re.split(r'(?=\n?\s*[\d০-৯]{4,5}[।\.\s]\s*নাম)', col_text)
    blocks = []
    for p in parts:
        p = p.strip()
        if re.match(r'[\d০-৯]{4,5}', p) and 'নাম' in p:
            blocks.append(p)
    return blocks


# ──────────────────────────────────────────
# PDF প্রসেসর
# ──────────────────────────────────────────
def process_pdf(pdf_path, folder_meta=None):
    voters = []
    meta   = (folder_meta or {}).copy()

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return voters

            # পেজ ১ — মেটা
            p1_text = pdf.pages[0].extract_text() or ""
            p1_meta = parse_page1(p1_text)
            meta.update({k: v for k, v in p1_meta.items() if v})

            # পেজ ২+ — ভোটার
            for pg in pdf.pages[1:]:
                try:
                    col_texts = extract_3col_blocks(pg)
                    for col_text in col_texts:
                        blocks = split_into_voter_blocks(col_text)
                        for block in blocks:
                            try:
                                v = parse_one_block(block, meta)
                                if v.get('নাম') and len(v['নাম']) > 1:
                                    voters.append(v)
                            except Exception:
                                pass
                except Exception:
                    pass

    except Exception as e:
        print(f"\n    ⚠ {os.path.basename(str(pdf_path))}: {e}")

    return voters


# ──────────────────────────────────────────
# ফোল্ডার → মেটা
# ──────────────────────────────────────────
def meta_from_path(pdf_path, root):
    """
    F:\চট্টগ্রাম-৬\চট্রগ্রাম-৬\RAOZAN\BAGOAN\151592\file.pdf
    → folder_upazila=RAOZAN, folder_union=BAGOAN, folder_area=151592
    """
    try:
        rel   = Path(pdf_path).relative_to(root)
        parts = rel.parts
    except ValueError:
        parts = []

    m = {}
    if len(parts) >= 3: m['_upazila_folder'] = parts[2]
    if len(parts) >= 4: m['_union_folder']   = parts[3]
    if len(parts) >= 5: m['_area_folder']    = parts[4]
    m['source_file'] = Path(pdf_path).name
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
    for ri, v in enumerate(voters, 2):
        for ci, (key, _, _w) in enumerate(COLS, 1):
            c = ws.cell(row=ri, column=ci, value=v.get(key, ''))
            c.font = dfont
            c.alignment = dctr if ci in center_cols else dlft
            c.border = brd
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
        ("মোট ভোটার",      stats.get('total_voters', 0)),
        ("মোট PDF ফাইল",   stats.get('total_pdfs',   0)),
        ("সফল ফাইল",       stats.get('success',      0)),
        ("ব্যর্থ ফাইল",    stats.get('failed',       0)),
        ("মোট সময়",        stats.get('elapsed',      '')),
        ("তৈরির তারিখ",    datetime.now().strftime('%d/%m/%Y %H:%M')),
    ]
    for ri, (lbl, val) in enumerate(rows, 3):
        ws2.cell(row=ri, column=1, value=lbl).font = Font(bold=True, name="Arial", size=10)
        ws2.cell(row=ri, column=2, value=val).font = Font(name="Arial", size=10)
    ws2.column_dimensions['A'].width = 22
    ws2.column_dimensions['B'].width = 22

    wb.save(out_path)
    return out_path


# ──────────────────────────────────────────
# মেইন
# ──────────────────────────────────────────
def main():
    if len(sys.argv) > 1:
        root = sys.argv[1]
    else:
        root = DEFAULT_ROOT
        print(f"\n📁 ডিফল্ট ফোল্ডার: {root}")
        c = input("অন্য ফোল্ডার পাথ দিন (খালি = ডিফল্ট): ").strip()
        if c: root = c

    root = Path(root)
    if not root.exists():
        print(f"❌ ফোল্ডার পাওয়া যায়নি: {root}"); sys.exit(1)

    ts          = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_base    = os.path.join(OUTPUT_DIR, f"voter_data_{ts}")
    checkpoint  = out_base + "_checkpoint.json"

    print(f"\n{'='*62}")
    print(f"  বাংলাদেশ ভোটার তালিকা এক্সট্রাক্টর v2.0")
    print(f"{'='*62}")
    print(f"  রুট    : {root}")
    print(f"  আউটপুট : {out_base}.xlsx")
    print(f"{'='*62}\n")

    # সব PDF
    print("📂 PDF খোঁজা হচ্ছে...")
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

    print(f"\n{'='*62}")
    print(f"  ✅ প্রক্রিয়াকরণ সম্পন্ন!")
    print(f"  মোট ভোটার  : {len(all_voters):,}")
    print(f"  সফল ফাইল   : {success:,}")
    print(f"  ব্যর্থ ফাইল : {failed:,}")
    print(f"  মোট সময়    : {elapsed_total/60:.1f} মিনিট")
    print(f"{'='*62}\n")

    if not all_voters:
        print("❌ কোনো ভোটার ডেটা পাওয়া যায়নি!")
        print("   কারণ হতে পারে: PDF-এ টেক্সট লেয়ার নেই (স্ক্যান)।")
        input("Enter চাপুন..."); sys.exit(1)

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

    print(f"\n🎉 সম্পন্ন! ডেস্কটপে {len(saved_files)}টি ফাইল তৈরি হয়েছে।")
    print("   এই Excel ফাইলগুলো voter_app.html-এ আমদানি করুন।")
    input("\nEnter চাপুন বন্ধ করতে...")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠ বন্ধ করা হয়েছে। চেকপয়েন্ট থেকে পরে চালু করা যাবে।")
    except Exception as e:
        print(f"\n❌ ত্রুটি: {e}")
        traceback.print_exc()
        input("Enter চাপুন...")
