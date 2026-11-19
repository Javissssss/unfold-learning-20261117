@echo off
setlocal
rem Keep the launcher ASCII; pass Unicode folder names through the environment.
set "UNFOLD_LAUNCH_DIR=%~dp0"
powershell.exe -NoLogo -NoProfile -Command "$ErrorActionPreference='Stop'; & (Join-Path $env:UNFOLD_LAUNCH_DIR ((-join [char[]](0x542F,0x52A8)) + '.ps1')) -Background -OpenBrowser"
if errorlevel 1 (
    echo.
    echo Unfold could not start. Read the error above; no port or data was changed.
    pause
    exit /b 1
)
exit /b 0
