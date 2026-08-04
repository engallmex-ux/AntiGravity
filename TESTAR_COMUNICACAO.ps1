# Script PowerShell para Teste de Comunicacao com Servidor GETS
$ServerUrl = "https://ais-dev-6ko5tblf62pobktp5sgd4d-379733651533.us-east1.run.app"
$ApiKey = "AbraaoLucas_a3f89b1c2e4d5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   TESTE DE COMUNICACAO COM SERVIDOR GETS " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[+] URL Alvo : $ServerUrl" -ForegroundColor White
Write-Host "[+] Chave    : $($ApiKey.Substring(0, 15))..." -ForegroundColor White
Write-Host ""

$Endpoint = "$ServerUrl/api/robot/sync-payload"
$Headers = @{
    "Authorization" = "Bearer $ApiKey"
    "Content-Type"  = "application/json"
    "x-api-key"      = $ApiKey
}

$TestPayload = @{
    workOrders = @(
        @{
            id = "TEST-PING-001"
            getsCode = "GETS-TEST"
            equipment = "BOMBA DE INFUSAO TESTE"
            equipmentTag = "PAT-TEST"
            sector = "ENGENHARIA CLINICA"
            isCriticalSector = $false
            status = "Em Atendimento"
            criticality = "Media"
            description = "Teste de verificacao da chave de API e comunicacao."
            openedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    )
} | ConvertTo-Json -Depth 5

Write-Host "[*] Enviando requisicao POST para $Endpoint..." -ForegroundColor Yellow

try {
    $Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $Headers -Body $TestPayload -ErrorAction Stop
    Write-Host ""
    Write-Host "[OK] COMUNICAÇÃO REALIZADA COM SUCESSO!" -ForegroundColor Green
    Write-Host "Resposta do Servidor:" -ForegroundColor Gray
    $Response | ConvertTo-Json -Depth 3 | Write-Host -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "[ERRO] FALHA AO SE COMUNICAR COM O SERVIDOR" -ForegroundColor Red
    Write-Host "Detalhes do Erro: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
