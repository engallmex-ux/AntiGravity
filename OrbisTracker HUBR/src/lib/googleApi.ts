import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  signOut
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Google OAuth provider with scopes requested by the user
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive');
googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
googleProvider.addScope('https://www.googleapis.com/auth/forms.body');

let cachedAccessToken: string | null = null;
let isSigningIn = false;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Load token from sessionStorage if present (for better UX during page reloads in iframe)
  const sessionToken = sessionStorage.getItem('google_access_token');
  if (sessionToken) {
    cachedAccessToken = sessionToken;
  }

  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      sessionStorage.removeItem('google_access_token');
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) return null;
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Não foi possível obter o token de acesso do Google.');
    }

    cachedAccessToken = credential.accessToken;
    sessionStorage.setItem('google_access_token', cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Erro de login no Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Log out
export const logoutGoogle = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  sessionStorage.removeItem('google_access_token');
};

// Helper to get access token, or throw if expired/missing
export const getAccessToken = async (): Promise<string> => {
  if (cachedAccessToken) return cachedAccessToken;
  const sessionToken = sessionStorage.getItem('google_access_token');
  if (sessionToken) {
    cachedAccessToken = sessionToken;
    return sessionToken;
  }
  throw new Error('Não autenticado com o Google. Por favor, faça login.');
};

// ==========================================
// GOOGLE DRIVE INTEGRATION
// ==========================================

// Create a folder in Google Drive
export const createDriveFolder = async (folderName: string): Promise<string> => {
  const token = await getAccessToken();
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao criar pasta no Google Drive.');
  }

  const data = await response.json();
  return data.id;
};

// Upload a label image to a folder in Google Drive
export const uploadFileToDrive = async (
  base64Data: string,
  fileName: string,
  mimeType: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> => {
  const token = await getAccessToken();

  // Convert base64 to binary
  const binaryString = atob(base64Data.split(',')[1] || base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });

  // Metadata
  const metadata: any = {
    name: fileName,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  // Create multipart/related request
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao carregar imagem para o Google Drive.');
  }

  const data = await response.json();

  // Change permission to anyone with link can view (so it can be opened easily from the Sheet)
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (permError) {
    console.warn('Erro ao definir permissões do arquivo no Drive:', permError);
  }

  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  };
};

