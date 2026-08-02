<#
======================================================================
  Instalar_AI_Local.ps1
  Instalação e Configuração Automática de IA Local (Ollama + Continue)
======================================================================
#>

# 1. Elevação de Privilégios (Admin) se necessário
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")) {
    Write-Host "[!] Solicitando permissão de Administrador..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = 'Stop'

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "     INSTALADOR AUTOMÁTICO: OLLAMA + CONTINUE (QWEN)  " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

# 2. Verificar/Instalar Ollama
Write-Host "[1/5] Verificando instalação do Ollama..." -ForegroundColor Cyan
$ollamaCmd = Get-Command ollama -ErrorAction SilentlyContinue

if (-not $ollamaCmd) {
    Write-Host "    Ollama não encontrado. Instalando via Winget..." -ForegroundColor Yellow
    winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
    Write-Host "    Ollama instalado com sucesso!" -ForegroundColor Green
} else {
    Write-Host "    Ollama já está instalado." -ForegroundColor Green
}

# 3. Garantir serviço Ollama ativo
Write-Host "[2/5] Verificando se o serviço Ollama está ativo..." -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod -Uri 'http://localhost:11434/api/tags' -TimeoutSec 3 -ErrorAction Stop
    Write-Host "    Serviço Ollama rodando normalmente." -ForegroundColor Green
} catch {
    Write-Host "    Iniciando o servidor Ollama em segundo plano..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden
    Start-Sleep -Seconds 4
}

# 4. Baixar modelos
Write-Host "[3/5] Baixando modelo de Chat (qwen2.5-coder:7b)... (Pode demorar alguns minutos)" -ForegroundColor Cyan
& ollama pull qwen2.5-coder:7b

Write-Host "[4/5] Baixando modelo de Autocomplete (qwen2.5-coder:1.5b)..." -ForegroundColor Cyan
& ollama pull qwen2.5-coder:1.5b

# 5. Configurar o Continue (.continue/config.json)
Write-Host "[5/5] Gerando arquivo de configuração do Continue (.continue/config.json)..." -ForegroundColor Cyan

$continueDir = Join-Path $env:USERPROFILE '.continue'
if (-not (Test-Path $continueDir)) {
    New-Item -ItemType Directory -Path $continueDir -Force | Out-Null
}

$configFile = Join-Path $continueDir 'config.json'

$configJson = @"
{
  "models": [
    {
      "title": "Qwen 2.5 Coder 7B (Local - Grátis)",
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
      "prompt": "Refatore o código selecionado buscando maior legibilidade, performance e boas práticas.",
      "description": "Refatorar código selecionado"
    },
    {
      "name": "testes",
      "prompt": "Crie testes unitários completos cobrindo os cenários do código fornecido.",
      "description": "Gerar testes unitários"
    },
    {
      "name": "explicar",
      "prompt": "Explique detalhadamente o funcionamento do código selecionado, linha por linha se necessário.",
      "description": "Explicar código selecionado"
    }
  ]
}
"@

Set-Content -Path $configFile -Value $configJson -Encoding UTF8

Write-Host "    Arquivo config.json salvo em: $configFile" -ForegroundColor Green
Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  TUDO PRONTO! O Continue já está configurado com a IA local. " -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Read-Host "Pressione ENTER para encerrar..."
