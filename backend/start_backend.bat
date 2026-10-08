@echo off
REM Double-click to start the Todo App backend (auto-frees port 8000 first).
powershell -ExecutionPolicy Bypass -File "%~dp0start_backend.ps1"
