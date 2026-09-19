@echo off
chcp 65001 > nul
title বাংলাদেশ ভোটার তালিকা এক্সট্রাক্টর v2.0

echo.
echo ============================================================
echo   বাংলাদেশ ভোটার তালিকা PDF এক্সট্রাক্টর  v2.0
echo   ৩-কলাম ফরম্যাট সাপোর্ট  ^|  চট্টগ্রাম + সব বিভাগ
echo ============================================================
echo.

:: Python চেক
python --version > nul 2>&1
if errorlevel 1 (
    echo [X] Python পাওয়া যায়নি!
    echo.
    echo     ডাউনলোড করুন: https://www.python.org/downloads/
    echo     ইনস্টলে "Add Python to PATH" অবশ্যই চেক দিন।
    echo.
    pause & exit /b 1
)

echo [1/3] Python পাওয়া গেছে।
echo [2/3] লাইব্রেরি আপডেট হচ্ছে (OCR লাইব্রেরিসহ, প্রথমবার কয়েক মিনিট ও প্রায় ১ জিবি ডাউনলোড লাগতে পারে)...
pip install pdfplumber openpyxl pymupdf easyocr numpy pillow --quiet --upgrade
if errorlevel 1 (
    echo [X] লাইব্রেরি ইনস্টল ব্যর্থ। ইন্টারনেট চেক করুন।
    pause & exit /b 1
)

echo [3/3] এক্সট্রাক্টর চালু হচ্ছে...
echo.
echo ============================================================
echo   পাথ উদাহরণ:
echo     F:\চট্টগ্রাম-৬
echo     F:\চট্টগ্রাম-৬\চট্রগ্রাম-৬\RAOZAN
echo   (খালি রাখলে F:\ পুরো ড্রাইভ স্ক্যান হবে)
echo ============================================================
echo.

python voter_extractor.py

pause
