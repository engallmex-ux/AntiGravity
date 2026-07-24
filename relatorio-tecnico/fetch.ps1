$email = "lucas.fonseca.4@hubrasil.gov.br"
$password = "140921"
$encodedEmail = $email.Replace("@", "%40")

$cookieFile = "C:\Users\Holter\.gemini\antigravity\scratch\relatorio-tecnico\cookies.txt"
$outputPath = "C:\Users\Holter\.gemini\antigravity\scratch\relatorio-tecnico\consulta.html"

# Limpa cookies anteriores se existirem
if (Test-Path $cookieFile) { Remove-Item $cookieFile }

Write-Output "1. Estabelecendo sessão inicial (GET)..."
& curl.exe -s -c $cookieFile -L "https://gets.ceb.unicamp.br/nec/view/pendencias/consulta.jsf" -o "C:\Users\Holter\.gemini\antigravity\scratch\relatorio-tecnico\login_initial.html"

Write-Output "2. Enviando requisição de Login (POST j_security_check)..."
& curl.exe -s -b $cookieFile -c $cookieFile -d "j_username=$encodedEmail&j_password=$password" -L "https://gets.ceb.unicamp.br/nec/view/j_security_check" -o "C:\Users\Holter\.gemini\antigravity\scratch\relatorio-tecnico\login_response.html"

Write-Output "3. Acessando a página de consulta de equipamentos..."
& curl.exe -s -b $cookieFile -c $cookieFile -L "https://gets.ceb.unicamp.br/nec/view/equipamento/consulta.jsf" -o $outputPath

if (Test-Path $outputPath) {
    $size = (Get-Item $outputPath).Length
    Write-Output "Concluído! Arquivo salvo em: $outputPath ($size bytes)"
} else {
    Write-Output "Erro: O arquivo de consulta não foi criado."
}
