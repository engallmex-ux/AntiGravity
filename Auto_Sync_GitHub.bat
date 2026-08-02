@echo off
chcp 65001 > nul
title Auto Sincronização GitHub
color 0B

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Auto_Sync_GitHub.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro durante a execucao.
    pause
)