// Upload a text readme file to a folder in Google Drive
export const uploadTextToDrive = async (
  text: string,
  fileName: string,
  parentId?: string
): Promise<{ id: string; webViewLink: string }> => {
  const token = await getAccessToken();
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

  const metadata: any = {
    name: fileName,
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', blob);

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao carregar arquivo de texto para o Google Drive.');
  }

  const data = await response.json();

  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
  } catch (permError) {
    console.warn('Erro ao definir permissões do arquivo de texto no Drive:', permError);
  }

  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`
  };
};

// Find an existing subfolder by name or create a new one under a parent folder ID
export const getOrCreateSubfolder = async (parentFolderId: string, folderName: string): Promise<string> => {
  const token = await getAccessToken();
  const query = encodeURIComponent(`name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`);
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
  
  try {
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }
  } catch (err) {
    console.warn('Erro ao pesquisar pasta no Drive:', err);
  }

  // Since Google Drive v3 creation allows parents in body:
  const createBody = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const createResponse = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(createBody)
  });

  if (!createResponse.ok) {
    const error = await createResponse.json();
    throw new Error(error.error?.message || `Erro ao criar subpasta ${folderName} no Google Drive.`);
  }

  const data = await createResponse.json();
  return data.id;
};

// Sector to folder structure helper matching the HU-UFSCar official structure
interface FolderPathResult {
  category: string;
  sectorSubfolder: string;
}

export function getFolderMappingForSector(setor: string): FolderPathResult {
  const s = (setor || '').toUpperCase();
  
  // TREINAMENTO_E_DISPOSITIVOS_NAO_MEDICOS
  if (s.includes('TREINAMENTO') || s.includes('SIMULADOR') || s.includes('CURSO') || s.includes('NAO MEDICO') || s.includes('NÃO-MÉDICO') || s.includes('TESTE') || s.includes('NÃO MÉDICO') || s.includes('DISPOSITIVO_NAO_MEDICO')) {
    return {
      category: 'TREINAMENTO_E_DISPOSITIVOS_NAO_MEDICOS',
      sectorSubfolder: 'Equipamentos_de_Treinamento_e_Simulacoes_Nao_Medicos'
    };
  }
  
  // UNIDADES_DE_INTERNAMENTO_E_CUIDADOS
  if (s.includes('UCA') || s.includes('PAI-UCA') || s.includes('CRIANÇA') || s.includes('ADOLESCENTE') || s.includes('PEDIATRI')) {
    if (s.includes('UTI')) {
      return {
        category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
        sectorSubfolder: 'UTI_Pediatrica (UTIPED)'
      };
    }
    return {
      category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
      sectorSubfolder: 'Unidade_da_Crianca_e_Adolescentes (UCA)'
    };
  }
  if (s.includes('UCIR') || s.includes('CLINICA CIRURGICA')) {
    return {
      category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
      sectorSubfolder: 'Unidade_de_Clinica_Cirurgica (UCIR)'
    };
  }
  if (s.includes('UCMC') || s.includes('CLINICA MEDICA')) {
    return {
      category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
      sectorSubfolder: 'Unidade_de_Clinica_Medica (UCMC)'
    };
  }
  if (s.includes('USM') || s.includes('SAUDE MENTAL')) {
    return {
      category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
      sectorSubfolder: 'Unidade_de_Saude_Mental (USM)'
    };
  }
  if (s.includes('UTIA') || s.includes('UTI ADULTO') || s.includes('UCRIT')) {
    return {
      category: 'UNIDADES_DE_INTERNAMENTO_E_CUIDADOS',
      sectorSubfolder: 'UTI_Adulto (UTIA)'
    };
  }

  // BLOCOS_OPERATORIOS_E_ESTERILIZACAO
  if (s.includes('CC -') || s.includes('CENTRO CIRURGICO') || s.includes('UBCPME - CC')) {
    return {
      category: 'BLOCOS_OPERATORIOS_E_ESTERILIZACAO',
      sectorSubfolder: 'Unidade_de_Bloco_Cirurgico (CC)'
    };
  }
  if (s.includes('CME -') || s.includes('CENTRAL DE MATERIAL') || s.includes('ESTERILIZA')) {
    return {
      category: 'BLOCOS_OPERATORIOS_E_ESTERILIZACAO',
      sectorSubfolder: 'CME_Centro_de_Material_e_Esterilizacao'
    };
  }

  // SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS
  if (s.includes('AMB') || s.includes('AMBULATORIO')) {
    return {
      category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS',
      sectorSubfolder: 'Ambulatorio_de_Especialidades (AMB)'
    };
  }
  if (s.includes('RAD') || s.includes('UDIDE') || s.includes('RADIOLOGIA') || s.includes('TOMO') || s.includes('MAMO') || s.includes('US') || s.includes('IMAGEN')) {
    if (s.includes('ECG')) {
      return {
        category: 'URGENCIA_E_APOIO_CRITICO',
        sectorSubfolder: 'Eletrocardiograma_e_Eletroencefalograma (ECG)'
      };
    }
    return {
      category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS',
      sectorSubfolder: 'Unidade_de_Diagnostico_por_Imagens (UDIDE)'
    };
  }
  if (s.includes('LAP') || s.includes('LAC') || s.includes('LABORATORIO') || s.includes('ANALISES')) {
    return {
      category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS',
      sectorSubfolder: 'Unidade_de_Laboratorio_de_Analises_Clinicas (LAC)'
    };
  }
  if (s.includes('UNEF') || s.includes('NEFROLOGIA')) {
    return {
      category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS',
      sectorSubfolder: 'Unidade_de_Nefrologia (UNEF)'
    };
  }
  if (s.includes('ENDO') || s.includes('BRONCO') || s.includes('ENDOSCOPIA')) {
    return {
      category: 'SERVICOS_DIAGNOSTICOS_E_TERAPEUTICOS',
      sectorSubfolder: 'Endoscopia_e_Broncoscopia (ENDO)'
    };
  }

  // URGENCIA_E_APOIO_CRITICO
  if (s.includes('PAA') || s.includes('URGENCIA') || s.includes('EMERGENCIA') || s.includes('PRONTO ATENDIMENTO')) {
    return {
      category: 'URGENCIA_E_APOIO_CRITICO',
      sectorSubfolder: 'Unidade_de_Urgencia_e_Emergencia'
    };
  }
  if (s.includes('ECG') || s.includes('EEG') || s.includes('ELETROCARDIOGRAMA')) {
    return {
      category: 'URGENCIA_E_APOIO_CRITICO',
      sectorSubfolder: 'Eletrocardiograma_e_Eletroencefalograma (ECG)'
    };
  }

  // GESTAO_LOGISTICA_E_FARMACIA
  if (s.includes('UFCD') || s.includes('FARMACIA') || s.includes('SFHC') || s.includes('FATURAMENTO')) {
    return {
      category: 'GESTAO_LOGISTICA_E_FARMACIA',
      sectorSubfolder: 'Farmacia_Clinica_e_Dispensacao (UFCD)'
    };
  }
  if (s.includes('SAFS') || s.includes('ABASTECIMENTO') || s.includes('SUPRIMENTOS')) {
    return {
      category: 'GESTAO_LOGISTICA_E_FARMACIA',
      sectorSubfolder: 'Setor_de_Abastecimento_Farmaceutico_e_Suprimentos (SAFS)'
    };
  }
  if (s.includes('STEC') || s.includes('SEGE') || s.includes('ENGENHARIA') || s.includes('MANUTENCAO') || s.includes('TECNICO')) {
    return {
      category: 'GESTAO_LOGISTICA_E_FARMACIA',
      sectorSubfolder: 'Engenharia_Clinica_e_Manutencao (STEC)'
    };
  }
  if (s.includes('SOST') || s.includes('OCUPACIONAL') || s.includes('SEGURANCA')) {
    return {
      category: 'GESTAO_LOGISTICA_E_FARMACIA',
      sectorSubfolder: 'Saude_Ocupacional_e_Seguranca (SOST)'
    };
  }
  if (s.includes('GEP') || s.includes('PESQUISA')) {
    return {
      category: 'GESTAO_LOGISTICA_E_FARMACIA',
      sectorSubfolder: 'Pesquisa_Clinica (GEP)'
    };
  }

  return {
    category: 'GESTAO_LOGISTICA_E_FARMACIA',
    sectorSubfolder: 'OUTROS'
  };
}

// Create deeply nested folder hierarchy on Google Drive based on official structure and return final folder ID with standardized subfolders
export const createDeepDriveFolder = async (
  rootFolderId: string, 
  setor: string, 
  equipmentFolder: string
): Promise<{
  folderId: string;
  subfolders: {
    documentacao: string;
    tecnico: string;
    calibracao: string;
    midia: string;
    logs: string;
  };
}> => {
  const mapping = getFolderMappingForSector(setor);
  
  // Step 1: Create or find "[2] SETORES_E_LOCALIZACOES"
  const setoresId = await getOrCreateSubfolder(rootFolderId, "[2] SETORES_E_LOCALIZACOES");
  
  // Step 2: Create or find the Category folder
  const categoryId = await getOrCreateSubfolder(setoresId, mapping.category);
  
  // Step 3: Create or find the Sector subfolder
  const sectorId = await getOrCreateSubfolder(categoryId, mapping.sectorSubfolder);
  
  // Step 4: Create or find the Equipment specific folder (ex: Monitor MON-102)
  const finalEqFolderId = await getOrCreateSubfolder(sectorId, equipmentFolder);

  // Step 5: Create the 5 subfolders for clinical engineering asset dossiers
  const docId = await getOrCreateSubfolder(finalEqFolderId, "01_DOCUMENTACAO_ORIGINAL");
  const tecnicoId = await getOrCreateSubfolder(finalEqFolderId, "02_TECNICO");
  const calibracaoId = await getOrCreateSubfolder(finalEqFolderId, "03_CALIBRACAO_E_MANUTENCAO");
  const midiaId = await getOrCreateSubfolder(finalEqFolderId, "04_MIDIA");
  const logsId = await getOrCreateSubfolder(finalEqFolderId, "05_LOGS_ORBSTRACKER");
  
  return {
    folderId: finalEqFolderId,
    subfolders: {
      documentacao: docId,
      tecnico: tecnicoId,
      calibracao: calibracaoId,
      midia: midiaId,
      logs: logsId
    }
  };
};

// Read rows from Google Sheet
export const getSheetRows = async (spreadsheetId: string, range: string): Promise<any[][] | null> => {
  const token = await getAccessToken();
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.values || null;
  } catch (err) {
    console.error("Erro ao ler dados do Google Sheets:", err);
    return null;
  }
};

// ==========================================
// GOOGLE SHEETS INTEGRATION
// ==========================================

// Create a new spreadsheet with customized clinical engineering columns
export const createGoogleSheet = async (title: string): Promise<string> => {
  const token = await getAccessToken();
  const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: title
      },
      sheets: [
        {
          properties: {
            title: 'Inspeções'
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao criar planilha.');
  }

  const data = await response.json();
  const spreadsheetId = data.spreadsheetId;

  // Add Column Headers
  const headers = [
    [
      "Data e Hora do Registro",
      "Equipamento",
      "Fabricante",
      "Modelo",
      "Número de Série (S/N)",
      "Número de Patrimônio / TAG",
      "Setor / Localização",
      "Observações / Diagnósticos",
      "Condição de Uso",
      "Auditor / Técnico",
      "E-mail do Auditor",
      "Possui Calibração?",
      "Executado por (Calibração)",
      "Data Calibração",
      "Próxima Calibração",
      "Possui Preventiva?",
      "Executado por (Preventiva)",
      "Data Preventiva",
      "Próxima Preventiva",
      "Possui Seg. Elétrica?",
      "Executado por (Seg. Elétrica)",
      "Data Seg. Elétrica",
      "Próxima Seg. Elétrica",
      "Link das Imagens no Google Drive",
      "Latitude",
      "Longitude",
      "Equipamento Novo?",
      "Nº O.S. (GETS)",
      "Código do Ativo",
      "Propriedade",
      "Manual (Instruções)",
      "Pasta Google Drive",
      "Lista de Acessórios"
    ]
  ];

  await appendSheetRow(spreadsheetId, 'Inspeções', headers);

  return spreadsheetId;
};

// Append a row to a Google Sheet
export const appendSheetRow = async (
  spreadsheetId: string,
  range: string,
  values: any[][]
): Promise<any> => {
  const token = await getAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: values
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Erro ao registrar dados na planilha do Google Sheets.');
  }

  return await response.json();
};
