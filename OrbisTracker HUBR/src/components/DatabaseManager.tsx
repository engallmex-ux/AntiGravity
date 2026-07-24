import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, RefreshCw, X, ShieldAlert, CheckCircle, Trash2, 
  FileSpreadsheet, Clipboard, Check, Calendar, AlertCircle, Sparkles, HelpCircle,
  MapPin, Plus, Edit, Save, Building2
} from 'lucide-react';
import { InventoryItem, INVENTORY_DATA } from '../data/inventory';
import { Sector } from '../types';

interface DatabaseManagerProps {
  isOpen: boolean;
  onClose: () => void;
  googleUser?: any;
  googleToken?: string | null;
  onDatabaseUpdate: () => void;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  if (!line.includes('"')) {
    return line.split(delimiter);
  }
  
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// Utility to parse raw copied spreadsheet values (usually Tab-Separated Values - TSV)
export function parseRawSpreadsheet(rawText: string): InventoryItem[] {
  if (!rawText || !rawText.trim()) return [];
  
  // Split into lines
  const lines = rawText.split(/\r?\n/);
  if (lines.length < 2) return [];
  
  // Detect delimiter (tab for copy-pasted sheet, semicolon, or comma)
  const firstLine = lines[0];
  let delimiter = '\t';
  if (firstLine.includes('\t')) {
    delimiter = '\t';
  } else if (firstLine.includes(';')) {
    delimiter = ';';
  } else if (firstLine.includes(',')) {
    delimiter = ',';
  }
  
  // Parse headers (trim and lowercase for flexible comparison)
  const headers = splitCsvLine(firstLine, delimiter).map(h => h.trim().toLowerCase());
  
  // Map headers to indexes
  let eqIdx = -1;
  let brandIdx = -1;
  let modelIdx = -1;
  let brandModelIdx = -1;
  let locIdx = -1;
  let contractIdx = -1;
  let patIdx = -1; // identificador (patrimonio)
  let snIdx = -1;  // numSerie
  let acqIdx = -1; // dataAquisicao
  let warIdx = -1; // garantia
  
  headers.forEach((h, idx) => {
    const headerClean = h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^"|"$/g, ''); // remove accents & quotes
    
    if (
      headerClean.includes('equipamento') || 
      headerClean.includes('nome') || 
      headerClean.includes('descricao') || 
      headerClean.includes('item') || 
      headerClean === 'eq' ||
      headerClean.includes('device') ||
      headerClean.includes('aparelho') ||
      headerClean.includes('tipo equipamento')
    ) {
      eqIdx = idx;
    } else if (
      headerClean.includes('marca/modelo') || 
      headerClean.includes('marca_modelo') || 
      headerClean.includes('marca e modelo')
    ) {
      brandModelIdx = idx;
    } else if (
      headerClean.includes('marca') || 
      headerClean.includes('fabricante') || 
      headerClean.includes('brand') || 
      headerClean.includes('fabric') || 
      headerClean.includes('mfg')
    ) {
      brandIdx = idx;
    } else if (
      headerClean.includes('modelo') || 
      headerClean.includes('model')
    ) {
      modelIdx = idx;
    } else if (
      headerClean.includes('setor') || 
      headerClean.includes('localizacao') || 
      headerClean.includes('local') || 
      headerClean.includes('unidade') ||
      headerClean.includes('departamento') ||
      headerClean.includes('sala') ||
      headerClean.includes('orgao')
    ) {
      locIdx = idx;
    } else if (
      headerClean.includes('contrato') || 
      headerClean.includes('contract')
    ) {
      contractIdx = idx;
    } else if (
      headerClean.includes('patrimonio') || 
      headerClean.includes('identificador') || 
      headerClean.includes('id') || 
      headerClean.includes('tag') || 
      headerClean.includes('codigo') || 
      headerClean.includes('cod') ||
      headerClean.includes('plaqueta')
    ) {
      patIdx = idx;
    } else if (
      headerClean.includes('serie') || 
      headerClean.includes('s/n') || 
      headerClean.includes('n/s') || 
      headerClean.includes('sn') ||
      headerClean.includes('serial')
    ) {
      snIdx = idx;
    } else if (
      headerClean.includes('aquisicao') || 
      headerClean.includes('compra') || 
      headerClean.includes('data')
    ) {
      acqIdx = idx;
    } else if (
      headerClean.includes('garantia') || 
      headerClean.includes('validade')
    ) {
      warIdx = idx;
    }
  });
  
