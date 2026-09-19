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

# ──────────────────────────────────────────
# কনফিগারেশন
# ──────────────────────────────────────────
DEFAULT_ROOT = r"F:\\"
OUTPUT_DIR   = os.path.expanduser("~/Desktop")
BATCH_SAVE   = 1000   # প্রতি ১০০০ ভোটারে চেকপয়েন্ট
MAX_PER_FILE = 500000 # প্রতি Excel-এ সর্বোচ্চ ৫ লাখ

# ──────────────────────────────────────────
# বাংলা ফন্ট সিআইডি ও এনকোডিং ডিকশনারি
# ──────────────────────────────────────────
CID_MAP = {
    '(cid:140)': 'ন্ট',
    '(cid:203)': '্যা', '(cid:206)': 'র্', '(cid:207)': 'ে', '(cid:208)': 'ৈ',
    '(cid:209)': 'ু', '(cid:212)': 'ৌ', '(cid:229)': 'গ্র', '(cid:234)': 'ঙ্গ',
    '(cid:239)': 'শ্চি', '(cid:251)': 'ঞ্চ', '(cid:255)': 'ট্ট', '(cid:275)': 'ত্ত',
    '(cid:276)': 'ত্র', '(cid:279)': 'দ্দ', '(cid:290)': 'ন্ত', '(cid:292)': 'ন্দ',
    '(cid:293)': 'ন্ম', '(cid:296)': 'ন্ন', '(cid:297)': 'ন্সী', '(cid:303)': 'ন্যা',
    '(cid:304)': 'প্রাপ্ত', '(cid:306)': 'ল্লু', '(cid:308)': 'প্র', '(cid:314)': 'ব্দ',
    '(cid:316)': 'ব্ব', '(cid:317)': 'ব্রা', '(cid:322)': 'ন্নে', '(cid:324)': 'ম্ব',
    '(cid:327)': 'ম্ম', '(cid:332)': 'ল্লাহ', '(cid:340)': 'শ্চি', '(cid:344)': 'শ্র',
    '(cid:350)': 'স্ট', '(cid:354)': 'স্ট্র', '(cid:360)': 'স্ট', '(cid:361)': 'স্ত',
    '(cid:363)': 'চ্ছ', '(cid:369)': 'স্ত্রী', '(cid:381)': 'ছোল', '(cid:383)': 'নুর',
    '(cid:384)': 'শামস', '(cid:385)': 'রু', '(cid:386)': 'ফজল', '(cid:387)': 'দুল',
    '(cid:388)': 'ফুল', '(cid:389)': 'হৃদয়', '(cid:390)': 'জল', '(cid:398)': 'মেহের',
    '(cid:414)': 'দ্দী', '(cid:419)': 'কুর',
}

def clean_text(text):
    if not text: return ""
    text = str(text)
    for cid, val in CID_MAP.items():
        text = text.replace(cid, val)
    # Gashchi spelling fix
    text = text.replace('গিশ্চি', 'গশ্চি').replace('গিেশ্চি', 'গশ্চি').replace('গিশ্চ', 'গশ্চি')
    # Vowel reordering & Unicode normalization
    text = re.sub(r'e([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)া', r'\1ো', text)
    text = re.sub(r'ে([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)া', r'\1ো', text)
    text = re.sub(r'ে([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)ৗ', r'\1ৌ', text)
    text = re.sub(r'ে([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)', r'\1ে', text)
    text = re.sub(r'ৈ([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)', r'\1ৈ', text)
    text = re.sub(r'ি([\u0980-\u09FF](?:\u09CD[\u0980-\u09FF])?)', r'\1ি', text)
    text = text.replace('\u25cc', '')
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def bn2en(s):
    s = str(s)
    for b, e in zip('০১২৩৪৫৬৭৮৯', '0123456789'):
        s = s.replace(b, e)
    return s

def norm_date(s):
    s = clean_text(s)
    m = re.search(r'([০-৯\d]{1,2})[/\-\.]([০-৯\d]{1,2})[/\-\.]([০-৯\d]{2,4})', s)
    if m:
        d, m_val, y = bn2en(m.group(1)), bn2en(m.group(2)), bn2en(m.group(3))
        if len(y) == 2: y = "19" + y
        return f"{d.zfill(2)}/{m_val.zfill(2)}/{y}"
    return ""

