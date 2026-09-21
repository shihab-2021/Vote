@echo off
chcp 65001 > nul
title বাংলাদেশ ভোটার তালিকা অ্যাপ

echo.
echo ============================================================
echo   বাংলাদেশ ভোটার তালিকা অ্যাপ
echo ============================================================
echo.

python --version > nul 2>&1
if errorlevel 1 (
    echo [X] Python পাওয়া যায়নি!
    echo     ডাউনলোড করুন: https://www.python.org/downloads/
    echo     ইনস্টলে "Add Python to PATH" অবশ্যই চেক দিন।
    pause & exit /b 1
)

echo [1/2] লাইব্রেরি চেক হচ্ছে (প্রথমবার কিছুটা সময় লাগতে পারে)...
pip install pdfplumber openpyxl pymupdf easyocr numpy pillow fastapi uvicorn --quiet --upgrade
if errorlevel 1 (
    echo [X] লাইব্রেরি ইনস্টল ব্যর্থ। ইন্টারনেট সংযোগ চেক করুন।
    pause & exit /b 1
)

echo [2/2] সার্ভার চালু হচ্ছে...
echo.
echo   ব্রাউজারে এই ঠিকানায় যান:  http://127.0.0.1:8765
echo   বন্ধ করতে এই উইন্ডোতে Ctrl+C চাপুন।
echo.

start "" http://127.0.0.1:8765
python app_server.py

pause
