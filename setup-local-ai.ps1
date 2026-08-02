<#=====================================================================
  setup-local-ai.ps1
  Automatiza a instalação de:
   • Ollama (serviço de LLM local)   OR   llama.cpp (CPU‑only)
   • Download de um modelo quantizado (Llama‑2‑7B‑Chat)
   • Início do servidor local
  Compatível com Windows 10/11 (PowerShell 5+ ou PowerShell 7)
=====================================================================#>

# -------------------------- CONFIGURAÇÕES ---------------------------
# Escolha qual engine usar:
#   "ollama"   → instala Ollama (recomendado se houver GPU)
#   "llamacpp" → instala llama.cpp (CPU‑only, muito leve)
$engine = "ollama"          # <--- altere aqui se quiser "llamacpp"

# Modelo a ser baixado (versão quantizada, menor uso de RAM/VRAM)
$modelName   = "llama2"    # para Ollama (nome interno)
$modelFile   = "llama-2-7b-chat.ggmlv3.q4_0.bin"   # para llama.cpp
$modelURL    = "https://huggingface.co/TheBloke/Llama-2-7B-Chat-GGML/resolve/main/$modelFile"

# Pasta onde o modelo será guardado (para llama.cpp)
$llamaModelDir = "$env:USERPROFILE\llama_models"

# Porta que o servidor local vai escutar
$ollamaPort = 11434
$llamaPort = 1234

# -------------------------- FUNÇÕES -------------------------------
function Write-Info   { param([string]$msg) Write-Host "[INFO]  $msg" -ForegroundColor Cyan }
function Write-Error  { param([string]$msg) Write-Host "[ERRO]  $msg" -ForegroundColor Red }
function Write-Success{ param([string]$msg) Write-Host "[OK]    $msg" -ForegroundColor Green }

# Verifica se o script está rodando como admin
if (-not ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(`
        [Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Execute o PowerShell como Administrador."
    exit 1
}

# -------------------------- INSTALAÇÃO ---------------------------
if ($engine -eq "ollama") {
    Write-Info "Instalando Ollama via winget..."
    # winget já vem com Windows 10/11; se não houver, tenta chocolatey
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id Ollama.Ollama -e --source winget --accept-package-agreements --accept-source-agreements
    } elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        choco install ollama -y
    } else {
        Write-Error "Nem winget nem chocolatey encontrados. Instale um deles primeiro."
        exit 1
    }

    # Aguarda o binário estar no PATH ou checa o diretório padrão
    $ollamaExe = (Get-Command ollama -ErrorAction SilentlyContinue).Source
    if (-not $ollamaExe) {
        $defaultPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
        if (Test-Path $defaultPath) {
            $ollamaExe = $defaultPath
        } else {
            Write-Error "Ollama não foi encontrado no PATH nem no diretório padrão."
            exit 1
        }
    }
    Write-Success "Ollama instalado em: $ollamaExe"

    # Inicia o serviço (ele cria um daemon em background)
    Write-Info "Iniciando o daemon do Ollama..."
    Start-Process -FilePath $ollamaExe -ArgumentList "serve" -NoNewWindow -PassThru | Out-Null
    Start-Sleep -Seconds 5   # dá tempo para o daemon subir

    # Baixa o modelo escolhido (ex.: llama2)
    Write-Info "Baixando o modelo '$modelName' via Ollama..."
    & $ollamaExe pull $modelName
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Falha ao baixar o modelo $modelName."
        exit 1
    }
    Write-Success "Modelo $modelName pronto."

    # Teste rapido
    Write-Info "Teste rapido - gerando resposta..."
    $test = & $ollamaExe run $modelName "Qual a capital da Franca?"
    Write-Host "`nResposta do modelo:`n$test`n"
    Write-Success "Tudo pronto! Use 'ollama run $modelName `" <prompt> `"' ou acesse a API em http://localhost:$ollamaPort"

} elseif ($engine -eq "llamacpp") {
    # ------------------- LLMACPP -------------------
    Write-Info "Clonando repositorio llama.cpp..."
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Info "Instalando Git via winget..."
        winget install --id Git.Git -e
    }
    $repoDir = "$env:USERPROFILE\llama.cpp"
    if (Test-Path $repoDir) {
        Write-Info "Pasta $repoDir já existe – pulando clone."
    } else {
        git clone https://github.com/ggerganov/llama.cpp $repoDir
    }

    Write-Info "Compilando o binario (make)..."
    Set-Location $repoDir
    if (-not (Get-Command make -ErrorAction SilentlyContinue)) {
        Write-Info "Instalando make via winget..."
        winget install --id GnuWin32.Make -e
    }
    # Compila (usa todos os núcleos disponíveis)
    $cpuCores = (Get-WmiObject -Class Win32_Processor).NumberOfLogicalProcessors
    & make -j $cpuCores
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Compilacao falhou."
        exit 1
    }
    Write-Success "Compilacao concluida."

    # Cria pasta para o modelo
    New-Item -ItemType Directory -Force -Path $llamaModelDir | Out-Null

    # Baixa o modelo quantizado
    $modelPath = Join-Path $llamaModelDir $modelFile
    if (Test-Path $modelPath) {
        Write-Info "Modelo já existe em $modelPath – pulando download."
    } else {
        Write-Info "Baixando modelo quantizado..."
        Invoke-WebRequest -Uri $modelURL -OutFile $modelPath
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Falha ao baixar o modelo."
            exit 1
        }
    }
    Write-Success "Modelo salvo em $modelPath"

    # Inicia o servidor HTTP (compatível com OpenAI)
    Write-Info "Iniciando servidor HTTP (porta $llamaPort)..."
    $serverExe = Join-Path $repoDir "server.exe"
    Start-Process -FilePath $serverExe `
        -ArgumentList "-m $modelPath -c 2048 -ngl 0 -port $llamaPort" `
        -NoNewWindow -PassThru | Out-Null
    Start-Sleep -Seconds 5

    # Teste rapido usando curl (ou Invoke-WebRequest)
    Write-Info "Teste rapido - gerando resposta via API..."
    $payload = @{
        model = "local-llama2"
        messages = @(@{role="user"; content="Qual a capital da Franca?"})
        max_tokens = 64
    } | ConvertTo-Json -Depth 4

    $response = Invoke-WebRequest -Method POST `
        -Uri "http://127.0.0.1:$llamaPort/v1/chat/completions" `
        -ContentType "application/json" `
        -Body $payload

    $answer = ($response.Content | ConvertFrom-Json).choices[0].message.content
    Write-Host "`nResposta do modelo:`n$answer`n"
    Write-Success "Tudo pronto! Use a mesma URL acima para suas chamadas."

} else {
    Write-Error "Valor de `$engine` desconhecido. Use 'ollama' ou 'llamacpp'."
    exit 1
}
