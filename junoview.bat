@echo off
rem Launch the Junoview app (double-click me).
rem The project file and the file-browser root are this folder.
cd /d "%~dp0"

rem Prefer an installed `junoview`; otherwise run straight from this checkout.
where junoview >nul 2>nul
if %errorlevel%==0 (
    junoview %*
) else (
    set "PYTHONPATH=%~dp0src;%PYTHONPATH%"
    python -m junoview %*
)
pause
