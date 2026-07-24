import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Printer, 
  Copy, 
  Check, 
  RefreshCw, 
  FileText, 
  HelpCircle, 
  Tag, 
  AlertCircle,
  Sparkles,
  Link,
  Clock,
  User,
  ListFilter,
  CheckSquare,
  Square,
  ChevronRight
} from 'lucide-react';
import QRCode from 'qrcode';
import { InspectionRecord, FormFields } from '../types';

interface TagGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  activeFormFields?: FormFields;
  onApplyCodeToForm?: (code: string) => void;
  sectorsList?: Array<{ id: string; name: string }>;
  history?: InspectionRecord[];
  currentUser?: { name: string; email: string; role: 'admin' | 'user'; isGoogle: boolean; re?: string } | null;
  initialSelectedRecordId?: string | null;
}

type SiglaType = 'DTI' | 'MET' | 'SVI' | 'MON' | 'TER' | 'TERM';

const SIGLAS_INFO = {
  DTI: { label: 'DTI', name: 'Tecnologia da Informação', desc: 'Notebooks, Tablets, Computadores, Impressoras, etc.', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  MET: { label: 'MET', name: 'Metrologia e Teste', desc: 'Osciloscópios, simuladores, analisadores de segurança, etc.', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SVI: { label: 'SVI', name: 'Suporte à Vida', desc: 'Ventiladores, Cardioversores, Máquinas de Anestesia, etc.', bg: 'bg-rose-50 text-rose-700 border-rose-200' },
  MON: { label: 'MON', name: 'Monitorização e Diagnóstico', desc: 'Monitores Multiparamétricos, Oxímetros, Ultrassom, Raio-X, etc.', bg: 'bg-sky-50 text-sky-700 border-sky-200' },
  TER: { label: 'TER', name: 'Terapia e Apoio', desc: 'Bisturis elétricos, fototerapias, autoclaves, camas, etc.', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
  TERM: { label: 'TERM', name: 'Termodesinfectoras / Esterilização', desc: 'Termodesinfectoras, autoclaves, lavadoras de ultrassom, etc.', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
};

function ensureHuCompleto(code: string, record?: InspectionRecord): string {
  if (!code) return '';
  const clean = code.trim().toUpperCase();
  
  // If it is already in format HU-[SIGLA]-[NUM]-ORB
  if (/^HU-[A-Z]+-\d+-ORB$/.test(clean)) {
    return clean;
  }
  
  // If it's a simplified code like SVI-001 or SVI-000001
  const simplifiedRegex = /^([A-Z]+)-(\d+)(-ORB)?$/;
  const match = clean.match(simplifiedRegex);
  if (match) {
    const sigla = match[1];
    const numStr = match[2];
    const paddedNum = numStr.padStart(6, '0');
    return `HU-${sigla}-${paddedNum}-ORB`;
  }
  
  // Extract sigla from record or string
  let sigla = 'SVI';
  if (record && record.setor) {
    const sectorUpper = record.setor.toUpperCase();
    if (sectorUpper.includes('TI') || sectorUpper.includes('INFORMATICA') || sectorUpper.includes('INFORMÁTICA')) sigla = 'DTI';
    else if (sectorUpper.includes('METRO') || sectorUpper.includes('CALIBRA')) sigla = 'MET';
    else if (sectorUpper.includes('UTI') || sectorUpper.includes('VIDA')) sigla = 'SVI';
    else if (sectorUpper.includes('MONIT') || sectorUpper.includes('IMAGEM')) sigla = 'MON';
    else if (sectorUpper.includes('TERAPIA') || sectorUpper.includes('APOIO')) sigla = 'TER';
    else if (sectorUpper.includes('ESTERI') || sectorUpper.includes('LAVADORA')) sigla = 'TERM';
  }
  
  // Find numeric digits in the code
  const numMatch = clean.match(/\d+/);
  const numberPart = numMatch ? numMatch[0].padStart(6, '0') : '000001';
  
  // Look for sigla match in code itself
  const sigStrMatch = clean.match(/(DTI|MET|SVI|MON|TER|TERM)/);
  if (sigStrMatch) {
    sigla = sigStrMatch[1];
  }
  
  return `HU-${sigla}-${numberPart}-ORB`;
}

interface StickerPreviewProps {
  code: string;
  equipamento: string;
  marcaModelo: string;
  setor: string;
  numSerie: string;
  auditor: string;
  data: string;
  driveFolderUrl?: string;
  labelSize: '50x30' | '50x50';
  labelLayout: 'standard' | 'minimal';
}

function StickerPreview({
  code,
  equipamento,
  marcaModelo,
  setor,
  numSerie,
  auditor,
  data,
  driveFolderUrl,
  labelSize,
  labelLayout
}: StickerPreviewProps) {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    const qrContent = driveFolderUrl || `${window.location.origin}/?search=${code}`;
    QRCode.toDataURL(qrContent, { margin: 1, width: 120 }, (err, url) => {
      if (!err) {
        setQrUrl(url);
      }
    });
  }, [code, driveFolderUrl]);

  const isSquare = labelSize === '50x50';
  const isMinimal = labelLayout === 'minimal';

  return (
    <div className="w-full max-w-[280px] bg-slate-100 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner flex flex-col items-center justify-center">
      <div 
        className={`bg-white border-2 border-slate-950 text-slate-950 p-3 text-center w-full shadow-md flex flex-col justify-between transition-all duration-300 ${
          isSquare ? 'aspect-square h-[240px]' : 'h-[170px]'
        }`}
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        {isMinimal ? (
          // Minimal Layout (both square and rectangular)
          <div className="flex flex-col justify-between h-full w-full">
            <div>
              <div className="text-[10px] font-extrabold tracking-tight uppercase text-slate-900 leading-none">
                Orbis Engenharia Clínica
              </div>
              <div className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 mt-1 mb-1 leading-none">
                Hospital Universitário - HU
              </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center">
              {qrUrl ? (
                <img 
                  src={qrUrl} 
                  alt="QR Code" 
                  className={`select-none border border-slate-150 p-0.5 ${isSquare ? 'w-24 h-24' : 'w-16 h-16'}`}
                />
              ) : (
                <div className={`bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 ${isSquare ? 'w-24 h-24' : 'w-16 h-16'}`}>
                  Carregando...
                </div>
              )}
            </div>
            
            <div className="space-y-1 mt-1">
              <span className="inline-block text-[11px] font-black font-mono bg-slate-950 text-white px-2 py-0.5 leading-none">
                {code}
              </span>
              <div className="text-[7.5px] font-black border-t border-slate-200 pt-1 mt-1 opacity-90 leading-none text-slate-600">
                ORBISTRACKER HU-BR
              </div>
            </div>
          </div>
        ) : (
          // Standard/Completo Layout
          <div className="flex flex-col justify-between h-full w-full text-left">
            <div className="text-[10px] font-extrabold tracking-tight border-b-2 border-slate-950 pb-1 uppercase leading-none text-center text-slate-900">
              Hospital Universitário - HU
            </div>
            
            {isSquare ? (
              // Square Standard Layout
              <div className="flex-1 flex flex-col justify-between mt-1.5 mb-1.5">
                <div className="flex justify-center">
                  {qrUrl ? (
                    <img 
                      src={qrUrl} 
                      alt="QR Code" 
                      className="select-none border border-slate-150 p-0.5 w-24 h-24"
                    />
                  ) : (
                    <div className="bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 w-24 h-24">
                      Carregando...
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-black font-mono bg-slate-950 text-white px-2 py-0.5 mt-1.5 mb-1.5 self-center leading-none">
                  {code}
                </div>

                <div className="text-[7.5px] font-bold space-y-0.5 leading-tight border-t border-dashed border-slate-950 pt-1.5 text-slate-900">
                  <div className="truncate"><strong>EQUIPAMENTO:</strong> {(equipamento || 'N/A').toUpperCase()}</div>
                  <div className="truncate"><strong>MARCA/MODELO:</strong> {(marcaModelo || 'N/A').toUpperCase()}</div>
                  <div className="truncate"><strong>SETOR:</strong> {(setor || 'N/A').toUpperCase()}</div>
                  <div className="truncate"><strong>Nº SÉRIE:</strong> {(numSerie || 'N/A').toUpperCase()}</div>
                  <div className="truncate border-t border-dotted border-black/30 pt-1 mt-1 text-[7px] flex justify-between">
                    <span><strong>AUDITOR:</strong> {auditor.toUpperCase().slice(0, 15)}</span>
                    <span><strong>DATA:</strong> {data}</span>
                  </div>
                </div>
              </div>
            ) : (
              // Standard Rectangular 50x30
              <div className="flex-1 flex flex-col justify-between mt-1.5 text-slate-900">
                <div className="flex items-start justify-between gap-1.5 flex-1 min-h-0">
                  <div className="text-[7px] font-bold space-y-0.5 leading-tight flex-1 min-w-0 pr-1">
                    <div className="truncate"><strong>EQ:</strong> {(equipamento || 'N/A').toUpperCase()}</div>
                    <div className="truncate"><strong>MOD:</strong> {(marcaModelo || 'N/A').toUpperCase()}</div>
                    <div className="truncate"><strong>SET:</strong> {(setor || 'N/A').toUpperCase()}</div>
                    <div className="truncate"><strong>S/N:</strong> {(numSerie || 'N/A').toUpperCase()}</div>
                    <div className="truncate border-t border-dotted border-black/30 pt-0.5 mt-0.5 text-[6.5px] flex justify-between">
                      <span className="truncate max-w-[55px]"><strong>AUD:</strong> {auditor.toUpperCase().split(' ')[0]}</span>
                      <span><strong>DT:</strong> {data}</span>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-center">
                    {qrUrl ? (
                      <img 
                        src={qrUrl} 
                        alt="QR Code" 
                        className="select-none border border-slate-150 p-0.5 w-16 h-16"
                      />
                    ) : (
                      <div className="bg-slate-100 flex items-center justify-center text-[8px] text-slate-400 w-16 h-16">
                        Carregando...
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center mt-1">
                  <span className="inline-block text-[10px] font-black font-mono bg-slate-950 text-white px-2 py-0.5 leading-none">
                    {code}
                  </span>
                </div>
              </div>
            )}

            <div className="text-[7.5px] font-black border-t border-slate-950 pt-1 mt-1 text-center opacity-90 leading-none text-slate-800">
              ORBIS ENGENHARIA CLÍNICA
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TagGenerator({
  isOpen,
  onClose,
  activeFormFields,
  onApplyCodeToForm,
  sectorsList = [],
  history = [],
  currentUser,
  initialSelectedRecordId
}: TagGeneratorProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'individual'>('queue');
  
  // Persistent tracking of printed tags to show queue state
  const [printedTagIds, setPrintedTagIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('orbis_printed_tag_ids');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [sequences, setSequences] = useState<Record<SiglaType, number>>({
    DTI: 1,
    MET: 1,
    SVI: 1,
    MON: 1,
    TER: 1,
    TERM: 1
  });

  const [codeFormat, setCodeFormat] = useState<'standard' | 'simplified'>(() => {
    return (localStorage.getItem('orbis_code_format') as any) || 'simplified';
  });

  useEffect(() => {
    localStorage.setItem('orbis_code_format', codeFormat);
  }, [codeFormat]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Print Queue states
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'printed'>('pending');
  const [selectedQueueIds, setSelectedQueueIds] = useState<string[]>([]);
  
  // Auditor customizable metadata stored persistently
  const [auditorInfo, setAuditorInfo] = useState<string>(() => {
    return localStorage.getItem('orbis_auditor_label_info') || 
      (currentUser?.name 
        ? (currentUser.re ? `${currentUser.name} (RE-${currentUser.re})` : `${currentUser.name}`) 
        : 'Técnico de Auditoria');
  });

  const [auditDate, setAuditDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('pt-BR');
  });

  // Zebra ZD220 Thermal Printer states
  const [printMethod, setPrintMethod] = useState<'browser' | 'network' | 'browser_print' | 'download_zpl' | 'copy_zpl'>(() => {
    return (localStorage.getItem('orbis_print_method') as any) || 'browser';
  });
  const [zebraIp, setZebraIp] = useState<string>(() => {
    return localStorage.getItem('orbis_zebra_ip') || '';
  });
  const [zebraPort, setZebraPort] = useState<string>(() => {
    return localStorage.getItem('orbis_zebra_port') || '9100';
  });
  const [zebraStatus, setZebraStatus] = useState<string>('Não verificado');
  const [zebraPrinterDevice, setZebraPrinterDevice] = useState<any>(() => {
    const saved = localStorage.getItem('orbis_zebra_local_printer');
    return saved ? JSON.parse(saved) : null;
  });
  const [isZebraConfigOpen, setIsZebraConfigOpen] = useState<boolean>(false);

  // Persistent Label Size and Layout Configurations
  const [labelSize, setLabelSize] = useState<'50x30' | '50x50'>(() => {
    return (localStorage.getItem('orbis_label_size') as any) || '50x30';
  });

  const [labelLayout, setLabelLayout] = useState<'standard' | 'minimal'>(() => {
    return (localStorage.getItem('orbis_label_layout') as any) || 'minimal';
  });

  useEffect(() => {
    localStorage.setItem('orbis_label_size', labelSize);
  }, [labelSize]);

  useEffect(() => {
    localStorage.setItem('orbis_label_layout', labelLayout);
  }, [labelLayout]);

  const [showHelpBanner, setShowHelpBanner] = useState<boolean>(() => {
    return localStorage.getItem('orbis_hide_help_banner') !== 'true';
  });

  const handleToggleHelp = () => {
    if (showHelpBanner) {
      localStorage.setItem('orbis_hide_help_banner', 'true');
    } else {
      localStorage.removeItem('orbis_hide_help_banner');
    }
    setShowHelpBanner(!showHelpBanner);
  };

  useEffect(() => {
    localStorage.setItem('orbis_print_method', printMethod);
  }, [printMethod]);

  useEffect(() => {
    localStorage.setItem('orbis_zebra_ip', zebraIp);
  }, [zebraIp]);

  useEffect(() => {
    localStorage.setItem('orbis_zebra_port', zebraPort);
  }, [zebraPort]);

  // Detect local USB/network Zebra printers using Zebra's official Browser Print local service
  const detectLocalZebra = async () => {
    try {
      setZebraStatus('Procurando...');
      const response = await fetch('http://localhost:9195/available');
      if (response.ok) {
        const data = await response.json();
        if (data && data.printer && data.printer.length > 0) {
          const printer = data.printer[0];
          setZebraPrinterDevice(printer);
          setZebraStatus(`Detectada: ${printer.name} (${printer.connection})`);
          localStorage.setItem('orbis_zebra_local_printer', JSON.stringify(printer));
        } else {
          setZebraStatus('Nenhuma impressora USB local encontrada.');
        }
      } else {
        setZebraStatus('Zebra Browser Print inativo na porta 9195.');
      }
    } catch (e) {
      setZebraStatus('Não conectado ao Zebra Browser Print (verifique se está rodando localmente).');
    }
  };

  // ZPL Generator for Zebra ZD220 (203 DPI, 50x30mm or 50x50mm, standard or minimal layouts)
  const generateZpl = (
    code: string,
    equipamento: string,
    marcaModelo: string,
    setor: string,
    numSerie: string,
    auditor: string,
    data: string,
    driveUrl?: string
  ) => {
    const qrContent = driveUrl || `${window.location.origin}/?search=${code}`;
    
    // Clean and normalize text to prevent ZPL encoding issues
    const cleanEq = (equipamento || 'N/A').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 24);
    const cleanMM = (marcaModelo || 'N/A').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 24);
    const cleanSetor = (setor || 'N/A').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 24);
    const cleanSn = (numSerie || 'N/A').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cleanAuditor = (auditor || 'TECNICO').toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 18);
    const cleanData = data;

    if (labelSize === '50x50') {
      if (labelLayout === 'minimal') {
        // 50x50mm Minimal
        return `^XA
^CI28
^PW400
^LL400
^FO10,10^GB380,380,2^FS
^FO20,30^A0N,24,24^FDORBIS ENGENHARIA CLINICA^FS
^FO20,60^A0N,14,14^FDHOSPITAL UNIVERSITARIO - HU^FS
^FO20,80^GB360,2,2^FS
^FO100,100^BQN,2,8^FDQA,${qrContent}^FS
^FO20,285^GB360,35,35^FS
^FO30,293^A0N,22,22^FR^FD${code}^FS
^FO20,335^A0N,12,12^FDORBIS ENGENHARIA CLINICA E HOSPITALAR^FS
^FO20,355^A0N,12,12^FDORBISTRACKER HU-BR^FS
^FO20,372^A0N,10,10^FDSIMPLIFICADO VIA QR-CODE^FS
^XZ`;
      } else {
        // 50x50mm Completo (Full)
        return `^XA
^CI28
^PW400
^LL400
^FO10,10^GB380,380,2^FS
^FO20,20^A0N,22,22^FDHOSPITAL UNIVERSITARIO - HU^FS
^FO20,48^GB360,2,2^FS
^FO20,60^A0N,16,16^FDEQ: ${cleanEq}^FS
^FO20,80^A0N,16,16^FDMOD: ${cleanMM}^FS
^FO20,100^A0N,16,16^FDSET: ${cleanSetor}^FS
^FO20,120^A0N,16,16^FDS/N: ${cleanSn}^FS
^FO20,140^A0N,14,14^FDAUD: ${cleanAuditor}^FS
^FO20,160^A0N,14,14^FDDATA: ${cleanData}^FS
^FO110,190^BQN,2,6^FDQA,${qrContent}^FS
^FO20,320^GB360,32,32^FS
^FO30,328^A0N,20,20^FR^FD${code}^FS
^FO20,360^A0N,12,12^FDORBIS ENGENHARIA CLINICA E HOSPITALAR^FS
^FO20,375^A0N,12,12^FDORBISTRACKER HU-BRASIL^FS
^XZ`;
      }
    } else {
      // 50x30mm
      if (labelLayout === 'minimal') {
        // 50x30mm Minimal
        return `^XA
^CI28
^PW400
^LL240
^FO10,10^GB380,220,2^FS
^FO20,20^A0N,18,18^FDORBIS ENGENHARIA CLINICA^FS
^FO20,40^A0N,12,12^FDHOSPITAL UNIVERSITARIO - HU^FS
^FO20,55^GB360,2,2^FS
^FO160,70^BQN,2,4^FDQA,${qrContent}^FS
^FO20,165^GB360,30,30^FS
^FO30,172^A0N,18,18^FR^FD${code}^FS
^FO20,205^A0N,12,12^FDORBISTRACKER HU-BR^FS
^XZ`;
      } else {
        // 50x30mm Completo (Full)
        return `^XA
^CI28
^PW400
^LL240
^FO10,10^GB380,220,2^FS
^FO20,20^A0N,18,18^FDHOSPITAL UNIVERSITARIO - HU^FS
^FO20,42^GB360,2,2^FS
^FO20,52^A0N,14,14^FDEQ: ${cleanEq}^FS
^FO20,68^A0N,14,14^FDMOD: ${cleanMM}^FS
^FO20,84^A0N,14,14^FDSET: ${cleanSetor}^FS
^FO20,100^A0N,14,14^FDS/N: ${cleanSn}^FS
^FO20,116^A0N,12,12^FDAUD: ${cleanAuditor} - ${cleanData}^FS
^FO250,52^BQN,2,3^FDQA,${qrContent}^FS
^FO20,140^GB360,30,30^FS
^FO30,148^A0N,16,16^FR^FD${code}^FS
^FO20,180^GB360,1,1^FS
^FO20,190^A0N,12,12^FDORBIS ENGENHARIA CLINICA E HOSPITALAR^FS
^FO20,210^A0N,12,12^FDORBISTRACKER HU-BRASIL^FS
^XZ`;
      }
    }
  };

  const executeZebraPrint = async (zplContent: string, count: number = 1) => {
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (printMethod === 'network') {
        if (!zebraIp) {
          throw new Error("Por favor, informe o IP da impressora Zebra na rede.");
        }
        const response = await fetch('/api/print-zebra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ip: zebraIp, port: zebraPort, zpl: zplContent })
        });
        const data = await response.json();
        if (response.ok) {
          alert(`Sucesso! ${count} etiqueta(s) enviada(s) para a impressora Zebra no IP ${zebraIp}:${zebraPort}`);
          return true;
        } else {
          throw new Error(data.error || "Falha ao enviar impressão via rede.");
        }
      } else if (printMethod === 'browser_print') {
        const response = await fetch('http://localhost:9195/write', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            device: zebraPrinterDevice || { connection: 'usb', deviceType: 'printer' },
            data: zplContent
          })
        });
        if (response.ok) {
          alert(`Sucesso! ${count} etiqueta(s) enviada(s) para a impressora Zebra local via USB.`);
          return true;
        } else {
          throw new Error("O Zebra Browser Print local recusou a conexão. Verifique se o aplicativo está rodando em segundo plano.");
        }
      } else if (printMethod === 'download_zpl') {
        const blob = new Blob([zplContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `etiquetas_${Date.now()}.zpl`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      } else if (printMethod === 'copy_zpl') {
        await navigator.clipboard.writeText(zplContent);
        alert("Código ZPL copiado para a área de transferência! Você pode colar este código no utilitário de sua preferência.");
        return true;
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Erro desconhecido ao imprimir.");
      return false;
    } finally {
      setIsLoading(false);
    }
    return false;
  };

  // Individual Tag Creator States
  const [selectedSigla, setSelectedSigla] = useState<SiglaType>('SVI');
  const [customSequenceNumber, setCustomSequenceNumber] = useState<string>('');
  const [tagEquipamento, setTagEquipamento] = useState<string>('');
  const [tagMarcaModelo, setTagMarcaModelo] = useState<string>('');
  const [tagSetor, setTagSetor] = useState<string>('');
  const [tagNumSerie, setTagNumSerie] = useState<string>('');
  const [individualQrUrl, setIndividualQrUrl] = useState<string>('');

  // Save customized auditor name persistently
  useEffect(() => {
    localStorage.setItem('orbis_auditor_label_info', auditorInfo);
  }, [auditorInfo]);

  // Sync default auditor info if currentUser changes
  useEffect(() => {
    if (currentUser?.name && !localStorage.getItem('orbis_auditor_label_info')) {
      setAuditorInfo(currentUser.name);
    }
  }, [currentUser]);

  // Fetch sequential counters from server
  const loadSequences = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/tag-sequences');
      if (res.ok) {
        const data = await res.json();
        setSequences(data);
      } else {
        throw new Error('Falha ao comunicar com o servidor de patrimônio.');
      }
    } catch (err: any) {
      console.warn("Retornando para sequences locais do localStorage:", err);
      const saved = localStorage.getItem('orbis_tag_sequences');
      if (saved) {
        try {
          setSequences(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSequences();
    }
  }, [isOpen]);

  // Map history records into print queue entries
  const queueItems = useMemo(() => {
    return history.map(item => {
      const rawCode = (item.ativoCodigo || item.numPatrimonio || '').trim();
      const code = ensureHuCompleto(rawCode, item);
      const isPrinted = printedTagIds.includes(item.id);
      return {
        ...item,
        code,
        isPrinted
      };
    }).filter(item => !!item.code); // Only include items with an active code
  }, [history, printedTagIds]);

  // Filter items in the queue based on status
  const filteredQueueItems = useMemo(() => {
    return queueItems.filter(item => {
      if (filterMode === 'pending') return !item.isPrinted;
      if (filterMode === 'printed') return item.isPrinted;
      return true;
    });
  }, [queueItems, filterMode]);

  // Find which item to preview in the queue (first selected visible, or first visible)
  const previewItem = useMemo(() => {
    const selectedVisible = filteredQueueItems.find(item => selectedQueueIds.includes(item.id));
    if (selectedVisible) return selectedVisible;
    if (filteredQueueItems.length > 0) return filteredQueueItems[0];
    return null;
  }, [filteredQueueItems, selectedQueueIds]);

  const [hasInitializedSelection, setHasInitializedSelection] = useState(false);

  // Automatically select all filtered pending items on mount or list update
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedRecordId) {
        setSelectedQueueIds([initialSelectedRecordId]);
        setActiveTab('queue');
      } else if (!hasInitializedSelection && queueItems.length > 0) {
        const pendingIds = queueItems.filter(item => !item.isPrinted).map(item => item.id);
        setSelectedQueueIds(pendingIds);
        setHasInitializedSelection(true);
      }
    } else {
      setHasInitializedSelection(false);
    }
  }, [isOpen, initialSelectedRecordId, queueItems, hasInitializedSelection]);

  // Handle active form pulling for manual single generator
  const handlePullFromForm = () => {
    if (activeFormFields) {
      setTagEquipamento(activeFormFields.equipamento || '');
      const marca = activeFormFields.fabricante || '';
      const modelo = activeFormFields.modelo || '';
      setTagMarcaModelo(marca && modelo ? `${marca} / ${modelo}` : marca || modelo || '');
      setTagSetor(activeFormFields.setor || '');
      setTagNumSerie(activeFormFields.numSerie || '');
    }
  };

  // Determine current active sequence for individual tag
  const currentSeqNum = sequences[selectedSigla] || 1;
  const formattedSeqNum = customSequenceNumber || String(currentSeqNum).padStart(codeFormat === 'simplified' ? 3 : 6, '0');

  // Generated code string
  const generatedCode = codeFormat === 'simplified'
    ? `${selectedSigla}-${formattedSeqNum}`
    : `HU-${selectedSigla}-${formattedSeqNum}-ORB`;

  // Update Individual QR Code dynamically
  useEffect(() => {
    if (generatedCode) {
      // Encode deep-link URL to central web app as fallback, or Google Drive folder if available
      const qrContent = (activeFormFields && activeFormFields.driveFolderUrl) || `${window.location.origin}/?search=${generatedCode}`;
      QRCode.toDataURL(qrContent, { margin: 1, width: 180 }, (err, url) => {
        if (!err) {
          setIndividualQrUrl(url);
        } else {
          console.error("Erro ao gerar QR Code:", err);
        }
      });
    }
  }, [generatedCode, selectedSigla, customSequenceNumber, sequences, activeFormFields]);

  // Copy individual code to clipboard
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Increment sequence on database/Firestore
  const handleConfirmAndIncrement = async () => {
    setIsLoading(true);
    try {
      const currentVal = customSequenceNumber ? parseInt(customSequenceNumber, 10) : currentSeqNum;
      const nextVal = currentVal + 1;

      const res = await fetch('/api/tag-sequences/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sigla: selectedSigla, value: nextVal })
      });

      if (res.ok) {
        const data = await res.json();
        setSequences(data);
        localStorage.setItem('orbis_tag_sequences', JSON.stringify(data));
        setCustomSequenceNumber(''); // clear custom
      } else {
        const updated = { ...sequences, [selectedSigla]: nextVal };
        setSequences(updated);
        localStorage.setItem('orbis_tag_sequences', JSON.stringify(updated));
        setCustomSequenceNumber('');
      }

      window.dispatchEvent(new Event('orbis_db_updated'));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Print single manually drafted label
  const handlePrintSingle = async () => {
    const zpl = generateZpl(
      generatedCode,
      tagEquipamento,
      tagMarcaModelo,
      tagSetor,
      tagNumSerie,
      auditorInfo,
      auditDate,
      activeFormFields?.driveFolderUrl
    );

    if (printMethod !== 'browser') {
      const success = await executeZebraPrint(zpl, 1);
      if (success) {
        handleConfirmAndIncrement();
      }
      return;
    }

    // Generate QR Code dynamically
    const qrContent = (activeFormFields && activeFormFields.driveFolderUrl) || `${window.location.origin}/?search=${generatedCode}`;
    
    QRCode.toDataURL(qrContent, { margin: 1, width: 150 }, (err, qrUrl) => {
      if (err) {
        alert("Erro ao gerar QR Code para impressão.");
        return;
      }

      const labelHtml = labelLayout === 'minimal' ? `
        <div class="thermal-label ${labelSize === '50x50' ? 'square' : 'standard'}">
          <div class="label-title" style="border:none; padding:0; margin-bottom: 2px;">Orbis Engenharia Clínica</div>
          <div class="label-subtitle" style="font-size: 9px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Hospital Universitário - HU</div>
          <img class="qr-img" src="${qrUrl}" />
          <div class="label-code">${generatedCode}</div>
          <div class="label-footer" style="font-size: 8px; font-weight: bold; margin-top: 4px;">ORBISTRACKER HU-BR</div>
        </div>
      ` : `
        <div class="thermal-label ${labelSize === '50x50' ? 'square' : 'standard'}">
          <div class="label-title">Hospital Universitário - HU</div>
          <img class="qr-img" src="${qrUrl}" />
          <div class="label-code">${generatedCode}</div>
          <div class="label-metadata">
            <div><strong>EQUIPAMENTO:</strong> ${(tagEquipamento || 'Não Identificado').toUpperCase()}</div>
            <div><strong>MARCA/MODELO:</strong> ${(tagMarcaModelo || 'Não Informado').toUpperCase()}</div>
            <div><strong>SETOR:</strong> ${(tagSetor || 'Não Localizado').toUpperCase()}</div>
            <div><strong>Nº SÉRIE:</strong> ${(tagNumSerie || 'N/A').toUpperCase()}</div>
            <div style="margin-top: 3px; border-top: 1px dotted #000; padding-top: 2px;">
              <strong>AUDITOR:</strong> ${(auditorInfo || 'TÉCNICO').toUpperCase()}
            </div>
            <div><strong>DATA AUDITORIA:</strong> ${auditDate}</div>
          </div>
          <div class="label-footer">ORBIS ENGENHARIA CLÍNICA E HOSPITALAR</div>
        </div>
      `;

      const printWindow = window.open('', '_blank', 'width=500,height=600');
      if (!printWindow) {
        alert("Por favor, ative os pop-ups para imprimir a etiqueta.");
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Etiqueta HU-Orbis</title>
            <style>
              @page {
                size: auto;
                margin: 0mm;
              }
              body {
                margin: 0;
                padding: 10px;
                font-family: system-ui, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                background: #fff;
                color: #000;
              }
              * {
                box-sizing: border-box;
              }
              .thermal-label {
                border: 1px solid #000;
                padding: 10px;
                text-align: center;
                background: #fff;
                color: #000;
                margin: 0 auto;
              }
              .thermal-label.standard {
                width: 280px;
                height: auto;
              }
              .thermal-label.square {
                width: 280px;
                height: 280px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
              }
              .label-title {
                font-size: 11px;
                font-weight: 900;
                margin-bottom: 4px;
                text-transform: uppercase;
                border-bottom: 1.5px solid #000;
                padding-bottom: 3px;
              }
              .qr-img {
                width: 110px;
                height: 110px;
                margin: 4px auto;
                display: block;
              }
              .label-code {
                font-size: 13px;
                font-weight: 900;
                font-family: monospace;
                letter-spacing: 0.5px;
                background: #000;
                color: #fff;
                padding: 2.5px 5px;
                margin: 4px 0;
                display: inline-block;
              }
              .label-metadata {
                text-align: left;
                font-size: 9px;
                font-weight: 700;
                margin-top: 5px;
                border-top: 1px dashed #000;
                padding-top: 4px;
                line-height: 1.35;
              }
              .label-footer {
                font-size: 8px;
                margin-top: 4px;
                opacity: 0.8;
                font-weight: bold;
              }
            </style>
          </head>
          <body>
            ${labelHtml}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    });
  };

  // Toggle selection for individual queue item
  const handleToggleSelectItem = (id: string) => {
    setSelectedQueueIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Toggle selection of all items in current filtered view
  const handleToggleSelectAll = () => {
    const visibleIds = filteredQueueItems.map(item => item.id);
    const allSelected = visibleIds.every(id => selectedQueueIds.includes(id));

    if (allSelected) {
      setSelectedQueueIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedQueueIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  // Print all selected audited items from the queue in batch
  const handlePrintSelectedQueue = async () => {
    const selectedRecords = queueItems.filter(item => selectedQueueIds.includes(item.id));
    if (selectedRecords.length === 0) {
      alert("Selecione pelo menos um equipamento da fila para imprimir.");
      return;
    }

    if (printMethod !== 'browser') {
      setIsLoading(true);
      try {
        const concatenatedZpl = selectedRecords.map(item => {
          const brandModel = item.fabricante && item.modelo 
            ? `${item.fabricante} / ${item.modelo}`
            : item.fabricante || item.modelo || 'N/A';
          return generateZpl(
            item.code,
            item.equipamento,
            brandModel,
            item.setor || '',
            item.numSerie || '',
            auditorInfo,
            auditDate,
            item.driveFolderUrl
          );
        }).join('\n');

        const success = await executeZebraPrint(concatenatedZpl, selectedRecords.length);
        if (success) {
          // Save as printed in localStorage state
          const newlyPrintedIds = selectedRecords.map(r => r.id);
          const updatedPrintedIds = Array.from(new Set([...printedTagIds, ...newlyPrintedIds]));
          setPrintedTagIds(updatedPrintedIds);
          localStorage.setItem('orbis_printed_tag_ids', JSON.stringify(updatedPrintedIds));
        }
      } catch (err) {
        console.error("Erro ao processar lote ZPL:", err);
        setErrorMsg("Erro ao processar lote de ZPL.");
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      // Pre-generate QR Codes for all in parallel
      const labelsData = await Promise.all(selectedRecords.map(async (rec) => {
        const code = rec.code;
        // Strict pattern: URL is Drive Folder URL if synced, else deep-link search to our database/server
        const qrContent = rec.driveFolderUrl || `${window.location.origin}/?search=${code}`;
        const qrUrl = await QRCode.toDataURL(qrContent, { margin: 1, width: 150 });
        return {
          rec,
          code,
          qrUrl
        };
      }));

      const labelsHtml = labelsData.map(({ rec, code, qrUrl }) => {
        const brandModel = rec.fabricante && rec.modelo 
          ? `${rec.fabricante} / ${rec.modelo}`.toUpperCase() 
          : (rec.fabricante || rec.modelo || 'N/A').toUpperCase();

        if (labelLayout === 'minimal') {
          return `
            <div class="thermal-label ${labelSize === '50x50' ? 'square' : 'standard'}">
              <div class="label-title" style="border:none; padding:0; margin-bottom: 2px;">Orbis Engenharia Clínica</div>
              <div class="label-subtitle" style="font-size: 9px; font-weight: bold; margin-bottom: 4px; text-transform: uppercase;">Hospital Universitário - HU</div>
              <img class="qr-img" src="${qrUrl}" />
              <div class="label-code">${code}</div>
              <div class="label-footer" style="font-size: 8px; font-weight: bold; margin-top: 4px;">ORBISTRACKER HU-BR</div>
            </div>
          `;
        } else {
          return `
            <div class="thermal-label ${labelSize === '50x50' ? 'square' : 'standard'}">
              <div class="label-title">Hospital Universitário - HU</div>
              <img class="qr-img" src="${qrUrl}" />
              <div class="label-code">${code}</div>
              <div class="label-metadata">
                <div><strong>EQUIPAMENTO:</strong> ${(rec.equipamento || 'N/A').toUpperCase()}</div>
                <div><strong>MARCA/MOD:</strong> ${brandModel}</div>
                <div><strong>SETOR:</strong> ${(rec.setor || 'N/A').toUpperCase()}</div>
                <div><strong>Nº SÉRIE:</strong> ${(rec.numSerie || 'N/A').toUpperCase()}</div>
                <div style="margin-top: 3px; border-top: 1px dotted #000; padding-top: 2px;">
                  <strong>AUDITOR:</strong> ${(auditorInfo || 'TÉCNICO').toUpperCase()}
                </div>
                <div><strong>DATA AUDITORIA:</strong> ${auditDate}</div>
              </div>
              <div class="label-footer">ORBIS ENGENHARIA CLÍNICA E HOSPITALAR</div>
            </div>
          `;
        }
      }).join('<div class="page-break"></div>');

      const printWindow = window.open('', '_blank', 'width=500,height=600');
      if (!printWindow) {
        alert("Por favor, ative os pop-ups para imprimir as etiquetas da fila.");
        return;
      }
      printWindow.document.write(`
        <html>
          <head>
            <title>Fila de Impressão HU-Orbis</title>
            <style>
              @page {
                size: auto;
                margin: 0mm;
              }
              body {
                margin: 0;
                padding: 0;
                font-family: system-ui, sans-serif;
                background: #fff;
              }
              * {
                box-sizing: border-box;
              }
              .thermal-label {
                border: 1px solid #000;
                padding: 10px;
                text-align: center;
                background: #fff;
                color: #000;
                margin: 15px auto;
              }
              .thermal-label.standard {
                width: 280px;
                height: auto;
              }
              .thermal-label.square {
                width: 280px;
                height: 280px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
              }
              .label-title {
                font-size: 11px;
                font-weight: 900;
                margin-bottom: 4px;
                text-transform: uppercase;
                border-bottom: 1.5px solid #000;
                padding-bottom: 3px;
              }
              .qr-img {
                width: 110px;
                height: 110px;
                margin: 4px auto;
                display: block;
              }
              .label-code {
                font-size: 13px;
                font-weight: 900;
                font-family: monospace;
                letter-spacing: 0.5px;
                background: #000;
                color: #fff;
                padding: 2.5px 5px;
                margin: 4px 0;
                display: inline-block;
              }
              .label-metadata {
                text-align: left;
                font-size: 9px;
                font-weight: 700;
                margin-top: 5px;
                border-top: 1px dashed #000;
                padding-top: 4px;
                line-height: 1.35;
              }
              .label-footer {
                font-size: 8px;
                margin-top: 4px;
                opacity: 0.8;
                font-weight: bold;
              }
              .page-break {
                page-break-after: always;
                break-after: page;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      // Save as printed in localStorage state
      const newlyPrintedIds = selectedRecords.map(r => r.id);
      const updatedPrintedIds = Array.from(new Set([...printedTagIds, ...newlyPrintedIds]));
      setPrintedTagIds(updatedPrintedIds);
      localStorage.setItem('orbis_printed_tag_ids', JSON.stringify(updatedPrintedIds));

    } catch (err) {
      console.error("Erro ao imprimir fila:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark all selected as printed manually
  const handleMarkAsPrinted = () => {
    const visibleIds = filteredQueueItems.map(item => item.id);
    const selectedVisibleIds = visibleIds.filter(id => selectedQueueIds.includes(id));
    if (selectedVisibleIds.length === 0) return;

    const updated = Array.from(new Set([...printedTagIds, ...selectedVisibleIds]));
    setPrintedTagIds(updated);
    localStorage.setItem('orbis_printed_tag_ids', JSON.stringify(updated));
  };

  // Reset print status
  const handleResetPrintedStatus = () => {
    if (window.confirm("Deseja redefinir o status de todas as etiquetas para 'Pendente'?")) {
      setPrintedTagIds([]);
      localStorage.removeItem('orbis_printed_tag_ids');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
              <Tag className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                Fila de Etiquetas & Impressão Central
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Orbis Engenharia Clínica e Hospitalar - Impressão Integrada do Fluxo de Auditoria HU
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleHelp}
              className={`p-1.5 rounded-lg border transition-all text-xs flex items-center gap-1 font-bold cursor-pointer ${
                showHelpBanner 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title="Ajuda & Regras do Padrão Clínico Orbis/HU"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Padrão Clínico ?</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white font-bold text-xs p-1.5 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'queue'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              Fila de Espera de Impressão ({queueItems.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`flex-1 py-3 px-4 text-xs font-black uppercase tracking-wider text-center border-b-2 transition-all ${
              activeTab === 'individual'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Printer className="w-4 h-4 text-emerald-500" />
              Gerar Etiqueta Avulsa
            </span>
          </button>
        </div>

        {/* Modal Main Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-900 border border-red-150 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <p>{errorMsg}</p>
            </div>
          )}

          <AnimatePresence>
            {showHelpBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/60 dark:bg-indigo-950/20 text-xs space-y-3">
                  <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black uppercase tracking-wider">
                    <HelpCircle className="w-4 h-4 text-indigo-600" />
                    <span>Regras do Padrão Clínico de Identificação Orbis/HU</span>
                  </div>
                  
                  <p className="text-slate-755 dark:text-slate-300 leading-relaxed font-medium">
                    O código do ativo segue rigorosamente a estrutura oficial de engenharia clínica: <br />
                    <span className="inline-block mt-1 font-mono font-black text-xs bg-indigo-100 dark:bg-indigo-950/60 px-2 py-0.5 text-indigo-700 dark:text-indigo-400 rounded">
                      HU-[SIGLA]-[SEQUENCIAL]-ORB
                    </span>
                  </p>

                  <ul className="list-disc pl-4 space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <li>
                      <strong>QR Code Dinâmico:</strong> Incorpora o endereço direto da pasta de nuvem do ativo (Google Drive) se já sincronizado, ou o link direto de busca para rastreio imediato de histórico no servidor.
                    </li>
                    <li>
                      <strong>Acesso Instantâneo:</strong> Ao escanear o QR Code com qualquer câmera de smartphone, o técnico é direcionado imediatamente aos relatórios, manuais técnicos e histórico central de calibrações e auditorias, sem necessidade de estar fisicamente conectado à rede de cabos ou preso ao computador!
                    </li>
                    <li>
                      <strong>Como imprimir em campo:</strong> A fila reúne de forma simplificada e em lote todos os ativos identificados no celular. Você pode carregar e disparar as demandas de impressão via rede Wi-Fi/Zebra ou baixar o arquivo ZPL para controle local simplificado.
                    </li>
                  </ul>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={handleToggleHelp}
                      className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Entendi, Ocultar Painel
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SHARED CONTROL PANEL: Auditor Identity & Stamp parameters */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Auditor Responsável (Nome ou Registro RE)
              </label>
              <input
                type="text"
                placeholder="Ex: Lucas Souza (RE-5928)"
                value={auditorInfo}
                onChange={(e) => setAuditorInfo(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-800 dark:text-slate-100 font-bold"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Data de Execução da Auditoria
              </label>
              <input
                type="text"
                placeholder="Ex: 05/07/2026"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-800 dark:text-slate-100 font-bold"
              />
            </div>
          </div>

          {/* ZEBRA ZD220 PRINTER SETTINGS PANEL */}
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsZebraConfigOpen(!isZebraConfigOpen)}
              className="w-full flex items-center justify-between p-3.5 bg-slate-100 dark:bg-slate-900/80 text-left cursor-pointer hover:bg-slate-150/70 dark:hover:bg-slate-800/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Configurações da Impressora Zebra ZD220
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Método selecionado: {
                      printMethod === 'browser' ? 'Navegador (PDF)' :
                      printMethod === 'network' ? `Rede (${zebraIp || 'IP não informado'}:${zebraPort})` :
                      printMethod === 'browser_print' ? 'Local USB (Browser Print)' :
                      printMethod === 'download_zpl' ? 'Download ZPL' : 'Copiar ZPL'
                    }
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-slate-400">
                {isZebraConfigOpen ? 'Ocultar ▲' : 'Configurar ▼'}
              </span>
            </button>

            {isZebraConfigOpen && (
              <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 space-y-4 animate-fade-in text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Select Connection Method */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Método de Saída / Conexão
                    </label>
                    <select
                      value={printMethod}
                      onChange={(e) => setPrintMethod(e.target.value as any)}
                      className="w-full text-xs p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="browser">Imprimir via Navegador (Padrão PDF)</option>
                      <option value="network">Rede TCP/IP Direta (ZD220 Ethernet/Wi-Fi)</option>
                      <option value="browser_print">Zebra Browser Print (ZD220 USB Local)</option>
                      <option value="download_zpl">Salvar Arquivo ZPL (.zpl)</option>
                      <option value="copy_zpl">Copiar Código ZPL p/ área de transferência</option>
                    </select>
                  </div>

                  {/* Contextual Settings based on method */}
                  {printMethod === 'network' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          IP da Impressora
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: 192.168.1.150"
                          value={zebraIp}
                          onChange={(e) => setZebraIp(e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-800 dark:text-slate-100 font-mono font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Porta TCP
                        </label>
                        <input
                          type="text"
                          placeholder="9100"
                          value={zebraPort}
                          onChange={(e) => setZebraPort(e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-800 dark:text-slate-100 font-mono font-bold"
                        />
                      </div>
                    </div>
                  )}

                  {printMethod === 'browser_print' && (
                    <div className="space-y-2">
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                        Status do Zebra Browser Print Local
                      </label>
                      <div className="flex gap-2 items-center">
                        <button
                          type="button"
                          onClick={detectLocalZebra}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                        >
                          Detectar Impressora USB
                        </button>
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold bg-white dark:bg-slate-900 px-2 py-1.5 border border-slate-200 dark:border-slate-800 rounded-lg flex-1">
                          {zebraStatus}
                        </span>
                      </div>
                    </div>
                  )}

                  {printMethod === 'browser' && (
                    <div className="flex items-center p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 rounded-lg text-[11px] text-slate-600 dark:text-slate-300">
                      Ideal para testar sem impressora física ou imprimir em impressoras comuns de escritório. Abre uma janela de visualização limpa.
                    </div>
                  )}

                  {(printMethod === 'download_zpl' || printMethod === 'copy_zpl') && (
                    <div className="flex items-center p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100/50 rounded-lg text-[11px] text-slate-600 dark:text-slate-300">
                      Gera comandos nativos em Zebra Programming Language (ZPL) compatíveis com a ZD220 para você spolar manualmente.
                    </div>
                  )}

                </div>

                {/* RECOMMENDED LABEL MODEL SPECS FOR ZD220 */}
                <div className="hidden sm:block p-3 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                  <h5 className="font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                    <span>📋</span>
                    <span>Especificação de Etiqueta Homologada (Zebra ZD220)</span>
                  </h5>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    <strong>Dimensões:</strong> 50mm x 30mm (Borracha Adesiva de Alta Aderência). <br />
                    <strong>Material Sugerido:</strong> BOPP Fosco ou Poliéster Prata (impermeável e resistente a álcool 70% ou fricção clínica). <br />
                    <strong>Ribbon:</strong> Resina Total (garante legibilidade eterna contra intempéries químicas hospitalares).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* LABEL TEMPLATE CONFIGURATION PANEL */}
          <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-indigo-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                Modelo e Dimensões da Etiqueta (Zebra ZD220)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Dimensions Option */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Dimensões da Etiqueta
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelSize('50x30')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      labelSize === '50x30'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    50mm x 30mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelSize('50x50')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      labelSize === '50x50'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    50mm x 50mm
                  </button>
                </div>
              </div>

              {/* Layout Option */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  Layout de Informações
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setLabelLayout('minimal')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      labelLayout === 'minimal'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    Mínimo (Código + QR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelLayout('standard')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      labelLayout === 'standard'
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850'
                    }`}
                  >
                    Completo (Ficha Ativo)
                  </button>
                </div>
              </div>
            </div>

            <p className="hidden sm:block text-[10px] text-slate-500 leading-relaxed bg-white dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-200/50 dark:border-slate-800/40">
              {labelLayout === 'minimal' 
                ? '💡 O modelo Mínimo é ideal para economizar espaço e evitar redundância visual. Contém apenas a identificação corporativa "Orbis", o QR-Code de leitura rápida e o código exclusivo do ativo (Ex: HU-SVI-000001-ORB) para consulta móvel total.' 
                : '💡 O modelo Completo imprime todos os metadados técnicos diretamente na etiqueta física, incluindo Equipamento, Marca/Modelo, Setor, S/N e as informações do auditor.'}
            </p>
          </div>

          {activeTab === 'queue' ? (
            /* TAB 1: INTEGRATED PRINT QUEUE */
            <div className="space-y-4">
              
              {/* Queue Controls and Filtering */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/40 dark:bg-slate-950/40 p-3 rounded-xl border border-indigo-100/60 dark:border-slate-850/60">
                <div className="flex items-center gap-2">
                  <ListFilter className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Status na Fila:</span>
                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-white dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setFilterMode('pending')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer ${
                        filterMode === 'pending' 
                          ? 'bg-indigo-600 text-white' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Pendente ({queueItems.filter(i => !i.isPrinted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('printed')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer ${
                        filterMode === 'printed' 
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Impresso ({queueItems.filter(i => i.isPrinted).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('all')}
                      className={`px-2.5 py-1 text-[10px] font-bold rounded-md cursor-pointer ${
                        filterMode === 'all' 
                          ? 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-100' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Todos ({queueItems.length})
                    </button>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleResetPrintedStatus}
                    className="flex-1 sm:flex-none px-3 py-1.5 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-[10px] font-bold rounded-lg cursor-pointer text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    Redefinir Status
                  </button>
                  <button
                    type="button"
                    onClick={handleMarkAsPrinted}
                    disabled={selectedQueueIds.length === 0}
                    className="flex-1 sm:flex-none px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    Marcar Selecionadas como Impresso
                  </button>
                </div>
              </div>

              {/* Queue Listing */}
              {filteredQueueItems.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-5 h-5 text-slate-400" />
                  </div>
                  <h4 className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">Nenhum equipamento nesta categoria</h4>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Os equipamentos auditados e verificados aparecem automaticamente aqui. Realize inspeções na tela principal para popular sua fila de impressão!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                  
                  {/* Table (Left column, span 7) */}
                  <div className="md:col-span-7 space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-[10px] font-extrabold uppercase text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        {filteredQueueItems.every(i => selectedQueueIds.includes(i.id)) ? (
                          <>Desmarcar Todas as Visíveis</>
                        ) : (
                          <>Selecionar Todas as Visíveis</>
                        )}
                      </button>
                      <span className="text-[10px] font-bold text-slate-400">
                        {selectedQueueIds.filter(id => filteredQueueItems.some(i => i.id === id)).length} de {filteredQueueItems.length} selecionados
                      </span>
                    </div>

                    {/* Table view */}
                    <div className="border border-slate-200 dark:border-slate-850 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm max-h-[350px] overflow-y-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-950 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 dark:border-slate-850">
                            <th className="p-3 w-10 text-center">Sel</th>
                            <th className="p-3">Equipamento / Modelo</th>
                            <th className="p-3">Código</th>
                            <th className="p-3 text-center">Drive</th>
                            <th className="p-3 text-center">Imp.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150 dark:divide-slate-850">
                          {filteredQueueItems.map((item) => {
                            const isSelected = selectedQueueIds.includes(item.id);
                            return (
                              <tr 
                                key={item.id}
                                onClick={() => handleToggleSelectItem(item.id)}
                                className={`text-xs hover:bg-slate-50/60 dark:hover:bg-slate-850/50 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-indigo-50/15 dark:bg-slate-850/30' : ''
                                }`}
                              >
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSelectItem(item.id)}
                                    className="text-slate-400 hover:text-indigo-600 transition-colors"
                                  >
                                    {isSelected ? (
                                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                                    ) : (
                                      <Square className="w-4 h-4 text-slate-300" />
                                    )}
                                  </button>
                                </td>
                                <td className="p-3">
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{item.equipamento}</div>
                                  <div className="text-[10px] text-slate-400">{item.fabricante} {item.modelo}</div>
                                </td>
                                <td className="p-3 font-mono font-black text-slate-700 dark:text-slate-300 text-[11px]">
                                  {item.code}
                                </td>
                                <td className="p-3 text-center">
                                  {item.driveFolderUrl ? (
                                    <span className="inline-flex px-1.5 py-0.5 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-900 text-[9px] font-black rounded" title={item.driveFolderUrl}>
                                      Sim
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-400 text-[9px] font-bold rounded">
                                      Não
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  {item.isPrinted ? (
                                    <span className="inline-flex px-1.5 py-0.5 bg-emerald-500 text-slate-950 text-[9px] font-extrabold rounded-full">
                                      Sim
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold rounded-full">
                                      Não
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-2 justify-end">
                      <button
                        type="button"
                        onClick={handlePrintSelectedQueue}
                        disabled={isLoading || selectedQueueIds.length === 0}
                        className="w-full py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-wider rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
                      >
                        <Printer className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Imprimir {selectedQueueIds.length} Etiquetas Selecionadas (Lote)
                      </button>
                    </div>
                  </div>

                  {/* Preview (Right column, span 5) */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 self-start flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      Prévia do Modelo da Etiqueta
                    </span>
                    
                    {previewItem ? (
                      <>
                        <StickerPreview 
                          code={previewItem.code}
                          equipamento={previewItem.equipamento || ''}
                          marcaModelo={previewItem.fabricante && previewItem.modelo ? `${previewItem.fabricante} / ${previewItem.modelo}` : previewItem.fabricante || previewItem.modelo || ''}
                          setor={previewItem.setor || ''}
                          numSerie={previewItem.numSerie || ''}
                          auditor={auditorInfo}
                          data={auditDate}
                          driveFolderUrl={previewItem.driveFolderUrl}
                          labelSize={labelSize}
                          labelLayout={labelLayout}
                        />
                        <div className="text-center text-[10px] text-slate-400 max-w-[240px] leading-relaxed">
                          Mostrando prévia para <span className="font-bold text-slate-800 dark:text-slate-200">{previewItem.equipamento}</span>. Altere as opções acima de tamanho e layout para atualizar instantaneamente o modelo!
                        </div>
                      </>
                    ) : (
                      <div className="w-full max-w-[280px] h-[170px] bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center p-4">
                        <Printer className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fila Sem Ativos Disponíveis</span>
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>
          ) : (
            /* TAB 2: INDIVIDUAL MANUAL TAG GENERATOR */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              
              {/* Form Controls Column */}
              <div className="md:col-span-7 space-y-4">
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 animate-pulse" />
                      Classificação & Sequência
                    </span>
                    {activeFormFields && (
                      <button
                        type="button"
                        onClick={handlePullFromForm}
                        className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                        title="Puxa os dados do formulário que está aberto na tela principal"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Puxar Dados do Form Ativo
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Select Code Format */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Padrão do Código do Ativo
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCodeFormat('simplified');
                            setCustomSequenceNumber('');
                          }}
                          className={`p-2 rounded-lg text-[10px] font-bold border text-center transition-all cursor-pointer ${
                            codeFormat === 'simplified'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-extrabold text-[11px]">Simplificado Orbis</div>
                          <div className="opacity-80">Ex: TERM-001, SVI-002</div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCodeFormat('standard');
                            setCustomSequenceNumber('');
                          }}
                          className={`p-2 rounded-lg text-[10px] font-bold border text-center transition-all cursor-pointer ${
                            codeFormat === 'standard'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="font-extrabold text-[11px]">HU Completo</div>
                          <div className="opacity-80">Ex: HU-SVI-000002-ORB</div>
                        </button>
                      </div>
                    </div>

                    {/* Sigla Criticality Selector */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Categoria de Criticidade (Sigla)
                      </label>
                      <select
                        value={selectedSigla}
                        onChange={(e) => {
                          setSelectedSigla(e.target.value as SiglaType);
                          setCustomSequenceNumber(''); // reset custom
                        }}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800 dark:text-slate-100 font-semibold"
                      >
                        <option value="SVI">SVI - Suporte à Vida</option>
                        <option value="MON">MON - Monitorização e Diagnóstico</option>
                        <option value="TERM">TERM - Termodesinfectoras / Esterilização</option>
                        <option value="TER">TER - Terapia e Apoio Clínico</option>
                        <option value="DTI">DTI - Diretoria de Tecnologia da Informação</option>
                        <option value="MET">MET - Metrologia e Equipamentos de Teste</option>
                      </select>
                      
                      <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                        <strong>Grupo:</strong> {SIGLAS_INFO[selectedSigla]?.name} &mdash; {SIGLAS_INFO[selectedSigla]?.desc}
                      </p>
                    </div>

                    {/* Sequential Number (editable) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          Sequencial ({codeFormat === 'simplified' ? '3 dígitos' : '6 dígitos'})
                        </label>
                        <span className="text-[9px] text-indigo-500 font-bold">
                          Próximo automático: {String(currentSeqNum).padStart(codeFormat === 'simplified' ? 3 : 6, '0')}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder={String(currentSeqNum).padStart(codeFormat === 'simplified' ? 3 : 6, '0')}
                        value={customSequenceNumber}
                        onChange={(e) => {
                          const maxLen = codeFormat === 'simplified' ? 3 : 6;
                          const val = e.target.value.replace(/\D/g, '').substring(0, maxLen);
                          setCustomSequenceNumber(val);
                        }}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800 dark:text-slate-100"
                      />
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        Deixe em branco para usar o contador automático do banco ou digite para forçar uma sequência específica.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Additional sticker meta data */}
                <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 space-y-3.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 block">
                    Metadados da Etiqueta (Impressão opcional)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nome do Ativo</label>
                      <input
                        type="text"
                        placeholder="Ex: VENTILADOR UTI"
                        value={tagEquipamento}
                        onChange={(e) => setTagEquipamento(e.target.value)}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Marca / Modelo</label>
                      <input
                        type="text"
                        placeholder="Ex: MINDRAY / SV-300"
                        value={tagMarcaModelo}
                        onChange={(e) => setTagMarcaModelo(e.target.value)}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Setor Vinculado</label>
                      <select
                        value={tagSetor}
                        onChange={(e) => setTagSetor(e.target.value)}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg cursor-pointer text-slate-700 dark:text-slate-300"
                      >
                        <option value="">Selecione um Setor (Opcional)</option>
                        {sectorsList.map((sec) => (
                          <option key={sec.id} value={sec.name}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Número de Série (S/N)</label>
                      <input
                        type="text"
                        placeholder="Ex: GB-52088"
                        value={tagNumSerie}
                        onChange={(e) => setTagNumSerie(e.target.value)}
                        className="w-full text-xs p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                {/* Operations & Form integration actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  {onApplyCodeToForm && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyCodeToForm(generatedCode);
                        handleConfirmAndIncrement();
                        onClose();
                      }}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Link className="w-4 h-4" />
                      Vincular ao Form & Consumir
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmAndIncrement}
                    disabled={isLoading}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-750"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Reservar Nº & Avançar Sequência
                  </button>
                </div>
              </div>

              {/* Thermal Printer Live Sticker Preview Column */}
              <div className="md:col-span-5 flex flex-col items-center justify-center space-y-4">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 self-start">
                  Visualização da Impressora Térmica
                </span>

                {/* Simulated ribbon roll sticker */}
                <StickerPreview 
                  code={generatedCode}
                  equipamento={tagEquipamento}
                  marcaModelo={tagMarcaModelo}
                  setor={tagSetor}
                  numSerie={tagNumSerie}
                  auditor={auditorInfo}
                  data={auditDate}
                  driveFolderUrl={activeFormFields?.driveFolderUrl}
                  labelSize={labelSize}
                  labelLayout={labelLayout}
                />

                {/* Actions */}
                <div className="flex gap-2 w-full max-w-[280px]">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-750 text-[11px] font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? 'Copiado!' : 'Copiar Código'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintSingle}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/20 text-[11px] font-bold rounded-lg cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir Térmica
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Instructions Panel */}
        <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800/80 flex items-start gap-2.5 text-slate-500 text-[10px] leading-relaxed">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
              Regras do Padrão Clínico de Identificação Orbis/HU:
            </p>
            <p className="mt-0.5">
              O código segue rigorosamente o padrão: <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded font-bold text-slate-800 dark:text-slate-200">HU-[SIGLA]-[SEQUENCIAL]-ORB</code>.
              O QR Code gerado incorpora o <strong>endereço direto da pasta do Google Drive</strong> do ativo (se sincronizado) ou o <strong>link direto para busca imediata de histórico no servidor</strong>. Isto assegura que ao escanear com qualquer câmera de smartphone, o técnico seja levado instantaneamente aos relatórios, manuais e histórico central de auditoria do ativo, sem ficar parado na frente da máquina!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 text-right flex justify-between items-center">
          <span className="text-[9px] text-slate-400 font-bold font-mono">
            Modo Integrado Fila de Espera & Lotes
          </span>
          <button
            onClick={onClose}
            className="py-1.5 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg cursor-pointer transition-colors"
          >
            Fechar Gerador
          </button>
        </div>
      </motion.div>
    </div>
  );
}
