#!/usr/bin/env node

/**
 * Script de Diagnóstico e Verificação da Integração Google Workspace / Google Cloud
 * Pode ser executado em qualquer terminal ou no Google Cloud Shell.
 * 
 * Uso:
 *   node verify-google-integration.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Cores ANSI para o Terminal
const C = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgRed: "\x1b[41m"
};

console.log(`\n${C.bright}${C.cyan}======================================================================${C.reset}`);
console.log(`${C.bright}${C.cyan}     ORBISTRACKER HU-BR - DIAGNÓSTICO DA CONTA DE SERVIÇO GOOGLE     ${C.reset}`);
console.log(`${C.bright}${C.cyan}======================================================================${C.reset}\n`);

// 1. Carregar variáveis do .env se existir
let envVars = { ...process.env };
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  console.log(`${C.dim}Encontrado arquivo .env local. Carregando variáveis...${C.reset}`);
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remover aspas simples ou duplas se houver
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      envVars[key] = value;
    }
  });
}

const GOOGLE_SA_EMAIL = envVars.GOOGLE_SERVICE_ACCOUNT_EMAIL || "orbistracker-hu-br@project-834bd17b-8382-4908-8e8.iam.gserviceaccount.com";
const GOOGLE_SA_KEY_RAW = envVars.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
const GOOGLE_ROOT_FOLDER_ID = envVars.GOOGLE_CENTRAL_ROOT_FOLDER_ID || "";
const GOOGLE_SPREADSHEET_ID = envVars.GOOGLE_CENTRAL_SPREADSHEET_ID || "";

// Tratar a chave privada
const GOOGLE_SA_KEY = GOOGLE_SA_KEY_RAW.replace(/\\n/g, "\n").trim();

// Relatório inicial de parâmetros
console.log(`${C.bright}--- CONFIGURAÇÃO ATUAL ---${C.reset}`);
console.log(`${C.bright}E-mail da Conta de Serviço:${C.reset} ${GOOGLE_SA_EMAIL}`);
console.log(`${C.bright}Chave Privada Definida?:${C.reset} ${GOOGLE_SA_KEY ? `${C.green}SIM (${GOOGLE_SA_KEY.length} caracteres)${C.reset}` : `${C.red}NÃO (Vazio)${C.reset}`}`);
console.log(`${C.bright}ID da Planilha Central:${C.reset} ${GOOGLE_SPREADSHEET_ID ? GOOGLE_SPREADSHEET_ID : `${C.yellow}Não configurado (GOOGLE_CENTRAL_SPREADSHEET_ID)${C.reset}`}`);
console.log(`${C.bright}ID da Pasta Raiz do Drive:${C.reset} ${GOOGLE_ROOT_FOLDER_ID ? GOOGLE_ROOT_FOLDER_ID : `${C.yellow}Não configurado (GOOGLE_CENTRAL_ROOT_FOLDER_ID)${C.reset}`}`);
console.log(`-------------------------\n`);

// Lista de APIs exigidas para habilitação no Console do Google Cloud:
const REQUIRED_APIS = [
  { name: "Google Sheets API", url: "https://console.cloud.google.com/apis/library/sheets.googleapis.com" },
  { name: "Google Drive API", url: "https://console.cloud.google.com/apis/library/drive.googleapis.com" }
];

async function runDiagnostics() {
  const checklist = {
    envLoaded: false,
    privateKeyFormat: false,
    jwtAuth: false,
    sheetsAccess: false,
    driveAccess: false
  };

  // Passo 1: Verificar parâmetros essenciais
  console.log(`${C.bright}[PASS0 1/5] Validando parâmetros básicos...${C.reset}`);
  if (!GOOGLE_SA_KEY) {
    console.log(`❌ ${C.red}Erro: Variável GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY não está preenchida.${C.reset}`);
    console.log(`   ${C.dim}Para resolver: Adicione no Painel de Secrets ou no arquivo .env a chave privada JSON gerada para a Conta de Serviço.${C.reset}`);
    showApiInstructions();
    return;
  }
  checklist.envLoaded = true;
  console.log(`✅ Parâmetros carregados com sucesso.\n`);

  // Passo 2: Validar integridade matemática da chave privada
  console.log(`${C.bright}[PASSO 2/5] Testando integridade da Chave Privada...${C.reset}`);
  if (!GOOGLE_SA_KEY.includes("-----BEGIN PRIVATE KEY-----") || !GOOGLE_SA_KEY.includes("-----END PRIVATE KEY-----")) {
    console.log(`❌ ${C.red}Erro: Formato da chave privada inválido.${C.reset}`);
    console.log(`   A chave privada deve incluir os marcadores "-----BEGIN PRIVATE KEY-----" e "-----END PRIVATE KEY-----".`);
    console.log(`   ${C.dim}Dica: Se colou do JSON do Google Cloud, certifique-se de copiar o valor completo do campo "private_key" substituindo as quebras de linha '\\n' por quebras reais ou mantendo o padrão correto.${C.reset}`);
    return;
  }
  
  try {
    // Tenta simular a assinatura de uma string de teste com a chave para ver se o crypto do Node aceita
    const testHeader = { alg: "RS256", typ: "JWT" };
    const encodedHeader = Buffer.from(JSON.stringify(testHeader)).toString("base64url");
    const testPayload = { iss: "test", exp: Math.floor(Date.now() / 1000) + 3600 };
    const encodedPayload = Buffer.from(JSON.stringify(testPayload)).toString("base64url");
    const signInput = `${encodedHeader}.${encodedPayload}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signInput);
    signer.sign(GOOGLE_SA_KEY, "base64url");
    checklist.privateKeyFormat = true;
    console.log(`✅ Chave privada íntegra e decodificável pelo módulo crypto do Node.js.\n`);
  } catch (err) {
    console.log(`❌ ${C.red}Erro ao decodificar a Chave Privada:${C.reset} ${err.message}`);
    console.log(`   Geralmente este erro ocorre se a chave estiver corrompida, truncada ou se houver caracteres de espaço inesperados.`);
    return;
  }

  // Passo 3: Tentar gerar JWT e obter Access Token do Google OAuth2
  console.log(`${C.bright}[PASSO 3/5] Solicitando Token de Acesso do Google OAuth2...${C.reset}`);
  let accessToken = "";
  try {
    const now = Math.floor(Date.now() / 1000);
    const jwtHeader = { alg: "RS256", typ: "JWT" };
    const encodedHeader = Buffer.from(JSON.stringify(jwtHeader)).toString("base64url");
    
    const jwtPayload = {
      iss: GOOGLE_SA_EMAIL,
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 300,
      iat: now
    };

    const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString("base64url");
    const signInput = `${encodedHeader}.${encodedPayload}`;
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signInput);
    const signature = signer.sign(GOOGLE_SA_KEY, "base64url");
    const jwt = `${signInput}.${signature}`;

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Servidor do Google retornou erro: ${errText}`);
    }

    const tokenData = await res.json();
    accessToken = tokenData.access_token;
    checklist.jwtAuth = true;
    console.log(`✅ Autenticação realizada com sucesso!`);
    console.log(`   Token de Acesso gerado com expiração em ${tokenData.expires_in} segundos.`);
    console.log(`   ${C.dim}E-mail autenticado: ${GOOGLE_SA_EMAIL}${C.reset}\n`);
  } catch (err) {
    console.log(`❌ ${C.red}Falha na Autenticação JWT com o Google:${C.reset} ${err.message}`);
    console.log(`   Verifique se o e-mail da Conta de Serviço está correto e se o relógio de sua máquina está sincronizado com a internet.`);
    showApiInstructions();
    return;
  }

  // Passo 4: Testar acesso ao Google Sheets
  console.log(`${C.bright}[PASSO 4/5] Verificando acesso à Planilha do Google Sheets...${C.reset}`);
  if (!GOOGLE_SPREADSHEET_ID) {
    console.log(`⚠️  ${C.yellow}Aviso: ID da Planilha Central não configurado.${C.reset} Pulando teste do Google Sheets.`);
    console.log(`   Caso queira testar, configure a variável GOOGLE_CENTRAL_SPREADSHEET_ID.\n`);
  } else {
    try {
      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SPREADSHEET_ID}`;
      const res = await fetch(sheetsUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        const errCode = res.status;
        const errMsg = errData.error ? errData.error.message : "Erro desconhecido";
        
        console.log(`❌ ${C.red}Falha ao acessar Planilha (HTTP ${errCode}):${C.reset} ${errMsg}`);
        
        if (errCode === 403 || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("not found")) {
          console.log(`\n   👉 ${C.bright}${C.yellow}AÇÃO NECESSÁRIA:${C.reset}`);
          console.log(`   1. Certifique-se de que compartilhou a planilha de ID ${C.bright}${GOOGLE_SPREADSHEET_ID}${C.reset} com o e-mail:`);
          console.log(`      ${C.bright}${C.green}${GOOGLE_SA_EMAIL}${C.reset} dando permissão de ${C.bright}EDITOR${C.reset}.`);
          console.log(`   2. Verifique se a API do Google Sheets está ativada no seu projeto no link:`);
          console.log(`      ${C.underscore}${REQUIRED_APIS[0].url}${C.reset}`);
        }
        console.log("");
      } else {
        const sheetInfo = await res.json();
        checklist.sheetsAccess = true;
        console.log(`✅ Acesso ao Google Sheets confirmado!`);
        console.log(`   Título da Planilha: "${sheetInfo.properties.title}"`);
        console.log(`   Abas encontradas: ${sheetInfo.sheets.map(s => `"${s.properties.title}"`).join(", ")}\n`);
      }
    } catch (err) {
      console.log(`❌ ${C.red}Erro de conexão ao Google Sheets API:${C.reset} ${err.message}\n`);
    }
  }

  // Passo 5: Testar acesso ao Google Drive
  console.log(`${C.bright}[PASSO 5/5] Verificando acesso à Pasta Raiz do Google Drive...${C.reset}`);
  if (!GOOGLE_ROOT_FOLDER_ID) {
    console.log(`⚠️  ${C.yellow}Aviso: ID da Pasta Raiz do Drive não configurado.${C.reset} Pulando teste de criação de diretórios.`);
    console.log(`   Caso queira testar, configure a variável GOOGLE_CENTRAL_ROOT_FOLDER_ID.\n`);
  } else {
    try {
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${GOOGLE_ROOT_FOLDER_ID}?fields=id,name,mimeType,owners`;
      const res = await fetch(driveUrl, {
        method: "GET",
        headers: { "Authorization": `Bearer ${accessToken}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        const errCode = res.status;
        const errMsg = errData.error ? errData.error.message : "Erro desconhecido";

        console.log(`❌ ${C.red}Falha ao acessar Pasta no Google Drive (HTTP ${errCode}):${C.reset} ${errMsg}`);

        if (errCode === 403 || errMsg.toLowerCase().includes("permission") || errMsg.toLowerCase().includes("not found")) {
          console.log(`\n   👉 ${C.bright}${C.yellow}AÇÃO NECESSÁRIA:${C.reset}`);
          console.log(`   1. Certifique-se de que compartilhou a Pasta do Google Drive de ID ${C.bright}${GOOGLE_ROOT_FOLDER_ID}${C.reset} com o e-mail:`);
          console.log(`      ${C.bright}${C.green}${GOOGLE_SA_EMAIL}${C.reset} dando permissão de ${C.bright}ORGANIZADOR / EDITOR (Can organize, add, and edit)${C.reset}.`);
          console.log(`   2. Verifique se a API do Google Drive está ativada no seu projeto no link:`);
          console.log(`      ${C.underscore}${REQUIRED_APIS[1].url}${C.reset}`);
        }
        console.log("");
      } else {
        const folderInfo = await res.json();
        if (folderInfo.mimeType !== 'application/vnd.google-apps.folder') {
          console.log(`⚠️  ${C.yellow}Aviso: O ID fornecido pertence a um arquivo comum e não a uma pasta do Drive!${C.reset}`);
          console.log(`   MimeType retornado: "${folderInfo.mimeType}"\n`);
        } else {
          checklist.driveAccess = true;
          console.log(`✅ Acesso ao Google Drive confirmado!`);
          console.log(`   Nome da Pasta Raiz: "${folderInfo.name}"\n`);
        }
      }
    } catch (err) {
      console.log(`❌ ${C.red}Erro de conexão ao Google Drive API:${C.reset} ${err.message}\n`);
    }
  }

  // Resumo do Diagnóstico
  console.log(`${C.bright}${C.cyan}======================================================================${C.reset}`);
  console.log(`${C.bright}${C.cyan}                          RESUMO DO CHECKLIST                         ${C.reset}`);
  console.log(`${C.bright}${C.cyan}======================================================================${C.reset}`);
  
  printChecklistItem("1. Parâmetros essenciais configurados", checklist.envLoaded);
  printChecklistItem("2. Chave Privada válida e decodificável", checklist.privateKeyFormat);
  printChecklistItem("3. Autenticação JWT com Google OAuth2", checklist.jwtAuth);
  
  if (GOOGLE_SPREADSHEET_ID) {
    printChecklistItem("4. Permissão e Acesso ao Google Sheets API", checklist.sheetsAccess);
  } else {
    console.log(`➖ ${C.dim}[PULADO] 4. Google Sheets (Variável GOOGLE_CENTRAL_SPREADSHEET_ID não fornecida)${C.reset}`);
  }
  
  if (GOOGLE_ROOT_FOLDER_ID) {
    printChecklistItem("5. Permissão e Acesso ao Google Drive API", checklist.driveAccess);
  } else {
    console.log(`➖ ${C.dim}[PULADO] 5. Google Drive (Variável GOOGLE_CENTRAL_ROOT_FOLDER_ID não fornecida)${C.reset}`);
  }

  console.log(`\n----------------------------------------------------------------------`);
  
  const allCoreGreen = checklist.envLoaded && checklist.privateKeyFormat && checklist.jwtAuth;
  const optionalGreen = (!GOOGLE_SPREADSHEET_ID || checklist.sheetsAccess) && (!GOOGLE_ROOT_FOLDER_ID || checklist.driveAccess);

  if (allCoreGreen && optionalGreen) {
    console.log(`${C.bgGreen}${C.white}${C.bright}  INTEGRAÇÃO 100% PRONTA E OPERACIONAL PARA USO CORPORATIVO!  ${C.reset}`);
    console.log(`\nSua aplicação OrbisTracker HU-BR pode enviar relatórios e fotos em tempo real para a nuvem compartilhada com total segurança.`);
  } else {
    console.log(`${C.bgRed}${C.white}${C.bright}  INTEGRAÇÃO PRECISA DE AJUSTES  ${C.reset}`);
    console.log(`\nSiga os pontos marcados com "❌" acima para ajustar as permissões ou chaves.`);
  }
  
  showApiInstructions();
}

function printChecklistItem(label, isOk) {
  if (isOk) {
    console.log(`✅ ${C.green}${C.bright}[OK]${C.reset} ${label}`);
  } else {
    console.log(`❌ ${C.red}${C.bright}[FALHA]${C.reset} ${label}`);
  }
}

function showApiInstructions() {
  console.log(`\n${C.bright}--- ENDEREÇOS DAS APIS GOOGLE EXIGIDAS ---${C.reset}`);
  console.log(`Caso receba erros de API desabilitada, acesse o Console do Google Cloud`);
  console.log(`no projeto vinculado à sua conta de serviço e clique em "Ativar" para cada API abaixo:\n`);
  
  REQUIRED_APIS.forEach((api, idx) => {
    console.log(`${C.bright}${idx + 1}. ${api.name}:${C.reset}`);
    console.log(`   👉 ${C.blue}${C.underscore}${api.url}${C.reset}`);
  });
  console.log("");
}

// Iniciar diagnósticos
runDiagnostics();
