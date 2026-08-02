@echo off
chcp 65001 > nul
title Instalador e Configurador - IA Local Continue + Ollama
color 0A

echo =======================================================================
echo          INSTALADOR AUTOMATICO: CONTINUE + OLLAMA + QWEN 2.5
echo =======================================================================
echo.

:: 1. Verificar permissões de administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Solicitando privilegios de Administrador...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: 2. Executar script PowerShell embarcado para automação completa
echo [*] Iniciando processo de instalacao e configuracao...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "^
    $ErrorActionPreference = 'Stop'; ^
    Write-Host '[1/5] Verificando instalacao do Ollama...' -ForegroundColor Cyan; ^
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) { ^
        Write-Host '    Ollama nao encontrado. Instalando via Winget...' -ForegroundColor Yellow; ^
        winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements; ^
        $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User'); ^
    } else { ^
        Write-Host '    Ollama ja esta instalado.' -ForegroundColor Green; ^
    }; ^
    Write-Host '[2/5] Garantindo que o servico Ollama esteja rodando...' -ForegroundColor Cyan; ^
    try { ^
        $res = Invoke-RestMethod -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -ErrorAction Stop; ^
        Write-Host '    Servico Ollama ativo!' -ForegroundColor Green; ^
    } catch { ^
        Write-Host '    Iniciando daemon do Ollama...' -ForegroundColor Yellow; ^
        Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden; ^
        Start-Sleep -Seconds 4; ^
    }; ^
    Write-Host '[3/5] Baixando modelo de Chat (qwen2.5-coder:7b)... (Aguarde)' -ForegroundColor Cyan; ^
    & ollama pull qwen2.5-coder:7b; ^
    Write-Host '[4/5] Baixando modelo de Autocomplete (qwen2.5-coder:1.5b)... (Aguarde)' -ForegroundColor Cyan; ^
    & ollama pull qwen2.5-coder:1.5b; ^
    Write-Host '[5/5] Configurando extensao Continue (.continue/config.json)...' -ForegroundColor Cyan; ^
    $continueDir = Join-Path $env:USERPROFILE '.continue'; ^
    if (-not (Test-Path $continueDir)) { New-Item -ItemType Directory -Path $continueDir -Force | Out-Null }; ^
    $configFile = Join-Path $continueDir 'config.json'; ^
    $configContent = @'
{
  "models": [
    {
      "title": "Qwen 2.5 Coder 7B (Local - Gratis)",
      "provider": "ollama",
      "model": "qwen2.5-coder:7b",
      "apiBase": "http://localhost:11434",
      "completionOptions": {
        "contextLength": 8192
      }
    }
  ],
  "tabAutocompleteModel": {
    "title": "Qwen 2.5 Coder 1.5B (Tab Autocomplete)",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b",
    "apiBase": "http://localhost:11434"
  },
  "contextProviders": [
    { "name": "code", "params": {} },
    { "name": "docs", "params": {} },
    { "name": "terminal", "params": {} },
    { "name": "folder", "params": {} },
    { "name": "diff", "params": {} }
  ],
  "customCommands": [
    {
      "name": "refatorar",
      "prompt": "Refatore o codigo selecionado buscando maior legibilidade, performance e boas praticas.",
      "description": "Refatorar codigo selecionado"
    },
    {
      "name": "testes",
      "prompt": "Crie testes unitarios completos cobrindo os cenarios do codigo fornecido.",
      "description": "Gerar testes unitarios"
    },
    {
      "name": "explicar",
      "prompt": "Explique detalhadamente o funcionamento do codigo selecionado, linha por linha se necessario.",
      "description": "Explicar codigo selecionado"
    }
  ]
}
'@; ^
    Set-Content -Path $configFile -Value $configContent -Encoding UTF8; ^
    Write-Host '    Arquivo config.json criado/atualizado com sucesso!' -ForegroundColor Green; ^
    Write-Host ''; ^
    Write-Host '=======================================================' -ForegroundColor Green; ^
    Write-Host '  SUCESSO: AMBIENTE DE IA LOCAL CONFIGURADO COM EXITO! ' -ForegroundColor Green; ^
    Write-Host '=======================================================' -ForegroundColor Green;
"

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
