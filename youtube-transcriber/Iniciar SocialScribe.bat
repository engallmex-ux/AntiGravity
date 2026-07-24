@echo off
title SocialScribe - Transcrições Inteligentes
chcp 65001 > nul

:: cd /d "%~dp0" garante que o prompt mude para a pasta onde este arquivo .bat está localizado.
:: Isso torna a pasta inteira portátil se copiada para um pendrive ou outro diretório!
cd /d "%~dp0"
cls

echo =============================================================
echo      INICIANDO O SOCIALSCRIBE - TRANSCRIÇÕES INTELIGENTES
echo =============================================================
echo.
echo Abrindo o Dashboard Web do SocialScribe no seu navegador...
start http://127.0.0.1:5000
echo.
echo Iniciando servidor local na porta 5000...
.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 5000
echo.
echo =============================================================
echo       PROCESSO FINALIZADO
echo =============================================================
pause
