# =======================================================
# SCRIPT DE AUTO SINCRONIZACAO EM 1 CLIQUE (sync.ps1)
# =======================================================
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "[*] Iniciando auto sincronizacao com o GitHub..." -ForegroundColor Cyan

# 0. Localizar o diretorio do repositorio Git
$targetDir = $PSScriptRoot
if (-not $targetDir -or -not (Test-Path (Join-Path $targetDir ".git"))) {
    $targetDir = (Get-Location).Path
}
if (-not (Test-Path (Join-Path $targetDir ".git"))) {
    $targetDir = "C:\Users\Holter\.antigravity-ide\AntiGravity"
}

if (Test-Path (Join-Path $targetDir ".git")) {
    Set-Location $targetDir
    Write-Host "[i] Diretorio do repositorio: $targetDir" -ForegroundColor Gray
} else {
    Write-Host "[!] Erro: Nenhum repositorio Git (.git) foi encontrado." -ForegroundColor Red
    return
}

# 1. Garante safe.directory no Git
$repoDir = (Get-Location).Path.Replace('\', '/')
git config --global --add safe.directory "$repoDir" 2>$null

# 2. Puxa as novidades do repositorio remoto
Write-Host "[1/3] Puxando alteracoes remotas (Git Pull)..." -ForegroundColor Yellow
git pull origin main --rebase

if ($LASTEXITCODE -ne 0) {
    Write-Host "[!] Atencao: Ocorreu um problema ao fazer git pull. Verifique se ha conflitos." -ForegroundColor Red
}

# 3. Indexa todas as alteracoes de codigo, notas e fluxos .json do n8n
Write-Host "[2/3] Indexando arquivos (Git Add)..." -ForegroundColor Yellow
git add .

# 4. Verifica e envia se houver alteracoes
$status = git status --porcelain
if ($status) {
    $dataHora = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $mensagemCommit = "Auto Sync: Trabalho finalizado em $dataHora (engallmex@gmail.com)"

    Write-Host "[3/3] Commitando alteracoes..." -ForegroundColor Yellow
    git commit -m "$mensagemCommit"

    Write-Host "[->] Enviando para o GitHub (Git Push)..." -ForegroundColor Yellow
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] Sincronizacao concluida com sucesso!" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Falha ao enviar para o GitHub (Git Push)." -ForegroundColor Red
    }
} else {
    Write-Host "[OK] Tudo ja esta atualizado no GitHub!" -ForegroundColor Green
}
