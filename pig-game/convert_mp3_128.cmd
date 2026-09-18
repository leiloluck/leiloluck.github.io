@echo off
setlocal

REM Require ffmpeg
where ffmpeg >nul 2>&1 || (echo ERROR: ffmpeg not found in PATH & pause & exit /b 1)

REM Create output folder
if not exist "audio" mkdir "audio"

for %%F in (*.mp3) do (
    echo ==========================================
    echo Converting: "%%~nxF"
    echo Output:     "audio\%%~nF.mp3"
    ffmpeg -y -loglevel error -i "%%F" -c:a libmp3lame -b:a 96k "audio\%%~nF.mp3"
    if errorlevel 1 echo   FAILED: %%~nxF
)

echo Done.
pause
endlocal
