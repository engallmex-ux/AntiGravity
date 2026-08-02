@echo off
title GETS Robots - Web Dashboard
echo ============================================================
echo 🤖 INICIANDO PAINEL WEB DOS ROBÔS GETS (CEB / EBSERH)
echo ============================================================
echo.
echo 1. Iniciando o servidor Python na porta 5000...
echo 2. Aguarde 2 segundos para a conexao estabilizar...
echo.
start /b "" "C:\Users\Holter\.antigravity-ide\AntiGravity\.venv\Scripts\python.exe" -m gets_robots.web_server
timeout /t 3 /nobreak >nul
echo 3. Abrindo o Microsoft Edge em http://localhost:5000 ...
start msedge http://localhost:5000
echo.
echo Servidor em execucao! Para encerrar, feche esta janela.
pause
