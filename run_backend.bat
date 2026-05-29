@echo off
chcp 65001 >nul
cd /d "%~dp0backend"
echo Starting Flask backend on http://127.0.0.1:5000 ...
python app.py
pause
