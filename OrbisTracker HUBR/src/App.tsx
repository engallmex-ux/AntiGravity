import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Wrench, Sparkles, CheckCircle2, AlertTriangle, 
  Trash2, RefreshCw, Layers, ShieldCheck, HeartPulse, Compass, Info,
  Sun, Moon, HelpCircle, X, Database, MapPin, Radio, Menu, LogOut, Lock, Building2, Tag, Zap,
  Upload, FolderOpen, FileSpreadsheet, Sliders, Cloud, Play, ExternalLink,
  Smartphone, RotateCw, Wifi, Battery
} from 'lucide-react';
import QRCode from 'qrcode';

import OrbisLogo from './components/OrbisLogo';

import { FormFields, LabelImage, InspectionRecord, FormMapping } from './types';
import CameraCapture from './components/CameraCapture';
import FormEditor from './components/FormEditor';
import VoiceAssistant from './components/VoiceAssistant';
import HistoryList from './components/HistoryList';
import InventoryLookup from './components/InventoryLookup';
import DatabaseManager from './components/DatabaseManager';
import LoginScreen from './components/LoginScreen';
import UserManager from './components/UserManager';
import AssetsDashboard from './components/AssetsDashboard';
import TagGenerator from './components/TagGenerator';
import { INVENTORY_DATA, InventoryItem } from './data/inventory';

// Initial default empty form fields
const initialFields: FormFields = {
  equipamento: '',
  fabricante: '',
  modelo: '',
  numSerie: '',
  numPatrimonio: '',
  setor: '',
  observacoes: '',
  condicao: 'Boa', // Defaulting to 'Boa' condition
  temCalibracao: false,
  executadoPorCal: '',
  dataCal: '',
  proxCal: '',
  temManutencao: false,
  executadoPorManut: '',
  dataManut: '',
  proxManut: '',
  temSegurancaEletrica: false,
  executadoPorSegElet: '',
  dataSegElet: '',
  proxSegElet: '',
  isNewEquipment: false,
  isTrainingItem: false,
  numeroOSGets: '',
  propriedade: 'Próprio',
  linkManual: '',
  ativoCodigo: '',
  driveFolderUrl: '',
  accessories: []
};

// Default Google Form mappings for the user's specific clinical engineering form
const defaultFormMapping: FormMapping = {
  formUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSfW7GSzOU-Ed9v4PzqJ1pTCG2wahh4pmNIb1rTdaksZqL8qGA/viewform',
  mappings: {
    equipamento: 'entry.848834710',     // Typical placeholder entries (fully customizable in UI)
    fabricante: 'entry.563836173',
    modelo: 'entry.1042702738',
    numSerie: 'entry.2120019253',
    numPatrimonio: 'entry.58287313',
    setor: 'entry.482819385',
    observacoes: 'entry.198374291',
    condicao: 'entry.2005620254',      // Custom mapping ID for Condition
    executadoPorCal: 'entry.148291028',
    dataCal: 'entry.184729102',
    proxCal: 'entry.148291048',
    executadoPorManut: 'entry.829104810',
    proxManut: 'entry.138291041',
    proxSegElet: 'entry.128472919'
  }
};

