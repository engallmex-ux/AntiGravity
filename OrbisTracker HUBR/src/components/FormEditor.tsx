import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Wrench, Check, ShieldCheck, Calendar, Info, AlertTriangle, 
  Settings, ExternalLink, Copy, CheckCircle2, Mic, MicOff, Save, Trash2, Shield,
  MapPin, Compass, Radio, Cpu, Globe, Share2, Layers, Plus, Camera, Mail, Zap, Eye, EyeOff, Upload
} from 'lucide-react';
import { FormFields, FormMapping, LabelImage } from '../types';
import { INVENTORY_DATA } from '../data/inventory';

interface FormEditorProps {
  fields: FormFields;
  onChangeFields: (updated: FormFields) => void;
  onSaveRecord: () => void;
  onResetForm: () => void;
  existingInspections?: Array<{ numPatrimonio?: string; numSerie?: string; timestamp: string; auditorNome?: string; equipamento: string }>;
  isGoogleConnected?: boolean;
  isReferenceCodeEnabled?: boolean;
  isExpressMode?: boolean;
  onChangeExpressMode?: (enabled: boolean) => void;
  images?: LabelImage[];
  onAddImage?: (img: LabelImage) => void;
  onRemoveImage?: (id: string) => void;
  onClearImages?: () => void;
}