  // Fallbacks if no header matched
  if (eqIdx === -1) eqIdx = 0; // Assume first column is equipment name
  
  const parsedItems: InventoryItem[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = splitCsvLine(line, delimiter).map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length === 0 || !cols[eqIdx]) continue;
    
    const equipamento = cols[eqIdx];
    
    // Marca & Modelo combo
    let marcaModelo = '';
    if (brandModelIdx !== -1 && cols[brandModelIdx]) {
      marcaModelo = cols[brandModelIdx];
    } else {
      const brand = brandIdx !== -1 ? cols[brandIdx] : '';
      const model = modelIdx !== -1 ? cols[modelIdx] : '';
      if (brand && model) {
        marcaModelo = `${brand} / ${model}`;
      } else if (brand) {
        marcaModelo = brand;
      } else if (model) {
        marcaModelo = model;
      } else {
        marcaModelo = 'N/A';
      }
    }
    
    const localizacao = locIdx !== -1 && cols[locIdx] ? cols[locIdx] : 'GERAL';
    const contrato = contractIdx !== -1 && cols[contractIdx] ? cols[contractIdx] : 'Não';
    const identificador = patIdx !== -1 && cols[patIdx] ? cols[patIdx] : `PAT-${2000 + i}`;
    const numSerie = snIdx !== -1 && cols[snIdx] ? cols[snIdx] : 'N/D';
    const dataAquisicao = acqIdx !== -1 && cols[acqIdx] ? cols[acqIdx] : '';
    const garantia = warIdx !== -1 && cols[warIdx] ? cols[warIdx] : '';
    
    parsedItems.push({
      equipamento: equipamento.toUpperCase(),
      marcaModelo: marcaModelo.toUpperCase(),
      localizacao: localizacao.toUpperCase(),
      contrato,
      identificador,
      numSerie,
      dataAquisicao,
      garantia
    });
  }
  
  return parsedItems;
}

// Check if an equipment name is typical medical equipment
export function checkIsMedicalEquipment(name: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove accents
  
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
}