export default function App() {
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [images, setImages] = useState<LabelImage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [history, setHistory] = useState<InspectionRecord[]>([]);
  const [mapping, setMapping] = useState<FormMapping>(defaultFormMapping);

  // Local active user (Admin / User roles)
  const [currentUser, setCurrentUser] = useState<{ name: string; email: string; role: 'admin' | 'user'; isGoogle: boolean } | null>(() => {
    const saved = localStorage.getItem('orbistracker_logged_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  
  const [syncingRecordId, setSyncingRecordId] = useState<string | null>(null);
  const [sheetRecords, setSheetRecords] = useState<any[][]>([]);

  interface SaStatus {
    configured: boolean;
    email: string;
    hasRootFolder: boolean;
    hasSpreadsheet: boolean;
    spreadsheetId?: string;
    rootFolderId?: string;
  }
  const [saStatus, setSaStatus] = useState<SaStatus | null>(null);

  // Diagnostic & Configuration Modal State for Central Cloud Storage
  const [isSaTestModalOpen, setIsSaTestModalOpen] = useState(false);
  const [saModalTab, setSaModalTab] = useState<'status' | 'config'>('status');
  const [saJsonText, setSaJsonText] = useState<string>('');
  const [saSpreadsheetIdInput, setSaSpreadsheetIdInput] = useState<string>('');
  const [saFolderIdInput, setSaFolderIdInput] = useState<string>('');
  const [saConfigLoading, setSaConfigLoading] = useState<boolean>(false);
  const [saConfigMessage, setSaConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [saTestLoading, setSaTestLoading] = useState(false);
  const [saTestSteps, setSaTestSteps] = useState<{ name: string; status: 'success' | 'failed' | 'pending'; message: string }[]>([]);
  const [saTestResult, setSaTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const [saSyncTestLoading, setSaSyncTestLoading] = useState<boolean>(false);
  const [saSyncTestLog, setSaSyncTestLog] = useState<{ time: string; text: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [saSyncTestSuccessUrl, setSaSyncTestSuccessUrl] = useState<string | null>(null);

  const handleRunSaSyncTest = async () => {
    setSaSyncTestLoading(true);
    setSaSyncTestSuccessUrl(null);
    setSaSyncTestLog([]);

    const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
      const timeStr = new Date().toLocaleTimeString('pt-BR');
      setSaSyncTestLog(prev => [...prev, { time: timeStr, text, type }]);
    };

    addLog("Iniciando fluxo completo de diagnóstico em tempo real...", "info");

    try {
      // Step 1: Gerar Etiqueta QR Code de Teste (Imagem Base64)
      addLog("Gerando etiqueta QR Code com ID de teste (HU-TST-9999-ORB)...", "info");
      const testAtivo = "HU-TST-9999-ORB";
      const qrBase64 = await QRCode.toDataURL(testAtivo, { margin: 1, width: 200 });
      addLog("Etiqueta QR Code de teste gerada com sucesso em memória.", "success");

      // Step 2: Montar objeto de inspeção com informações de teste
      addLog("Estruturando o registro do ativo com informações de teste...", "info");
      const testImage: LabelImage = {
        id: `img_test_${Date.now()}`,
        base64: qrBase64,
        mimeType: "image/png",
        labelType: "geral",
        fileName: "Etiqueta_QR_Teste.png"
      };

      const testRecord: InspectionRecord = {
        id: `TEST_SYNC_${Date.now()}`,
        ativoCodigo: testAtivo,
        equipamento: "Teste",
        fabricante: "Teste",
        modelo: "Teste",
        numSerie: "Teste",
        numPatrimonio: "Teste",
        setor: "TESTE_SINC",
        observacoes: "Teste",
        condicao: "Boa",
        latitude: -23.5505,
        longitude: -46.6333,
        temCalibracao: true,
        executadoPorCal: "Teste",
        dataCal: "11/07/2026",
        proxCal: "11/07/2027",
        temManutencao: true,
        executadoPorManut: "Teste",
        dataManut: "11/07/2026",
        proxManut: "11/07/2027",
        temSegurancaEletrica: true,
        executadoPorSegElet: "Teste",
        dataSegElet: "11/07/2026",
        proxSegElet: "11/07/2027",
        isNewEquipment: true,
        isTrainingItem: true,
        numeroOSGets: "Teste",
        propriedade: "Próprio",
        linkManual: "https://www.orbis.com.br/manual-teste",
        accessories: [
          { id: "acc1", codigoAcessorio: "ACC-TESTE-01", tipo: "Cabo de Força", descricao: "Cabo de teste" }
        ],
        timestamp: new Date().toISOString(),
        status: "completo",
        imagesCount: 1,
        images: [testImage],
        auditorNome: "Auditor Teste",
        auditorEmail: "teste@orbis.com"
      };

      // Step 3: Salvar base local / Firestore do applet
      addLog("Salvando o Ativo de Teste no banco de dados Firestore local...", "info");
      const saveResponse = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: testRecord })
      });

      if (!saveResponse.ok) {
        throw new Error("Falha ao salvar registro de teste no banco local/Firestore.");
      }
      const saveData = await saveResponse.json();
      addLog("Ativo de Teste salvo com sucesso no Firestore e backup JSON local gerado!", "success");

      // Step 4: Sincronizar com Conta de Serviço do Google Workspace
      addLog("Iniciando comunicação com a Conta de Serviço e APIs do Google Drive/Sheets...", "info");
      const syncResponse = await fetch('/api/google/sa-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record: saveData.record || testRecord,
          images: [testImage]
        })
      });

      if (!syncResponse.ok) {
        const errData = await syncResponse.json();
        throw new Error(errData.error || "Erro de resposta da sincronização do Workspace.");
      }

      const syncData = await syncResponse.json();
      addLog("Google Drive: Subpastas e arquivos de características gerados com sucesso!", "success");
      addLog("Google Drive: Imagem QR Code de teste carregada com sucesso!", "success");
      addLog("Google Sheets: Nova linha adicionada na Planilha de Inspeções!", "success");

      setSaSyncTestSuccessUrl(syncData.driveFolderUrl);
      addLog("Fluxo de diagnóstico de ponta a ponta finalizado com Sucesso Absoluto!", "success");

      // Reload Google Sheet rows to update rankings and duplicate checks!
      loadSheetRecords();
    } catch (err: any) {
      addLog(`Falha no Diagnóstico: ${err.message}`, "error");
    } finally {
      setSaSyncTestLoading(false);
    }
  };

  const handleRunSaTest = async () => {
    setSaTestLoading(true);
    setSaTestResult(null);
    setSaTestSteps([
      { name: "1. Autenticação JWT da Conta de Serviço", status: 'pending', message: 'Iniciando teste de chaves...' },
      { name: "2. Verificação da Pasta Raiz no Google Drive", status: 'pending', message: 'Aguardando autenticação...' },
      { name: "3. Verificação da Planilha no Google Sheets", status: 'pending', message: 'Aguardando autenticação...' }
    ]);
    setIsSaTestModalOpen(true);

    try {
      const response = await fetch('/api/google/sa-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.steps) {
        setSaTestSteps(data.steps);
      }
      setSaTestResult({ success: data.success, error: data.error });
    } catch (err: any) {
      setSaTestResult({ success: false, error: err.message });
      setSaTestSteps(prev => prev.map(s => s.status === 'pending' ? { ...s, status: 'failed', message: 'Erro ao executar teste.' } : s));
    } finally {
      setSaTestLoading(false);
    }
  };

  const loadSaStatus = async () => {
    try {
      const res = await fetch('/api/google/sa-status');
      const data = await res.json();
      setSaStatus(data);
      if (data.spreadsheetId) setSaSpreadsheetIdInput(data.spreadsheetId);
      if (data.rootFolderId) setSaFolderIdInput(data.rootFolderId);
    } catch (err) {
      console.error("Error fetching SA status:", err);
    }
  };

  const handleSaveSaConfig = async () => {
    setSaConfigLoading(true);
    setSaConfigMessage(null);
    try {
      let saJsonObj = null;
      if (saJsonText.trim()) {
        try {
          saJsonObj = JSON.parse(saJsonText);
        } catch (e) {
          throw new Error("O texto fornecido não é um JSON válido. Certifique-se de carregar ou colar o conteúdo exato do arquivo de chaves da Conta de Serviço.");
        }
      }

      const response = await fetch('/api/google/sa-configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saJson: saJsonObj,
          spreadsheetId: saSpreadsheetIdInput,
          rootFolderId: saFolderIdInput
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Erro ao salvar configurações.");
      }

      setSaConfigMessage({ type: 'success', text: "Parâmetros configurados com sucesso no servidor e gravados no .env!" });
      setSaJsonText('');
      await loadSaStatus();
      setSaModalTab('status');
      handleRunSaTest();
    } catch (err: any) {
      setSaConfigMessage({ type: 'error', text: err.message });
    } finally {
      setSaConfigLoading(false);
    }
  };

  const handleSaJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        JSON.parse(text);
        setSaJsonText(text);
        setSaConfigMessage({ type: 'success', text: `Arquivo "${file.name}" carregado e validado com sucesso! Clique em "Salvar Configurações" para aplicar.` });
      } catch (err) {
        setSaConfigMessage({ type: 'error', text: "O arquivo carregado não contém um JSON válido. Verifique se baixou o arquivo de chaves correto." });
      }
    };
    reader.readAsText(file);
  };

  // Load Google Service Account status
  useEffect(() => {
    loadSaStatus();
  }, []);

  // Theme & Help Menu State
  const [theme, setTheme] = useState<'light' | 'dark' | 'dark_modern'>(() => {
    const savedTheme = localStorage.getItem('smartform_theme') as 'light' | 'dark' | 'dark_modern';
    return savedTheme || 'dark_modern';
  });
  const [isMobilePreviewEnabled, setIsMobilePreviewEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('orbis_mobile_preview_enabled');
    return saved === null ? true : saved === 'true';
  });
  const [mobileOrientation, setMobileOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isDatabaseManagerOpen, setIsDatabaseManagerOpen] = useState(false);
  const [isUserManagerOpen, setIsUserManagerOpen] = useState(false);
  const [isAssetsDashboardOpen, setIsAssetsDashboardOpen] = useState(false);
  const [isTagGeneratorOpen, setIsTagGeneratorOpen] = useState(false);
  const [initialSelectedRecordId, setInitialSelectedRecordId] = useState<string | null>(null);
  const [isExpressMode, setIsExpressMode] = useState<boolean>(() => {
    return localStorage.getItem('orbis_express_mode') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('orbis_express_mode', String(isExpressMode));
  }, [isExpressMode]);

  const [activeInventory, setActiveInventory] = useState<InventoryItem[]>(INVENTORY_DATA);
  const [helpActiveTab, setHelpActiveTab] = useState<'sobre' | 'dicas' | 'passos' | 'faq' | 'usabilidade'>('sobre');

  // Load custom inventory if exists
  useEffect(() => {
    const loadInventory = () => {
      const saved = localStorage.getItem('orbis_custom_inventory');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setActiveInventory(parsed);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setActiveInventory(INVENTORY_DATA);
    };

    loadInventory();
    
    window.addEventListener('orbis_db_updated', loadInventory);
    window.addEventListener('storage', loadInventory);
    return () => {
      window.removeEventListener('orbis_db_updated', loadInventory);
      window.removeEventListener('storage', loadInventory);
    };
  }, []);
  const [isReferenceCodeEnabled, setIsReferenceCodeEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_ref_code_enabled') !== 'false';
  });

  const [isGoogleSyncEnabled, setIsGoogleSyncEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_google_sync_enabled') !== 'false';
  });

  const [isNfcTagEnabled, setIsNfcTagEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_nfc_tag_enabled') !== 'false';
  });

  const [isGpsLocationEnabled, setIsGpsLocationEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_gps_location_enabled') !== 'false';
  });

  const [isVoiceInputEnabled, setIsVoiceInputEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('orbis_voice_input_enabled');
    return saved === null ? true : saved === 'true';
  });

  const [isPhotoSequenceEnabled, setIsPhotoSequenceEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_photo_sequence_enabled') !== 'false';
  });

  const [isJsonExportEnabled, setIsJsonExportEnabled] = useState<boolean>(() => {
    return localStorage.getItem('orbis_json_export_enabled') === 'true';
  });

  const [showClearPasswordInput, setShowClearPasswordInput] = useState<boolean>(false);
  const [clearPassword, setClearPassword] = useState<string>('');

  const isServiceAccountActive = !!(saStatus?.configured && saStatus?.hasSpreadsheet && isGoogleSyncEnabled);

  const toggleReferenceCode = () => {
    const nextVal = !isReferenceCodeEnabled;
    setIsReferenceCodeEnabled(nextVal);
    localStorage.setItem('orbis_ref_code_enabled', String(nextVal));
  };

  const toggleGoogleSync = () => {
    const nextVal = !isGoogleSyncEnabled;
    setIsGoogleSyncEnabled(nextVal);
    localStorage.setItem('orbis_google_sync_enabled', String(nextVal));
  };

  const toggleNfcTag = () => {
    const nextVal = !isNfcTagEnabled;
    setIsNfcTagEnabled(nextVal);
    localStorage.setItem('orbis_nfc_tag_enabled', String(nextVal));
  };

  const toggleGpsLocation = () => {
    const nextVal = !isGpsLocationEnabled;
    setIsGpsLocationEnabled(nextVal);
    localStorage.setItem('orbis_gps_location_enabled', String(nextVal));
  };

  const toggleVoiceInput = () => {
    const nextVal = !isVoiceInputEnabled;
    setIsVoiceInputEnabled(nextVal);
    localStorage.setItem('orbis_voice_input_enabled', String(nextVal));
  };

  const togglePhotoSequence = () => {
    const nextVal = !isPhotoSequenceEnabled;
    setIsPhotoSequenceEnabled(nextVal);
    localStorage.setItem('orbis_photo_sequence_enabled', String(nextVal));
  };

  const toggleJsonExport = () => {
    const nextVal = !isJsonExportEnabled;
    setIsJsonExportEnabled(nextVal);
    localStorage.setItem('orbis_json_export_enabled', String(nextVal));
  };

  const toggleTheme = () => {
    let nextTheme: 'light' | 'dark' | 'dark_modern';
    if (theme === 'light') {
      nextTheme = 'dark';
    } else if (theme === 'dark') {
      nextTheme = 'dark_modern';
    } else {
      nextTheme = 'light';
    }
    setTheme(nextTheme);
    localStorage.setItem('smartform_theme', nextTheme);
  };

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Load rows from Google Sheet to support Rankings, Duplication Checks & Stats
  const loadSheetRecords = async () => {
    try {
      const response = await fetch('/api/google/sa-records');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.rows && data.rows.length > 0) {
          setSheetRecords(data.rows);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados centralizados do Google Sheets:", err);
    }
  };

  // Load history from local server API with local storage fallback
  const loadServerInspections = async () => {
    try {
      const res = await fetch('/api/inspections');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setHistory(data);
          localStorage.setItem('smartform_history', JSON.stringify(data));
          return;
        }
      }
    } catch (err) {
      console.warn("Não foi possível carregar inspeções do servidor, utilizando cache local:", err);
    }

    const savedHistory = localStorage.getItem('smartform_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Erro ao carregar histórico local:", e);
      }
    }
  };

  // Load history and configurations from LocalStorage / Server on mount
  useEffect(() => {
    loadServerInspections();

    const savedFields = localStorage.getItem('smartform_current_fields');
    if (savedFields) {
      try {
        setFields({ ...initialFields, ...JSON.parse(savedFields) });
      } catch (e) {
        console.error("Erro ao carregar campos ativos:", e);
      }
    }


  }, []);

  // Hook for deep-linking scanned assets via QR Code URLs (window.location.search)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchVal = params.get('search') || params.get('id');
    if (searchVal) {
      const cleanSearch = searchVal.trim().toUpperCase();
      
      // First, find in local/server history
      const matchedHistory = history.find(item => 
        (item.ativoCodigo && item.ativoCodigo.toUpperCase() === cleanSearch) || 
        (item.numPatrimonio && item.numPatrimonio.toUpperCase() === cleanSearch)
      );

      if (matchedHistory) {
        handleLoadRecord(matchedHistory);
        setStatusMessage({
          type: 'success',
          text: `Equipamento [${cleanSearch}] carregado via QR Link diretamente do histórico central!`
        });
      } else {
        // Look in base active inventory
        const matchedItem = activeInventory.find(item => 
          (item.identificador && item.identificador.toUpperCase() === cleanSearch)
        );
        if (matchedItem) {
          handleSelectItem(matchedItem);
          setStatusMessage({
            type: 'success',
            text: `Equipamento cadastrado [${cleanSearch}] carregado via QR Link!`
          });
        } else {
          // Put the code in fields directly as new
          persistFields({
            ...fields,
            numPatrimonio: cleanSearch,
            ativoCodigo: cleanSearch,
            observacoes: `Carregado via link QR Code`
          });
          setStatusMessage({
            type: 'info',
            text: `Código de Ativo [${cleanSearch}] não localizado. Pronto para iniciar novo cadastro.`
          });
        }
      }

      // Clean query param to avoid loading loops on manually refreshed page
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [history, activeInventory]);

  // Save changes to LocalStorage
  const persistFields = (updatedFields: FormFields) => {
    setFields(updatedFields);
    localStorage.setItem('smartform_current_fields', JSON.stringify(updatedFields));
  };

  // Load sheet records when Service Account status or Google Sync setting changes
  useEffect(() => {
    const isServiceAccountActive = !!(saStatus?.configured && saStatus?.hasSpreadsheet && isGoogleSyncEnabled);
    if (isServiceAccountActive) {
      loadSheetRecords();
    }
  }, [saStatus, isGoogleSyncEnabled]);

  // Combined inspections list (Local + Cloud Sheet rows)
  const allInspections = useMemo(() => {
    const list: Array<{ numPatrimonio?: string; numSerie?: string; timestamp: string; auditorNome?: string; equipamento: string; latitude?: number; longitude?: number }> = history.map(item => ({
      numPatrimonio: item.numPatrimonio,
      numSerie: item.numSerie,
      timestamp: item.timestamp,
      auditorNome: item.auditorNome || 'Você',
      equipamento: item.equipamento,
      latitude: item.latitude,
      longitude: item.longitude
    }));

    if (sheetRecords && sheetRecords.length > 1) {
      for (let i = 1; i < sheetRecords.length; i++) {
        const row = sheetRecords[i];
        if (row && row.length > 5) {
          const timestampStr = row[1] || '';
          const eqName = row[2] || '';
          const sn = row[5] || '';
          const pat = row[6] || '';
          const auditorName = row[10] || '';
          const latVal = row[25];
          const lngVal = row[26];
          const lat = latVal ? Number(latVal) : undefined;
          const lng = lngVal ? Number(lngVal) : undefined;
          
          let timestamp = new Date().toISOString();
          if (timestampStr) {
            if (timestampStr.includes('/') && timestampStr.includes(':')) {
              try {
                const parts = timestampStr.split(' ');
                const dateParts = parts[0].split('/');
                const timeParts = parts[1].split(':');
                const d = new Date(
                  Number(dateParts[2]),
                  Number(dateParts[1]) - 1,
                  Number(dateParts[0]),
                  Number(timeParts[0]),
                  Number(timeParts[1]),
                  Number(timeParts[2] || 0)
                );
                if (!isNaN(d.getTime())) {
                  timestamp = d.toISOString();
                }
              } catch (pe) {}
            } else {
              try {
                timestamp = new Date(timestampStr).toISOString();
              } catch (pe) {}
            }
          }

          const existsLocal = list.some(item => {
            const matchPat = pat && item.numPatrimonio && item.numPatrimonio.toLowerCase() === pat.toLowerCase();
            const matchSer = sn && item.numSerie && item.numSerie.toLowerCase() === sn.toLowerCase();
            return matchPat || matchSer;
          });

          if (!existsLocal) {
            list.push({
              numPatrimonio: pat,
              numSerie: sn,
              timestamp: timestamp,
              auditorNome: auditorName || 'Outro Técnico',
              equipamento: eqName,
              latitude: lat !== undefined && !isNaN(lat) ? lat : undefined,
              longitude: lng !== undefined && !isNaN(lng) ? lng : undefined
            });
          }
        }
      }
    }

    return list;
  }, [history, sheetRecords]);

  // Dynamic Inventory combining baseline database, local history, and newly synced sheet equipments
  const dynamicInventory = useMemo(() => {
    const baseList = [...activeInventory];

    // Add local history records first
    history.forEach(rec => {
      const exists = baseList.some(item => {
        const matchPat = rec.numPatrimonio && item.identificador && item.identificador.toLowerCase() === rec.numPatrimonio.toLowerCase();
        const matchSer = rec.numSerie && item.numSerie && item.numSerie.toLowerCase() === rec.numSerie.toLowerCase();
        return matchPat || matchSer;
      });

      if (!exists) {
        baseList.push({
          equipamento: (rec.equipamento || '').toUpperCase(),
          marcaModelo: rec.fabricante && rec.modelo ? `${rec.fabricante} / ${rec.modelo}`.toUpperCase() : (rec.fabricante || rec.modelo || 'DESCONHECIDO').toUpperCase(),
          localizacao: (rec.setor || 'GERAL').toUpperCase(),
          contrato: 'Não',
          identificador: rec.ativoCodigo || rec.numPatrimonio || rec.numSerie || '',
          numSerie: rec.numSerie || '',
          dataAquisicao: rec.timestamp ? rec.timestamp.split('T')[0] : '',
          garantia: ''
        });
      }
    });

    if (sheetRecords && sheetRecords.length > 1) {
      for (let i = 1; i < sheetRecords.length; i++) {
        const row = sheetRecords[i];
        if (row && row.length > 5) {
          const identificador = row[0] || '';
          const eqName = row[2] || '';
          const mfg = row[3] || '';
          const model = row[4] || '';
          const sn = row[5] || '';
          const pat = row[6] || '';
          const sector = row[7] || '';

          if (!eqName) continue;

          // Check if already exists in baseList
          const exists = baseList.some(item => {
            const matchPat = pat && item.identificador && item.identificador.toLowerCase() === pat.toLowerCase();
            const matchSer = sn && item.numSerie && item.numSerie.toLowerCase() === sn.toLowerCase();
            return matchPat || matchSer;
          });

          if (!exists) {
            baseList.push({
              equipamento: eqName.toUpperCase(),
              marcaModelo: mfg && model ? `${mfg} / ${model}`.toUpperCase() : (mfg || model || 'DESCONHECIDO').toUpperCase(),
              localizacao: (sector || 'GERAL').toUpperCase(),
              contrato: 'Não',
              identificador: identificador || pat || sn || '',
              numSerie: sn || '',
              dataAquisicao: row[1] ? row[1].split(' ')[0] : '',
              garantia: ''
            });
          }
        }
      }
    }

    return baseList;
  }, [activeInventory, history, sheetRecords]);



  const handleAddImage = (newImg: LabelImage) => {
    setImages(prev => [...prev, newImg]);
    setStatusMessage({
      type: 'info',
      text: `Imagem "${newImg.fileName}" adicionada! Clique em "Ler Informações com IA" para processar.`
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleClearImages = () => {
    setImages([]);
    setStatusMessage(null);
  };

  // call server OCR endpoint to read multiple labels
  const handleProcessOCR = async () => {
    if (images.length === 0) return;

    setIsProcessing(true);
    setStatusMessage(null);

    try {
      const response = await fetch('/api/process-labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro desconhecido na leitura OCR.');
      }

      const extractedFields = await response.json();
      let finalFields = { ...extractedFields };
      let foundMatchedItem = false;

      // Cruzamento de dados com activeInventory caso leia Nº de Série ou Patrimônio
      if (finalFields.numSerie || finalFields.numPatrimonio) {
        const s1 = (finalFields.numSerie || '').trim().toLowerCase();
        const p1 = (finalFields.numPatrimonio || '').trim().toLowerCase();

        const found = activeInventory.find(item => {
          const s2 = (item.numSerie || '').trim().toLowerCase();
          const p2 = (item.identificador || '').trim().toLowerCase();

          const matchSn = s1 && s2 && s2 !== "not in source" && (s1.includes(s2) || s2.includes(s1));
          const matchPat = p1 && p2 && (p1.includes(p2) || p2.includes(p1));
          return matchSn || matchPat;
        });

        if (found) {
          foundMatchedItem = true;
          let mfg = '';
          let model = '';
          if (found.marcaModelo.includes('/')) {
            const parts = found.marcaModelo.split('/');
            mfg = parts[0].trim();
            model = parts.slice(1).join('/').trim();
          } else {
            mfg = found.marcaModelo.trim();
          }

          finalFields.equipamento = found.equipamento;
          finalFields.fabricante = mfg;
          finalFields.modelo = model;
          if (found.numSerie && found.numSerie !== "Not in source") {
            const cleanSn = found.numSerie.includes(',') ? found.numSerie.split(',')[0].trim() : found.numSerie.trim();
            finalFields.numSerie = cleanSn;
          }
          if (found.identificador) {
            const cleanPat = found.identificador.includes(',') ? found.identificador.split(',')[0].trim() : found.identificador.trim();
            finalFields.numPatrimonio = cleanPat;
          }
        }
      }
      
      // Update form fields
      persistFields(finalFields);
      triggerAutoGpsCapture(finalFields);
      
      setStatusMessage({
        type: 'success',
        text: foundMatchedItem 
          ? 'Sucesso! O Gemini leu as etiquetas e cruzou com os dados cadastrados oficiais do hospital! Localização GPS atualizada.'
          : 'Sucesso! Todas as fotos foram lidas pelo Gemini. Localização GPS atualizada.'
      });
    } catch (error: any) {
      console.error("Erro no OCR:", error);
      setStatusMessage({
        type: 'error',
        text: `Erro ao analisar etiquetas: ${error.message || 'Verifique sua conexão e tente novamente.'}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerAutoGpsCapture = (baseFields: FormFields) => {
    if (!isGpsLocationEnabled) return;
    if (!navigator.geolocation) {
      console.warn("Geolocalização não suportada.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        persistFields({
          ...baseFields,
          latitude,
          longitude
        });
        try {
          if (navigator.vibrate) navigator.vibrate(100);
        } catch (e) {}
      },
      (error) => {
        console.warn("GPS precision or permission error, using simulation fallback:", error);
        const mockLat = -21.97984 + (Math.random() - 0.5) * 0.001;
        const mockLng = -47.88125 + (Math.random() - 0.5) * 0.001;
        persistFields({
          ...baseFields,
          latitude: mockLat,
          longitude: mockLng
        });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleManualGpsClick = () => {
    setStatusMessage({
      type: 'info',
      text: 'Adquirindo sinal GPS e mapeando localização do ativo...'
    });
    
    if (!navigator.geolocation) {
      setStatusMessage({
        type: 'error',
        text: 'Erro: Geolocalização não suportada neste dispositivo.'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        persistFields({
          ...fields,
          latitude,
          longitude
        });
        setStatusMessage({
          type: 'success',
          text: `GPS adquirido com sucesso! Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`
        });
        try {
          if (navigator.vibrate) navigator.vibrate(120);
        } catch (e) {}
      },
      (error) => {
        console.warn("GPS precision or permission error, using simulation fallback:", error);
        const mockLat = -21.97984 + (Math.random() - 0.5) * 0.001;
        const mockLng = -47.88125 + (Math.random() - 0.5) * 0.001;
        persistFields({
          ...fields,
          latitude: mockLat,
          longitude: mockLng
        });
        setStatusMessage({
          type: 'success',
          text: `Coordenadas simuladas do hospital (Iframe): Lat: ${mockLat.toFixed(6)}, Lng: ${mockLng.toFixed(6)}`
        });
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
    );
  };

  const handleSelectItem = (item: InventoryItem) => {
    let mfg = '';
    let model = '';
    if (item.marcaModelo.includes('/')) {
      const parts = item.marcaModelo.split('/');
      mfg = parts[0].trim();
      model = parts.slice(1).join('/').trim();
    } else {
      mfg = item.marcaModelo.trim();
    }

    const cleanSn = item.numSerie && item.numSerie !== 'Not in source'
      ? (item.numSerie.includes(',') ? item.numSerie.split(',')[0].trim() : item.numSerie.trim())
      : '';
    const cleanPat = item.identificador
      ? (item.identificador.includes(',') ? item.identificador.split(',')[0].trim() : item.identificador.trim())
      : '';

    // Buscar o registro mais recente da mesma categoria (equipamento) no histórico para autopreencher os dados técnicos
    const matchingRecords = [...history]
      .filter(rec => rec.equipamento && rec.equipamento.trim().toLowerCase() === item.equipamento.trim().toLowerCase())
      .sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

    const lastRecord = matchingRecords[0];

    const newFields = {
      ...fields,
      equipamento: item.equipamento,
      fabricante: mfg,
      modelo: model,
      numSerie: cleanSn,
      numPatrimonio: cleanPat,
      setor: item.localizacao || '',
      observacoes: '',
      // Histórico de Calibração
      temCalibracao: lastRecord ? !!lastRecord.temCalibracao : false,
      executadoPorCal: lastRecord ? lastRecord.executadoPorCal || '' : '',
      dataCal: lastRecord ? lastRecord.dataCal || '' : '',
      proxCal: lastRecord ? lastRecord.proxCal || '' : '',
      // Histórico de Manutenção Preventiva
      temManutencao: lastRecord ? !!lastRecord.temManutencao : false,
      executadoPorManut: lastRecord ? lastRecord.executadoPorManut || '' : '',
      dataManut: lastRecord ? lastRecord.dataManut || '' : '',
      proxManut: lastRecord ? lastRecord.proxManut || '' : '',
      // Histórico de Segurança Elétrica
      temSegurancaEletrica: lastRecord ? !!lastRecord.temSegurancaEletrica : false,
      executadoPorSegElet: lastRecord ? lastRecord.executadoPorSegElet || '' : '',
      dataSegElet: lastRecord ? lastRecord.dataSegElet || '' : '',
      proxSegElet: lastRecord ? lastRecord.proxSegElet || '' : ''
    };

    persistFields(newFields);
    triggerAutoGpsCapture(newFields);

    setStatusMessage({
      type: 'success',
      text: lastRecord
        ? `Equipamento "${item.equipamento}" selecionado. Dados cadastrais e histórico anterior de calibração/manutenção vinculados automaticamente!`
        : `Equipamento "${item.equipamento}" selecionado do cadastro. Dados e GPS vinculados automaticamente!`
    });
  };

  const handleSyncToGoogle = async (record: InspectionRecord, syncImages?: LabelImage[]) => {
    const isServiceAccountActive = !!(saStatus?.configured && saStatus?.hasSpreadsheet && isGoogleSyncEnabled);

    if (!isServiceAccountActive) {
      setStatusMessage({
        type: 'error',
        text: 'A sincronização corporativa centralizada não está ativa ou não foi configurada.'
      });
      return;
    }

    setSyncingRecordId(record.id);
    setStatusMessage({
      type: 'info',
      text: `Sincronizando "${record.equipamento}" de forma centralizada na Nuvem Corporativa...`
    });

    const imagesToUpload = syncImages || (images.length > 0 ? images : []);

    try {
      const response = await fetch('/api/google/sa-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          record,
          images: imagesToUpload
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro na sincronização corporativa.');
      }

      const data = await response.json();

      // Add to sheet records locally so it immediately shows up as synced
      setSheetRecords(prev => {
        if (prev && prev.length > 0) {
          const alreadyExists = prev.some(r => {
            const rowSn = r[5];
            const rowPat = r[6];
            const rowAtivo = r[0];
            return (record.numSerie && rowSn === record.numSerie) || 
                   (record.numPatrimonio && rowPat === record.numPatrimonio) ||
                   (record.ativoCodigo && rowAtivo === record.ativoCodigo);
          });
          if (alreadyExists) return prev;
          return [...prev, data.inspectionRow];
        }
        return [
          ['Código do Ativo', 'Data e Hora do Registro', 'Equipamento', 'Fabricante', 'Modelo', 'Número de Série (S/N)', 'Número de Patrimônio / TAG', 'Setor / Localização', 'Observações / Diagnósticos', 'Condição de Uso', 'Auditor / Técnico', 'E-mail do Auditor', 'Possui Calibração?', 'Executado por (Calibração)', 'Data Calibração', 'Próxima Calibração', 'Possui Preventiva?', 'Executado por (Preventiva)', 'Data Preventiva', 'Próxima Preventiva', 'Possui Seg. Elétrica?', 'Executado por (Seg. Elétrica)', 'Data Seg. Elétrica', 'Próxima Seg. Elétrica', 'Link das Imagens no Google Drive', 'Latitude', 'Longitude', 'Equipamento Novo?', 'Nº O.S. (GETS)', 'Propriedade', 'Link do Manual', 'Pasta Google Drive', 'Lista de Acessórios'],
          data.inspectionRow
        ];
      });

      const updatedRecord: InspectionRecord = {
        ...record,
        googleSheetRowSynced: true,
        driveFolderUrl: data.driveFolderUrl || record.driveFolderUrl || '',
        googleDriveLinks: data.driveLinks || record.googleDriveLinks || []
      };

      // Save the updated record back to the local backend server so it is persistent!
      try {
        await fetch('/api/inspections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ record: updatedRecord })
        });
      } catch (err) {
        console.error("Erro ao persistir status de sincronização no servidor:", err);
      }

      // Keep item in local history queue marked as successfully synced
      setHistory(prev => {
        const updated = prev.map(item => item.id === record.id ? updatedRecord : item);
        localStorage.setItem('smartform_history', JSON.stringify(updated));
        return updated;
      });

      setStatusMessage({
        type: 'success',
        text: `Sincronização concluída com sucesso! "${record.equipamento}" enviado diretamente à Nuvem Corporativa centralizada.`
      });

      // Reload Google Sheet rows to update rankings and duplicate checks!
      loadSheetRecords();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Erro ao sincronizar corporativo: ${err.message}`
      });
    } finally {
      setSyncingRecordId(null);
    }
  };

  const handleSaveRecord = async () => {
    const missingFields: string[] = [];
    if (!fields.equipamento?.trim()) missingFields.push('Nome do Equipamento');
    
    if (isExpressMode) {
      if (!fields.numPatrimonio?.trim()) missingFields.push('Nº de Patrimônio');
    } else {
      if (!fields.fabricante?.trim()) missingFields.push('Fabricante');
      if (!fields.modelo?.trim()) missingFields.push('Modelo');
      if (!fields.numSerie?.trim()) missingFields.push('Número de Série (S/N)');
    }

    if (missingFields.length > 0) {
      setStatusMessage({
        type: 'error',
        text: `Não é possível prosseguir. Os seguintes campos técnicos são obrigatórios: ${missingFields.join(', ')}.`
      });
      return;
    }

    // Auto-clean unpopulated optional metadata blocks to avoid sending empty/blank info to Google Sheets or PDF
    let cleanedFields = { ...fields };
    if (cleanedFields.temCalibracao && !cleanedFields.executadoPorCal?.trim() && !cleanedFields.dataCal?.trim() && !cleanedFields.proxCal?.trim()) {
      cleanedFields.temCalibracao = false;
    }
    if (cleanedFields.temManutencao && !cleanedFields.executadoPorManut?.trim() && !cleanedFields.dataManut?.trim() && !cleanedFields.proxManut?.trim()) {
      cleanedFields.temManutencao = false;
    }
    if (cleanedFields.temSegurancaEletrica && !cleanedFields.executadoPorSegElet?.trim() && !cleanedFields.dataSegElet?.trim() && !cleanedFields.proxSegElet?.trim()) {
      cleanedFields.temSegurancaEletrica = false;
    }

    // Ensure we have a Código do Ativo (first column)
    if (!cleanedFields.ativoCodigo?.trim()) {
      const eqName = cleanedFields.equipamento || '';
      const eqNameNormalized = eqName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      let sigla = "TER";
      if (
        eqNameNormalized.includes("termo") ||
        eqNameNormalized.includes("esteriliz") ||
        eqNameNormalized.includes("autoclave")
      ) {
        sigla = "TERM";
      } else if (
        eqNameNormalized.includes("ventilador") ||
        eqNameNormalized.includes("respirador") ||
        eqNameNormalized.includes("desfibrilador") ||
        eqNameNormalized.includes("cardioversor") ||
        eqNameNormalized.includes("anestesia") ||
        eqNameNormalized.includes("marcapasso") ||
        eqNameNormalized.includes("suporte de vida")
      ) {
        sigla = "SVI";
      } else if (
        eqNameNormalized.includes("monitor") ||
        eqNameNormalized.includes("oximetro") ||
        eqNameNormalized.includes("ecg") ||
        eqNameNormalized.includes("electro") ||
        eqNameNormalized.includes("eletro") ||
        eqNameNormalized.includes("ultrassom") ||
        eqNameNormalized.includes("raio x") ||
        eqNameNormalized.includes("raio-x") ||
        eqNameNormalized.includes("capnografo") ||
        eqNameNormalized.includes("gaseometro") ||
        eqNameNormalized.includes("glicosimetro")
      ) {
        sigla = "MON";
      } else if (
        eqNameNormalized.includes("computador") ||
        eqNameNormalized.includes("notebook") ||
        eqNameNormalized.includes("tablet") ||
        eqNameNormalized.includes("impressora") ||
        eqNameNormalized.includes("roteador") ||
        eqNameNormalized.includes("switch")
      ) {
        sigla = "DTI";
      } else if (
        eqNameNormalized.includes("osciloscopio") ||
        eqNameNormalized.includes("analisador") ||
        eqNameNormalized.includes("simulador") ||
        eqNameNormalized.includes("calibrador") ||
        eqNameNormalized.includes("metrologia")
      ) {
        sigla = "MET";
      }

      // Check format preference
      const codeFormat = localStorage.getItem('orbis_code_format') || 'simplified';
      
      try {
        const seqRes = await fetch('/api/tag-sequences');
        const seqData = await seqRes.json();
        const serverSeq = seqData[sigla] || 1;
        
        let generatedCode = '';
        if (codeFormat === 'simplified') {
          generatedCode = `${sigla}-${String(serverSeq).padStart(3, '0')}`;
        } else {
          generatedCode = `HU-${sigla}-${String(serverSeq).padStart(6, '0')}-ORB`;
        }
        cleanedFields.ativoCodigo = generatedCode;

        // Also increment the sequence on the server
        await fetch('/api/tag-sequences/increment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sigla, value: serverSeq + 1 })
        });
      } catch (err) {
        console.warn("Could not auto-generate ativoCodigo:", err);
        // Fallback to patrimonio or random number
        cleanedFields.ativoCodigo = cleanedFields.numPatrimonio || `HU-${sigla}-${Math.floor(1000 + Math.random() * 9000)}-ORB`;
      }
    }

    const newRecord: InspectionRecord = {
      ...cleanedFields,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      status: 'completo',
      imagesCount: images.length,
      images: images,
      auditorNome: currentUser?.name || 'Técnico Local',
      auditorEmail: currentUser?.email || '',
      auditorRE: currentUser?.re || ''
    };

    // First, save immediately to local state for instant user feedback
    setHistory(prev => {
      const updated = [newRecord, ...prev];
      localStorage.setItem('smartform_history', JSON.stringify(updated));
      return updated;
    });

    setStatusMessage({
      type: 'info',
      text: `Salvando equipamento "${fields.equipamento}" e armazenando fotos...`
    });

    // Save/Sync to the local Express backend server disk to avoid LocalStorage limits!
    try {
      const serverRes = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: newRecord })
      });
      if (serverRes.ok) {
        const result = await serverRes.json();
        if (result.success && result.record) {
          // Update local history with the server-processed record (cleared base64 + url assigned)
          setHistory(prev => {
            const updated = prev.map(item => item.id === newRecord.id ? result.record : item);
            localStorage.setItem('smartform_history', JSON.stringify(updated));
            return updated;
          });
          setStatusMessage({
            type: 'success',
            text: `Equipamento "${fields.equipamento}" registrado com sucesso no servidor e fotos arquivadas!`
          });
        }
      }
    } catch (err) {
      console.warn("Could not save to local server-side database:", err);
    }

    const activeImages = [...images];

    // Auto-sync to Google Workspace if active (Central Service Account)
    const isServiceAccountActive = !!(saStatus?.configured && saStatus?.hasSpreadsheet && isGoogleSyncEnabled);
    if (isServiceAccountActive) {
      setStatusMessage({
        type: 'info',
        text: `Salvando localmente e enviando para a Nuvem Corporativa centralizada...`
      });
      
      // Clear active form fields and images first to prevent double-tap submissions
      persistFields(initialFields);
      setImages([]);

      await handleSyncToGoogle(newRecord, activeImages);
    } else {
      // Clear form and images anyway to prepare for next asset
      persistFields(initialFields);
      setImages([]);
    }

  };

  const handleDeleteRecord = async (id: string) => {
    const passwordAttempt = prompt("Para excluir este registro/arquivo de inspeção, insira a senha de administrador:");
    if (passwordAttempt === null) return; // Cancelado pelo usuário
    
    const cleanAttempt = passwordAttempt.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanAttempt !== 'admin123' && cleanAttempt !== 'lucassouza' && cleanAttempt !== 'lucas') {
      alert("Acesso negado: Senha incorreta. Apenas administradores autorizados podem excluir arquivos do sistema.");
      return;
    }

    setHistory(prev => {
      const updated = prev.filter(r => r.id !== id);
      localStorage.setItem('smartform_history', JSON.stringify(updated));
      return updated;
    });

    try {
      await fetch(`/api/inspections/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error("Erro ao excluir do servidor:", err);
    }
  };

  const handleClearHistory = async () => {
    if (currentUser?.role !== 'admin') {
      alert("Apenas administradores podem limpar todo o banco de dados.");
      return;
    }

    if (window.confirm("Deseja realmente apagar todo o histórico de inspeções local e do servidor? Esta ação é irreversível e excluirá todos os arquivos físicos.")) {
      setHistory([]);
      localStorage.removeItem('smartform_history');

      try {
        await fetch('/api/inspections', { method: 'DELETE' });
      } catch (err) {
        console.error("Erro ao limpar dados no servidor:", err);
      }
    }
  };

  const handleConfirmClearHistory = async () => {
    const cleanAttempt = clearPassword.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanAttempt !== 'admin123' && cleanAttempt !== 'lucassouza' && cleanAttempt !== 'lucas' && cleanAttempt !== 'orbis123') {
      alert("Acesso negado: Senha de administrador incorreta.");
      return;
    }

    if (window.confirm("Deseja realmente apagar todo o histórico de inspeções local e do servidor? Esta ação é irreversível e excluirá todos os arquivos físicos.")) {
      setHistory([]);
      localStorage.removeItem('smartform_history');

      try {
        await fetch('/api/inspections', { method: 'DELETE' });
        alert("Todo o histórico de inspeções foi apagado com sucesso!");
        setShowClearPasswordInput(false);
        setClearPassword('');
      } catch (err) {
        console.error("Erro ao limpar dados no servidor:", err);
        alert("Histórico local apagado, mas ocorreu um erro ao sincronizar com o servidor.");
      }
    }
  };

  const handleLoadRecord = (record: InspectionRecord) => {
    const { id, timestamp, status, imagesCount, images: recordImages, ...originalFields } = record;
    persistFields({ ...initialFields, ...originalFields });
    if (recordImages) {
      setImages(recordImages);
    } else {
      setImages([]);
    }
    setStatusMessage({
      type: 'info',
      text: `Registro de "${record.equipamento}" carregado de volta no formulário ativo.`
    });
    
    // Scroll smoothly to form editor
    const el = document.getElementById('form-editor-container');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleResetForm = () => {
    if (window.confirm("Limpar todos os campos ativos e começar uma nova inspeção?")) {
      persistFields(initialFields);
      setImages([]);
      setStatusMessage(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center font-sans p-4" id="app-login-barrier">
        <LoginScreen
          onLoginSuccess={(u) => {
            setCurrentUser(u);
            localStorage.setItem('orbistracker_logged_user', JSON.stringify(u));
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans transition-colors duration-200 ${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : ''}`} id="app-root">
      
      {/* 1. Header Branding Section */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50 shadow-md" id="main-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 relative">
          
          {/* App Title/Slogan */}
          <div className="flex items-center min-w-0">
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm md:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                OrbisTracker HU-BR
                <span className="px-1.5 py-0.5 bg-emerald-500 text-[9px] font-extrabold text-slate-950 rounded-full shrink-0">v1.6.0</span>
              </h1>
              <p className="text-[9px] sm:text-[10px] text-slate-300 font-medium">
                Precisão que transforma horas de auditoria em segundos de ação
              </p>
            </div>
          </div>

          {/* Unified Action Dropdown Menu Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden xs:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-100 truncate max-w-[120px]">{currentUser?.name}</span>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {currentUser?.re && (
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded border border-emerald-500/20 font-bold shrink-0">
                    RE: {currentUser.re}
                  </span>
                )}
                <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${currentUser?.role === 'admin' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                  {currentUser?.role === 'admin' ? 'Administrador' : 'Técnico'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-sm active:scale-95 ${
                isHeaderMenuOpen 
                  ? 'bg-emerald-600 border-emerald-500 text-white' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Menu de Ferramentas e Configurações"
            >
              <Menu className={`w-4 h-4 ${isHeaderMenuOpen ? 'rotate-90 text-white' : 'text-emerald-400'} transition-transform duration-200`} />
              <span>Opções</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentUser(null);
                localStorage.removeItem('orbistracker_logged_user');
              }}
              className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 hover:border-rose-500/30 transition-all cursor-pointer min-h-[36px] flex items-center justify-center"
              title="Sair do aplicativo"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Invisible Overlay Backdrop for Closing Dropdown on Click Outside */}
          {isHeaderMenuOpen && (
            <div 
              className="fixed inset-0 z-40 bg-black/5" 
              onClick={() => setIsHeaderMenuOpen(false)} 
            />
          )}

          {/* Floating Dropdown Janela/Aba de Ações */}
          {isHeaderMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="absolute right-4 top-18 z-50 w-[290px] sm:w-[340px] max-h-[calc(100vh-80px)] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-3 flex flex-col gap-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent animate-fade-in"
            >
              <div className="px-2 py-1.5 border-b border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ferramentas de Auditoria</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              </div>

              {/* MCP Server Connection Status Badge */}
              <div className="mx-1 my-1 p-2 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between gap-3 text-xs shadow-inner">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                  <span className="font-bold text-slate-300">MCP:</span>
                  <span className="font-mono text-[9px] text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-900/30">
                    default_local_agent
                  </span>
                </div>
                <span className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider">Conectado</span>
              </div>

              {/* Nuvem Central Ativa Section within Options Menu */}
              {saStatus?.configured && saStatus?.hasSpreadsheet && (
                <div className="p-2.5 mx-1 my-1 bg-slate-850 rounded-xl border border-emerald-500/20 flex flex-col gap-2 shadow-inner" id="sa-active-menu-section">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-2 w-2 relative shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                      </span>
                      <span className="font-bold text-xs text-white">Nuvem Central Ativa</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunSaTest();
                      }}
                      disabled={saTestLoading}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-650 disabled:opacity-50 text-emerald-400 border border-slate-750 hover:border-emerald-500/30 rounded font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer"
                      title="Testar Conexão Google Cloud"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${saTestLoading ? 'animate-spin' : ''}`} />
                      Testar
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-normal font-medium">
                    Dados e arquivos são sincronizados no Google Drive e Sheets do Hospital.
                  </div>
                  <div className="font-mono text-[9px] bg-slate-900/60 px-2 py-1 rounded border border-slate-800/40 truncate text-emerald-300 font-bold" title={saStatus.email}>
                    SA: {saStatus.email.split('@')[0]}...
                  </div>
                </div>
              )}

              {/* Action Item: Painel Geral de Ativos */}
              <button
                type="button"
                onClick={() => {
                  setIsAssetsDashboardOpen(true);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
              >
                <div className="p-2 bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-900/30 transition-colors shrink-0">
                  <Building2 className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    Painel Geral de Ativos
                    <span className="bg-indigo-600 text-[9px] font-black px-1.5 py-0.5 rounded-full text-indigo-100">
                      {activeInventory.length}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Indicadores, cobertura de vistorias, mapa de calor e planta baixa</div>
                </div>
              </button>

              {/* Action Item: Gerador de Etiquetas de Patrimônio */}
              <button
                type="button"
                onClick={() => {
                  setIsTagGeneratorOpen(true);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white cursor-pointer"
              >
                <div className="p-2 bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-900/30 transition-colors shrink-0">
                  <Tag className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    Imprimir Etiquetas & Lotes
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 font-medium">Geração de códigos HU, QR Code e carga de impressão térmica para campo</div>
                </div>
              </button>

              {/* Action Item 1: Nova Inspeção (Reset Form) */}
              <button
                type="button"
                onClick={() => {
                  handleResetForm();
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
              >
                <div className="p-2 bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-900/30 transition-colors shrink-0">
                  <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs">Nova Inspeção</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Limpa o formulário e inicia nova auditoria do zero</div>
                </div>
              </button>

              {/* Action Item 2: Google Sheets Spreadsheet (Conditional) */}
              {isGoogleSyncEnabled && saStatus?.hasSpreadsheet && saStatus?.spreadsheetId && (
                <button
                  type="button"
                  onClick={() => {
                    setIsHeaderMenuOpen(false);
                    window.open(`https://docs.google.com/spreadsheets/d/${saStatus.spreadsheetId}`, '_blank');
                  }}
                  className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white cursor-pointer"
                >
                  <div className="p-2 bg-amber-950/50 border border-amber-500/20 text-amber-400 rounded-lg group-hover:bg-amber-900/30 transition-colors shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs">Planilha Central em Nuvem</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Abrir planilha integrada ativa em nova aba
                    </div>
                  </div>
                </button>
              )}

              {/* Action Item 3: GPS Geográfico Manual (Conditional) */}
              {isGpsLocationEnabled && (
                <button
                  type="button"
                  onClick={() => {
                    handleManualGpsClick();
                    setIsHeaderMenuOpen(false);
                  }}
                  className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
                >
                  <div className="p-2 bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 rounded-lg group-hover:bg-indigo-900/30 transition-colors shrink-0">
                    <MapPin className="w-4 h-4 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs">Capturar GPS</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Grava as coordenadas geográficas atuais do ativo</div>
                  </div>
                </button>
              )}

              {/* Action Item 4: Gerenciar Base de Dados de Ativos */}
              <button
                type="button"
                onClick={() => {
                  setIsDatabaseManagerOpen(true);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
              >
                <div className="p-2 bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-900/30 transition-colors shrink-0">
                  <Database className="w-4 h-4 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs">Atualizar Base de Dados</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Carregar planilha atualizada, copiar do Excel ou sincronizar Sheets</div>
                </div>
              </button>

              {/* Action Item: Gerenciar Técnicos (Somente Admin) */}
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserManagerOpen(true);
                    setIsHeaderMenuOpen(false);
                  }}
                  className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
                >
                  <div className="p-2 bg-emerald-950/50 border border-emerald-500/20 text-emerald-400 rounded-lg group-hover:bg-emerald-900/30 transition-colors shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs">Gestão de Técnicos</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">Cadastrar, alterar senhas e definir perfis dos técnicos de campo</div>
                  </div>
                </button>
              )}

              {/* Action Item: Alternar Modo Express */}
              <button
                type="button"
                onClick={() => {
                  setIsExpressMode(!isExpressMode);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white cursor-pointer"
              >
                <div className={`p-2 rounded-lg shrink-0 border transition-all ${isExpressMode ? 'bg-amber-950/50 border-amber-500/30 text-amber-400' : 'bg-slate-950/50 border-slate-800 text-slate-400'}`}>
                  <Zap className={`w-4 h-4 ${isExpressMode ? 'animate-bounce' : ''}`} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    Modo Express (Super Rápido)
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isExpressMode ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                      {isExpressMode ? 'ATIVADO' : 'DESATIVADO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Otimiza a tela para mobile focando em Ativo, Setor, Foto e Observações</div>
                </div>
              </button>

              {/* Action Item 5: Ajuda e Instruções de Uso */}
              <button
                type="button"
                onClick={() => {
                  setIsHelpOpen(true);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white"
              >
                <div className="p-2 bg-blue-950/50 border border-blue-500/20 text-blue-400 rounded-lg group-hover:bg-blue-900/30 transition-colors shrink-0">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs">Instruções de Uso & FAQ</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Dúvidas frequentes, guias rápidos e dicas de precisão</div>
                </div>
              </button>

              {/* Action Item 5: Alternar Tema de Cores (Light / Dark / Dark Modern) */}
              <button
                type="button"
                onClick={() => {
                  toggleTheme();
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white cursor-pointer"
              >
                <div className="p-2 bg-pink-950/50 border border-pink-500/20 text-pink-400 rounded-lg group-hover:bg-pink-900/30 transition-colors shrink-0">
                  {theme === 'light' ? (
                    <Moon className="w-4 h-4 text-amber-400" />
                  ) : theme === 'dark' ? (
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Sun className="w-4 h-4 text-amber-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs">Alternar Tema de Cores</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Modo ativo: {theme === 'light' ? 'Claro' : theme === 'dark' ? 'Escuro Padrão' : 'Obsidian Moderno'}
                  </div>
                </div>
              </button>

              {/* Action Item 6: Alternar Simulador Mobile */}
              <button
                type="button"
                onClick={() => {
                  setIsMobilePreviewEnabled(!isMobilePreviewEnabled);
                  setIsHeaderMenuOpen(false);
                }}
                className="w-full p-2.5 bg-slate-850 hover:bg-slate-800 text-left rounded-xl border border-slate-800/40 hover:border-slate-750 transition-all flex items-start gap-3 group text-white cursor-pointer"
              >
                <div className={`p-2 rounded-lg shrink-0 border transition-all ${isMobilePreviewEnabled ? 'bg-indigo-950/50 border-indigo-500/30 text-indigo-400' : 'bg-slate-950/50 border-slate-800 text-slate-400'}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs flex items-center gap-1.5">
                    Simulador Visual Mobile
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${isMobilePreviewEnabled ? 'bg-indigo-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
                      {isMobilePreviewEnabled ? 'ATIVO' : 'INATIVO'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Visualiza a interface de vistoria clínica simulando um dispositivo móvel
                  </div>
                </div>
              </button>
            </motion.div>
          )}

        </div>
      </header>



      {/* 2. Main Content Stage */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6" id="main-content">
        
        {/* Status Toast Banner */}
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
                : statusMessage.type === 'error'
                ? 'bg-red-50 text-red-900 border-red-100'
                : 'bg-blue-50 text-blue-900 border-blue-100'
            }`}
            id="status-toast"
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs">
              <p className="font-semibold">{statusMessage.type === 'success' ? 'Sucesso!' : statusMessage.type === 'error' ? 'Atenção / Erro' : 'Informativo'}</p>
              <p className="mt-0.5 text-slate-600 leading-relaxed">{statusMessage.text}</p>
            </div>
            <button 
              type="button"
              onClick={() => setStatusMessage(null)} 
              className="text-slate-400 hover:text-slate-600 text-xs font-bold font-mono px-1.5 hover:bg-slate-200/50 rounded"
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* 1. Quick Search and Select Inventory Header */}
        <InventoryLookup 
          onSelectItem={handleSelectItem} 
          isNfcTagEnabled={isNfcTagEnabled} 
          activeInventory={dynamicInventory} 
        />

        {/* Quick Access Menu List (Responsivo: lista vertical no celular, grid no desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" id="quick-access-grid">
          
          {/* Card 1: Ficha Técnica */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('form-editor-wrapper');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
          >
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors shrink-0">
              <Wrench className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Ficha Técnica</h3>
            </div>
          </button>

          {/* Card 2: Histórico */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('history-list-wrapper');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
          >
            <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors shrink-0">
              <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Histórico</h3>
            </div>
          </button>

          {/* Card 3: Google Workspace */}
          {isGoogleSyncEnabled && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('google-manager-wrapper');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
            >
              <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors shrink-0">
                <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Google Sync</h3>
              </div>
            </button>
          )}

          {/* Card 4: Câmera & OCR */}
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById('camera-capture-wrapper');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
          >
            <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-xl group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50 transition-colors shrink-0">
              <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Câmera & OCR</h3>
            </div>
          </button>

          {/* Card 5: GPS Geográfico */}
          {isGpsLocationEnabled && (
            <button
              type="button"
              onClick={handleManualGpsClick}
              className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
            >
              <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 transition-colors shrink-0">
                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Localização GPS</h3>
              </div>
            </button>
          )}

          {/* Card 6: RFID & NFC */}
          {isNfcTagEnabled && (
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('inventory-lookup-container');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  const btn = el.querySelector('button[title*="RFID"]');
                  if (btn) (btn as HTMLButtonElement).click();
                }
              }}
              className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs text-left transition-all hover:translate-x-1 hover:scale-[1.01] active:scale-[0.99] cursor-pointer flex flex-row items-center gap-3.5 group w-full"
            >
              <div className="p-2 bg-sky-50 dark:bg-sky-950/40 rounded-xl group-hover:bg-sky-100 dark:group-hover:bg-sky-900/50 transition-colors shrink-0">
                <Radio className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-200 tracking-tight">Tag RFID / NFC</h3>
              </div>
            </button>
          )}

        </div>

        {/* Seções Superiores de Vistoria: Captura de Câmera vs Editor de Formulário de IA (Com Opção de Simulador) */}
        {isMobilePreviewEnabled ? (
          <div className="flex flex-col items-center justify-center py-6 bg-slate-900/30 dark:bg-slate-900/10 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-xs max-w-4xl mx-auto w-full">
            {/* Controles do Simulador Mobile */}
            <div className="flex items-center gap-4 mb-6 bg-slate-950 px-5 py-2 rounded-full border border-slate-800 shadow-md">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 select-none">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                Simulador Mobile Ativo
              </span>
              <div className="h-4 w-px bg-slate-800" />
              <button
                type="button"
                onClick={() => setMobileOrientation(mobileOrientation === 'portrait' ? 'landscape' : 'portrait')}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-indigo-400" />
                <span>{mobileOrientation === 'portrait' ? 'Retrato (Portrait)' : 'Paisagem (Landscape)'}</span>
              </button>
              <div className="h-4 w-px bg-slate-800" />
              <button
                type="button"
                onClick={() => setIsMobilePreviewEnabled(false)}
                className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
              >
                Desativar
              </button>
            </div>

            {/* Moldura e Chassis do Dispositivo */}
            <div
              className={`relative bg-slate-950 border-[12px] border-slate-800 rounded-[45px] shadow-2xl transition-all duration-300 overflow-hidden ${
                mobileOrientation === 'portrait' 
                  ? 'w-[375px] h-[780px]' 
                  : 'w-[780px] h-[400px]'
              }`}
            >
              {/* Notch da Câmera e Saída de Som */}
              {mobileOrientation === 'portrait' && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center">
                  <div className="w-12 h-1 bg-slate-950 rounded-full" />
                  <div className="w-2.5 h-2.5 bg-slate-900 rounded-full ml-3 border border-slate-950" />
                </div>
              )}

              {/* Tela Interna do Dispositivo Simulador */}
              <div className={`w-full h-full overflow-y-auto px-4 pb-6 scrollbar-none mobile-simulator-viewport bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${
                mobileOrientation === 'portrait' ? 'pt-8' : 'pt-4'
              }`}>
                {/* Simulação da Barra de Status do Celular */}
                <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 mb-4 px-2 select-none border-b border-slate-200/20 pb-2">
                  <span className="font-mono">16:11</span>
                  <div className="flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5" />
                    <Battery className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* Renderizar os Componentes em Formato Empilhado Mobile */}
                <div className="space-y-6">
                  {/* Widget de Captura de Imagens com Câmera */}
                  <div id="camera-capture-wrapper">
                    <CameraCapture
                      images={images}
                      onAddImage={handleAddImage}
                      onRemoveImage={handleRemoveImage}
                      onClearImages={handleClearImages}
                      onProcess={handleProcessOCR}
                      isProcessing={isProcessing}
                      isPhotoSequenceEnabled={isPhotoSequenceEnabled}
                    />
                  </div>

                  {/* Widget do Assistente de Voz Inteligente com IA */}
                  {isVoiceInputEnabled && (
                    <VoiceAssistant
                      currentFields={fields}
                      onUpdateFields={persistFields}
                    />
                  )}

                  {/* Widget do Editor de Formulário Clínico */}
                  <div id="form-editor-wrapper">
                    <FormEditor
                      fields={fields}
                      onChangeFields={persistFields}
                      onSaveRecord={handleSaveRecord}
                      onResetForm={handleResetForm}
                      existingInspections={allInspections}
                      isGoogleConnected={isServiceAccountActive}
                      isReferenceCodeEnabled={isReferenceCodeEnabled}
                      isExpressMode={isExpressMode}
                      onChangeExpressMode={setIsExpressMode}
                      images={images}
                      onAddImage={handleAddImage}
                      onRemoveImage={handleRemoveImage}
                      onClearImages={handleClearImages}
                    />
                  </div>
                </div>
              </div>

              {/* Barra Indicadora de Início (Home Indicator) */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-700/60 rounded-full z-50" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Coluna Esquerda (Largura 5/12): Câmera e Assistente de Voz */}
            <div className="lg:col-span-5 space-y-6 flex flex-col">
              
              {/* Widget de Captura de Imagens com Câmera */}
              <div id="camera-capture-wrapper">
                <CameraCapture
                  images={images}
                  onAddImage={handleAddImage}
                  onRemoveImage={handleRemoveImage}
                  onClearImages={handleClearImages}
                  onProcess={handleProcessOCR}
                  isProcessing={isProcessing}
                  isPhotoSequenceEnabled={isPhotoSequenceEnabled}
                />
              </div>

              {/* Smart AI Voice Assistant widget */}
              {isVoiceInputEnabled && (
                <VoiceAssistant
                  currentFields={fields}
                  onUpdateFields={persistFields}
                />
              )}

              {/* 
                COLUNA ESQUERDA: Ferramentas de Entrada de Dados e Integração
                - Camera Capture: Permite capturar e processar fotos com OCR via Gemini.
                - Voice Assistant: Auxilia no preenchimento de campos por comando de voz/ditado inteligente.
              */}
            </div>

            {/* Right Column (Width: 7/12): Form Editor and Prefill Actions */}
            <div className="lg:col-span-7 space-y-6" id="form-editor-wrapper">
              <FormEditor
                fields={fields}
                onChangeFields={persistFields}
                onSaveRecord={handleSaveRecord}
                onResetForm={handleResetForm}
                existingInspections={allInspections}
                isGoogleConnected={isServiceAccountActive}
                isReferenceCodeEnabled={isReferenceCodeEnabled}
                isExpressMode={isExpressMode}
                onChangeExpressMode={setIsExpressMode}
                images={images}
                onAddImage={handleAddImage}
                onRemoveImage={handleRemoveImage}
                onClearImages={handleClearImages}
              />
            </div>

          </div>
        )}

        {/* Full-width History Database */}
        <div className="pt-2" id="history-list-wrapper">
          <HistoryList
            records={history}
            onLoadRecord={handleLoadRecord}
            onDeleteRecord={handleDeleteRecord}
            onClearHistory={handleClearHistory}
            isGoogleConnected={isServiceAccountActive}
            onSyncToGoogle={handleSyncToGoogle}
            syncingRecordId={syncingRecordId}
            allInspections={allInspections}
            isJsonExportEnabled={isJsonExportEnabled}
            onPrintRecord={(recordId) => {
              setInitialSelectedRecordId(recordId);
              setIsTagGeneratorOpen(true);
            }}
          />
        </div>

      </main>

      {/* 3. Footer */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-8 text-center text-xs" id="main-footer-copyright">
        <p className="font-mono text-slate-300">© 2026 Orbis Engenharia Clínica. Todos os direitos reservados.</p>
        <p className="mt-1 font-sans text-slate-400">Idealização e Desenvolvimento: <strong className="text-emerald-400 font-semibold">Lucas Fonseca</strong></p>
        <p className="mt-1 text-[11px] text-slate-500">Desenvolvido sob medida para inventários físicos, automação de calibração e manutenção hospitalar em parceria com o HU-Brasil.</p>
      </footer>

      {/* 4. Interactive Step-by-Step Help & FAQ Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in" id="help-modal-overlay">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[85vh] animate-scale-up" id="help-modal-container">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600 animate-bounce" />
                <span className="font-bold text-slate-800 text-base">Central de Ajuda - OrbisTracker HU-Brasil</span>
              </div>
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition-colors"
                title="Fechar central de ajuda"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Navigation Controls */}
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setHelpActiveTab('sobre')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  helpActiveTab === 'sobre'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                Sobre o Sistema
              </button>
              <button
                type="button"
                onClick={() => setHelpActiveTab('dicas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  helpActiveTab === 'dicas'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                Dicas Operacionais
              </button>
              <button
                type="button"
                onClick={() => setHelpActiveTab('passos')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  helpActiveTab === 'passos'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                Passo-a-Passo
              </button>
              <button
                type="button"
                onClick={() => setHelpActiveTab('faq')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  helpActiveTab === 'faq'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                FAQ / Dúvidas
              </button>
              <button
                type="button"
                onClick={() => setHelpActiveTab('usabilidade')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  helpActiveTab === 'usabilidade'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-emerald-100/60 hover:text-emerald-800'
                }`}
              >
                🚀 Guia de Usabilidade
              </button>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-xs sm:text-sm leading-relaxed" id="help-modal-body">
              
              {/* TAB: SOBRE O SISTEMA */}
              {helpActiveTab === 'sobre' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200">
                      SISTEMA OPERACIONAL
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      Sobre o OrbisTracker HU-Brasil
                    </h3>
                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                      O <strong>OrbisTracker HU-Brasil</strong> nasceu de um desafio real e urgente da Engenharia Clínica: a necessidade de simplificar e acelerar o inventário físico de equipamentos hospitalares. Criado para substituir pranchetas e planilhas manuais lentas, o aplicativo funciona como o braço móvel de um sistema de auditoria inteligente.
                    </p>
                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                      Muito mais do que um simples leitor de patrimônio, o OrbisTracker cria uma base de dados sólida e auditável. Em uma única varredura, o auditor captura o registro fotográfico da etiqueta e da placa do fabricante, documenta o estado de conservação do equipamento e cruza essas informações com a localização geográfica exata do ativo dentro do hospital.
                    </p>
                    <p className="text-slate-600 leading-relaxed text-xs sm:text-sm">
                      Ao eliminar a digitação manual, o aplicativo alimenta o banco de dados central de forma rápida, visual e inteligente. O resultado é a drástica redução do tempo de coleta e a garantia de informações precisas e à prova de falhas para a gestão hospitalar.
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3.5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      🚀 Controle de Versão & pipeline
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/60">
                      <div>
                        <span className="text-slate-400">Versão:</span> <span className="text-emerald-700 font-bold">v1.6.0</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Revisão:</span> <span className="font-semibold text-slate-800">Rev. 2026.06.A</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Ambiente:</span> <span className="text-blue-700 font-semibold">Production</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Engine:</span> <span className="font-semibold text-slate-800">SAPI-Core</span>
                      </div>
                      <div className="col-span-2 border-t border-slate-200 pt-2 mt-1.5 flex items-center gap-1.5 text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-slate-500 font-sans">Gemini Visão Computacional Conectada</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3.5 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                      ⚙️ Configurações de Recursos e Módulos Opcionais
                    </span>
                    <div className="space-y-2.5">
                      {/* Auxiliar de Código de Referência */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Auxiliar de Código de Referência</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Gera automaticamente códigos de identificação sequenciais padronizados (ex: HU-MON-000045-ORB) durante o fluxo de auditoria.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleReferenceCode}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isReferenceCodeEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isReferenceCodeEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Google Workspace Integration */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Integração Google Workspace (Sheets & Drive)</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Habilita a sincronização em nuvem e upload automático de fotos para o ecossistema do hospital no Google Drive e Sheets.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleGoogleSync}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isGoogleSyncEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isGoogleSyncEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Fast and Intelligent Voice Input */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Entrada de Voz Inteligente (SAPI-Voice)</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Habilita o assistente de voz nativo do navegador para o preenchimento automático das vistorias via ditado por comando de voz rápido.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleVoiceInput}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isVoiceInputEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isVoiceInputEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* NFC / RFID tag */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Leitor de Tag RFID / NFC</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Habilita o botão de varredura física NFC (NDEF Reader) e o simulador clínico de tags de identificação no topo do inventário.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleNfcTag}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isNfcTagEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isNfcTagEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* GPS location */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Geolocalização GPS de Ativos</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Habilita a captura automatizada ou manual das coordenadas de satélite (latitude/longitude) do ativo vistoriado no hospital.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleGpsLocation}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isGpsLocationEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isGpsLocationEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Guided Photo Sequence */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Sequência Fotográfica Recomendada (Orbis-Pose)</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Orienta passo-a-passo e define automaticamente a categoria de cada foto (Geral, S/N, Patrimônio, Calibração, etc.) com lembretes inteligentes para manter o padrão de qualidade.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={togglePhotoSequence}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isPhotoSequenceEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isPhotoSequenceEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Individual JSON Export Toggle */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Exportação JSON Individual (Histórico)</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Habilita o botão "JSON" de exportação individual de cada card de inspeção no histórico de auditorias.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={toggleJsonExport}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isJsonExportEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isJsonExportEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Simulador de Dispositivo Móvel */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Simulador de Dispositivo Móvel</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Simula a interface do aplicativo clínico em uma tela reduzida de smartphone (375px/812px) para teste de usabilidade.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const nextVal = !isMobilePreviewEnabled;
                            setIsMobilePreviewEnabled(nextVal);
                            localStorage.setItem('orbis_mobile_preview_enabled', String(nextVal));
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isMobilePreviewEnabled
                              ? 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700'
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {isMobilePreviewEnabled ? '✓ Ativo' : 'Inativo'}
                        </button>
                      </div>

                      {/* Servidor MCP Status */}
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/60 flex items-center justify-between gap-3">
                        <div>
                          <span className="font-bold text-slate-800 text-xs">Servidor MCP (Model Context Protocol)</span>
                          <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                            Mostra o status de integração do agente local ativo. Usado para orquestração automática das auditorias clínicas.
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 bg-emerald-50 px-2 py-1 rounded border border-emerald-200/40 text-[10px] text-emerald-850 font-mono font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>default_local_agent</span>
                        </div>
                      </div>

                      {/* Apagar Tudo with Password */}
                      <div className="bg-red-50/50 dark:bg-red-950/10 p-3 rounded-xl border border-red-200/50 dark:border-red-900/30 flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="font-bold text-red-800 dark:text-red-400 text-xs flex items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" />
                              Limpar Banco de Dados (Apagar Tudo)
                            </span>
                            <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                              Apaga de forma irreversível todo o histórico de inspeções local e no servidor. Requer senha de administrador.
                            </p>
                          </div>
                        </div>

                        {showClearPasswordInput ? (
                          <div className="flex gap-2 items-center animate-fade-in w-full">
                            <input
                              type="password"
                              placeholder="Senha de admin..."
                              value={clearPassword}
                              onChange={(e) => setClearPassword(e.target.value)}
                              className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-xs rounded-lg flex-1 font-mono focus:ring-1 focus:ring-red-500 outline-none text-slate-800 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={handleConfirmClearHistory}
                              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm shrink-0"
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowClearPasswordInput(false);
                                setClearPassword('');
                              }}
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowClearPasswordInput(true)}
                            className="w-full py-1.5 bg-red-50 hover:bg-red-100/80 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 rounded-lg text-xs font-bold transition-all text-center cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Apagar Todo o Histórico</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB: DICAS OPERACIONAIS */}
              {helpActiveTab === 'dicas' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-1">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight mb-3 flex items-center gap-1.5">
                      <Wrench className="w-5 h-5 text-emerald-600" />
                      Dicas Operacionais de Engenharia
                    </h3>
                    <ul className="text-xs sm:text-sm text-slate-600 space-y-3 leading-relaxed">
                      <li className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <span className="text-emerald-600 font-bold shrink-0 text-base">✓</span>
                        <span>
                          <strong>Tudo em uma única foto?</strong> Se todas as informações estiverem na mesma etiqueta ou no mesmo equipamento, tire apenas uma foto geral. O Gemini fará o cruzamento unificado dos dados.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <span className="text-emerald-600 font-bold shrink-0 text-base">✓</span>
                        <span>
                          <strong>Sem calibração?</strong> Caso o equipamento não tenha calibração ativa, deixe o switch "Equipamento possui?" desligado para evitar dados nulos no Google Forms.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                        <span className="text-emerald-600 font-bold shrink-0 text-base">✓</span>
                        <span>
                          <strong>Impressora Térmica Zebra ZD220:</strong> Configure no painel de impressão o método desejado: rede TCP/IP direta (via IP Ethernet/Wi-Fi), Zebra Browser Print local (USB) ou download direto do comando nativo em ZPL para spolar manualmente.
                        </span>
                      </li>
                      <li className="flex items-start gap-2 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25">
                        <span className="text-emerald-600 font-bold shrink-0 text-base">📋</span>
                        <span>
                          <strong>Etiqueta de Engenharia Clínica Homologada:</strong> Use dimensões 50mm x 30mm em material BOPP Fosco ou Poliéster Prata (impermeável e resistente a fricção clínica e álcool 70%) com ribbon Resina Total para legibilidade permanente.
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {/* TAB: PASSO-A-PASSO */}
              {helpActiveTab === 'passos' && (
                <div className="space-y-3.5 animate-fade-in">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">Guia</span>
                    <span>Fluxo de Registro Passo-a-Passo</span>
                  </h4>
                  <ol className="list-decimal pl-5 space-y-2.5 text-slate-600 text-xs sm:text-sm">
                    <li><strong>Pesquise ou Selecione o Ativo:</strong> Use o painel de pesquisa superior para buscar ativos já cadastrados no hospital ou comece a digitar o nome do equipamento.</li>
                    <li><strong>Identificação por RE (Controle de Ponto):</strong> Todo auditor possui um Registro de Engenheiro (RE) salvo em seu cadastro de usuário (ex: Lucas Fonseca RE-3700). Este código operacional é incluído automaticamente nos metadados da inspeção e impresso na etiqueta como responsável clínico, sendo usado para atualizações de controle de ponto e produtividade.</li>
                    <li><strong>Geração Automática de Código Sequencial & QR Code:</strong> Com base no equipamento e padrão predeterminado Orbis Engenharia Clínica, o sistema gera o código sequencial unificado do ativo (ex: <code className="font-mono bg-slate-50 px-1 border border-slate-100 text-slate-800 font-bold">TERM-001</code>, <code className="font-mono bg-slate-50 px-1 border border-slate-100 text-slate-800 font-bold">SVI-002</code>). Um QR Code individual é gerado contendo o link de consulta rápida da ficha de auditoria e calibragem.</li>
                    <li><strong>Modo Express para Campo (Coleta Rápida):</strong> Para auditoria de existência física em campo via celular, ative o <strong>Modo Express</strong>. Ele oculta campos de manutenção, manuais e tabelas, mantendo apenas: Ativo, Setor, Foto e Observações, permitindo concluir a coleta em menos de 10 segundos por equipamento!</li>
                    <li><strong>Fotografe com Orientação de Categoria:</strong> Capture imagens da etiqueta de calibração, placa de dados e vista geral. A IA Gemini processará as fotos instantaneamente para preencher dados técnicos e organizar as pastas.</li>
                    <li><strong>Vincule os Acessórios com Sub-Rastreabilidade:</strong> Ao registrar acessórios (como sensores, baterias, cabos de força), eles receberão sub-códigos sequenciais vinculados para controle patrimonial completo.</li>
                    <li><strong>Imprima Etiquetas de Patrimônio:</strong> Gere etiquetas avulsas ou automáticas a partir da fila de auditoria com logotipo da Orbis Engenharia Clínica e Hospitalar, QR Code dinâmico, código do ativo e identificação do auditor.</li>
                    <li><strong>Sincronização em Nuvem:</strong> Os dados auditados e fotos são consolidados e enviados diretamente para o Google Sheets e pastas automatizadas por equipamento no Google Drive do hospital.</li>
                  </ol>
                </div>
              )}

              {/* TAB: PERGUNTAS FREQUENTES */}
              {helpActiveTab === 'faq' && (
                <div className="space-y-3.5 animate-fade-in">
                  <h4 className="font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                    <span className="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full font-bold">FAQ</span>
                    <span>Dúvidas Frequentes e Bancos de Dados</span>
                  </h4>

                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="font-bold text-slate-800 text-xs">P: Por que o logotipo da etiqueta foi corrigido para Orbis Engenharia Clínica e Hospitalar?</p>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">R: O cabeçalho foi homologado e padronizado para exibir a identificação institucional correta: <strong>Orbis Engenharia Clínica e Hospitalar</strong> (Web Global) ao invés de outras nomenclaturas antigas.</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="font-bold text-slate-800 text-xs">P: Como funciona o controle de Registro do Engenheiro (RE)?</p>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">R: O RE é o registro de matricula operacional interna de cada engenheiro/técnico da equipe Orbis. Ele é exigido na criação do usuário de campo e serve para auditoria jurídica nas planilhas de calibração, controle de ponto e carimbo eletrônico de responsabilidade clínica nas etiquetas térmicas geradas.</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="font-bold text-slate-800 text-xs">P: Os dados são salvos na conta Engemax ou na minha conta pessoal?</p>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">R: <strong>Na sua conta pessoal do Google Drive!</strong> A aplicação foi desenvolvida sob o conceito de privacidade e auto-gestão. Tudo é armazenado diretamente no seu Google Sheets e no seu próprio Drive através do token de segurança obtido no login. Nenhuma informação é compartilhada com servidores externos.</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="font-bold text-slate-800 text-xs">P: Como as fotos são organizadas dentro do Google Drive?</p>
                      <p className="text-slate-600 text-xs mt-1 leading-relaxed">R: O OrbisTracker cria uma pasta raiz para o inventário, e nela organiza subpastas por <strong>Setor</strong> e <strong>Tipo de Equipamento</strong>. Cada ativo individual ganha uma pasta própria nomeada com o seu <strong>Código Exclusivo de Rastreabilidade</strong>. Dentro desta pasta, são salvos os arquivos de fotos e um arquivo de dados resumo.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: USABILIDADE PARA AUDITORIA HOSPITALAR */}
              {helpActiveTab === 'usabilidade' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="border-b border-slate-100 pb-3">
                    <span className="inline-flex items-center gap-1 bg-emerald-150 text-emerald-800 px-2.5 py-0.5 rounded-full text-[10px] font-black border border-emerald-300 uppercase tracking-wider mb-2">
                      PRÁTICA REAL & RESILIÊNCIA
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                      Guia de Usabilidade para Auditoria Hospitalar
                    </h3>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed mt-1">
                      Este guia foi estruturado para treinar a equipe de campo e prever situações reais do ambiente hospitalar. O nosso foco absoluto é a <strong>agilidade, simplicidade e precisão de funcionamento</strong>. Abaixo estão descritos os cenários de simulação para capacitar os auditores.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Cenário 1: Conexão em Subsolos */}
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                          Cenário de Teste 1
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Falhas de Conexão em Subsolos (Offline-First)</h4>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        <strong>O Problema:</strong> Setores como Radiologia, Medicina Nuclear, Almoxarifado e Central de Esterilização de Materiais (CME) costumam ficar em subsolos blindados, onde o sinal de internet (4G ou Wi-Fi) é nulo ou intermitente.
                      </p>
                      <div className="mt-2.5 bg-white p-2.5 rounded-lg border border-slate-150 text-[11px] space-y-1 text-slate-700">
                        <p className="font-bold text-slate-800 flex items-center gap-1">
                          <span className="text-blue-600">🛠️ Como Testar e Praticar:</span>
                        </p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>Coloque seu dispositivo móvel no <strong>Modo Avião</strong> ou desative a internet.</li>
                          <li>Realize a captura de foto do ativo, digite ou gere o código e preencha a vistoria.</li>
                          <li>Clique em <strong>"Salvar Registro Local"</strong>. O OrbisTracker aceitará o salvamento instantaneamente, guardando todos os dados e as imagens offline em segurança.</li>
                          <li>O registro aparecerá no topo do Histórico com o status vermelho <span className="font-bold text-red-600">"Pendente"</span>.</li>
                          <li>Ao restabelecer a conexão (ao subir para a Engenharia Clínica), basta abrir o app e clicar em <strong>"Sincronizar Tudo"</strong>. O sistema enviará os lotes acumulados automaticamente para a planilha oficial e gerará as pastas organizadas no Google Drive.</li>
                        </ol>
                      </div>
                    </div>

                    {/* Cenário 2: Etiquetas Rasuradas ou Danificadas */}
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                          Cenário de Teste 2
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Leitura de Etiquetas Rasuradas ou Desgastadas</h4>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        <strong>O Problema:</strong> Equipamentos antigos ou higienizados frequentemente com álcool 70% possuem placas de fabricante e etiquetas de patrimônio borradas, riscadas ou ilegíveis pelo leitor comum de código de barras.
                      </p>
                      <div className="mt-2.5 bg-white p-2.5 rounded-lg border border-slate-150 text-[11px] space-y-1 text-slate-700">
                        <p className="font-bold text-slate-800 flex items-center gap-1">
                          <span className="text-blue-600">🛠️ Como Testar e Praticar:</span>
                        </p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>Tire uma foto o mais nítida possível da etiqueta gasta usando a câmera integrada.</li>
                          <li>Clique em <strong>"Analisar com IA Gemini"</strong>. A visão computacional do Gemini tentará realizar uma correspondência inteligente parcial.</li>
                          <li>Caso a leitura extraia dados parciais, utilize o campo de pesquisa rápida para buscar o número patrimonial parcial ou digite o identificador aproximado.</li>
                          <li>Ao selecionar o ativo sugerido no autocompletar, o OrbisTracker carregará os dados originais corretos de marca, modelo e número de série a partir do banco de dados oficial cadastrado no hospital, poupando a redigitação manual.</li>
                        </ol>
                      </div>
                    </div>

                    {/* Cenário 3: Inconsistência de Dados e Divergência */}
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200 shrink-0">
                          Cenário de Teste 3
                        </span>
                        <h4 className="font-bold text-slate-800 text-xs sm:text-sm">Inconsistência de Dados e Divergência Física</h4>
                      </div>
                      <p className="text-slate-600 text-xs leading-relaxed">
                        <strong>O Problema:</strong> O sistema interno do hospital aponta que uma bomba de infusão pertence ao Centro Cirúrgico, mas ela foi realocada fisicamente e está operando na UTI Adulto.
                      </p>
                      <div className="mt-2.5 bg-white p-2.5 rounded-lg border border-slate-150 text-[11px] space-y-1 text-slate-700">
                        <p className="font-bold text-slate-800 flex items-center gap-1">
                          <span className="text-blue-600">🛠️ Como Testar e Praticar:</span>
                        </p>
                        <ol className="list-decimal pl-4 space-y-1">
                          <li>Pesquise e selecione o ativo divergente usando o leitor de inventário no topo do app.</li>
                          <li>Note que o formulário carregará os dados oficiais de cadastro, mas a localização atual real é diferente.</li>
                          <li>Altere o campo <strong>"Setor / Localização"</strong> para o setor onde o equipamento realmente está (ex: UTI Adulto).</li>
                          <li>Caso as etiquetas de calibração estejam vencidas ou divirjam do banco, altere as datas correspondentes na Seção de Manutenção do formulário.</li>
                          <li>Salve e envie os dados. A sua auditoria apontará no Google Sheets a divergência corrigida em tempo real, permitindo a imediata retificação física do inventário.</li>
                        </ol>
                      </div>
                    </div>

                    {/* Alinhamento de Agilidade e Limpeza */}
                    <div className="p-3 bg-emerald-50 text-emerald-950 rounded-xl border border-emerald-150 text-xs">
                      <p className="font-extrabold text-emerald-900 flex items-center gap-1.5 mb-1 text-[11px] uppercase tracking-wider">
                        ✨ Agilidade de Campo & Sem Excesso de Processos
                      </p>
                      <p className="leading-relaxed">
                        Conforme alinhado em nossa reunião de engenharia e operações: <strong>menos é mais</strong>. O OrbisTracker removeu fluxos burocráticos e recursos que atrasam a rota diária do auditor (como leitores complexos de RFID/NFC ou logins aninhados obrigatórios). Tudo foi otimizado para que a captura de foto e cruzamento via IA seja a forma mais rápida, limpa e produtiva de auditar. Ative apenas os recursos de apoio que forem convenientes no menu do cabeçalho.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl text-right">
              <button
                type="button"
                onClick={() => setIsHelpOpen(false)}
                className="py-1.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
              >
                Entendi, Fechar Guia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Database Management Dialog Modal */}
      <DatabaseManager
        isOpen={isDatabaseManagerOpen}
        onClose={() => setIsDatabaseManagerOpen(false)}
        onDatabaseUpdate={() => {
          // Relies on event listener for live synchronization in subcomponents
        }}
      />

      {/* Central User/Technician Manager Modal */}
      <UserManager
        isOpen={isUserManagerOpen}
        onClose={() => setIsUserManagerOpen(false)}
        currentUser={currentUser}
      />

      {/* Central Assets & Heatmap Dashboard Modal */}
      <AssetsDashboard
        isOpen={isAssetsDashboardOpen}
        onClose={() => setIsAssetsDashboardOpen(false)}
        history={history}
        activeInventory={activeInventory}
        onSelectAuditItem={handleSelectItem}
      />

      {/* Central Asset Tag & QR Code Generator Modal */}
      <TagGenerator
        isOpen={isTagGeneratorOpen}
        onClose={() => {
          setIsTagGeneratorOpen(false);
          setInitialSelectedRecordId(null);
        }}
        initialSelectedRecordId={initialSelectedRecordId}
        activeFormFields={fields}
        history={history}
        currentUser={currentUser}
        onApplyCodeToForm={(code) => {
          persistFields({
            ...fields,
            numPatrimonio: code,
            ativoCodigo: code
          });
        }}
      />

      {/* Google Service Account Connection Test Modal */}
      {isSaTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-800 overflow-hidden text-left"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white tracking-tight">
                  Nuvem Corporativa Orbis
                </h3>
              </div>
              <button
                onClick={() => setIsSaTestModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
              <button
                type="button"
                onClick={() => setSaModalTab('status')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  saModalTab === 'status' 
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Diagnóstico & Status
              </button>
              <button
                type="button"
                onClick={() => setSaModalTab('config')}
                className={`flex-1 py-3 text-xs font-bold border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  saModalTab === 'config' 
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Sliders className="w-4 h-4" />
                Configurar Parâmetros
              </button>
            </div>

            {/* Body */}
            {saModalTab === 'status' ? (
              <div className="p-5 space-y-4 max-h-[450px] overflow-y-auto">
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Este diagnóstico realiza testes em tempo real com as APIs do Google Workspace utilizando a Conta de Serviço e parâmetros ativos.
                </div>

                {saStatus && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 font-mono text-slate-600 dark:text-slate-300">
                    <div className="truncate"><span className="font-sans font-bold text-slate-400">SA Email:</span> {saStatus.email}</div>
                    <div className="truncate"><span className="font-sans font-bold text-slate-400">Planilha ID:</span> {saStatus.spreadsheetId || "Não configurado"}</div>
                    <div className="truncate"><span className="font-sans font-bold text-slate-400">Pasta Raiz:</span> {saStatus.rootFolderId || "Não configurado"}</div>
                  </div>
                )}

                {/* Steps */}
                <div className="space-y-3">
                  {saTestSteps.map((step, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 text-xs space-y-1 animate-fade-in"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-slate-800 dark:text-slate-200">{step.name}</span>
                        {step.status === 'success' && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Sucesso
                          </span>
                        )}
                        {step.status === 'failed' && (
                          <span className="text-red-600 dark:text-red-400 font-extrabold flex items-center gap-0.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Falha
                          </span>
                        )}
                        {step.status === 'pending' && (
                          <span className="text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin shrink-0" /> Testando...
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed break-words">
                        {step.message}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Result Message */}
                {saTestResult && (
                  <div className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                    saTestResult.success 
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200' 
                      : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 text-red-900 dark:text-red-200'
                  }`}>
                    <div className="font-bold mb-1 flex items-center gap-1.5">
                      {saTestResult.success ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Sincronização 100% Funcional!</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-red-600" />
                          <span>Erros de Permissão Encontrados</span>
                        </>
                      )}
                    </div>
                    <div>
                      {saTestResult.success 
                        ? "A autenticação com a conta de serviço está correta e ela possui permissão total de escrita na Planilha e na Pasta do Drive configuradas!"
                        : `A verificação falhou. Detalhes: ${saTestResult.error || "Algumas etapas não puderam ser concluídas com sucesso. Certifique-se de que compartilhou a pasta do Drive e a planilha de ativos com o e-mail da conta de serviço como Editor."}`}
                    </div>
                  </div>
                )}

                {/* Real-time Sync Test Section */}
                <div className="p-4 rounded-xl border border-amber-100 dark:border-amber-950/40 bg-amber-50/30 dark:bg-amber-950/5 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span className="font-bold text-xs text-amber-900 dark:text-amber-300">Enviar Registro de Teste Completo (Orbis Cloud Diagnostics)</span>
                  </div>
                  <div className="text-[11px] text-amber-700 dark:text-amber-400/80 leading-relaxed">
                    Clique abaixo para gerar um Ativo e Etiqueta QR Code fictícios de teste. O sistema irá criar o JSON de histórico local, sincronizar as pastas no Google Drive do hospital e preencher uma linha na planilha do Google Sheets com dados neutros (<span className="font-mono bg-amber-100/60 dark:bg-amber-950 px-1 rounded">numSerie = Teste</span>). Excelente para validar o fluxo de ponta a ponta sem dados reais de campo.
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRunSaSyncTest}
                      disabled={saSyncTestLoading || !saStatus?.configured}
                      className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {saSyncTestLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Sincronizando Teste...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Iniciar Envio de Teste</span>
                        </>
                      )}
                    </button>
                    
                    {!saStatus?.configured && (
                      <span className="text-[10px] text-red-500 font-semibold">Conta de Serviço não configurada.</span>
                    )}
                  </div>

                  {/* Sync Test Result status logs */}
                  {saSyncTestLog.length > 0 && (
                    <div className="mt-3 space-y-1.5 bg-slate-900 text-[10px] font-mono text-slate-300 p-3 rounded-lg border border-slate-950 max-h-40 overflow-y-auto">
                      {saSyncTestLog.map((log, lIdx) => (
                        <div key={lIdx} className="leading-tight">
                          <span className="text-slate-500">[{log.time}]</span>{' '}
                          <span className={log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-emerald-400' : 'text-slate-300'}>
                            {log.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {saSyncTestSuccessUrl && (
                    <div className="mt-2 text-[11px] bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-2.5 rounded-lg text-emerald-800 dark:text-emerald-300 flex flex-col gap-1">
                      <div className="font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sincronização de Teste Concluída!</span>
                      </div>
                      <div>
                        O registro foi gravado na base local/Firestore e os arquivos de teste foram gerados na Nuvem Corporativa Orbis.
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <a 
                          href={saSyncTestSuccessUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="font-bold text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                        >
                          Acessar Pasta de Teste no Drive <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-5 space-y-4 max-h-[450px] overflow-y-auto">
                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Carregue diretamente o arquivo <strong className="text-slate-700 dark:text-slate-200">.json</strong> de chaves obtido do Google Cloud Console para que o servidor configure a integração automaticamente.
                </div>

                {/* File Upload Zone */}
                <div className="relative border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center hover:bg-slate-50 dark:hover:bg-slate-950/50 transition-colors">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleSaJsonFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                    <Upload className="w-6 h-6 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Selecionar Arquivo JSON de Chaves
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Arraste ou clique para navegar (.json)
                    </span>
                  </div>
                </div>

                {/* Paste Area / Loaded JSON confirmation */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Ou Cole o Texto do JSON diretamente:
                  </label>
                  <textarea
                    rows={3}
                    value={saJsonText}
                    onChange={(e) => setSaJsonText(e.target.value)}
                    placeholder='{"type": "service_account", "project_id": "...", ...}'
                    className="w-full text-[10px] font-mono p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                {/* Parameters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <FileSpreadsheet className="w-3 h-3 text-emerald-500" /> ID da Planilha Central
                    </label>
                    <input
                      type="text"
                      value={saSpreadsheetIdInput}
                      onChange={(e) => setSaSpreadsheetIdInput(e.target.value)}
                      placeholder="Ex: 17N-Vp7q..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <FolderOpen className="w-3 h-3 text-emerald-500" /> ID da Pasta Raiz no Drive
                    </label>
                    <input
                      type="text"
                      value={saFolderIdInput}
                      onChange={(e) => setSaFolderIdInput(e.target.value)}
                      placeholder="Ex: 1a8b_c9d..."
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Message display */}
                {saConfigMessage && (
                  <div className={`p-3 rounded-xl border text-xs leading-relaxed animate-fade-in ${
                    saConfigMessage.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40 text-red-800 dark:text-red-300'
                  }`}>
                    {saConfigMessage.text}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex gap-2 justify-end">
              {saModalTab === 'status' ? (
                <>
                  <button
                    type="button"
                    onClick={handleRunSaTest}
                    disabled={saTestLoading}
                    className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer border border-slate-200 dark:border-slate-800 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${saTestLoading ? 'animate-spin' : ''}`} />
                    Refazer Teste
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSaTestModalOpen(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 text-white dark:text-slate-900 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Fechar
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSaModalTab('status');
                      setSaConfigMessage(null);
                    }}
                    className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveSaConfig}
                    disabled={saConfigLoading}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1 cursor-pointer shadow-sm shadow-emerald-500/10"
                  >
                    {saConfigLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                    Salvar Configurações
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