# ──────────────────────────────────────────
# পেজ ১ — কেন্দ্র মেটা
# ──────────────────────────────────────────
def parse_page1(page, folder_meta=None):
    words = page.extract_words()
    meta = {}
    
    full_text = clean_text(page.extract_text() or '')
    if 'মহিলা' in full_text[:600]: meta['লিঙ্গ'] = 'মহিলা'
    elif 'পুরুষ' in full_text[:600]: meta['লিঙ্গ'] = 'পুরুষ'
    
    for w in words:
        top = w['top']
        x0 = w['x0']
        txt = clean_text(w['text'])
        if not txt: continue
        
        # Upazila: top ~ 304, x0 ~ 200
        if 290 < top < 320 and 190 <= x0 < 380:
            if 'উপজেলা' not in txt:
                meta['উপজেলা'] = meta.get('উপজেলা', '') + ' ' + txt
                
        # Union: top ~ 325..365, x0 ~ 190..380
        elif 325 < top < 365 and 190 <= x0 < 380:
            if 'ইউনিয়ন' not in txt and 'ক্যান্টনমেন্ট' not in txt and 'বোর্ড' not in txt and 'পৌর' not in txt and 'ওয়ার্ড' not in txt:
                meta['ইউনিয়ন'] = meta.get('ইউনিয়ন', '') + ' ' + txt
                
        # Area Name: top ~ 375..405, x0 ~ 190..380
        elif 375 < top < 405 and 190 <= x0 < 380:
            meta['এলাকা_নাম'] = meta.get('এলাকা_নাম', '') + ' ' + txt
            
        # Area No: top ~ 410..435, x0 ~ 190..380
        elif 410 < top < 435 and 190 <= x0 < 380:
            meta['এলাকা_নং'] = meta.get('এলাকা_নং', '') + ' ' + txt
            
        # District: top ~ 225..250, x0 > 420
        elif 225 < top < 250 and x0 > 420:
            if 'জেলা' not in txt:
                meta['জেলা'] = meta.get('জেলা', '') + ' ' + txt
                
        # Ward No: top ~ 340..365, x0 > 620
        elif 340 < top < 365 and x0 > 620:
            meta['ওয়ার্ড'] = meta.get('ওয়ার্ড', '') + ' ' + txt

    for k in meta:
        meta[k] = clean_text(meta[k])

    # Fallbacks if metadata missing
    if not meta.get('ইউনিয়ন') and folder_meta and folder_meta.get('_union_folder'):
        meta['ইউনিয়ন'] = folder_meta['_union_folder']
    if not meta.get('উপজেলা') and folder_meta and folder_meta.get('_upazila_folder'):
        meta['উপজেলা'] = folder_meta['_upazila_folder']

    return meta

# ──────────────────────────────────────────
# ভোটার বক্স পার্সার
# ──────────────────────────────────────────
def post_process_record(v):
    for field in ['নাম', 'পিতা', 'মাতা', 'পেশা', 'ঠিকানা', 'ইউনিয়ন', 'উপজেলা', 'জেলা', 'এলাকা_নাম']:
        val = v.get(field, '')
        if not val: continue
        val = str(val)

        val = val.replace('(cid:259)', '').replace('(cid:281)', 'ঞ্চ').replace('(cid:217)', 'ক্ষ')
        val = val.replace('(cid:245)', 'জাফ').replace('(cid:253)', 'নজু')

        val = val.replace('মেভাহাম্মদ', 'মোহাম্মদ').replace('মভাহাম্মদ', 'মোহাম্মদ').replace('মভাহাদ্দ', 'মোহাম্মদ')
        val = val.replace('মেভাঃ', 'মোঃ').replace('মেভা', 'মোঃ')
        val = val.replace('মোজাফাফর', 'মোজাফফর').replace('মোজাফাফৰ', 'মোজাফফর')
        val = val.replace('ইউশামসপ', 'ইউসুফ').replace('ইউসপ', 'ইউসুফ').replace('ইউশফ', 'ইউসুফ')
        val = val.replace('রিফক', 'রফিক').replace('আেবদীন', 'আবেদীন')
        val = val.replace('স ালমা', 'সালমা').replace('মনজুুরা', 'মনজূরা').replace('কুরলছুমা', 'কুলছুম')
        val = val.replace('আবদুলল', 'আব্দুল').replace('ল্লাহাহ', 'ল্লাহ')
        val = val.replace('নুররুল', 'নুরুল').replace('নুরর', 'নুর')
        val = val.replace('অন্যাান্যা', 'অন্যান্য').replace('অন্যাান্য', 'অন্যান্য').replace('অন্যানা', 'অন্যান্য')
        val = val.replace('ব্যাবসা', 'ব্যবসা').replace('চাকুররী', 'চাকুরী')

        val = re.sub(r'\s+(?:স্ত|ন্ত|ত|র|া|ন|স)$', '', val)
        val = re.sub(r'\s+', ' ', val).strip()
        v[field] = val

    name = v.get('নাম', '')
    if re.search(r'\s+(?:চু|চূ|চৌ)$', name):
        name = re.sub(r'\s+(?:চু|চূ|চৌ)$', ' চৌধুরী', name)
    v['নাম'] = name

    occ = v.get('পেশা', '')
    if any(k in occ for k in ['পাশ্চী', 'পাদ্রী', 'পাদ্্রী', 'পাঞ্চী', 'পুরোহিত']):
        v['পেশা'] = 'ইমাম/পুরোহিত/পাদ্রী'
    elif 'ড্রাইভার' in occ or 'াইভার' in occ:
        v['পেশা'] = 'ড্রাইভার'
    elif 'শিক্ষক' in occ or 'শিঙ্ক' in occ:
        v['পেশা'] = 'শিক্ষক'

    return v

