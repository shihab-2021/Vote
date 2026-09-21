# -*- coding: utf-8 -*-
"""
ভোটার রেকর্ড ভ্যালিডেশন — vote-2/voter_extractor.py থেকে পোর্ট করা (dependency-free)।

এই ফাইলটি ইচ্ছাকৃতভাবে vote-2/voter_extractor.py-এর একটি ছোট, নির্ভরতা-মুক্ত কপি।
মূল ফাইলে easyocr/pymupdf/pdfplumber ইম্পোর্ট আছে (~1GB dependency), যা হোস্টেড
সার্ভারে আনা ঠিক না -- OCR কনভার্সন লোকালেই থাকে (দেখুন README.md)।

flag_record() লজিক বদলালে vote-2/voter_extractor.py-এর সংশ্লিষ্ট অংশও
(লাইন ~192-221) মিলিয়ে আপডেট করুন।
"""
import re

# Excel কলাম অর্ডার -- import parser এই ক্রমেই openpyxl থেকে সারি পড়ে
# (bengali_key, display_label, sqlalchemy_field_name)
COLS = [
    ('ক্রমিক',          'ক্রমিক নং',        'serial_no'),
    ('নাম',              'নাম',              'name'),
    ('ভোটার_নং',        'ভোটার নং',         'voter_no'),
    ('পিতা',             'পিতার নাম',        'father_name'),
    ('মাতা',             'মাতার নাম',        'mother_name'),
    ('পেশা',             'পেশা',             'occupation'),
    ('জন্ম_তারিখ',      'জন্ম তারিখ',       'dob'),
    ('লিঙ্গ',            'লিঙ্গ',             'gender'),
    ('জেলা',             'জেলা',             'district'),
    ('পৌরসভা',           'পৌরসভা',           'municipality'),
    ('উপজেলা',           'উপজেলা',           'upazila'),
    ('ইউনিয়ন',          'ইউনিয়ন/ওয়ার্ড',   'union_name'),
    ('ওয়ার্ড',          'ওয়ার্ড নং',        'ward'),
    ('এলাকা_নং',        'এলাকা নং',         'area_no'),
    ('এলাকা_নাম',       'এলাকার নাম',        'area_name'),
    ('ঠিকানা',           'ঠিকানা',           'address'),
    ('_upazila_folder', 'ফোল্ডার উপজেলা',    'upazila_folder'),
    ('_union_folder',   'ফোল্ডার ইউনিয়ন',    'union_folder'),
    ('_area_folder',    'ফোল্ডার এলাকা',     'area_folder'),
    ('source_file',     'উৎস ফাইল',          'source_file'),
    ('_flag',           'যাচাই প্রয়োজন',     None),  # derived, no direct DB column
]
BENGALI_KEYS = [b for b, _, _ in COLS]
BENGALI_TO_FIELD = {b: f for b, _, f in COLS if f}

def bn2en(s: str) -> str:
    s = str(s)
    for b, e in zip('০১২৩৪৫৬৭৮৯', '0123456789'):
        s = s.replace(b, e)
    return s


def norm_date(s: str) -> str:
    s = bn2en(str(s))
    m = re.search(r'(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})', s)
    if m:
        d, m_val, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = "19" + y
        return f"{d.zfill(2)}/{m_val.zfill(2)}/{y}"
    return ""


_SUSPICIOUS_CHARS = re.compile(r'[?^~]|[a-zA-Z]')
_STRAY_PAREN = re.compile(r'\([^ঀ-৿\s]{1,4}\)')
_LEAK_LABEL = re.compile(r'জন্ম|তারিখ|ঠিকানা')


def flag_record(v: dict) -> list[str]:
    """রেকর্ডে সন্দেহজনক/অসম্পূর্ণ কিছু থাকলে কারণসহ তালিকা ফেরত দেয়; সব ঠিক থাকলে ফাঁকা তালিকা।

    v-তে বাংলা কী থাকবে বলে ধরে নেওয়া হয় (নাম, পিতা, মাতা, ভোটার_নং, জন্ম_তারিখ, ঠিকানা, পেশা)
    -- import parser এবং voters router উভয়ই কল করার আগে এই আকারে ম্যাপ করে।
    """
    reasons = []

    required = [('নাম', 'নাম'), ('ভোটার_নং', 'ভোটার নং'), ('পিতা', 'পিতার নাম'),
                ('মাতা', 'মাতার নাম'), ('জন্ম_তারিখ', 'জন্ম তারিখ'), ('ঠিকানা', 'ঠিকানা')]
    missing = [label for key, label in required if not v.get(key)]
    if missing:
        reasons.append('অসম্পূর্ণ: ' + ', '.join(missing))

    for key, label in [('নাম', 'নাম'), ('পিতা', 'পিতা'), ('মাতা', 'মাতা'), ('ঠিকানা', 'ঠিকানা'), ('পেশা', 'পেশা')]:
        val = v.get(key, '') or ''
        if not val:
            continue
        if _SUSPICIOUS_CHARS.search(val) or _STRAY_PAREN.search(val):
            reasons.append(f'সন্দেহজনক অক্ষর: {label}')
        if key in ('পিতা', 'মাতা') and len(val) > 35:
            reasons.append(f'অস্বাভাবিক দৈর্ঘ্য: {label}')
        if key == 'পেশা' and _LEAK_LABEL.search(val):
            reasons.append('পেশা ফিল্ডে অন্য তথ্য মিশে গেছে')

    vno = v.get('ভোটার_নং', '') or ''
    if vno and not (10 <= len(vno) <= 14):
        reasons.append('অস্বাভাবিক ভোটার নং দৈর্ঘ্য')

    return reasons


def flag_record_by_field(row: dict) -> list[str]:
    """flag_record()-এর মতোই, কিন্তু ইংরেজি DB ফিল্ড-নাম কী সহ dict নেয়
    (models.Voter-এর কলাম নাম) -- voters router এডিটের পর রি-ভ্যালিডেশনের জন্য ব্যবহার করে।"""
    field_to_bengali = {
        'name': 'নাম', 'voter_no': 'ভোটার_নং', 'father_name': 'পিতা', 'mother_name': 'মাতা',
        'dob': 'জন্ম_তারিখ', 'address': 'ঠিকানা', 'occupation': 'পেশা',
    }
    v = {bengali: row.get(field) for field, bengali in field_to_bengali.items()}
    return flag_record(v)
