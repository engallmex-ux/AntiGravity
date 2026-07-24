import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileSpreadsheet, Trash2, Calendar, FileText, Search, ExternalLink, RefreshCw, Layers,
  Cloud, Check, AlertCircle, Eye, HardDrive, Share2, Award, BarChart2, MessageSquare,
  MapPin, Globe, FolderOpen, FileDown, Copy, Database, Printer, X
} from 'lucide-react';
import { InspectionRecord } from '../types';
import { generateInspectionPDF } from '../lib/pdfGenerator';
import QRCode from 'qrcode';

interface HistoryListProps {
  records: InspectionRecord[];
  onLoadRecord: (record: InspectionRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearHistory: () => void;
  isGoogleConnected: boolean;
  onSyncToGoogle: (record: InspectionRecord) => Promise<void>;
  syncingRecordId: string | null;
  allInspections?: Array<{ numPatrimonio?: string; numSerie?: string; timestamp: string; auditorNome?: string; equipamento: string }>;
  onPrintRecord?: (recordId: string) => void;
  isJsonExportEnabled?: boolean;
}

function getInitials(name?: string): string {
  if (!name) return "TEC";
  const clean = name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TEC";
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 3);
}

export default function HistoryList({
  records,
  onLoadRecord,
  onDeleteRecord,
  onClearHistory,
  isGoogleConnected,
  onSyncToGoogle,
  syncingRecordId,
  allInspections = [],
  onPrintRecord,
  isJsonExportEnabled = false
}: HistoryListProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'records' | 'dashboard' | 'json_history'>('records');
  const [isGeneratingPdfId, setIsGeneratingPdfId] = useState<string | null>(null);

  // JSON History states
  const [jsonHistories, setJsonHistories] = useState<any[]>([]);
  const [isLoadingHistories, setIsLoadingHistories] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);

  // Label preview states
  const [selectedPreviewRecord, setSelectedPreviewRecord] = useState<InspectionRecord | null>(null);
  const [previewQrUrl, setPreviewQrUrl] = useState<string>('');
  const [previewFormatSize, setPreviewFormatSize] = useState<'50x30' | '50x50'>('50x30');
  const [previewFormatLayout, setPreviewFormatLayout] = useState<'standard' | 'minimal'>('minimal');

  useEffect(() => {
    if (selectedPreviewRecord) {
      const rawCode = (selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim();
      const code = rawCode.startsWith('HU-') ? rawCode : `HU-SVI-${rawCode.padStart(6, '0')}-ORB`;
      const qrContent = selectedPreviewRecord.driveFolderUrl || `${window.location.origin}/?search=${code}`;
      QRCode.toDataURL(qrContent, { margin: 1, width: 150 }, (err, url) => {
        if (!err) {
          setPreviewQrUrl(url);
        } else {
          console.error("Erro ao gerar QR Code:", err);
        }
      });
    } else {
      setPreviewQrUrl('');
    }
  }, [selectedPreviewRecord]);

  useEffect(() => {
    if (activeTab === 'json_history') {
      fetchJsonHistories();
    }
  }, [activeTab]);

  const fetchJsonHistories = async () => {
    setIsLoadingHistories(true);
    try {
      const res = await fetch("/api/historicos");
      if (res.ok) {
        const data = await res.json();
        setJsonHistories(data);
      }
    } catch (err) {
      console.error("Error fetching json histories:", err);
    } finally {
      setIsLoadingHistories(false);
    }
  };

  const handleDeleteJsonHistory = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este histórico JSON?")) return;
    try {
      const res = await fetch(`/api/historicos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setJsonHistories(prev => prev.filter(item => item.id !== id));
      }
    } catch (err) {
      console.error("Error deleting json history:", err);
    }
  };

  const handleClearAllJsonHistories = async () => {
    if (!confirm("Tem certeza que deseja apagar TODOS os históricos JSON? Isso removerá os backups locais e de nuvem vinculados.")) return;
    try {
      const res = await fetch(`/api/historicos`, { method: 'DELETE' });
      if (res.ok) {
        setJsonHistories([]);
      }
    } catch (err) {
      console.error("Error clearing json histories:", err);
    }
  };

  const handleCopyJsonToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHistoryId(id);
    setTimeout(() => setCopiedHistoryId(null), 2000);
  };

  // Compute real-time leaderboard and production statistics
  const stats = useMemo(() => {
    // If we have combined database (Local + Sheet rows), prioritize it for ranking
    const list = allInspections.length > 0 ? allInspections : records.map(rec => ({
      numPatrimonio: rec.numPatrimonio,
      numSerie: rec.numSerie,
      timestamp: rec.timestamp,
      auditorNome: rec.auditorNome || 'Técnico Local',
      equipamento: rec.equipamento
    }));

    const auditorMap: { [key: string]: number } = {};
    const equipmentMap: { [key: string]: number } = {};
    
    list.forEach(item => {
      const name = item.auditorNome || 'Técnico Local';
      auditorMap[name] = (auditorMap[name] || 0) + 1;
      
      const eq = item.equipamento || 'Outros';
      equipmentMap[eq] = (equipmentMap[eq] || 0) + 1;
    });

    const sortedAuditors = Object.entries(auditorMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const sortedEquipments = Object.entries(equipmentMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total: list.length,
      rankings: sortedAuditors,
      equipments: sortedEquipments
    };
  }, [allInspections, records]);

  // Generate and share the formatted summary text on WhatsApp
  const shareOnWhatsApp = () => {
    const dateStr = new Date().toLocaleDateString('pt-BR');
    
    let text = `*🏥 ENG. CLÍNICA - RELATÓRIO DE INSPEÇÕES*\n`;
    text += `📅 *Data:* ${dateStr}\n`;
    text += `🛠️ *Equipamentos Analisados:* ${stats.total} ativos cadastrados\n\n`;
    
    text += `🏆 *RANKING DE ATIVIDADES (TÉCNICOS):*\n`;
    if (stats.rankings.length === 0) {
      text += `• Nenhum técnico registrou ativos ainda.\n`;
    } else {
      stats.rankings.slice(0, 5).forEach((item, index) => {
        text += `${index + 1}º ${item.name}: ${item.count} ativo(s)\n`;
      });
    }
    
    text += `\n📦 *EQUIPAMENTOS MAIS INSPECONADOS:*\n`;
    if (stats.equipments.length === 0) {
      text += `• N/D\n`;
    } else {
      stats.equipments.slice(0, 3).forEach(item => {
        text += `• ${item.name}: ${item.count} unidades\n`;
      });
    }
    
    text += `\n🌐 _Relatório unificado em tempo real via OrbisTracker HU-Brasil_`;
    
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Generate and share a specific inspection's detailed summary text on WhatsApp
  const shareRecordOnWhatsApp = (rec: InspectionRecord) => {
    const dateStr = new Date(rec.timestamp).toLocaleDateString('pt-BR');
    const timeStr = new Date(rec.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let text = `*🏥 ENG. CLÍNICA - LAUDO DE INSPEÇÃO TÉCNICA*\n\n`;
    text += `⚙️ *Ativo:* ${rec.equipamento.toUpperCase()}\n`;
    if (rec.ativoCodigo) {
      text += `🆔 *Código do Ativo:* ${rec.ativoCodigo.toUpperCase()}\n`;
    }
    text += `🏭 *Fabricante/Modelo:* ${rec.fabricante} / ${rec.modelo}\n`;
    text += `🔢 *Nº de Série:* ${rec.numSerie}\n`;
    if (rec.numPatrimonio) {
      text += `🏷️ *Patrimônio:* ${rec.numPatrimonio}\n`;
    }
    text += `📍 *Setor de Localização:* ${rec.setor || 'Geral'}\n`;
    text += `🚥 *Condição:* ${rec.condicao || 'N/A'}\n`;
    if (rec.numeroOSGets) {
      text += `🛠️ *O.S. GETS:* ${rec.numeroOSGets}\n`;
    }
    if (rec.latitude && rec.longitude) {
      text += `🗺️ *GPS:* ${rec.latitude.toFixed(6)}, ${rec.longitude.toFixed(6)}\n`;
    }
    
    text += `\n*🔍 STATUS DE MANUTENÇÃO & CALIBRAÇÃO:*\n`;
    text += `• *Calibração:* ${rec.temCalibracao ? `✅ Realizada (${rec.dataCal}) - Próx: *${rec.proxCal}*` : '❌ Não possui ou vencida'}\n`;
    text += `• *M. Preventiva:* ${rec.temManutencao ? `✅ Realizada (${rec.dataManut}) - Próx: *${rec.proxManut}*` : '❌ Não possui ou vencida'}\n`;
    text += `• *Seg. Elétrica:* ${rec.temSegurancaEletrica ? `✅ Realizada (${rec.dataSegElet}) - Próx: *${rec.proxSegElet}*` : '❌ Não possui'}\n`;
    
    if (rec.accessories && rec.accessories.length > 0) {
      text += `\n📦 *Acessórios Cadastrados (${rec.accessories.length}):*\n`;
      rec.accessories.forEach((acc, idx) => {
        text += `  • [${acc.codigoAcessorio || `ACC-${idx+1}`}] ${acc.tipo}: ${acc.descricao}${acc.numSerie ? ` (S/N: ${acc.numSerie})` : ''}\n`;
      });
    }

    if (rec.observacoes && rec.observacoes.trim()) {
      text += `\n📝 *Observações Técnicas:*\n_${rec.observacoes.trim()}_\n`;
    }

    const driveUrl = rec.driveFolderUrl || (rec.googleDriveLinks && rec.googleDriveLinks[0]) || `https://drive.google.com/drive/u/0/search?q=${encodeURIComponent(rec.ativoCodigo || rec.numSerie || rec.equipamento)}`;
    text += `\n📂 *Pasta do Ativo no Google Drive:* ${driveUrl}\n`;
    
    text += `\n👤 *Auditor:* ${rec.auditorNome || 'Técnico Autorizado'}\n`;
    text += `📅 *Data/Hora:* ${dateStr} às ${timeStr}\n\n`;
    text += `_Laudo técnico gerado via OrbisTracker HU-BR_`;
    
    const encodedText = encodeURIComponent(text);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
  };

  // Filter records based on search
  const filteredRecords = records.filter(rec => {
    const term = searchTerm.toLowerCase();
    return (
      rec.equipamento.toLowerCase().includes(term) ||
      rec.fabricante.toLowerCase().includes(term) ||
      rec.modelo.toLowerCase().includes(term) ||
      rec.numSerie.toLowerCase().includes(term) ||
      rec.numPatrimonio.toLowerCase().includes(term)
    );
  });

  // Export history to CSV format
  const exportToCSV = () => {
    if (records.length === 0) return;

    // Define CSV Headers in Portuguese
    const headers = [
      'ID', 'Data de Registro', 'Equipamento', 'Fabricante', 'Modelo', 
      'Numero de Serie', 'Numero de Patrimonio', 'Setor', 'Observacoes',
      'Possui Calibracao', 'Calibrado Por', 'Data da Calibracao', 'Proxima Calibracao',
      'Possui Preventiva', 'Preventiva Por', 'Data da Preventiva', 'Proxima Preventiva',
      'Possui Seg. Eletrica', 'Seg. Eletrica Por', 'Data Seg. Eletrica', 'Proxima Seg. Eletrica',
      'Latitude', 'Longitude', 'Equipamento Novo', 'No OS (GETS)', 'Codigo do Ativo',
      'Propriedade', 'Link do Manual', 'Pasta Google Drive', 'Lista de Acessorios'
    ];
 
    const rows = records.map(rec => {
      const accessoriesText = rec.accessories && rec.accessories.length > 0
        ? rec.accessories.map((acc, idx) => {
            const cod = acc.codigoAcessorio || `${rec.ativoCodigo || 'EQP'}-ACC-${idx+1}`;
            return `[${cod}] ${acc.tipo}: ${acc.descricao}${acc.numSerie ? ` (S/N: ${acc.numSerie})` : ''}`;
          }).join('; ')
        : 'Nenhum';

      return [
        rec.id,
        new Date(rec.timestamp).toLocaleString('pt-BR'),
        `"${rec.equipamento.replace(/"/g, '""')}"`,
        `"${rec.fabricante.replace(/"/g, '""')}"`,
        `"${rec.modelo.replace(/"/g, '""')}"`,
        `"${rec.numSerie.replace(/"/g, '""')}"`,
        `"${rec.numPatrimonio.replace(/"/g, '""')}"`,
        `"${rec.setor.replace(/"/g, '""')}"`,
        `"${rec.observacoes.replace(/"/g, '""')}"`,
        rec.temCalibracao ? 'SIM' : 'NAO',
        `"${rec.executadoPorCal.replace(/"/g, '""')}"`,
        rec.dataCal,
        rec.proxCal,
        rec.temManutencao ? 'SIM' : 'NAO',
        `"${rec.executadoPorManut.replace(/"/g, '""')}"`,
        rec.dataManut,
        rec.proxManut,
        rec.temSegurancaEletrica ? 'SIM' : 'NAO',
        `"${rec.executadoPorSegElet.replace(/"/g, '""')}"`,
        rec.dataSegElet,
        rec.proxSegElet,
        rec.latitude !== undefined ? rec.latitude : '',
        rec.longitude !== undefined ? rec.longitude : '',
        rec.isNewEquipment ? 'SIM' : 'NAO',
        `"${(rec.numeroOSGets || '').replace(/"/g, '""')}"`,
        `"${(rec.ativoCodigo || '').replace(/"/g, '""')}"`,
        `"${(rec.propriedade || 'Próprio').replace(/"/g, '""')}"`,
        `"${(rec.linkManual || '').replace(/"/g, '""')}"`,
        `"${(rec.driveFolderUrl || '').replace(/"/g, '""')}"`,
        `"${accessoriesText.replace(/"/g, '""')}"`
      ];
    });

    // Build CSV content
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    // Create blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `historico_inspecoes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id="history-list-container">
      {/* Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
        <div>
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Histórico Local de Inspeções ({records.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualize os registros de inspeção técnica salvos localmente no seu dispositivo.
          </p>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-slate-100 bg-slate-50/20 px-5">
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'records'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          Registros Ativos ({records.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Painel de Desempenho & Ranking
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('json_history')}
          className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'json_history'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-4 h-4 text-amber-600" />
          Históricos JSON (Nuvem / Backups)
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="p-5 space-y-6">
          {/* Quick Header Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl">
            <div>
              <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Resumo para a Gestão</h3>
              <p className="text-[11px] text-emerald-600 mt-0.5">
                Compartilhe o andamento das inspeções por WhatsApp ou acompanhe a produtividade dos técnicos do hospital.
              </p>
            </div>
            <button
              type="button"
              onClick={shareOnWhatsApp}
              className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow transition-all active:scale-[0.98] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              Compartilhar no WhatsApp
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leaderboard Section */}
            <div className="bg-slate-50/60 p-5 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Award className="w-4 h-4 text-amber-500 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Produtividade por Técnico</h4>
              </div>

              {stats.rankings.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Nenhum registro para exibir. Conecte sua conta Google para rastrear atividades em tempo real.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {stats.rankings.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 
                            ? 'bg-amber-100 text-amber-800' 
                            : idx === 1 
                            ? 'bg-slate-200 text-slate-700' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-700">{item.name}</span>
                      </div>
                      <div className="font-mono font-bold text-emerald-600">
                        {item.count} ativo{item.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Equipment Breakdown Section */}
            <div className="bg-slate-50/60 p-5 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <BarChart2 className="w-4 h-4 text-blue-500" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Volume por Tipo de Ativo</h4>
              </div>

              {stats.equipments.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  Nenhum equipamento registrado.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {stats.equipments.slice(0, 5).map((item) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-600 font-semibold">
                        <span>{item.name}</span>
                        <span className="font-bold text-slate-700">{item.count} un.</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200/60 rounded-full overflow-hidden border border-slate-100">
                        <div 
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                          style={{ width: `${Math.max(4, Math.min(100, (item.count / (stats.total || 1)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'json_history' ? (
        <div className="p-5 space-y-6" id="json-history-view">
          {/* Header row inside tab */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50/50 border border-amber-100 p-4 rounded-xl">
            <div>
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-600 animate-pulse" />
                Repositório Central de Históricos JSON
              </h3>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Estes arquivos seguem o padrão <span className="font-mono bg-amber-100/60 px-1 rounded">HU-[SIGLA]-[SEQUENCIAL]-ORB_AAAAMMDD_HHMM_INIT.json</span> e servem para backup e exportação para outras plataformas de Engenharia Clínica.
              </p>
            </div>
            {jsonHistories.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllJsonHistories}
                className="py-2 px-3 text-red-600 hover:bg-red-50 text-xs font-bold rounded-lg border border-red-200 transition-all cursor-pointer"
              >
                Limpar Todos os Backups
              </button>
            )}
          </div>

          {isLoadingHistories ? (
            <div className="text-center py-12 text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-600" />
              <span className="text-xs font-medium">Buscando históricos JSON no servidor e no banco de dados Firestore...</span>
            </div>
          ) : jsonHistories.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3 animate-bounce" />
              <p className="text-sm font-semibold text-slate-700">Nenhum histórico JSON gerado ainda.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Sempre que você criar ou atualizar uma inspeção, ou sincronizar com o Google Drive, um arquivo de backup padrão em formato JSON será gerado automaticamente.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                <span>Mostrando {jsonHistories.length} arquivos JSON de histórico armazenados</span>
                <button
                  type="button"
                  onClick={fetchJsonHistories}
                  className="p-1 text-slate-500 hover:text-emerald-600 rounded hover:bg-slate-100 transition-all cursor-pointer"
                  title="Atualizar lista"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              <div className="border border-slate-200/60 rounded-xl overflow-hidden shadow-sm bg-white divide-y divide-slate-100">
                {jsonHistories.map((hist) => {
                  const isExpanded = expandedHistoryId === hist.id;
                  const recordString = JSON.stringify(hist.record || hist, null, 2);
                  return (
                    <div key={hist.id} className="p-4 hover:bg-slate-50/40 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                              {hist.ativoCodigo || "CÓDIGO N/D"}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 font-mono text-ellipsis overflow-hidden max-w-xs sm:max-w-md" title={hist.fileName}>
                              {hist.fileName}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>📅 Gerado em: {new Date(hist.timestamp).toLocaleString('pt-BR')}</span>
                            <span>👤 Técnico: {hist.auditorName || "Local"} ({hist.auditorInitials || getInitials(hist.auditorName)})</span>
                            {hist.record?.equipamento && (
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium">{hist.record.equipamento}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => setExpandedHistoryId(isExpanded ? null : hist.id)}
                            className="py-1.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>{isExpanded ? "Ocultar" : "Visualizar JSON"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const blob = new Blob([recordString], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.setAttribute("href", url);
                              link.setAttribute("download", hist.fileName || "historico.json");
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                            <span>Baixar File</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteJsonHistory(hist.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                            title="Excluir Backup"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-4 bg-slate-900 rounded-lg p-3 relative font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto border border-slate-950">
                          <div className="absolute right-3 top-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyJsonToClipboard(recordString, hist.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors flex items-center gap-1 cursor-pointer"
                              title="Copiar JSON para área de transferência"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span className="text-[9px] font-sans font-bold">
                                {copiedHistoryId === hist.id ? "Copiado!" : "Copiar"}
                              </span>
                            </button>
                          </div>
                          <pre className="whitespace-pre-wrap">{recordString}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Search Bar */}
          {records.length > 0 && (
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por equipamento, fabricante, número de série ou patrimônio..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* List content */}
          <div className="p-5">
            {records.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-200 mb-3 stroke-[1.2]" />
                <p className="text-sm font-medium text-slate-600">Nenhum equipamento registrado ainda.</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Tire fotos das etiquetas, revise as informações e salve no histórico para exportar como planilha ou revisar mais tarde.
                </p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">Nenhum resultado encontrado para a sua busca.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredRecords.map((rec) => {
                  const hasGps = rec.latitude !== undefined && rec.longitude !== undefined;
                  const hasDrive = !!rec.driveFolderUrl;
                  const hasManual = !!rec.linkManual;
                  const hasAccessories = rec.accessories && rec.accessories.length > 0;

                  return (
                    <div 
                      key={rec.id} 
                      className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between group relative"
                    >
                      {/* Top bar with titles & basic tags */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 tracking-tight">
                              {rec.equipamento || 'N/A'}
                            </h3>
                            {rec.ativoCodigo && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-slate-950 text-slate-100 dark:bg-slate-800 dark:text-slate-200 font-mono border border-slate-950 uppercase tracking-wider">
                                {rec.ativoCodigo}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="flex items-center gap-1 font-medium">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {new Date(rec.timestamp).toLocaleDateString('pt-BR')} {new Date(rec.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                            </span>
                            {rec.propriedade && (
                              <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                rec.propriedade === 'Próprio'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                  : rec.propriedade === 'Alugado'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                                  : 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                              }`}>
                                {rec.propriedade}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top-Right Delete Action */}
                        <button
                          type="button"
                          onClick={() => onDeleteRecord(rec.id)}
                          className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                          title="Remover Registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Content Columns Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
                        {/* Column 1: Identification & Specs */}
                        <div className="space-y-2.5">
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Identificação</span>
                            <div className="space-y-1 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                              <p className="text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-400 mr-1 text-[10px]">FAB:</span>
                                <span className="font-medium">{rec.fabricante || 'N/A'}</span>
                              </p>
                              {rec.modelo && (
                                <p className="text-slate-600 dark:text-slate-400">
                                  <span className="font-semibold text-slate-400 mr-1 text-[10px]">MOD:</span>
                                  <span>{rec.modelo}</span>
                                </p>
                              )}
                              <p className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                <span className="font-semibold text-slate-400 mr-1">S/N:</span>
                                <span className="font-bold text-slate-700 dark:text-slate-300">{rec.numSerie || 'N/A'}</span>
                              </p>
                              {rec.numPatrimonio && (
                                <p className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                                  <span className="font-semibold text-slate-400 mr-1">PAT:</span>
                                  <span className="font-bold text-slate-700 dark:text-slate-300">{rec.numPatrimonio}</span>
                                </p>
                              )}
                              <p className="text-slate-600 dark:text-slate-400">
                                <span className="font-semibold text-slate-400 mr-1 text-[10px]">Setor:</span>
                                <span className="font-medium text-slate-700 dark:text-slate-300">{rec.setor || 'Geral'}</span>
                              </p>
                            </div>
                          </div>

                          {/* Accessories list */}
                          {hasAccessories && (
                            <div>
                              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
                                Acessórios ({rec.accessories.length})
                              </span>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto p-1 bg-slate-50/35 dark:bg-slate-900/20 rounded-lg">
                                {rec.accessories.map((acc, i) => {
                                  const cod = acc.codigoAcessorio || `${rec.ativoCodigo || 'EQP'}-ACC-${i+1}`;
                                  return (
                                    <span
                                      key={acc.id}
                                      className="inline-flex items-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-700"
                                      title={`${acc.tipo}: ${acc.descricao}`}
                                    >
                                      {cod.split('-').pop()}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Column 2: Status, Calibrations & Location */}
                        <div className="space-y-2.5">
                          <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">Status & Condição</span>
                            <div className="space-y-1.5">
                              {/* Condition Badge */}
                              {rec.condicao && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    rec.condicao === 'Boa'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30'
                                      : rec.condicao.startsWith('Regular')
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                                      : rec.condicao.startsWith('Ruim')
                                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30'
                                      : rec.condicao === 'Não localizado'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-400 dark:border-orange-900/30'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${
                                      rec.condicao === 'Boa'
                                        ? 'bg-emerald-600 dark:bg-emerald-400'
                                        : rec.condicao.startsWith('Regular')
                                        ? 'bg-amber-600 dark:bg-amber-400'
                                        : rec.condicao.startsWith('Ruim')
                                        ? 'bg-red-600 dark:bg-red-400'
                                        : rec.condicao === 'Não localizado'
                                        ? 'bg-orange-600 dark:bg-orange-400'
                                        : 'bg-blue-600 dark:bg-blue-400'
                                    }`} />
                                    {rec.condicao}
                                  </span>
                                  {rec.isNewEquipment && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400 rounded text-[9px] font-extrabold uppercase border border-orange-200 dark:border-orange-900/30">
                                      Novo Ativo
                                    </span>
                                  )}
                                  {rec.condicao === 'Em Manutenção' && rec.numeroOSGets && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 rounded text-[9px] font-mono font-bold border border-blue-200 dark:border-blue-900/30">
                                      O.S: {rec.numeroOSGets}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Calibration Status */}
                              <div className="flex flex-col gap-1 pt-1">
                                <div className="flex items-center justify-between text-[11px] border-b border-slate-50 dark:border-slate-800/60 pb-1">
                                  <span className="text-slate-400 font-medium">Calibração:</span>
                                  {rec.temCalibracao ? (
                                    <span className="font-bold text-blue-600 dark:text-blue-400">
                                      Realizada ({rec.proxCal || 'N/D'})
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Não possui</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[11px] border-b border-slate-50 dark:border-slate-800/60 pb-1">
                                  <span className="text-slate-400 font-medium">M. Preventiva:</span>
                                  {rec.temManutencao ? (
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                      Realizada ({rec.proxManut || 'N/D'})
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Não possui</span>
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="text-slate-400 font-medium">Seg. Elétrica:</span>
                                  {rec.temSegurancaEletrica ? (
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                      Realizada ({rec.proxSegElet || 'N/D'})
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">Não possui</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Location GPS Block */}
                          {hasGps && (
                            <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-2 rounded-xl border border-emerald-100/50 dark:border-emerald-900/20">
                              <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block mb-1">Coordenadas de Satélite</span>
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                  {rec.latitude?.toFixed(4)}, {rec.longitude?.toFixed(4)}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${rec.latitude},${rec.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                    title="Abrir no Google Maps"
                                  >
                                    <Globe className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${rec.latitude},${rec.longitude}`;
                                      let text = `*🏥 LOCALIZAÇÃO DO ATIVO - ENG. CLÍNICA*\n\n`;
                                      text += `⚙️ *Ativo:* ${rec.equipamento}\n`;
                                      text += `🔢 *S/N:* ${rec.numSerie}\n`;
                                      text += `🏷️ *Patrimônio:* ${rec.numPatrimonio || 'N/D'}\n`;
                                      text += `📍 *Setor:* ${rec.setor || 'N/D'}\n`;
                                      text += `🗺️ *GPS:* ${rec.latitude?.toFixed(6)}, ${rec.longitude?.toFixed(6)}\n`;
                                      text += `🌐 *Google Maps:* ${mapsUrl}\n`;
                                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                                    }}
                                    className="p-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 rounded-lg shadow-2xs transition-colors cursor-pointer"
                                    title="Compartilhar Coordenadas no WhatsApp"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Observations summary */}
                      {rec.observacoes && rec.observacoes.trim() && (
                        <div className="mb-4 bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                          <span className="font-bold text-slate-400 uppercase tracking-wider block text-[9px] mb-0.5">Observações Técnicas</span>
                          <p className="italic line-clamp-2">"{rec.observacoes.trim()}"</p>
                        </div>
                      )}

                      {/* Quick File Links row */}
                      {(hasDrive || hasManual) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {hasDrive && (
                            <a
                              href={rec.driveFolderUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-850 hover:text-amber-900 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-900/30 border border-amber-200/60 dark:border-amber-900/30 px-2.5 py-1 rounded-lg hover:shadow-2xs transition-all cursor-pointer"
                            >
                              <FolderOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>Pasta Drive do Ativo ↗</span>
                            </a>
                          )}
                          {hasManual && (
                            <a
                              href={rec.linkManual}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[10px] font-bold text-blue-800 hover:text-blue-900 bg-blue-50 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-900/30 border border-blue-200/60 dark:border-blue-900/30 px-2.5 py-1 rounded-lg hover:shadow-2xs transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>Manual de Instruções ↗</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Card Bottom: Unified Action Toolbar Grid */}
                      <div className="mt-2 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-2.5">
                        {/* Cloud Sync State Row */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nuvem Central</span>
                          {rec.googleSheetRowSynced ? (
                            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-lg text-[10px] font-extrabold border border-emerald-200/60 dark:border-emerald-900/30">
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 animate-bounce" />
                              <span>Sincronizado</span>
                              {rec.googleDriveLinks && rec.googleDriveLinks.length > 0 && (
                                <a
                                  href={rec.googleDriveLinks[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                  title="Ver foto no Google Drive"
                                >
                                  <HardDrive className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          ) : isGoogleConnected ? (
                            <button
                              type="button"
                              onClick={() => onSyncToGoogle(rec)}
                              disabled={syncingRecordId !== null}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
                              title="Sincronizar com Google Sheets e salvar fotos no Drive"
                            >
                              {syncingRecordId === rec.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Cloud className="w-3 h-3 animate-pulse" />
                              )}
                              <span>Enviar Nuvem</span>
                            </button>
                          ) : (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold px-2 py-1 border border-slate-100 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-900/40 flex items-center gap-1" title="Conecte ao Google acima para ativar">
                              <Cloud className="w-3 h-3" />
                              <span>Google Off</span>
                            </div>
                          )}
                        </div>

                        {/* Button Action bar (4 or 5 horizontal compact actions) */}
                        <div className={`grid grid-cols-2 ${isJsonExportEnabled ? 'sm:grid-cols-5' : 'sm:grid-cols-4'} gap-1.5`}>
                          {/* Label printing preview */}
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewRecord(rec)}
                            className="py-2 px-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-900/30 text-indigo-700 border border-indigo-100 dark:border-indigo-900/30 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[10px] transition-all"
                            title="Visualizar Etiqueta com QR Code"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Etiqueta</span>
                          </button>

                          {/* Technical PDF generation */}
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                setIsGeneratingPdfId(rec.id);
                                await generateInspectionPDF(rec);
                              } catch (err: any) {
                                alert(err.message || 'Erro ao gerar PDF.');
                              } finally {
                                setIsGeneratingPdfId(null);
                              }
                            }}
                            disabled={isGeneratingPdfId !== null}
                            className="py-2 px-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400 dark:hover:bg-rose-900/30 text-rose-700 border border-rose-100 dark:border-rose-900/30 disabled:bg-slate-100 disabled:text-slate-400 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[10px] transition-all"
                            title="Gerar Relatório de Inspeção Técnica em PDF"
                          >
                            {isGeneratingPdfId === rec.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileDown className="w-3.5 h-3.5" />
                            )}
                            <span>Laudo PDF</span>
                          </button>

                          {/* WhatsApp detailed share */}
                          <button
                            type="button"
                            onClick={() => shareRecordOnWhatsApp(rec)}
                            className="py-2 px-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-900/30 text-emerald-700 border border-emerald-100 dark:border-emerald-900/30 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[10px] transition-all"
                            title="Compartilhar Detalhes da Inspeção via WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          {/* JSON backup export */}
                          {isJsonExportEnabled && (
                            <button
                              type="button"
                              onClick={() => {
                                const code = (rec.ativoCodigo || '').trim().replace(/[^a-zA-Z0-9-]/g, '_');
                                const initials = getInitials(rec.auditorNome);
                                const date = new Date(rec.timestamp);
                                const dStr = date.getFullYear() +
                                  String(date.getMonth() + 1).padStart(2, '0') +
                                  String(date.getDate()).padStart(2, '0');
                                const tStr = String(date.getHours()).padStart(2, '0') +
                                  String(date.getMinutes()).padStart(2, '0');
                                const jsonFileName = `${code || "HU-TEC-000000-ORB"}_${dStr}_${tStr}_${initials}.json`;

                                const blob = new Blob([JSON.stringify(rec, null, 2)], { type: 'application/json' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.setAttribute("href", url);
                                link.setAttribute("download", jsonFileName);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              }}
                              className="py-2 px-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:hover:bg-amber-900/30 text-amber-700 border border-amber-100 dark:border-amber-900/30 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[10px] transition-all"
                              title="Exportar Registro como Arquivo JSON Histórico"
                            >
                              <Database className="w-3.5 h-3.5" />
                              <span>JSON</span>
                            </button>
                          )}

                          {/* Reopen / Load into FormEditor */}
                          <button
                            type="button"
                            onClick={() => onLoadRecord(rec)}
                            className="py-2 px-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer text-[10px] transition-all"
                            title="Editar / Reabrir no formulário"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Reabrir</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {selectedPreviewRecord && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" style={{ contentVisibility: 'auto' }}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full border border-slate-200 dark:border-slate-800 p-6 shadow-2xl flex flex-col gap-4 animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  Visualização da Etiqueta
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewRecord(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector Options */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Tamanho</span>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewFormatSize('50x30')}
                    className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                      previewFormatSize === '50x30'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    50x30 mm
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFormatSize('50x50')}
                    className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                      previewFormatSize === '50x50'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    50x50 mm
                  </button>
                </div>
              </div>
              <div>
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Layout</span>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewFormatLayout('minimal')}
                    className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                      previewFormatLayout === 'minimal'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Mínimo
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFormatLayout('standard')}
                    className={`flex-1 py-1 px-1.5 rounded-lg font-bold text-center transition-all cursor-pointer ${
                      previewFormatLayout === 'standard'
                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Completo
                  </button>
                </div>
              </div>
            </div>

            {/* Label Canvas Container */}
            <div className="flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200/50 dark:border-slate-800/80 shadow-inner">
              <div 
                className={`bg-white text-slate-950 border-2 border-slate-950 p-3 shadow-md flex flex-col justify-between transition-all duration-300 ${
                  previewFormatSize === '50x50' ? 'aspect-square w-[230px] h-[230px]' : 'w-[250px] h-[155px]'
                }`}
                style={{ fontFamily: 'system-ui, sans-serif' }}
              >
                {previewFormatLayout === 'minimal' ? (
                  <div className="flex flex-col justify-between h-full w-full">
                    <div className="text-center">
                      <div className="text-[9px] font-extrabold tracking-tight uppercase leading-none text-slate-900">
                        Orbis Engenharia Clínica
                      </div>
                      <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mt-0.5 leading-none">
                        Hospital Universitário - HU
                      </div>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center">
                      {previewQrUrl ? (
                        <img 
                          src={previewQrUrl} 
                          alt="QR Code" 
                          className={`border border-slate-150 p-0.5 ${previewFormatSize === '50x50' ? 'w-20 h-20' : 'w-14 h-14'}`}
                        />
                      ) : (
                        <div className="bg-slate-50 border border-slate-100 flex items-center justify-center text-[7px] text-slate-400 w-14 h-14">
                          Carregando...
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center space-y-0.5">
                      <span className="inline-block text-[10px] font-black font-mono bg-slate-950 text-white px-1.5 py-0.5 leading-none rounded-sm">
                        {((selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().startsWith('HU-')
                          ? (selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim()
                          : `HU-SVI-${(selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().padStart(6, '0')}-ORB`
                        )}
                      </span>
                      <div className="text-[7px] font-black border-t border-slate-200 pt-0.5 mt-0.5 opacity-90 leading-none text-slate-600">
                        ORBISTRACKER HU-BR
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between h-full w-full text-left">
                    <div className="text-[9px] font-extrabold tracking-tight border-b border-slate-950 pb-0.5 uppercase leading-none text-center text-slate-900">
                      Hospital Universitário - HU
                    </div>
                    
                    {previewFormatSize === '50x50' ? (
                      <div className="flex-1 flex flex-col justify-between mt-1 mb-1 text-slate-900">
                        <div className="flex justify-center">
                          {previewQrUrl ? (
                            <img 
                              src={previewQrUrl} 
                              alt="QR Code" 
                              className="border border-slate-150 p-0.5 w-20 h-20"
                            />
                          ) : (
                            <div className="bg-slate-50 border border-slate-100 flex items-center justify-center text-[7px] text-slate-400 w-20 h-20">
                              Carregando...
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] font-black font-mono bg-slate-950 text-white px-1.5 py-0.5 self-center leading-none rounded-sm">
                          {((selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().startsWith('HU-')
                            ? (selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim()
                            : `HU-SVI-${(selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().padStart(6, '0')}-ORB`
                          )}
                        </div>

                        <div className="text-[7px] font-bold space-y-0.5 leading-tight border-t border-dashed border-slate-950 pt-1 text-slate-900">
                          <div className="truncate"><strong>EQUIPAMENTO:</strong> {(selectedPreviewRecord.equipamento || 'N/A').toUpperCase()}</div>
                          <div className="truncate"><strong>MARCA/MOD:</strong> {((selectedPreviewRecord.fabricante || '') + (selectedPreviewRecord.modelo ? ` / ${selectedPreviewRecord.modelo}` : '') || 'N/A').toUpperCase()}</div>
                          <div className="truncate"><strong>SETOR:</strong> {(selectedPreviewRecord.setor || 'N/A').toUpperCase()}</div>
                          <div className="truncate"><strong>Nº SÉRIE:</strong> {(selectedPreviewRecord.numSerie || 'N/A').toUpperCase()}</div>
                          <div className="truncate border-t border-dotted border-black/30 pt-0.5 mt-0.5 text-[6.5px] flex justify-between">
                            <span><strong>AUD:</strong> {getInitials(selectedPreviewRecord.auditorNome)}</span>
                            <span><strong>DATA:</strong> {new Date(selectedPreviewRecord.timestamp).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col justify-between mt-1 text-slate-900">
                        <div className="flex items-start justify-between gap-1 flex-1 min-h-0">
                          <div className="text-[6.5px] font-bold space-y-0.5 leading-tight flex-1 min-w-0 pr-1">
                            <div className="truncate"><strong>EQ:</strong> {(selectedPreviewRecord.equipamento || 'N/A').toUpperCase()}</div>
                            <div className="truncate"><strong>MOD:</strong> {((selectedPreviewRecord.fabricante || '') + (selectedPreviewRecord.modelo ? ` / ${selectedPreviewRecord.modelo}` : '') || 'N/A').toUpperCase()}</div>
                            <div className="truncate"><strong>SET:</strong> {(selectedPreviewRecord.setor || 'N/A').toUpperCase()}</div>
                            <div className="truncate"><strong>S/N:</strong> {(selectedPreviewRecord.numSerie || 'N/A').toUpperCase()}</div>
                            <div className="truncate border-t border-dotted border-black/30 pt-0.5 mt-0.5 text-[6px] flex justify-between">
                              <span className="truncate max-w-[45px]"><strong>AUD:</strong> {getInitials(selectedPreviewRecord.auditorNome)}</span>
                              <span><strong>DT:</strong> {new Date(selectedPreviewRecord.timestamp).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          
                          <div className="shrink-0 flex items-center justify-center">
                            {previewQrUrl ? (
                              <img 
                                src={previewQrUrl} 
                                alt="QR Code" 
                                className="border border-slate-150 p-0.5 w-12 h-12"
                              />
                            ) : (
                              <div className="bg-slate-50 border border-slate-100 flex items-center justify-center text-[7px] text-slate-400 w-12 h-12">
                                Carregando...
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-center mt-0.5">
                          <span className="inline-block text-[9px] font-black font-mono bg-slate-950 text-white px-1.5 py-0.5 leading-none rounded-sm">
                            {((selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().startsWith('HU-')
                              ? (selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim()
                              : `HU-SVI-${(selectedPreviewRecord.ativoCodigo || selectedPreviewRecord.numPatrimonio || '').trim().padStart(6, '0')}-ORB`
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="text-[7px] font-black border-t border-slate-950 pt-0.5 mt-0.5 text-center opacity-90 leading-none text-slate-800">
                      ORBIS ENGENHARIA CLÍNICA
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedPreviewRecord(null)}
                className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 rounded-xl font-bold text-xs shadow-sm transition-all text-center cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