def parse_one_box(box_text, meta):
    b = clean_text(box_text)
    v = {}
    
    # Serial
    m_sl = re.search(r'^\s*([\d০-৯]{4,5})', b)
    v['ক্রমিক'] = bn2en(m_sl.group(1)) if m_sl else ''
    
    # Name
    m_name = re.search(r'নাম\s*:\s*(.+?)(?=\s*ভোটার নং|\s*পিতা|\Z)', b)
    name = m_name.group(1).strip() if m_name else ''
    name = re.sub(r'[\d০-৯]{4,5}[\.\।]?$', '', name).strip()
    v['নাম'] = name
    
    # Voter No
    m_vno = re.search(r'ভোটার নং\s*:\s*([\d০-৯]+)', b)
    v['ভোটার_নং'] = bn2en(m_vno.group(1).strip()) if m_vno else ''
    
    # Father
    m_fat = re.search(r'পিতা\s*:\s*(.+?)(?=\s*মাতা|\Z)', b)
    fat = m_fat.group(1).strip() if m_fat else ''
    v['পিতা'] = re.sub(r'[\d০-৯]{4,5}[\.\।]?$', '', fat).strip()
    
    # Mother
    m_mot = re.search(r'মাতা\s*:\s*(.+?)(?=\s*(?:পেশা|কপেশা|জন্ম|তারিখ|ঠিকানা)|\Z)', b)
    mot = m_mot.group(1).strip() if m_mot else ''
    v['মাতা'] = re.sub(r'[\d০-৯]{4,5}[\.\।]?$', '', mot).strip()
    
    # DOB
    v['জন্ম_তারিখ'] = norm_date(b)
    
    # Occupation
    m_occ = re.search(r'(?:পেশা|কপেশা)\s*:\s*([^,,\n]+)', b)
    v['পেশা'] = m_occ.group(1).strip() if m_occ else ''
    
    # Address
    m_add = re.search(r'ঠিকানা\s*:\s*(.+)', b)
    v['ঠিকানা'] = m_add.group(1).strip() if m_add else ''
    
    # Copy metadata
    for k in ['লিঙ্গ', 'জেলা', 'উপজেলা', 'পৌরসভা', 'ইউনিয়ন', 'ওয়ার্ড', 'এলাকা_নং', 'এলাকা_নাম']:
        v[k] = meta.get(k, '')

    v = post_process_record(v)
    return v

# ──────────────────────────────────────────
# PDF প্রসেসর — গ্রিডভিত্তিক বক্স এক্সট্র্যাক্টর
# ──────────────────────────────────────────
def process_pdf(pdf_path, folder_meta=None):
    voters = []
    meta   = (folder_meta or {}).copy()

    try:
        with pdfplumber.open(pdf_path) as pdf:
            if not pdf.pages:
                return voters

            # Page 1 Metadata
            p1_meta = parse_page1(pdf.pages[0], folder_meta)
            meta.update({k: v for k, v in p1_meta.items() if v})

            # Pages 2+ Voter grid boxes
            for pg in pdf.pages[1:]:
                try:
                    words = pg.extract_words()
                    if not words: continue
                    
                    # Filter header text and single-character vertical side artifacts
                    vwords = [w for w in words if w['top'] > 105]
                    vwords = [w for w in vwords if not ((w['bottom'] - w['top']) > 25 and len(w['text']) <= 2)]
                    if not vwords: continue
                    
                    # Group into horizontal box rows
                    vwords.sort(key=lambda w: (w['top'], w['x0']))
                    rows = []
                    for w in vwords:
                        matched = False
                        for r in rows:
                            if abs(w['top'] - r['avg_top']) < 45:
                                r['words'].append(w)
                                r['avg_top'] = sum(x['top'] for x in r['words']) / len(r['words'])
                                matched = True
                                break
                        if not matched:
                            rows.append({'avg_top': w['top'], 'words': [w]})
                    rows.sort(key=lambda r: r['avg_top'])
                    
                    # In each row, split into 3 columns by X coordinates
                    for r in rows:
                        col1 = [w for w in r['words'] if w['x0'] < 280]
                        col2 = [w for w in r['words'] if 280 <= w['x0'] < 520]
                        col3 = [w for w in r['words'] if w['x0'] >= 520]
                        
                        for col in [col1, col2, col3]:
                            if not col: continue
                            # Sort words inside single box by Y lines then X
                            col.sort(key=lambda w: (round(w['top']/4)*4, w['x0']))
                            box_str = ' '.join([w['text'] for w in col])
                            v = parse_one_box(box_str, meta)
                            if v.get('নাম') and len(v['নাম']) > 1:
                                voters.append(v)
                except Exception:
                    pass

    except Exception as e:
        print(f"\n    ⚠ {os.path.basename(str(pdf_path))}: {e}")

    # Ensure sequential serial numbers
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
