# -*- coding: utf-8 -*-
"""
PDF -> ভোটার ডেটা OCR ইঞ্জিন -- vote-2/voter_extractor.py থেকে পোর্ট করা।

ভারী ML dependency (pdfplumber, pymupdf, easyocr, numpy, pillow) ইচ্ছাকৃতভাবে
ঐচ্ছিক -- এগুলো ইনস্টল না থাকলে (যেমন হালকা Railway ডিপ্লয়মেন্টে) এই মডিউল
ইম্পোর্ট হবে ঠিকই, কিন্তু OCR_AVAILABLE False থাকবে এবং process_pdf() কল করলে
স্পষ্ট এরর দেবে। convert রাউটার এই ফ্ল্যাগ চেক করে কনভার্ট ফিচার দেখায়/লুকায়।

লজিক বদলালে vote-2/voter_extractor.py-এর সংশ্লিষ্ট অংশও মিলিয়ে আপডেট করুন।
"""
import re
from pathlib import Path

from .voter_rules import bn2en, norm_date, flag_record

try:
    import pdfplumber
    import fitz  # PyMuPDF
    import numpy as np
    from PIL import Image
    import easyocr
    OCR_AVAILABLE = True
    OCR_IMPORT_ERROR = ""
except ImportError as e:
    OCR_AVAILABLE = False
    OCR_IMPORT_ERROR = str(e)

OCR_ZOOM = 3


class ConversionCancelled(Exception):
    """ব্যবহারকারী "থামান" চাপলে process_pdf() এই এক্সসেপশন তুলে মাঝপথে থেমে যায়।"""


_OCR_READER = None


def get_ocr_reader():
    global _OCR_READER
    if _OCR_READER is None:
        _OCR_READER = easyocr.Reader(['bn'], gpu=False, verbose=False)
    return _OCR_READER


def render_page_image(fitz_page, zoom=OCR_ZOOM):
    pix = fitz_page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def ocr_region(pil_img, bbox, zoom, reader):
    x0, top, x1, bottom = bbox
    crop = pil_img.crop((x0 * zoom, top * zoom, x1 * zoom, bottom * zoom))
    lines = reader.readtext(np.array(crop), detail=0, paragraph=True)
    return '\n'.join(lines)


def parse_page1(page, fitz_page, folder_meta=None):
    meta = {}
    reader = get_ocr_reader()
    img = render_page_image(fitz_page)
    text = ocr_region(img, (0, 0, page.width, page.height), OCR_ZOOM, reader)

    head = text[:250]
    if 'মহিলা' in head:
        meta['লিঙ্গ'] = 'মহিলা'
    elif 'পুরুষ' in head:
        meta['লিঙ্গ'] = 'পুরুষ'

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


def clean_value(val):
    if not val:
        return ''
    val = str(val).replace('_', ' ')
    return re.sub(r'\s+', ' ', val).strip(' ,.-')


def get_field_from_text(text, pattern):
    m = re.search(pattern, text)
    return clean_value(m.group(1)) if m else ''


def extract_cell_digits(page, bbox):
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
    t = ocr_text.replace('\n', ' ')
    return {
        'নাম': get_field_from_text(t, r'নাম\s*[:ঃ]\s*(.+?)(?=ভোটার|পিতা|$)'),
        'পিতা': get_field_from_text(t, r'পিতা\s*[:ঃ]\s*(.+?)(?=মাতা|$)'),
        'মাতা': get_field_from_text(t, r'মাতা\s*[:ঃ]\s*(.+?)(?=পেশা|জন্ম|$)'),
        'পেশা': get_field_from_text(t, r'পেশা\s*[:ঃ]\s*(.+?)(?=[,;]|\s*জন|\s*ঠিকানা|$)'),
        'ঠিকানা': get_field_from_text(t, r'ঠিকানা\s*[:ঃ]\s*(.+)$'),
    }


def process_pdf(pdf_path, folder_meta=None, progress_cb=None, cancel_event=None):
    """একটা PDF থেকে ভোটার dict-এর লিস্ট বের করে (বাংলা কী সহ, voter_rules.COLS-এর মতো)।
    progress_cb(page_idx, total_pages, cell_idx, total_cells, voter_count) -- ঐচ্ছিক লাইভ প্রগ্রেস।
    cancel_event -- ঐচ্ছিক threading.Event; সেট হলে পরের সেল প্রসেস করার আগেই
    ConversionCancelled তুলে থেমে যায় (ব্যবহারকারীর "থামান" অনুরোধ)।"""
    if not OCR_AVAILABLE:
        raise RuntimeError(f"OCR লাইব্রেরি ইনস্টল করা নেই: {OCR_IMPORT_ERROR}")

    voters = []
    meta = (folder_meta or {}).copy()
    reader = get_ocr_reader()

    with pdfplumber.open(pdf_path) as pdf:
        if not pdf.pages:
            return voters

        fitz_doc = fitz.open(str(pdf_path))
        try:
            if cancel_event is not None and cancel_event.is_set():
                raise ConversionCancelled()
            p1_meta = parse_page1(pdf.pages[0], fitz_doc[0], folder_meta)
            meta.update({k: v for k, v in p1_meta.items() if v})

            total_data_pages = len(pdf.pages) - 1
            for page_idx in range(1, len(pdf.pages)):
                pg = pdf.pages[page_idx]
                try:
                    tables = pg.find_tables()
                    if not tables:
                        continue
                    table = tables[0]
                    pil_img = render_page_image(fitz_doc[page_idx])

                    cells = [cell for row in table.rows for cell in row.cells if cell]
                    for cell_idx, cell in enumerate(cells, 1):
                        if cancel_event is not None and cancel_event.is_set():
                            raise ConversionCancelled()
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
                            v['_flag'] = '; '.join(flag_record(v))
                            voters.append(v)
                        except Exception:
                            pass
                        finally:
                            if progress_cb:
                                progress_cb(page_idx, total_data_pages, cell_idx, len(cells), len(voters))
                except ConversionCancelled:
                    raise
                except Exception:
                    pass
        finally:
            fitz_doc.close()

    last_sl = 0
    for v in voters:
        if v.get('ক্রমিক') and v['ক্রমিক'].isdigit():
            last_sl = int(v['ক্রমিক'])
        elif last_sl > 0:
            last_sl += 1
            v['ক্রমিক'] = f"{last_sl:04d}"

    return voters


def meta_from_path(pdf_path, root):
    pdf_path = Path(pdf_path)
    root = Path(root)
    try:
        parts = pdf_path.relative_to(root).parts
    except ValueError:
        parts = []

    m = {}
    if len(parts) >= 3: m['_upazila_folder'] = parts[2]
    if len(parts) >= 4: m['_union_folder'] = parts[3]
    if len(parts) >= 5: m['_area_folder'] = parts[4]

    if '_area_folder' not in m and len(pdf_path.parents) > 0:
        m['_area_folder'] = pdf_path.parent.name
    if '_union_folder' not in m and len(pdf_path.parents) > 1:
        m['_union_folder'] = pdf_path.parent.parent.name
    if '_upazila_folder' not in m and len(pdf_path.parents) > 2:
        m['_upazila_folder'] = pdf_path.parent.parent.parent.name

    m['source_file'] = pdf_path.name
    return m
