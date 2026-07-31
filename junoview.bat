@echo off
rem Launch the Junoview app (double-click me).
rem The project file and the file-browser root are this folder.
setlocal
cd /d "%~dp0"

rem Find a real interpreter, in order of trustworthiness. Bare `python` is
rem LAST on purpose: on Windows it usually resolves to the Microsoft Store
rem stub in WindowsApps, which is not a Python and just opens the Store.
rem Set JUNOVIEW_PYTHON to point at your own interpreter to override all this.
set "PY=%JUNOVIEW_PYTHON%"
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PY if exist "C:\ProgramData\miniconda3\python.exe" set "PY=C:\ProgramData\miniconda3\python.exe"
if not defined PY if exist "%USERPROFILE%\miniconda3\python.exe" set "PY=%USERPROFILE%\miniconda3\python.exe"
if not defined PY (
    where py >nul 2>nul
    if not errorlevel 1 set "PY=py"
)
if not defined PY set "PY=python"

rem Run this checkout in preference to any installed copy, so editing the
rem source and double-clicking shows you the edit. Deliberately NOT `where
rem junoview` -- that finds this very file and re-invokes it forever.
if exist "%~dp0src\junoview\__init__.py" set "PYTHONPATH=%~dp0src;%PYTHONPATH%"

"%PY%" -m junoview %*
if errorlevel 1 (
    echo.
    echo Junoview exited with an error. If it could not find Python, set
    echo JUNOVIEW_PYTHON to your interpreter, e.g.
    echo     set JUNOVIEW_PYTHON=C:\ProgramData\miniconda3\python.exe
)
pause
