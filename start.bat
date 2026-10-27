@echo off
title KhabarGolpo local server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
start "" "http://localhost:5501/"
node serve.mjs 5501
pause