export default function DatabaseManager({ 
  isOpen, 
  onClose, 
  googleUser, 
  googleToken,
  onDatabaseUpdate 
}: DatabaseManagerProps) {
  const [activeTab, setActiveTab] = useState<'paste' | 'google' | 'sectors' | 'info'>('paste');
  const [rawText, setRawText] = useState<string>('');
  const [googleUrl, setGoogleUrl] = useState<string>('');
  const [sheetTabName, setSheetTabName] = useState<string>('Página1');
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Sector states
  const [sectorsList, setSectorsList] = useState<Sector[]>([]);
  const [editingSectorId, setEditingSectorId] = useState<string | null>(null);
  const [sectorForm, setSectorForm] = useState<Partial<Sector>>({
    id: '',
    name: '',
    description: '',
    category: 'Blocos Críticos e Cirúrgicos',
    floor: 'Térreo',
    x: 50,
    y: 50,
    latitude: undefined,
    longitude: undefined
  });
  const [sectorQuery, setSectorQuery] = useState('');
  
  // Database status
  const [dbStats, setDbStats] = useState<{ count: number; isCustom: boolean; lastUpdated: string }>({
    count: 0,
    isCustom: false,
    lastUpdated: ''
  });

  const fetchSectors = async () => {
    try {
      const res = await fetch('/api/sectors');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setSectorsList(data);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar setores do servidor:", err);
    }
  };

  // Load current stats on mount or when modal opens
  useEffect(() => {
    if (isOpen) {
      updateStats();
      fetchSectors();
    }
  }, [isOpen]);

  const updateStats = () => {
    const customDb = localStorage.getItem('orbis_custom_inventory');
    const updateTime = localStorage.getItem('orbis_db_last_updated') || 'Nunca';
    
    if (customDb) {
      try {
        const parsed = JSON.parse(customDb);
        setDbStats({
          count: parsed.length,
          isCustom: true,
          lastUpdated: updateTime
        });
      } catch (e) {
        setDbStats({ count: INVENTORY_DATA.length, isCustom: false, lastUpdated: 'Erro' });
      }
    } else {
      setDbStats({
        count: INVENTORY_DATA.length, // default list has correct items count
        isCustom: false,
        lastUpdated: 'Padrão Hospitalar (SAPI)'
      });
    }
  };

  const handlePasteImport = () => {
    if (!rawText.trim()) {
      setStatus({ type: 'error', text: 'Por favor, cole a planilha de dados brutos na caixa de texto.' });
      return;
    }
    
    setLoading(true);
    setStatus({ type: 'info', text: 'Processando e mapeando colunas...' });
    
    setTimeout(() => {
      try {
        const items = parseRawSpreadsheet(rawText);
        if (items.length === 0) {
          throw new Error('Nenhum equipamento válido pôde ser importado. Verifique os cabeçalhos das colunas.');
        }
        
        localStorage.setItem('orbis_custom_inventory', JSON.stringify(items));
        localStorage.setItem('orbis_db_last_updated', new Date().toLocaleString('pt-BR'));
        
        setStatus({
          type: 'success',
          text: `Sucesso! Base de dados atualizada. ${items.length} equipamentos mapeados e salvos localmente.`
        });
        setRawText('');
        updateStats();
        onDatabaseUpdate();
      } catch (err: any) {
        setStatus({
          type: 'error',
          text: err.message || 'Erro ao processar planilha. Verifique a formatação.'
        });
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  const handleGoogleImport = async () => {
    if (!googleUrl.trim()) {
      setStatus({ type: 'error', text: 'Insira o link ou ID da planilha do Google Sheets.' });
      return;
    }
    
    let spreadsheetId = googleUrl.trim();
    // Regex to extract Spreadsheet ID
    const idMatch = googleUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (idMatch && idMatch[1]) {
      spreadsheetId = idMatch[1];
    }
    
    setLoading(true);
    setStatus({ type: 'info', text: 'Buscando dados da planilha via Nuvem Corporativa Centralizada...' });
    
    try {
      const response = await fetch(
        `/api/google/sa-records?spreadsheetId=${encodeURIComponent(spreadsheetId)}&range=${encodeURIComponent(sheetTabName)}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Aba "${sheetTabName}" não localizada ou sem acesso de Editor para o e-mail da Conta de Serviço.`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Erro desconhecido ao carregar dados do servidor.');
      }
      const rows = data.rows;
      
      if (!rows || rows.length < 2) {
        throw new Error('A planilha está vazia ou não contém colunas suficientes.');
      }
      
      // Convert columns list back to tsv format so we can leverage our robust TSV parser
      const tsvText = rows.map((row: any[]) => row.join('\t')).join('\n');
      const items = parseRawSpreadsheet(tsvText);
      
      if (items.length === 0) {
        throw new Error('Nenhum registro correspondente a equipamento foi estruturado.');
      }
      
      localStorage.setItem('orbis_custom_inventory', JSON.stringify(items));
      localStorage.setItem('orbis_db_last_updated', new Date().toLocaleString('pt-BR'));
      
      setStatus({
        type: 'success',
        text: `Sincronização concluída! ${items.length} itens importados diretamente do Google Sheets com sucesso!`
      });
      updateStats();
      onDatabaseUpdate();
    } catch (err: any) {
      console.error(err);
      setStatus({
        type: 'error',
        text: `Falha na importação Google: ${err.message || 'Verifique se o link/nome da aba estão corretos e tente novamente.'}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefault = () => {
    const passwordAttempt = prompt("Para redefinir a base de dados ao padrão, insira a senha de administrador:");
    if (passwordAttempt === null) return;
    
    const cleanAttempt = passwordAttempt.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanAttempt !== 'admin123' && cleanAttempt !== 'lucassouza' && cleanAttempt !== 'lucas') {
      alert("Acesso negado: Senha incorreta. Apenas administradores autorizados podem alterar o banco de dados.");
      return;
    }

    if (window.confirm("Deseja realmente apagar sua base de dados personalizada e voltar ao banco padrão do HU?")) {
      localStorage.removeItem('orbis_custom_inventory');
      localStorage.setItem('orbis_db_last_updated', new Date().toLocaleString('pt-BR'));
      setStatus({
        type: 'success',
        text: 'Base de dados restaurada para o padrão oficial do SAPI.'
      });
      updateStats();
      onDatabaseUpdate();
    }
  };

  const handleLoadDefaultSectors = async () => {
    if (!window.confirm("Deseja realmente carregar todos os 24+ setores predefinidos do hospital? Isso substituirá suas modificações atuais de setores.")) return;
    
    setLoading(true);
    setStatus({ type: 'info', text: 'Carregando setores e salas predefinidos...' });
    try {
      const res = await fetch('/api/sectors/reset-defaults', { method: 'POST' });
      if (!res.ok) throw new Error('Erro ao carregar setores no servidor.');
      
      const data = await res.json();
      setStatus({ type: 'success', text: 'Setores, enfermarias e apoios de diagnósticos carregados com sucesso!' });
      await fetchSectors();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'Erro ao carregar padrões.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setStatus({ type: 'error', text: 'Geolocalização não é suportada por este dispositivo ou navegador.' });
      return;
    }
    
    setStatus({ type: 'info', text: 'Capturando posição por satélite GPS com alta precisão... Fique na frente da sala.' });
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setSectorForm(prev => ({
          ...prev,
          latitude: parseFloat(latitude.toFixed(6)),
          longitude: parseFloat(longitude.toFixed(6))
        }));
        setStatus({
          type: 'success',
          text: `Sucesso! Coordenadas GPS Capturadas: Lat ${latitude.toFixed(6)}, Lng ${longitude.toFixed(6)} (Precisão de ~${Math.round(accuracy)} metros)`
        });
      },
      (error) => {
        let msg = 'Erro ao obter sinal de GPS.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Permissão negada. Conceda acesso à localização na barra de endereços.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = 'Sinal GPS indisponível. Verifique se o GPS está ativo.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Tempo limite de satélite esgotado. Tente novamente.';
        }
        setStatus({ type: 'error', text: msg });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveSector = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectorForm.id || !sectorForm.name) {
      setStatus({ type: 'error', text: 'Por favor, informe pelo menos o Código (ID) e o Nome do Setor.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', text: 'Salvando setor...' });

    try {
      const cleanId = sectorForm.id.trim().toUpperCase().replace(/[\/\\#?%*:|"<>]/g, '_');
      const payload = {
        id: cleanId,
        name: sectorForm.name.trim(),
        description: sectorForm.description?.trim() || '',
        category: sectorForm.category || 'Geral',
        floor: sectorForm.floor || 'Térreo',
        x: Number(sectorForm.x ?? 50),
        y: Number(sectorForm.y ?? 50),
        latitude: sectorForm.latitude ? Number(sectorForm.latitude) : undefined,
        longitude: sectorForm.longitude ? Number(sectorForm.longitude) : undefined
      };

      const res = await fetch('/api/sectors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector: payload })
      });

      if (!res.ok) throw new Error('Falha ao salvar setor no servidor.');

      setStatus({ type: 'success', text: `Setor "${payload.name}" salvo com sucesso!` });
      setSectorForm({ id: '', name: '', description: '', category: 'Blocos Críticos e Cirúrgicos', floor: 'Térreo', x: 50, y: 50 });
      setEditingSectorId(null);
      await fetchSectors();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'Erro ao salvar o setor.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSector = (sector: Sector) => {
    setSectorForm(sector);
    setEditingSectorId(sector.id);
    setStatus(null);
  };

  const handleDeleteSector = async (id: string) => {
    const passwordAttempt = prompt("Para excluir este setor/sala, insira a senha de administrador:");
    if (passwordAttempt === null) return;
    
    const cleanAttempt = passwordAttempt.trim().toLowerCase().replace(/\s+/g, '');
    if (cleanAttempt !== 'admin123' && cleanAttempt !== 'lucassouza' && cleanAttempt !== 'lucas') {
      alert("Acesso negado: Senha incorreta. Apenas administradores autorizados podem excluir setores do sistema.");
      return;
    }

    if (!window.confirm("Deseja realmente excluir este setor/sala? Ativos deste setor não serão apagados, mas sua posição no mapa sumirá.")) return;

    setLoading(true);
    setStatus({ type: 'info', text: 'Excluindo setor...' });

    try {
      const res = await fetch(`/api/sectors/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao excluir setor do servidor.');

      setStatus({ type: 'success', text: 'Setor excluído com sucesso!' });
      await fetchSectors();
    } catch (err: any) {
      setStatus({ type: 'error', text: err.message || 'Erro ao excluir o setor.' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-850 dark:text-white flex items-center gap-1.5">
                Atualização da Base de Dados (Ativos/Inventário)
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">
                Sincronize ou importe a lista completa do seu sistema principal de forma prática
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Database Stats Overview banner */}
        <div className="bg-slate-900 text-white p-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
              {dbStats.isCustom ? 'Base Personalizada' : 'Base Padrão SAPI'}
            </div>
            <div className="text-xs">
              <strong>{dbStats.count}</strong> Ativos Ativos no Sistema
            </div>
          </div>
          <div className="text-[10px] text-slate-400">
            Última atualização: <span className="text-slate-300 font-semibold">{dbStats.lastUpdated}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={() => { setActiveTab('paste'); setStatus(null); }}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'paste' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Clipboard className="w-4 h-4" />
            Copiar e Colar (Excel)
          </button>
          
          <button
            onClick={() => { setActiveTab('google'); setStatus(null); }}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'google' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            Google Sheets Link
          </button>

          <button
            onClick={() => { setActiveTab('sectors'); setStatus(null); }}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'sectors' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Setores / Salas
          </button>

          <button
            onClick={() => { setActiveTab('info'); setStatus(null); }}
            className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'info' 
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-900' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            Regras de Verificação
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 dark:bg-slate-900 dark:text-slate-100">
          
          {status && (
            <div className={`p-3.5 rounded-xl border flex items-start gap-2.5 animate-fade-in text-xs leading-normal ${
              status.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/50' :
              status.type === 'error' ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50' :
              'bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
            }`}>
              {status.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : 
               status.type === 'error' ? <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" /> : 
               <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0 mt-0.5" />}
              <span>{status.text}</span>
            </div>
          )}

          {/* TAB 1: Paste copy-pasted values */}
          {activeTab === 'paste' && (
            <div className="space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Como funciona a Importação Direta:</span>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Abra sua planilha (no Excel ou Google Sheets), <strong>selecione todas as linhas e colunas (incluindo a linha de cabeçalhos)</strong>, copie (<kbd className="bg-slate-200 dark:bg-slate-850 px-1 rounded text-[10px]">Ctrl+C</kbd>) e cole diretamente no campo abaixo. Nosso sistema inteligente analisará a estrutura bruta e fará o mapeamento automaticamente.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cole a Planilha aqui (TSV / CSV / Bruto):</label>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Equipamento&#9;Marca&#9;Modelo&#9;Patrimônio&#9;Série&#9;Setor&#10;VENTILADOR UTI&#9;MINDRAY&#9;SV-300&#9;PA0037&#9;GB-52088001&#9;UTIPED"
                  rows={6}
                  className="w-full p-3 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-500 font-mono"
                  disabled={loading}
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handlePasteImport}
                  disabled={loading || !rawText}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  Mapear e Importar Planilha
                </button>
                
                {dbStats.isCustom && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Restaurar banco padrão"
                  >
                    <Trash2 className="w-4 h-4" />
                    Restaurar Padrão
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Google Sheets Live Sync */}
          {activeTab === 'google' && (
            <div className="space-y-3.5">
              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Você pode vincular sua planilha de ativos e atualizá-la de forma síncrona diretamente usando os servidores em nuvem da Orbis.
                <div className="mt-2 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Compartilhe sua planilha de ativos com o e-mail da conta de serviço como Editor para permitir o sincronismo!
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Link ou ID do Google Sheets:</label>
                  <input
                    type="text"
                    value={googleUrl}
                    onChange={(e) => setGoogleUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1-dFF2My0EzUvvpdRBEtWg61DpZ5PoFux6wHhv0nMckA..."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome da Aba (Tab Name):</label>
                  <input
                    type="text"
                    value={sheetTabName}
                    onChange={(e) => setSheetTabName(e.target.value)}
                    placeholder="Página1, Equipamentos, etc."
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGoogleImport}
                  disabled={loading || !googleUrl}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Puxar e Sincronizar Equipamentos
                </button>
                
                {dbStats.isCustom && (
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Restaurar Padrão
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Sectors/Rooms Administration */}
          {activeTab === 'sectors' && (
            <div className="space-y-4">
              {/* Preset loader & Actions header */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="text-[11px] text-slate-500 font-medium">
                  <strong>Banco de Setores</strong>: Carregue a árvore oficial de 24 salas/setores do hospital com coordenadas GPS pré-configuradas.
                </div>
                <button
                  type="button"
                  onClick={handleLoadDefaultSectors}
                  disabled={loading}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  Carregar 24+ Setores Padrão
                </button>
              </div>

              {/* Form container */}
              <form onSubmit={handleSaveSector} className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-150 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-emerald-500" />
                    {editingSectorId ? 'Editar Setor/Sala Registrado' : 'Registrar Novo Setor/Sala (Auditoria)'}
                  </h4>
                  {editingSectorId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectorId(null);
                        setSectorForm({
                          id: '',
                          name: '',
                          description: '',
                          category: 'Blocos Críticos e Cirúrgicos',
                          floor: 'Térreo',
                          x: 50,
                          y: 50,
                          latitude: undefined,
                          longitude: undefined
                        });
                      }}
                      className="text-[10px] font-bold text-red-500 hover:underline"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">CÓDIGO / ID (Sem espaços/acentos):</label>
                    <input
                      type="text"
                      required
                      value={sectorForm.id || ''}
                      onChange={(e) => setSectorForm({ ...sectorForm, id: e.target.value })}
                      placeholder="Ex: CC, UTIA, CME"
                      disabled={!!editingSectorId}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">NOME DO SETOR (Para match na planilha):</label>
                    <input
                      type="text"
                      required
                      value={sectorForm.name || ''}
                      onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })}
                      placeholder="Ex: CC - UBCPME - CC"
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">CATEGORIA / GRUPO:</label>
                    <select
                      value={sectorForm.category || 'Blocos Críticos e Cirúrgicos'}
                      onChange={(e) => setSectorForm({ ...sectorForm, category: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Blocos Críticos e Cirúrgicos">1. Blocos Críticos e Cirúrgicos</option>
                      <option value="Unidades de Terapia e Urgência">2. Unidades de Terapia e Urgência</option>
                      <option value="Enfermarias e Clínicas Especializadas">3. Enfermarias e Clínicas Especializadas</option>
                      <option value="Apoio Diagnóstico, Logística e Pesquisa">4. Apoio Diagnóstico, Logística e Pesquisa</option>
                      <option value="Áreas Técnicas e de Gestão">5. Áreas Técnicas e de Gestão</option>
                      <option value="Geral">Geral / Outros</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">ANDAR / PAVIMENTO:</label>
                    <select
                      value={sectorForm.floor || 'Térreo'}
                      onChange={(e) => setSectorForm({ ...sectorForm, floor: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Subsolo">Subsolo</option>
                      <option value="Térreo">Térreo</option>
                      <option value="1º Andar">1º Andar</option>
                      <option value="2º Andar">2º Andar</option>
                      <option value="3º Andar">3º Andar</option>
                      <option value="4º Andar">4º Andar</option>
                      <option value="5º Andar">5º Andar</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Descrição / Localização Amigável:</label>
                  <input
                    type="text"
                    value={sectorForm.description || ''}
                    onChange={(e) => setSectorForm({ ...sectorForm, description: e.target.value })}
                    placeholder="Ex: Unidade de Bloco Cirúrgico e Processamento de Materiais"
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* GPS Coordinates (Auditing Room by Room) */}
                <div className="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border border-emerald-500/20 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      Geolocalização (Auditoria no Local)
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureGPS}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-extrabold flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                    >
                      <MapPin className="w-3 h-3" />
                      Capturar GPS Presencial
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">LATITUDE:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={sectorForm.latitude || ''}
                        onChange={(e) => setSectorForm({ ...sectorForm, latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Ex: -23.55052"
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-lg focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400">LONGITUDE:</label>
                      <input
                        type="number"
                        step="0.000001"
                        value={sectorForm.longitude || ''}
                        onChange={(e) => setSectorForm({ ...sectorForm, longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                        placeholder="Ex: -46.63330"
                        className="w-full px-2 py-1 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Coordinate adjustment sliders with preview box */}
                <div className="space-y-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                    <span>Posicionamento Visual na Planta</span>
                    <span className="text-emerald-500">X: {sectorForm.x ?? 50}% | Y: {sectorForm.y ?? 50}%</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Esquerda (0%)</span>
                        <span>Direita (100%)</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="95"
                        value={sectorForm.x ?? 50}
                        onChange={(e) => setSectorForm({ ...sectorForm, x: Number(e.target.value) })}
                        className="w-full accent-emerald-500 h-1 bg-slate-250 dark:bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex justify-between text-[9px] text-slate-400">
                        <span>Topo (0%)</span>
                        <span>Base (100%)</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="95"
                        value={sectorForm.y ?? 50}
                        onChange={(e) => setSectorForm({ ...sectorForm, y: Number(e.target.value) })}
                        className="w-full accent-emerald-500 h-1 bg-slate-250 dark:bg-slate-800 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Visual Sandbox Map representation */}
                  <div className="relative h-20 bg-slate-200 dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-900/60 overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-15 dark:opacity-5 bg-[radial-gradient(#808080_1px,transparent_1px)] [background-size:10px_10px]" />
                    <span className="text-[9px] text-slate-400 uppercase font-bold tracking-widest pointer-events-none select-none">
                      Esboço de Dispersão na Planta
                    </span>
                    {/* Render existing pins in miniature */}
                    {sectorsList.map((s) => (
                      <div
                        key={s.id}
                        className="absolute w-1.5 h-1.5 bg-slate-400 dark:bg-slate-600 rounded-full"
                        style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
                        title={s.name}
                      />
                    ))}
                    {/* Active Form Pin */}
                    <div
                      className="absolute flex flex-col items-center animate-bounce z-10"
                      style={{ left: `${sectorForm.x ?? 50}%`, top: `${sectorForm.y ?? 50}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <MapPin className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />
                      <div className="bg-slate-900 text-[8px] text-white font-black px-1 rounded shadow-lg whitespace-nowrap -mt-0.5 border border-emerald-500/30">
                        {sectorForm.id || '?'}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {editingSectorId ? 'Atualizar Alterações do Setor/Sala' : 'Gravar Novo Setor/Sala'}
                </button>
              </form>

              {/* List container */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Salas e Setores Registrados ({sectorsList.length})
                  </span>
                  <input
                    type="text"
                    value={sectorQuery}
                    onChange={(e) => setSectorQuery(e.target.value)}
                    placeholder="Filtrar setores..."
                    className="px-2 py-1 border border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-950 text-[10px] rounded-lg focus:outline-none"
                  />
                </div>

                <div className="space-y-4 max-h-[240px] overflow-y-auto pr-1">
                  {/* Grouped Sectors by Category */}
                  {Array.from(new Set(sectorsList.map(s => s.category || 'Geral'))).map(categoryName => {
                    const filtered = sectorsList.filter(s => 
                      s.category === categoryName && (
                        s.name.toLowerCase().includes(sectorQuery.toLowerCase()) || 
                        s.id.toLowerCase().includes(sectorQuery.toLowerCase()) ||
                        (s.description || '').toLowerCase().includes(sectorQuery.toLowerCase())
                      )
                    );

                    if (filtered.length === 0) return null;

                    return (
                      <div key={categoryName} className="space-y-1.5">
                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-lg inline-block uppercase">
                          {categoryName}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {filtered.map((s) => (
                            <div
                              key={s.id}
                              className="p-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-xl flex items-start justify-between gap-2 transition-all"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shrink-0">
                                    {s.id}
                                  </span>
                                  <span className="font-bold text-xs truncate text-slate-800 dark:text-white" title={s.name}>
                                    {s.name}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
                                  {s.description || 'Sem descrição.'}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-[9px] text-slate-500 font-medium">
                                  <span className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[8px] text-slate-600 dark:text-slate-300">
                                    {s.floor || 'Térreo'}
                                  </span>
                                  <span>Planta: X:{s.x}% Y:{s.y}%</span>
                                  {s.latitude && s.longitude ? (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                                      📍 GPS: {s.latitude}, {s.longitude}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Sem GPS</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleEditSector(s)}
                                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-md transition-all"
                                  title="Editar"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSector(s.id)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-950 text-red-400 hover:text-red-600 rounded-md transition-all"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Rules and medical validation explanations */}
          {activeTab === 'info' && (
            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-900 rounded-xl">
                <h4 className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 mb-1 text-xs">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Mapeamento de Cabeçalhos Inteligente
                </h4>
                Nosso motor aceita qualquer planilha crua do hospital. Ele busca palavras-chave no cabeçalho como 
                <code> Equipamento</code>, <code>Marca/Modelo</code>, <code>Série</code>, <code>Patrimônio</code> e <code>Setor</code>, 
                garantindo que mesmo dados em formato bruto sejam interpretados e mapeados sem que você precise reformatar nada.
              </div>

              <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-150 dark:border-rose-900 rounded-xl">
                <h4 className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5 mb-1 text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  Validação de Equipamento Médico (EMH)
                </h4>
                O OrbisTracker possui uma lista de verificação rigorosa. Se o equipamento inserido no formulário não constar na base ou não tiver termos como <em>ventilador, monitor, bomba de infusão, desfibrilador, etc.</em>, o sistema exibirá alertas de advertência para evitar erros de inventário não-médico.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Dica de Auditoria Operacional</span>
                Recomendamos atualizar este cadastro de ativos a cada <strong>7 ou 15 dias</strong> para garantir que novos aparelhos recém-adquiridos pelo hospital constem corretamente na barra de busca de inventário e possam ser localizados via RFID ou etiqueta de identificação.
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
}
