@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
echo Starting React dev server (requires npm install in frontend/) ...
npm start