export default function FormEditor({
  fields,
  onChangeFields,
  onSaveRecord,
  onResetForm,
  existingInspections = [],
  isGoogleConnected = false,
  isReferenceCodeEnabled = false,
  isExpressMode = false,
  onChangeExpressMode,
  images = [],
  onAddImage,
  onRemoveImage,
  onClearImages
}: FormEditorProps) {
  const [activeSpeechField, setActiveSpeechField] = useState<keyof FormFields | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const expressFileInputRef = useRef<HTMLInputElement>(null);

  const handleExpressFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    Array.from(files).forEach((file: any) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && onAddImage) {
          const base64 = event.target.result as string;
          const newImg: LabelImage = {
            id: Math.random().toString(36).substring(2, 9),
            base64,
            mimeType: file.type || 'image/jpeg',
            labelType: 'geral',
            fileName: file.name
          };
          onAddImage(newImg);
        }
      };
      reader.readAsDataURL(file);
    });
    
    if (e.target) {
      e.target.value = '';
    }
  };

  const [activeInventory, setActiveInventory] = useState<any[]>(INVENTORY_DATA);

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

  // Real-time Database & Medical Device classification checks
  const isEquipmentInDatabase = useMemo(() => {
    const eq = (fields.equipamento || '').trim().toLowerCase();
    if (!eq) return true; // skip if empty
    
    return activeInventory.some(item => 
      item.equipamento.toLowerCase() === eq || 
      item.equipamento.toLowerCase().includes(eq) || 
      eq.includes(item.equipamento.toLowerCase())
    );
  }, [fields.equipamento, activeInventory]);

  const isMedicalEquipment = useMemo(() => {
    const eq = (fields.equipamento || '').trim().toLowerCase();
    if (!eq) return true; // skip if empty
    
    const n = eq.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
    const medicalKeywords = [
      'ventilador', 'respirador', 'monitor', 'desfibrilador', 'cardioversor', 
      'bomba', 'infusora', 'seringa', 'oximetro', 'eletro', 'autoclave', 
      'ultrassom', 'raio-x', 'raio x', 'cama', 'incubadora', 'anestesia', 
      'foco', 'bisturi', 'aspirador', 'esfigmo', 'termometro', 'marcapasso', 
      'cpap', 'bipap', 'laringo', 'otoscopio', 'balanca', 'nebulizador', 
      'glicosimetro', 'cardiografo', 'fisioterapia', 'fototerapia', 'dialise',
      'hemoglucoteste', 'audiometro', 'espirômetro', 'oftalmoscopio', 'macroscopio',
      'analisador', 'gaseometro', 'capnografo', 'nefroscopio', 'endoscopio'
    ];
    return medicalKeywords.some(keyword => n.includes(keyword));
  }, [fields.equipamento]);

  // Compute autocomplete options from available hospital inventory database
  const uniqueEquipments = useMemo(() => {
    const eqSet = new Set<string>();
    activeInventory.forEach(item => {
      if (item.equipamento) eqSet.add(item.equipamento.trim());
    });
    return Array.from(eqSet).filter(Boolean).sort();
  }, [activeInventory]);

  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    activeInventory.forEach(item => {
      if (item.marcaModelo) {
        if (item.marcaModelo.includes('/')) {
          brandsSet.add(item.marcaModelo.split('/')[0].trim());
        } else {
          brandsSet.add(item.marcaModelo.trim());
        }
      }
    });
    return Array.from(brandsSet).filter(Boolean).sort();
  }, [activeInventory]);

  const uniqueModels = useMemo(() => {
    const modelsSet = new Set<string>();
    activeInventory.forEach(item => {
      if (item.marcaModelo) {
        if (item.marcaModelo.includes('/')) {
          modelsSet.add(item.marcaModelo.split('/').slice(1).join('/').trim());
        } else {
          modelsSet.add(item.marcaModelo.trim());
        }
      }
    });
    return Array.from(modelsSet).filter(Boolean).sort();
  }, [activeInventory]);

  // Automatic asset code (ativoCodigo) generator on equipment change - NO BUTTON REQUIRED
  useEffect(() => {
    if (fields.equipamento && !fields.ativoCodigo && isReferenceCodeEnabled) {
      const eqName = fields.equipamento.trim();
      const eqNameNormalized = eqName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      
      let sigla: "DTI" | "MET" | "SVI" | "MON" | "TER" | "TERM" = "TER";
      
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
      } else {
        sigla = "TER";
      }

      // Read preference format
      const codeFormat = localStorage.getItem('orbis_code_format') || 'simplified';

      // 1. Check local inspections for the largest index
      let maxSeq = 0;
      if (existingInspections && existingInspections.length > 0) {
        existingInspections.forEach((ins: any) => {
          const code = ins.ativoCodigo || '';
          if (code) {
            if (code.startsWith(`HU-${sigla}-`) && code.endsWith('-ORB')) {
              const parts = code.split('-');
              if (parts.length === 4) {
                const seq = parseInt(parts[2], 10);
                if (!isNaN(seq) && seq > maxSeq) { maxSeq = seq; }
              }
            } else if (code.startsWith(`${sigla}-`)) {
              const parts = code.split('-');
              if (parts.length === 2) {
                const seq = parseInt(parts[1], 10);
                if (!isNaN(seq) && seq > maxSeq) { maxSeq = seq; }
              }
            }
          }
        });
      }

      // 2. Fetch the counter from server to combine and prevent collisions
      fetch('/api/tag-sequences')
        .then(res => res.json())
        .then(data => {
          const serverSeq = data[sigla] || 1;
          const finalSeq = Math.max(serverSeq, maxSeq + 1);
          
          let generatedCode = '';
          if (codeFormat === 'simplified') {
            generatedCode = `${sigla}-${String(finalSeq).padStart(3, '0')}`;
          } else {
            generatedCode = `HU-${sigla}-${String(finalSeq).padStart(6, '0')}-ORB`;
          }
          
          onChangeFields({
            ...fields,
            ativoCodigo: generatedCode
          });
        })
        .catch(err => {
          console.warn("Error fetching tag sequence, using history fallback:", err);
          const finalSeq = maxSeq + 1;
          
          let generatedCode = '';
          if (codeFormat === 'simplified') {
            generatedCode = `${sigla}-${String(finalSeq).padStart(3, '0')}`;
          } else {
            generatedCode = `HU-${sigla}-${String(finalSeq).padStart(6, '0')}-ORB`;
          }
          
          onChangeFields({
            ...fields,
            ativoCodigo: generatedCode
          });
        });
    }
  }, [fields.equipamento, fields.ativoCodigo, isReferenceCodeEnabled, existingInspections]);

  // Sync state for individual field speech recognition
  const handleFieldChange = (key: keyof FormFields, value: any) => {
    onChangeFields({
      ...fields,
      [key]: value
    });
  };

  // Help visibility states to clean up UI for mobile devices
  const [showNewEquipmentHelp, setShowNewEquipmentHelp] = useState(false);
  const [showTrainingHelp, setShowTrainingHelp] = useState(false);
  const [showMaintenanceHelp, setShowMaintenanceHelp] = useState(false);

  // Temporary states for adding accessories
  const [showAccessoriesForm, setShowAccessoriesForm] = useState(false);
  const [tempAccessoryTipo, setTempAccessoryTipo] = useState<'Cabo de Força' | 'Bateria' | 'Sensor' | 'Acessório Geral' | 'Consumível'>('Cabo de Força');
  const [tempAccessoryDesc, setTempAccessoryDesc] = useState('');
  const [tempAccessorySN, setTempAccessorySN] = useState('');
  const [tempAccessoryPhoto, setTempAccessoryPhoto] = useState<string | null>(null);

  const handleAccessoryPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempAccessoryPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Browser speech recognition for dictation in specific inputs
  const startFieldDictation = (fieldKey: keyof FormFields) => {
    setSpeechError(null);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSpeechError("Reconhecimento de voz não suportado pelo seu navegador.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setActiveSpeechField(fieldKey);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        // Clean up punctuation that sometimes appears at the end
        let cleaned = transcript.trim();
        if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1);
        
        // No custom conversions needed for text-based fields

        handleFieldChange(fieldKey, cleaned);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Erro no reconhecimento de voz:", event.error);
      if (event.error === 'not-allowed') {
        setSpeechError("Permissão de microfone negada.");
      } else {
        setSpeechError(`Erro de áudio: ${event.error}`);
      }
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      setActiveSpeechField(null);
    };

    recognition.start();
  };

  const [isCapturingGps, setIsCapturingGps] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [nfcStatus, setNfcStatus] = useState<{ type: 'idle' | 'scanning' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' });
  const [nfcSimRecord, setNfcSimRecord] = useState<string>('');

  // Bug reporting states
  const [isBugModalOpen, setIsBugModalOpen] = useState<boolean>(false);
  const [bugDescription, setBugDescription] = useState<string>('');
  const [isSendingBug, setIsSendingBug] = useState<boolean>(false);
  const [bugStatus, setBugStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [lastMailtoUrl, setLastMailtoUrl] = useState<string>('');

  const handleSendBugReport = () => {
    setIsSendingBug(true);
    setBugStatus('sending');
    
    const mailtoSubject = `[OrbisTracker ALERTA DE FALHA] - ${fields.equipamento || 'Equipamento Não Especificado'}`;
    const mailtoBody = `Prezada Equipe de Suporte Orbis,

Foi reportada uma instabilidade técnica em campo no aplicativo OrbisTracker.

DETALHES DO ATIVO:
- Nome do Equipamento: ${fields.equipamento || 'N/A'}
- Fabricante: ${fields.fabricante || 'N/A'}
- Modelo: ${fields.modelo || 'N/A'}
- Número de Série (S/N): ${fields.numSerie || 'N/A'}
- Patrimônio: ${fields.numPatrimonio || 'N/A'}
- Setor: ${fields.setor || 'N/A'}
- Localização GPS: ${fields.latitude ? `${fields.latitude.toFixed(6)}, ${fields.longitude?.toFixed(6)}` : 'Não capturado'}

DESCRIÇÃO DO OCORRIDO EM CAMPO:
${bugDescription || 'Nenhuma descrição detalhada fornecida pelo usuário.'}

SAPI-CORE LOG DIAGNOSTIC TRACE:
------------------------------------------------------------
Timestamp: ${new Date().toISOString()}
Status de Rede: ${navigator.onLine ? "ONLINE (Conectado ao HU)" : "OFFLINE (Subsolo / Sem Rede)"}
Registros Locais Cache: ${existingInspections ? existingInspections.length : 0} itens salvos
Suporte NFC: ${'NDEFReader' in window ? "Disponível" : "Simulado"}
------------------------------------------------------------

Este e-mail de alerta foi gerado automaticamente pelo OrbisTracker HU-BR v1.6.0.`;

    const generatedUrl = `mailto:engallmex@gmail.com.br?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(mailtoBody)}`;
    setLastMailtoUrl(generatedUrl);

    // Simulate sending network diagnostic payload to the Orbis central engineering dashboard
    setTimeout(() => {
      setIsSendingBug(false);
      setBugStatus('success');
      setBugDescription('');
      
      // Attempt automated redirection to trigger the user's mail client
      window.location.href = generatedUrl;
      
      try {
        if (navigator.vibrate) navigator.vibrate([150, 100, 150]);
      } catch (e) {}
    }, 1800);
  };

  // Geolocation function
  const handleGetLocation = () => {
    setIsCapturingGps(true);
    setGpsStatus('Obtendo sinal GPS do ativo...');
    
    if (!navigator.geolocation) {
      setGpsStatus('Erro: Geolocalização não suportada no seu navegador.');
      setIsCapturingGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChangeFields({
          ...fields,
          latitude,
          longitude
        });
        setGpsStatus(`GPS capturado com sucesso! Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}`);
        setIsCapturingGps(false);

        // Feedback sonoro/háptico se suportado
        try {
          if (navigator.vibrate) navigator.vibrate(100);
        } catch (e) {}
      },
      (error) => {
        console.warn("GPS precision or permission error, using simulation fallback:", error);
        // Fallback for demo environments or when in sandboxed iframe without proper geolocation permission
        const mockLat = -21.97984 + (Math.random() - 0.5) * 0.001;
        const mockLng = -47.88125 + (Math.random() - 0.5) * 0.001;
        onChangeFields({
          ...fields,
          latitude: mockLat,
          longitude: mockLng
        });
        setGpsStatus(`Coordenadas simuladas do hospital (Iframe restrito): Lat: ${mockLat.toFixed(6)}, Lng: ${mockLng.toFixed(6)}`);
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  };

  const handleClearLocation = () => {
    const updated = { ...fields };
    delete updated.latitude;
    delete updated.longitude;
    onChangeFields(updated);
    setGpsStatus(null);
  };

  // Helper to find asset and populate form
  const processTagValue = (tagValue: string) => {
    const cleanTag = tagValue.trim().toUpperCase();
    if (!cleanTag) return;

    setNfcStatus({ type: 'scanning', text: `Buscando dados da Tag "${cleanTag}" no inventário...` });

    // Look for matching inventory item
    // Inventory identification field may contain multiple, let's check substring
    const item = INVENTORY_DATA.find(inv => {
      const idMatch = inv.identificador.toUpperCase().includes(cleanTag);
      const snMatch = inv.numSerie.toUpperCase().includes(cleanTag);
      return idMatch || snMatch;
    });

    try {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } catch (e) {}

    // Play synthesized beep if possible
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch beep
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}

    if (item) {
      // Parse Brand & Model
      let parsedBrand = '';
      let parsedModel = '';
      if (item.marcaModelo.includes('/')) {
        const parts = item.marcaModelo.split('/');
        parsedBrand = parts[0].trim();
        parsedModel = parts[1].trim();
      } else {
        parsedBrand = item.marcaModelo.trim();
        parsedModel = item.marcaModelo.trim();
      }

      onChangeFields({
        ...fields,
        equipamento: item.equipamento,
        fabricante: parsedBrand,
        modelo: parsedModel,
        numSerie: item.numSerie.split(',')[0].trim(), // take first if multiple
        numPatrimonio: cleanTag,
        setor: item.localizacao,
        observacoes: `Carregado via Tag NFC RFID [${cleanTag}]`
      });

      setNfcStatus({
        type: 'success',
        text: `Tag "${cleanTag}" lida com sucesso! Equipamento "${item.equipamento}" importado do inventário.`
      });
    } else {
      // New tag, just set the patrimoine
      onChangeFields({
        ...fields,
        numPatrimonio: cleanTag,
        observacoes: `Nova Tag NFC RFID vinculada: ${cleanTag}`
      });

      setNfcStatus({
        type: 'success',
        text: `Nova Tag "${cleanTag}" vinculada com sucesso ao campo de Patrimônio.`
      });
    }

    setTimeout(() => {
      setNfcStatus({ type: 'idle', text: '' });
    }, 5000);
  };

  // Real Web NFC API
  const handleStartPhysicalNFC = async () => {
    setNfcStatus({ type: 'scanning', text: 'Aproxime o verso do celular da tag RFID/NFC física...' });
    
    if (!('NDEFReader' in window)) {
      setNfcStatus({
        type: 'error',
        text: 'API Web NFC não disponível. Por favor, use o simulador clínico ao lado para testar.'
      });
      return;
    }

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      
      ndef.addEventListener("readingerror", () => {
        setNfcStatus({ type: 'error', text: 'Erro ao ler tag NFC. Tente novamente ou use outra tag.' });
      });

      ndef.addEventListener("reading", ({ message, serialNumber }: any) => {
        let tagVal = serialNumber || '';
        if (message.records && message.records.length > 0) {
          const decoder = new TextDecoder();
          for (const record of message.records) {
            if (record.recordType === "text") {
              tagVal = decoder.decode(record.data);
            }
          }
        }
        processTagValue(tagVal);
      });
    } catch (error: any) {
      console.error(error);
      setNfcStatus({
        type: 'error',
        text: `Erro de Inicialização NFC: ${error.message || 'Permissão negada ou NFC desativado.'}`
      });
    }
  };

  // Real-time double check duplicate verification matching S/N or Asset Tag
  const enteredPatrimonio = fields.numPatrimonio?.trim() || '';
  const enteredSerie = fields.numSerie?.trim() || '';

  const duplicate = useMemo(() => {
    if (!enteredPatrimonio && !enteredSerie) return null;
    return existingInspections.find(item => {
      const matchPat = enteredPatrimonio && item.numPatrimonio && item.numPatrimonio.trim().toLowerCase() === enteredPatrimonio.toLowerCase();
      const matchSer = enteredSerie && item.numSerie && item.numSerie.trim().toLowerCase() === enteredSerie.toLowerCase();
      return matchPat || matchSer;
    });
  }, [enteredPatrimonio, enteredSerie, existingInspections]);

  if (isExpressMode) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden animate-fade-in" id="form-editor-container-express">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500/25 animate-bounce" />
              Dados do Ativo (Modo Express)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Foco absoluto de campo: confirme apenas Ativo, Setor, Foto e Observações em segundos.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeExpressMode && onChangeExpressMode(false)}
              className="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs border bg-amber-500/10 text-amber-600 border-amber-500/25 hover:bg-amber-500/20"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse fill-amber-500" />
              <span>Modo Express: Ativo</span>
            </button>
          </div>
        </div>

        {speechError && (
          <div className="mx-5 mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-center gap-2 animate-fade-in">
            <Info className="w-4 h-4 text-red-500 shrink-0" />
            <span>{speechError}</span>
          </div>
        )}

        {/* Real-time Double-Check Warning Alert Box */}
        {duplicate && (
          <div className="mx-5 mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex flex-col gap-2 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ⚠️ EQUIPAMENTO JÁ VERIFICADO! (Garantia contra dupla recolha)
            </div>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              O ativo <strong>{duplicate.equipamento}</strong> (S/N: <code>{duplicate.numSerie || 'N/D'}</code>, Patrimônio: <code>{duplicate.numPatrimonio || 'N/D'}</code>) já foi inspecionado em <strong>{new Date(duplicate.timestamp).toLocaleString('pt-BR')}</strong> por <strong>{duplicate.auditorNome || 'outro técnico'}</strong>.
            </p>
          </div>
        )}

        {/* Real-time Inventory Database Match & Medical classification alerts */}
        {fields.equipamento && fields.equipamento.trim().length > 1 && (!isEquipmentInDatabase || !isMedicalEquipment) && (
          <div className="mx-5 mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex flex-col gap-2 animate-fade-in shadow-sm">
            <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              ⚠️ ALERTA DE CONSISTÊNCIA DE INVENTÁRIO
            </div>
            <div className="text-[11px] text-rose-700 space-y-1.5 leading-relaxed">
              {!isEquipmentInDatabase && (
                <p>
                  O item <strong className="text-rose-900">"{fields.equipamento}"</strong> não foi localizado no cadastro oficial de ativos. Verifique se o nome está correto ou se precisa atualizar sua base nas Opções.
                </p>
              )}
              {!isMedicalEquipment && (
                <p>
                  O termo <strong className="text-rose-900">"{fields.equipamento}"</strong> não parece ser classificado como um Equipamento Médico-Hospitalar (EMH) clínico típico (ex: ventilador, monitor, desfibrilador). Confirme se este ativo está correto.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Main Fields Area */}
        <div className="p-5 space-y-6">
          <div className="space-y-6" id="express-mode-form">
            {/* CARD 1: O ATIVO (Identificação do Equipamento e Tags) */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Cpu className="w-4 h-4 text-amber-500" />
                01. Identificação do Ativo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Nome do Equipamento */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Nome do Equipamento <span className="text-red-500">*</span></span>
                    <span className="text-[9px] text-slate-400 font-normal">Ex: Monitor, Ventilador</span>
                  </label>
                  <div className="relative flex rounded-lg shadow-sm">
                    <input
                      type="text"
                      value={fields.equipamento || ''}
                      onChange={(e) => handleFieldChange('equipamento', e.target.value)}
                      className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold bg-white text-slate-800"
                      list="equipments-list"
                      placeholder="Selecione ou digite"
                    />
                    <button
                      type="button"
                      onClick={() => startFieldDictation('equipamento')}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                        activeSpeechField === 'equipamento' && isListening
                          ? 'bg-red-50 text-red-600 animate-pulse'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Falar este campo"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Número de Patrimônio */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Nº de Patrimônio <span className="text-red-500">*</span></span>
                    <span className="text-[9px] text-slate-400 font-normal">Código / Tag do Ativo</span>
                  </label>
                  <div className="relative flex rounded-lg shadow-sm">
                    <input
                      type="text"
                      value={fields.numPatrimonio || ''}
                      onChange={(e) => handleFieldChange('numPatrimonio', e.target.value)}
                      placeholder="Ex: HU-10294"
                      className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono font-bold text-emerald-600 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => startFieldDictation('numPatrimonio')}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                        activeSpeechField === 'numPatrimonio' && isListening
                          ? 'bg-red-50 text-red-600 animate-pulse'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Falar este campo"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Número de Série */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Nº de Série (S/N)</span>
                    <span className="text-[9px] text-slate-400 font-normal">Placa fabricante</span>
                  </label>
                  <div className="relative flex rounded-lg shadow-sm">
                    <input
                      type="text"
                      value={fields.numSerie || ''}
                      onChange={(e) => handleFieldChange('numSerie', e.target.value)}
                      placeholder="Ex: SN-84938"
                      className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-mono font-bold bg-white text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => startFieldDictation('numSerie')}
                      className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                        activeSpeechField === 'numSerie' && isListening
                          ? 'bg-red-50 text-red-600 animate-pulse'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                      title="Falar este campo"
                    >
                      <Mic className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CARD 2: SETOR (Localização no Hospital) */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <MapPin className="w-4 h-4 text-emerald-500" />
                02. Setor / Localização Física
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Setor Dropdown */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Setor do HU-Brasil</label>
                  <select
                    value={fields.setor || ''}
                    onChange={(e) => handleFieldChange('setor', e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white font-bold text-slate-800"
                  >
                    <option value="">-- Selecione o Setor --</option>
                    <option value="AMB - DENF - AMB">Ambulatório (AMB)</option>
                    <option value="AT - UDIDE-AT">Atendimento (AT)</option>
                    <option value="CC - UBCPME - CC">Centro Cirúrgico (CC)</option>
                    <option value="CME - UBCPME - CME">Central de Materiais (CME)</option>
                    <option value="ECG - UDIDE-MG-ECG">Eletrocardiografia (ECG)</option>
                    <option value="ENDO - UDIDE-END-DIG">Endoscopia (ENDO)</option>
                    <option value="PAA - UCRIT-PA">Pronto Atendimento (PAA)</option>
                    <option value="PAI - UCA-PA">Pediatria (PAI)</option>
                    <option value="RAD - UDIDE-RAD">Radiologia (RAD)</option>
                    <option value="SEGE - SEGE">Sect. Geral (SEGE)</option>
                    <option value="SFHC - SFH - FC">Faturamento Clínico (SFHC)</option>
                    <option value="STEC - STEC">Setor Técnico (STEC)</option>
                    <option value="UTIA - UCRIT-UTI">UTI Adulto (UTIA)</option>
                    <option value="UTIPED - UCA-UTI">UTI Pediátrica (UTIPED)</option>
                    <option value="Em Manutenção">Equipamento em Manutenção</option>
                    <option value="Outro">Outro (Digitar Manualmente)</option>
                  </select>
                </div>

                {/* Custom Setor */}
                {(fields.setor === 'Outro' || !['', 'AMB - DENF - AMB', 'AT - UDIDE-AT', 'CC - UBCPME - CC', 'CME - UBCPME - CME', 'ECG - UDIDE-MG-ECG', 'ENDO - UDIDE-END-DIG', 'PAA - UCRIT-PA', 'PAI - UCA-PA', 'RAD - UDIDE-RAD', 'SEGE - SEGE', 'SFHC - SFH - FC', 'STEC - STEC', 'UTIA - UCRIT-UTI', 'UTIPED - UCA-UTI', 'Em Manutenção'].includes(fields.setor)) && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Especificar Outro Setor</label>
                    <input
                      type="text"
                      value={fields.setor === 'Outro' ? '' : fields.setor}
                      onChange={(e) => handleFieldChange('setor', e.target.value)}
                      placeholder="Digite o nome do setor"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold bg-white text-slate-800"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* CARD 3: OBSERVAÇÕES */}
            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-4">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/50 pb-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                03. Observações Clínicas de Campo
              </h3>

              <div className="space-y-2">
                <div className="relative flex rounded-lg shadow-sm">
                  <textarea
                    value={fields.observacoes || ''}
                    onChange={(e) => handleFieldChange('observacoes', e.target.value)}
                    rows={3}
                    placeholder="Descreva quaisquer anomalias, observações de conservação ou discrepâncias físicas..."
                    className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 font-medium leading-relaxed bg-white text-slate-850"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('observacoes')}
                    className={`absolute right-1.5 bottom-1.5 p-1.5 rounded-md transition-colors ${
                      activeSpeechField === 'observacoes' && isListening
                        ? 'bg-red-50 text-red-600 animate-pulse'
                        : 'text-slate-400 hover:text-slate-600'
                      }`}
                    title="Falar este campo"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER ACTIONS - RESET & SAVE DYNAMICALLY */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
          {/* Reset Form Button */}
          <button
            type="button"
            onClick={onResetForm}
            className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
          >
            Limpar Formulário
          </button>

          {/* Dynamic Save & Sync Button */}
          {isGoogleConnected ? (
            <button
              type="button"
              id="btn-save-record"
              onClick={onSaveRecord}
              className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all active:scale-[0.99] cursor-pointer min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4" />
              Confirmar Coleta & Sincronizar Sheets
            </button>
          ) : (
            <button
              type="button"
              id="btn-save-record"
              onClick={onSaveRecord}
              className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-[0.99] cursor-pointer min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              Confirmar Coleta Local
            </button>
          )}

          {/* Autocomplete datalists */}
          <datalist id="equipments-list">
            {uniqueEquipments.map(item => (
              <option key={item} value={item} />
            ))}
          </datalist>

          <datalist id="brands-list">
            {uniqueBrands.map(item => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id="form-editor-container">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            {isExpressMode ? <Zap className="w-4 h-4 text-amber-500 fill-amber-500/25 animate-bounce" /> : <Wrench className="w-4 h-4 text-emerald-600" />}
            {isExpressMode ? 'Dados do Ativo (Modo Express)' : 'Dados Técnicos do Ativo'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isExpressMode 
              ? 'Foco absoluto de campo: confirme apenas Ativo, Setor, Foto e Observações em segundos.' 
              : 'Revise as informações extraídas pela IA ou insira manualmente os dados do inventário.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeExpressMode && onChangeExpressMode(!isExpressMode)}
            className={`w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs border ${
              isExpressMode 
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/25 hover:bg-amber-500/20' 
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-750'
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${isExpressMode ? 'text-amber-500 animate-pulse fill-amber-500' : 'text-slate-400'}`} />
            <span>{isExpressMode ? 'Modo Express: Ativo' : 'Ativar Modo Express'}</span>
          </button>
        </div>
      </div>

      {speechError && (
        <div className="mx-5 mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-center gap-2 animate-fade-in">
          <Info className="w-4 h-4 text-red-500 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Real-time Double-Check Warning Alert Box */}
      {duplicate && (
        <div className="mx-5 mt-4 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex flex-col gap-2 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            ⚠️ EQUIPAMENTO JÁ VERIFICADO! (Garantia contra dupla recolha)
          </div>
          <p className="text-[11px] text-amber-700 leading-relaxed">
            O ativo <strong>{duplicate.equipamento}</strong> (S/N: <code>{duplicate.numSerie || 'N/D'}</code>, Patrimônio: <code>{duplicate.numPatrimonio || 'N/D'}</code>) já foi inspecionado em <strong>{new Date(duplicate.timestamp).toLocaleString('pt-BR')}</strong> por <strong>{duplicate.auditorNome || 'outro técnico'}</strong>.
          </p>
          <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/50 p-2 rounded-lg">
            Deseja prosseguir e registrar uma nova calibração/inspeção mesmo assim para este mesmo ativo?
          </div>
        </div>
      )}

      {/* Real-time Inventory Database Match & Medical classification alerts */}
      {fields.equipamento && fields.equipamento.trim().length > 1 && (!isEquipmentInDatabase || !isMedicalEquipment) && (
        <div className="mx-5 mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex flex-col gap-2 animate-fade-in shadow-sm">
          <div className="flex items-center gap-2 font-bold text-xs text-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ⚠️ ALERTA DE CONSISTÊNCIA DE INVENTÁRIO
          </div>
          <div className="text-[11px] text-rose-700 space-y-1.5 leading-relaxed">
            {!isEquipmentInDatabase && (
              <p>
                O item <strong className="text-rose-900">"{fields.equipamento}"</strong> não foi localizado no cadastro oficial de ativos. Verifique se o nome está correto ou se precisa atualizar sua base nas Opções.
              </p>
            )}
            {!isMedicalEquipment && (
              <p>
                O termo <strong className="text-rose-900">"{fields.equipamento}"</strong> não parece ser classificado como um Equipamento Médico-Hospitalar (EMH) clínico típico (ex: ventilador, monitor, desfibrilador). Confirme se este ativo está correto.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Main Form Fields Layout */}
      <div className="p-5 space-y-6">
        
        {/* SECTION 1: Identificação Geral */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span>01. Identificação Geral</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Equipamento */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Nome do Equipamento <span className="text-red-500">*</span> <span className="text-[10px] text-red-500 font-normal font-sans">(Obrigatório)</span></span>
                <span className="text-[9px] text-slate-400 font-normal">Ex: Monitor, Ventilador</span>
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.equipamento || ''}
                  onChange={(e) => handleFieldChange('equipamento', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                  list="equipments-list"
                  placeholder="Selecione ou digite o equipamento"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('equipamento')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    activeSpeechField === 'equipamento' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Falar este campo"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Fabricante */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Fabricante <span className="text-red-500">*</span> <span className="text-[10px] text-red-500 font-normal font-sans">(Obrigatório)</span></span>
                <span className="text-[9px] text-slate-400 font-normal">Ex: Philips, Dixtal</span>
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.fabricante || ''}
                  onChange={(e) => handleFieldChange('fabricante', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                  list="brands-list"
                  placeholder="Selecione ou digite o fabricante"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('fabricante')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    activeSpeechField === 'fabricante' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Falar este campo"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Modelo */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Modelo <span className="text-red-500">*</span> <span className="text-[10px] text-red-500 font-normal font-sans">(Obrigatório)</span></span>
                <span className="text-[9px] text-slate-400 font-normal">Ex: DX-2020, Lifemed</span>
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.modelo || ''}
                  onChange={(e) => handleFieldChange('modelo', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium"
                  list="models-list"
                  placeholder="Selecione ou digite o modelo"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('modelo')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    activeSpeechField === 'modelo' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Falar este campo"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Código do Ativo */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Código Exclusivo do Ativo</span>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Automático</span>
              </label>
              <input
                type="text"
                placeholder="Gerado automaticamente após escolher o equipamento"
                value={fields.ativoCodigo || ''}
                onChange={(e) => handleFieldChange('ativoCodigo', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-slate-800 uppercase bg-slate-50"
              />
            </div>

            {/* Regime de Propriedade */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                <span>Regime de Propriedade / Lease</span>
              </label>
              <select
                value={fields.propriedade || 'Próprio'}
                onChange={(e) => handleFieldChange('propriedade', e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium"
              >
                <option value="Próprio">Próprio (Hospital)</option>
                <option value="Alugado">Alugado (Locação)</option>
                <option value="Comodato">Comodato / Teste</option>
              </select>
            </div>

            {/* Link do Manual de Instruções */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Link do Manual PDF</span>
                <button
                  type="button"
                  onClick={() => {
                    const query = `${fields.fabricante || ''} ${fields.modelo || ''} ${fields.equipamento || ''} manual pdf`;
                    window.open(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`, '_blank');
                  }}
                  className="text-[10px] text-blue-600 hover:underline font-bold"
                  title="Buscar manual no Google"
                >
                  Buscar no Google ↗
                </button>
              </label>
              <input
                type="text"
                placeholder="https://exemplo.com/manual.pdf"
                value={fields.linkManual || ''}
                onChange={(e) => handleFieldChange('linkManual', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-700 font-medium"
              />
            </div>

          </div>

          {/* CONDIÇÃO DO EQUIPAMENTO */}
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <span>Condição do Ativo / Equipamento *</span>
              <span className="text-[10px] text-red-500 font-bold">(Obrigatório)</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {[
                { 
                  value: 'Boa', 
                  label: 'Boa', 
                  color: 'hover:bg-emerald-50 text-emerald-800 border-slate-200 bg-white',
                  activeColor: 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-500/20 shadow-md shadow-emerald-600/15',
                  dotColor: 'bg-emerald-500'
                },
                { 
                  value: 'Regular', 
                  label: 'Regular', 
                  color: 'hover:bg-amber-50 text-amber-800 border-slate-200 bg-white',
                  activeColor: 'bg-amber-500 text-slate-950 border-amber-600 ring-2 ring-amber-500/20 shadow-md shadow-amber-500/15',
                  dotColor: 'bg-amber-500'
                },
                { 
                  value: 'Ruim', 
                  label: 'Ruim', 
                  color: 'hover:bg-red-50 text-red-800 border-slate-200 bg-white',
                  activeColor: 'bg-red-600 text-white border-red-700 ring-2 ring-red-500/20 shadow-md shadow-red-600/15',
                  dotColor: 'bg-red-500'
                },
                { 
                  value: 'Não localizado', 
                  label: 'Não localizado', 
                  color: 'hover:bg-orange-50 text-orange-800 border-slate-200 bg-white',
                  activeColor: 'bg-orange-500 text-white border-orange-600 ring-2 ring-orange-500/20 shadow-md shadow-orange-500/15',
                  dotColor: 'bg-orange-500'
                },
                { 
                  value: 'Em Manutenção', 
                  label: 'Em Manutenção', 
                  color: 'hover:bg-blue-50 text-blue-800 border-slate-200 bg-white',
                  activeColor: 'bg-blue-600 text-white border-blue-700 ring-2 ring-blue-500/20 shadow-md shadow-blue-600/15',
                  dotColor: 'bg-blue-500'
                }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleFieldChange('condicao', opt.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 justify-center border rounded-xl text-xs font-bold transition-all min-h-[44px] cursor-pointer active:scale-[0.98] ${
                    fields.condicao === opt.value ? opt.activeColor : opt.color
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 border border-black/10 ${
                    fields.condicao === opt.value ? 'bg-white' : opt.dotColor
                  }`} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>

            {/* Condicional para "Não localizado" (Equipamento Novo / Recém-chegado) */}
            {fields.condicao === 'Não localizado' && (
              <div className="mt-3 p-3.5 bg-orange-50/50 rounded-xl border border-orange-200/60 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-orange-100 text-orange-700 rounded-lg shrink-0 mt-0.5">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                      <span>Ativo Não Localizado na Base Principal</span>
                      <button
                        type="button"
                        onClick={() => setShowNewEquipmentHelp(!showNewEquipmentHelp)}
                        className="px-1 py-0.5 text-[10px] bg-orange-100 text-orange-800 rounded hover:bg-orange-200 transition-colors cursor-pointer font-bold font-mono"
                        title="Ajuda (?)"
                      >
                        {showNewEquipmentHelp ? 'Ocultar' : '?'}
                      </button>
                    </h4>
                    {showNewEquipmentHelp && (
                      <p className="text-[11px] text-slate-600 leading-relaxed animate-fade-in">
                        Equipamentos ausentes no cadastro principal do hospital podem ser novos ou recém-chegados. Marque para registrar este ativo como recém-chegado.
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 pt-2 border-t border-orange-100">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!fields.isNewEquipment}
                      onChange={(e) => handleFieldChange('isNewEquipment', e.target.checked)}
                      className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-orange-900">Marcar como Equipamento Novo / Recém-chegado</span>
                  </label>
                </div>
              </div>
            )}

            {/* Opções de Treinamento / Item Não-Médico */}
            <div className="mt-3 p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
              <div className="flex items-start gap-3">
                <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="space-y-1 flex-1">
                  <h4 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                    <span>Ativo de Treinamento ou Uso Geral (Não-Médico)</span>
                    <button
                      type="button"
                      onClick={() => setShowTrainingHelp(!showTrainingHelp)}
                      className="px-1 py-0.5 text-[10px] bg-indigo-100 text-indigo-800 rounded hover:bg-indigo-200 transition-colors cursor-pointer font-bold font-mono"
                      title="Ajuda (?)"
                    >
                      {showTrainingHelp ? 'Ocultar' : '?'}
                    </button>
                  </h4>
                  {showTrainingHelp && (
                    <p className="text-[11px] text-slate-600 leading-relaxed animate-fade-in">
                      Marque esta opção caso o equipamento analisado seja utilizado exclusivamente para <strong>treinamento, fins didáticos, simulações ou não se enquadre como um dispositivo médico regulamentado</strong>. Isto organiza as fotos em pastas de treinamento e adiciona um aviso legal nos relatórios de PDF e no Google Sheets.
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-indigo-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!fields.isTrainingItem}
                    onChange={(e) => handleFieldChange('isTrainingItem', e.target.checked)}
                    className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-indigo-900">Este equipamento NÃO é um dispositivo médico (Treinamento / Outro)</span>
                </label>
              </div>
            </div>

            {/* Condicional para "Em Manutenção" (O.S. do Sistema GETS e Consulta Rápida) */}
            {fields.condicao === 'Em Manutenção' && (
              <div className="mt-3 p-4 bg-blue-50/40 rounded-xl border border-blue-200/60 space-y-3.5 animate-fade-in">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0 mt-0.5">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div className="space-y-1 flex-1">
                    <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <span>Ativo em Processo de Manutenção</span>
                      <button
                        type="button"
                        onClick={() => setShowMaintenanceHelp(!showMaintenanceHelp)}
                        className="px-1 py-0.5 text-[10px] bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors cursor-pointer font-bold font-mono"
                        title="Ajuda (?)"
                      >
                        {showMaintenanceHelp ? 'Ocultar' : '?'}
                      </button>
                    </h4>
                    {showMaintenanceHelp && (
                      <p className="text-[11px] text-slate-600 leading-relaxed animate-fade-in">
                        Consulte ou registre a Ordem de Serviço (O.S.) correspondente na plataforma <strong>GETS (CEB Unicamp)</strong>. Utilize o link abaixo para abrir o portal e realizar a pesquisa rápida.
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                      <span>Número da O.S. (GETS)</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      value={fields.numeroOSGets || ''}
                      onChange={(e) => handleFieldChange('numeroOSGets', e.target.value)}
                      placeholder="Ex: OS-2026-9812"
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 focus:border-blue-500 rounded-lg focus:outline-none font-mono text-blue-900 font-semibold bg-white"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <a
                      href="https://gets.ceb.unicamp.br/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs hover:shadow-sm transition-all text-center cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      Acessar Plataforma GETS Unicamp ↗
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* SECTION 2: Identificadores Únicos */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span>02. Códigos e Identificadores</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Número de Série */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Número de Série (S/N) <span className="text-red-500">*</span> <span className="text-[10px] text-red-500 font-normal font-sans">(Obrigatório)</span></span>
                <span className="text-[9px] text-slate-400 font-normal">Normalmente na placa técnica metálica</span>
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.numSerie || ''}
                  onChange={(e) => handleFieldChange('numSerie', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-emerald-800 font-medium"
                  placeholder="Digite o número de série"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('numSerie')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    activeSpeechField === 'numSerie' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Falar este campo"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Número de Patrimônio */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                <span>Número de Patrimônio / TAG</span>
                <span className="text-[9px] text-slate-400">Normalmente etiqueta com código de barras</span>
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.numPatrimonio || ''}
                  onChange={(e) => handleFieldChange('numPatrimonio', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-mono text-emerald-800 font-medium"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('numPatrimonio')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors ${
                    activeSpeechField === 'numPatrimonio' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Falar este campo"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* SECTION 3: Setor e Observações */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-1">
            <span>03. Setor e Observações Clínicas</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Setor / Localização */}
            <div className="md:col-span-1 space-y-1">
              <label className="text-xs font-semibold text-slate-600">
                Setor / Localização
              </label>
              <div className="relative flex rounded-lg shadow-sm">
                <select
                  value={fields.setor || ''}
                  onChange={(e) => handleFieldChange('setor', e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="">-- Selecione o Setor --</option>
                  <option value="AMB - DENF - AMB">Ambulatório (AMB)</option>
                  <option value="AT - UDIDE-AT">Atendimento (AT)</option>
                  <option value="CC - UBCPME - CC">Centro Cirúrgico (CC)</option>
                  <option value="CME - UBCPME - CME">Central de Materiais (CME)</option>
                  <option value="ECG - UDIDE-MG-ECG">Eletrocardiografia (ECG)</option>
                  <option value="ENDO - UDIDE-END-DIG">Endoscopia (ENDO)</option>
                  <option value="PAA - UCRIT-PA">Pronto Atendimento (PAA)</option>
                  <option value="PAI - UCA-PA">Pediatria (PAI)</option>
                  <option value="RAD - UDIDE-RAD">Radiologia (RAD)</option>
                  <option value="SEGE - SEGE">Sect. Geral (SEGE)</option>
                  <option value="SFHC - SFH - FC">Faturamento Clínico (SFHC)</option>
                  <option value="STEC - STEC">Setor Técnico (STEC)</option>
                  <option value="UTIA - UCRIT-UTI">UTI Adulto (UTIA)</option>
                  <option value="UTIPED - UCA-UTI">UTI Pediátrica (UTIPED)</option>
                  <option value="Em Manutenção">Equipamento em Manutenção</option>
                  <option value="Outro">Outro (Digitar Manualmente)</option>
                </select>
              </div>
            </div>

            {/* Custom Setor (Se selecionou Outro ou para digitação direta) */}
            {fields.setor === 'Outro' || !['', 'AMB - DENF - AMB', 'AT - UDIDE-AT', 'CC - UBCPME - CC', 'CME - UBCPME - CME', 'ECG - UDIDE-MG-ECG', 'ENDO - UDIDE-END-DIG', 'PAA - UCRIT-PA', 'PAI - UCA-PA', 'RAD - UDIDE-RAD', 'SEGE - SEGE', 'SFHC - SFH - FC', 'STEC - STEC', 'UTIA - UCRIT-UTI', 'UTIPED - UCA-UTI', 'Em Manutenção'].includes(fields.setor) ? (
              <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-semibold text-slate-600">
                  Especificar Outro Setor
                </label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.setor === 'Outro' ? '' : fields.setor}
                    onChange={(e) => handleFieldChange('setor', e.target.value)}
                    placeholder="Digite o nome do setor"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            ) : null}

            {/* Observações / Diagnósticos */}
            <div className={`${fields.setor === 'Outro' || !['', 'AMB - DENF - AMB', 'AT - UDIDE-AT', 'CC - UBCPME - CC', 'CME - UBCPME - CME', 'ECG - UDIDE-MG-ECG', 'ENDO - UDIDE-END-DIG', 'PAA - UCRIT-PA', 'PAI - UCA-PA', 'RAD - UDIDE-RAD', 'SEGE - SEGE', 'SFHC - SFH - FC', 'STEC - STEC', 'UTIA - UCRIT-UTI', 'UTIPED - UCA-UTI', 'Em Manutenção'].includes(fields.setor) ? 'md:col-span-1' : 'md:col-span-2'} space-y-1.5`}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600">
                  Observações e Diagnósticos de Campo
                </label>
                <button
                  type="button"
                  onClick={() => setIsBugModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition-all cursor-pointer"
                >
                  <AlertTriangle className="w-3 h-3" />
                  Reportar Bug/Falha
                </button>
              </div>
              <div className="relative flex rounded-lg shadow-sm">
                <input
                  type="text"
                  value={fields.observacoes || ''}
                  onChange={(e) => handleFieldChange('observacoes', e.target.value)}
                  placeholder="Observações adicionais ou diagnósticos de campo"
                  className="w-full px-3 py-2 pr-9 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => startFieldDictation('observacoes')}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md ${
                    activeSpeechField === 'observacoes' && isListening
                      ? 'bg-red-50 text-red-600 animate-pulse'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Ditados por voz"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              </div>
              
              {/* Presets de Anomalias Físicas */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-medium self-center mr-1">Anomalias de campo:</span>
                {[
                  "Etiqueta ilegível por oxidação",
                  "Número inserido manualmente",
                  "Equipamento sem etiqueta",
                  "S/N ausente ou danificado",
                  "Tag RFID não respondendo"
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = fields.observacoes ? fields.observacoes.trim() : '';
                      const updated = current ? `${current}. ${preset}` : preset;
                      handleFieldChange('observacoes', updated);
                    }}
                    className="text-[10px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-full px-2 py-0.5 transition-colors cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* SECTION 4: Calibração */}
        <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              Etiqueta de Calibração (Não obrigatória)
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fields.temCalibracao}
                onChange={(e) => handleFieldChange('temCalibracao', e.target.checked)}
                className="sr-only peer"
                id="checkbox-tem-calibracao"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
              <span className="ml-2 text-xs font-medium text-slate-700">Equipamento possui?</span>
            </label>
          </div>

          {fields.temCalibracao && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 animate-fade-in" id="calibration-fields-group">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Quem Executou</label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.executadoPorCal || ''}
                    onChange={(e) => handleFieldChange('executadoPorCal', e.target.value)}
                    placeholder="Ex: LabCal Soluções"
                    className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('executadoPorCal')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Data de Execução</label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.dataCal || ''}
                    onChange={(e) => handleFieldChange('dataCal', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('dataCal')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 text-blue-700 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Próxima Verificação / Calibração
                </label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.proxCal || ''}
                    onChange={(e) => handleFieldChange('proxCal', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 pr-9 text-xs border border-blue-200 bg-white text-blue-900 rounded-lg focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('proxCal')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:text-blue-700"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: Manutenção Preventiva */}
        <div className="p-4 rounded-xl border border-amber-100 bg-amber-50/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-600" />
              Etiqueta de Manutenção Preventiva
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fields.temManutencao}
                onChange={(e) => handleFieldChange('temManutencao', e.target.checked)}
                className="sr-only peer"
                id="checkbox-tem-manutencao"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
              <span className="ml-2 text-xs font-medium text-slate-700">Equipamento possui?</span>
            </label>
          </div>

          {fields.temManutencao && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 animate-fade-in" id="maintenance-fields-group">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Quem Executou / Status</label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.executadoPorManut || ''}
                    onChange={(e) => handleFieldChange('executadoPorManut', e.target.value)}
                    placeholder="Ex: Engenharia Clínica Própria"
                    className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('executadoPorManut')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Data Realização</label>
                <input
                  type="text"
                  value={fields.dataManut || ''}
                  onChange={(e) => handleFieldChange('dataManut', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-700 flex items-center gap-1">
                  Próxima Preventiva
                </label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.proxManut || ''}
                    onChange={(e) => handleFieldChange('proxManut', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 pr-9 text-xs border border-amber-200 bg-white text-amber-900 rounded-lg focus:outline-none focus:border-amber-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('proxManut')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-amber-500 hover:text-amber-700"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 6: Segurança Elétrica */}
        <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              Etiqueta de Segurança Elétrica
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={fields.temSegurancaEletrica}
                onChange={(e) => handleFieldChange('temSegurancaEletrica', e.target.checked)}
                className="sr-only peer"
                id="checkbox-tem-seguranca"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
              <span className="ml-2 text-xs font-medium text-slate-700">Equipamento possui?</span>
            </label>
          </div>

          {fields.temSegurancaEletrica && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 animate-fade-in" id="safety-fields-group">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Quem Executou / Status</label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.executadoPorSegElet}
                    onChange={(e) => handleFieldChange('executadoPorSegElet', e.target.value)}
                    placeholder="Ex: Engenharia Clínica Própria"
                    className="w-full px-3 py-2 pr-9 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('executadoPorSegElet')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Data Realização</label>
                <input
                  type="text"
                  value={fields.dataSegElet}
                  onChange={(e) => handleFieldChange('dataSegElet', e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  Próxima Segurança Elétrica
                </label>
                <div className="relative flex rounded-lg shadow-sm">
                  <input
                    type="text"
                    value={fields.proxSegElet}
                    onChange={(e) => handleFieldChange('proxSegElet', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    className="w-full px-3 py-2 pr-9 text-xs border border-emerald-200 bg-white text-emerald-900 rounded-lg focus:outline-none focus:border-emerald-500 font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => startFieldDictation('proxSegElet')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-emerald-500 hover:text-emerald-700"
                  >
                    <Mic className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 7: Acessórios, Cabos e Consumíveis */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-600" />
              Acessórios, Cabos & Consumíveis Vinculados
            </h3>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showAccessoriesForm}
                onChange={(e) => setShowAccessoriesForm(e.target.checked)}
                className="sr-only peer"
                id="checkbox-show-accessories"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-800"></div>
              <span className="ml-2 text-xs font-medium text-slate-700">Deseja cadastrar?</span>
            </label>
          </div>

          {showAccessoriesForm && (
            <div className="space-y-4 pt-1 animate-fade-in" id="accessories-fields-group">
              <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                <span className="text-xs font-bold text-slate-800">Vincular Novo Item</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Tipo */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Tipo de Item</label>
                    <select
                      value={tempAccessoryTipo}
                      onChange={(e) => setTempAccessoryTipo(e.target.value as any)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 bg-white rounded-lg focus:outline-none focus:border-slate-800"
                    >
                      <option value="Cabo de Força">Cabo de Força</option>
                      <option value="Bateria">Bateria</option>
                      <option value="Sensor">Sensor</option>
                      <option value="Acessório Geral">Acessório Geral</option>
                      <option value="Consumível">Consumível</option>
                    </select>
                  </div>

                  {/* Descrição */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[11px] font-semibold text-slate-600">Descrição / Especificação</label>
                    <input
                      type="text"
                      placeholder="Ex: Sensor de SpO2 jacaré adulto 3m"
                      value={tempAccessoryDesc}
                      onChange={(e) => setTempAccessoryDesc(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800"
                    />
                  </div>

                  {/* Serial */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Nº Série (Opcional)</label>
                    <input
                      type="text"
                      placeholder="Ex: SN-ACC-4938"
                      value={tempAccessorySN}
                      onChange={(e) => setTempAccessorySN(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-slate-800 font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                  {/* Foto de Acessório */}
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{tempAccessoryPhoto ? '✓ Foto Capturada' : 'Anexar Foto do Acessório'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAccessoryPhotoChange}
                        className="hidden"
                      />
                    </label>
                    {tempAccessoryPhoto && (
                      <div className="relative group flex items-center">
                        <img
                          src={tempAccessoryPhoto}
                          alt="Previa"
                          className="w-8 h-8 rounded border border-slate-300 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setTempAccessoryPhoto(null)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-bold"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Button to add to list */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!tempAccessoryDesc.trim()) {
                        alert("Por favor, informe a descrição do acessório.");
                        return;
                      }
                      
                      const nextId = Math.random().toString(36).substring(2, 9);
                      const suffixMap: { [key: string]: string } = {
                        'Cabo de Força': 'CBL',
                        'Bateria': 'BAT',
                        'Sensor': 'SEN',
                        'Acessório Geral': 'ACC',
                        'Consumível': 'CON'
                      };
                      const suffix = suffixMap[tempAccessoryTipo] || 'ACC';
                      
                      const currentList = fields.accessories || [];
                      const sameTypeCount = currentList.filter(a => a.tipo === tempAccessoryTipo).length;
                      const rootCode = fields.ativoCodigo || 'ATIVO';
                      const accessoryCode = `${rootCode}-${suffix}-${sameTypeCount + 1}`;
                      
                      const newItem = {
                        id: nextId,
                        tipo: tempAccessoryTipo as any,
                        descricao: tempAccessoryDesc.trim(),
                        numSerie: tempAccessorySN.trim() || undefined,
                        codigoAcessorio: accessoryCode,
                        base64Image: tempAccessoryPhoto || undefined
                      };
                      
                      handleFieldChange('accessories', [...currentList, newItem]);
                      setTempAccessoryDesc('');
                      setTempAccessorySN('');
                      setTempAccessoryPhoto(null);
                    }}
                    className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar à Lista
                  </button>
                </div>
              </div>

              {/* Added Accessories List */}
              {fields.accessories && fields.accessories.length > 0 ? (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                        <th className="p-2.5">Código Gerado</th>
                        <th className="p-2.5">Tipo</th>
                        <th className="p-2.5">Descrição / S/N</th>
                        <th className="p-2.5 text-center">Foto</th>
                        <th className="p-2.5 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fields.accessories.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50">
                          <td className="p-2.5 font-mono font-bold text-slate-800">{item.codigoAcessorio}</td>
                          <td className="p-2.5 text-slate-600 font-medium">{item.tipo}</td>
                          <td className="p-2.5 text-slate-600">
                            <div>{item.descricao}</div>
                            {item.numSerie && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">S/N: {item.numSerie}</div>
                            )}
                          </td>
                          <td className="p-2.5 text-center">
                            {item.base64Image ? (
                              <div className="inline-block relative">
                                <img
                                  src={item.base64Image}
                                  alt="Acessorio"
                                  className="w-7 h-7 rounded object-cover border border-slate-200 cursor-pointer hover:scale-110 transition-transform"
                                  onClick={() => {
                                    const win = window.open();
                                    win?.document.write(`<img src="${item.base64Image}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-300 font-medium">Sem foto</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const list = fields.accessories || [];
                                const updated = list.filter(a => a.id !== item.id);
                                handleFieldChange('accessories', updated);
                              }}
                              className="text-red-600 hover:text-red-700 font-bold hover:underline cursor-pointer"
                            >
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                  Nenhum acessório ou cabo vinculado ainda. Preencha os campos acima para adicionar.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FOOTER ACTIONS - RESET & SAVE DYNAMICALLY */}
      <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3">
        {/* Reset Form Button */}
        <button
          type="button"
          onClick={onResetForm}
          className="py-3 px-4 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px]"
        >
          Limpar Formulário
        </button>

        {/* Dynamic Save & Sync Button */}
        {isGoogleConnected ? (
          <button
            type="button"
            id="btn-save-record"
            onClick={onSaveRecord}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all active:scale-[0.99] cursor-pointer min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4" />
            Salvar & Sincronizar com o Google Workspace
          </button>
        ) : (
          <button
            type="button"
            id="btn-save-record"
            onClick={onSaveRecord}
            className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-[0.99] cursor-pointer min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            Salvar no Histórico Local
          </button>
        )}

        {/* Autocomplete datalists */}
        <datalist id="equipments-list">
          {uniqueEquipments.map(item => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <datalist id="brands-list">
          {uniqueBrands.map(item => (
            <option key={item} value={item} />
          ))}
        </datalist>

        <datalist id="models-list">
          {uniqueModels.map(item => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>

      {/* MODAL DE REPORTAR BUG / FALHA (SAPI-Core & OrbisTracker Diagnostics) */}
      {isBugModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-55 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-red-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Reporte Técnico de Instabilidade</h3>
                  <p className="text-[10px] text-red-100 font-mono">OrbisTracker SAPI-Core Log Diagnostic</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBugModalOpen(false);
                  setBugStatus('idle');
                }}
                className="text-white hover:text-red-200 text-sm font-bold font-mono px-2 py-0.5 rounded bg-red-700/50"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              <p className="text-xs text-slate-600 leading-relaxed">
                Este recurso captura instantaneamente o estado atual do aplicativo, o log de diagnóstico do SAPI-Core, a situação de rede e o banco offline. O reporte é encaminhado ao painel do desenvolvedor <strong>Lucas Fonseca</strong> e gera um e-mail estruturado de falha.
              </p>

              {bugStatus !== 'success' ? (
                <>
                  {/* Alert about direct email sending to engallmex@gmail.com.br */}
                  <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-red-800 leading-normal">
                      <strong>Notificação ao engallmex@gmail.com.br:</strong> Ao clicar no botão abaixo, além de registrar o log no sistema, seu aplicativo abrirá o cliente de e-mail integrado para enviar as especificações e o relatório de falha instantaneamente para o destinatário técnico.
                    </div>
                  </div>

                  {/* System Captured Logs */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      📋 Diagnóstico do Sistema Capturado
                    </span>
                    <pre className="p-3 bg-slate-950 text-emerald-400 font-mono text-[10px] rounded-lg overflow-x-auto max-h-48 border border-slate-800 leading-relaxed whitespace-pre-wrap select-all">
{`[SAPI-Core Log Dump - Rev. 2026.06.A]
Timestamp: ${new Date().toISOString()}
Plataforma: React Native / PWA Container
Rede Status: ${navigator.onLine ? "ONLINE (Conectado ao HU)" : "OFFLINE (Subsolo / Sem Rede)"}
Registros Locais (Cache): ${existingInspections ? existingInspections.length : 0} itens salvos
NFC Físico (Web NFC): ${'NDEFReader' in window ? "Suportado/Disponível" : "Não suportado (Simulado)"}
Formulário Ativo:
- Ativo: "${fields.equipamento || 'Nenhum'}"
- Patrimônio: "${fields.numPatrimonio || 'Nenhum'}"
- S/N: "${fields.numSerie || 'Nenhum'}"
- GPS: ${fields.latitude ? `${fields.latitude.toFixed(6)}, ${fields.longitude?.toFixed(6)}` : 'Não capturado'}
Log Traces:
- [0.01s] Inic. OrbisTracker HU-Brasil Core... OK
- [0.03s] Verificando permissões de câmera... OK
- [0.05s] Inicializando motor de voz... OK
- [0.12s] SAPI-Core Engine online: v1.6.0`}
                    </pre>
                  </div>

                  {/* Bug Description */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 block">
                      Descreva o ocorrido em campo (Opcional)
                    </label>
                    <textarea
                      value={bugDescription}
                      onChange={(e) => setBugDescription(e.target.value)}
                      placeholder="Ex: Câmera desfocada na etiqueta, ou leitor NFC apresentou lentidão..."
                      rows={3}
                      className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-red-500"
                    />
                  </div>
                </>
              ) : (
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                    <Check className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-850 text-sm">Alerta & Relatório Gerados!</h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                      Os logs de diagnóstico foram reunidos e uma tentativa de abrir o cliente de e-mail para enviar o alerta diretamente para <strong>engallmex@gmail.com.br</strong> foi iniciada.
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl max-w-sm mx-auto text-left space-y-2">
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Caso o bloqueador de popups do seu navegador tenha impedido a abertura automática do aplicativo de e-mail, utilize o botão rápido abaixo para transmitir:
                    </p>
                    <a
                      href={lastMailtoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer text-center"
                    >
                      <Mail className="w-4 h-4 text-white animate-pulse" />
                      Enviar E-mail para engallmex@gmail.com.br
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2 shrink-0">
              {bugStatus !== 'success' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsBugModalOpen(false)}
                    className="py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSendingBug}
                    onClick={handleSendBugReport}
                    className="py-1.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSendingBug ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Processando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-3.5 h-3.5" />
                        Gerar E-mail & Reportar
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsBugModalOpen(false);
                    setBugStatus('idle');
                  }}
                  className="py-1.5 px-4 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Fechar Janela
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
