@echo off
chcp 65001 > nul
title Auto Sincronização GitHub
color 0B

:: Define o diretorio do projeto
set "PROJECT_DIR=C:\Users\Holter\.antigravity-ide\AntiGravity"

if exist "%~dp0Auto_Sync_GitHub.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Auto_Sync_GitHub.ps1"
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%PROJECT_DIR%\Auto_Sync_GitHub.ps1"
)

if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro durante a execucao.
    pause
)
