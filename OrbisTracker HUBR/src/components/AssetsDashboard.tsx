import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, Users, CheckCircle2, AlertTriangle, Search, Filter, MapPin, 
  X, HelpCircle, Flame, Grid, Layers, Upload, BarChart3, ArrowRight, ClipboardList,
  Calendar, ShieldAlert, BadgeInfo, Trash2, Camera, Plus, ExternalLink, FileText
} from 'lucide-react';
import { InventoryItem } from '../data/inventory';
import { InspectionRecord, Sector } from '../types';

interface AssetsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  history: InspectionRecord[];
  activeInventory: InventoryItem[];
  onSelectAuditItem: (item: InventoryItem) => void;
  onRefreshDatabase?: () => void;
}

// Fixed positions for hospital sectors on our stylish stylized map (percentages)
const SECTOR_COORDINATES: Record<string, { x: number; y: number; label: string; desc: string }> = {
  'PAA - UCRIT-PA': { x: 22, y: 28, label: 'PAA', desc: 'Pronto Atendimento / Emergência' },
  'SEGE - SEGE': { x: 82, y: 72, label: 'SEGE', desc: 'Serviços Gerais / Adm' },
  'ENDO - UDIDE-END-DIG': { x: 78, y: 32, label: 'ENDO', desc: 'Endoscopia / Diagnóstico' },
  'UCMC - UCMC': { x: 55, y: 75, label: 'UCMC', desc: 'Unidade de Cuidados Coronários' },
  'CME - UBCPME - CME': { x: 28, y: 72, label: 'CME', desc: 'Central de Esterilização' },
  'SGPIT - SGPIT': { x: 52, y: 25, label: 'SGPIT', desc: 'Tecnologia da Informação / Engenharia' }
};

export default function AssetsDashboard({ 
  isOpen, 
  onClose, 
  history, 
  activeInventory: propActiveInventory,
  onSelectAuditItem,
  onRefreshDatabase
}: AssetsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'kpis' | 'table' | 'map'>('kpis');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'auditados' | 'pendentes'>('todos');
  const [sectorFilter, setSectorFilter] = useState<string>('todos');
  const [heatMapMode, setHeatMapMode] = useState<boolean>(true);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [selectedMapSector, setSelectedMapSector] = useState<string | null>(null);

  // Dynamic sectors from server
  const [sectorsList, setSectorsList] = useState<Sector[]>([]);

  // Custom blueprint image upload
  const [customBlueprint, setCustomBlueprint] = useState<string | null>(() => {
    return localStorage.getItem('orbis_custom_blueprint') || null;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation state for deleting inventory items
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Selected audit report for modal viewer
  const [selectedReport, setSelectedReport] = useState<InspectionRecord | null>(null);

  // Floor plans PDFs on Google Drive
  const [floorPlans, setFloorPlans] = useState<{ id: string; name: string; url: string; sector?: string }[]>(() => {
    const saved = localStorage.getItem('orbis_floor_plan_pdfs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'pdf-1',
        name: 'Planta Geral HU-Brasil - Pronto Atendimento & Emergência (Bloco A).pdf',
        url: 'https://drive.google.com/drive/folders/1HU-Brasil-FakeFolderID-1',
        sector: 'PAA - UCRIT-PA'
      },
      {
        id: 'pdf-2',
        name: 'Layout Técnico HU-Brasil - Bloco Cirúrgico & Esterilização (CME).pdf',
        url: 'https://drive.google.com/drive/folders/1HU-Brasil-FakeFolderID-2',
        sector: 'CME - UBCPME - CME'
      },
      {
        id: 'pdf-3',
        name: 'Planta de Infraestrutura - Tecnologia da Informação & Engenharia Clínica.pdf',
        url: 'https://drive.google.com/drive/folders/1HU-Brasil-FakeFolderID-3',
        sector: 'SGPIT - SGPIT'
      }
    ];
  });

  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanUrl, setNewPlanUrl] = useState('');
  const [newPlanSector, setNewPlanSector] = useState('todos');

  const handleAddFloorPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanName.trim() || !newPlanUrl.trim()) return;

    let targetUrl = newPlanUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    const newPlan = {
      id: 'pdf-' + Date.now(),
      name: newPlanName.trim(),
      url: targetUrl,
      sector: newPlanSector !== 'todos' ? newPlanSector : undefined
    };

    const updated = [...floorPlans, newPlan];
    setFloorPlans(updated);
    localStorage.setItem('orbis_floor_plan_pdfs', JSON.stringify(updated));

    setNewPlanName('');
    setNewPlanUrl('');
    setNewPlanSector('todos');
  };

  const handleRemoveFloorPlan = (id: string) => {
    const updated = floorPlans.filter(p => p.id !== id);
    setFloorPlans(updated);
    localStorage.setItem('orbis_floor_plan_pdfs', JSON.stringify(updated));
  };

  // Delete inventory item from local cache & server API
  const handleDeleteInventoryItem = async (item: InventoryItem) => {
    try {
      const res = await fetch(`/api/inventory/${encodeURIComponent(item.identificador)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const updated = inventory.filter(it => it.identificador !== item.identificador);
        setInventory(updated);
        localStorage.setItem('orbis_custom_inventory', JSON.stringify(updated));
        window.dispatchEvent(new Event('orbis_db_updated'));
        if (onRefreshDatabase) onRefreshDatabase();
        setConfirmDeleteId(null);
      } else {
        alert("Erro ao excluir ativo do servidor.");
      }
    } catch (err) {
      console.error("Failed to delete inventory item:", err);
      alert("Erro de conexão ao excluir o ativo.");
    }
  };

  // Local inventory state synced with server
  const [inventory, setInventory] = useState<InventoryItem[]>(propActiveInventory);
  const [loading, setLoading] = useState(false);

  // Load inventory dynamically from Server API
  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setInventory(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch inventory from server, using prop/fallback:', err);
    } finally {
      setLoading(false);
    }
  };

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
      console.error('Failed to fetch sectors:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
      fetchSectors();
    }
  }, [isOpen]);

  const dynamicSectorCoordinates = useMemo(() => {
    const coords: Record<string, { x: number; y: number; label: string; desc: string; category?: string; floor?: string; latitude?: number; longitude?: number }> = {};
    sectorsList.forEach(s => {
      coords[s.name] = {
        x: s.x,
        y: s.y,
        label: s.id,
        desc: s.description || '',
        category: s.category,
        floor: s.floor,
        latitude: s.latitude,
        longitude: s.longitude
      };
    });
    // Add default hardcoded ones as fallback if they aren't registered yet
    Object.entries(SECTOR_COORDINATES).forEach(([key, val]) => {
      if (!coords[key]) {
        coords[key] = {
          ...val,
          category: 'Geral',
          floor: 'Térreo'
        };
      }
    });
    return coords;
  }, [sectorsList]);

  // Sync prop active inventory if it changes
  useEffect(() => {
    if (propActiveInventory && propActiveInventory.length > 0) {
      setInventory(propActiveInventory);
    }
  }, [propActiveInventory]);

  // Map inventory identification to inspection records
  const auditStatusMap = useMemo(() => {
    const map: Record<string, { audited: boolean; record?: InspectionRecord }> = {};
    
    // Initialize
    inventory.forEach(item => {
      map[item.identificador] = { audited: false };
    });

    // Match with inspection history
    history.forEach(rec => {
      // Find matching inventory item by series, patrimônio or unique identifier
      const matchedItem = inventory.find(item => 
        (item.identificador && item.identificador === rec.numPatrimonio) ||
        (item.numSerie && item.numSerie === rec.numSerie) ||
        (item.identificador && item.identificador === rec.ativoCodigo)
      );

      if (matchedItem) {
        map[matchedItem.identificador] = {
          audited: true,
          record: rec
        };
      }
    });

    return map;
  }, [inventory, history]);

  // Statistics Calculation
  const stats = useMemo<{
    total: number;
    audited: number;
    pending: number;
    pctCompleted: number;
    techCount: number;
    sectorCount: number;
    sectorStats: Record<string, { total: number; audited: number; pending: number }>;
    activeTechs: string[];
  }>(() => {
    const total = inventory.length;
    let audited = 0;
    const technicians = new Set<string>();
    const sectors = new Set<string>();

    inventory.forEach(item => {
      if (auditStatusMap[item.identificador]?.audited) {
        audited++;
        const rec = auditStatusMap[item.identificador].record;
        if (rec?.auditorNome) {
          technicians.add(rec.auditorNome);
        }
      }
      if (item.localizacao) {
        sectors.add(item.localizacao);
      }
    });

    const pending = total - audited;
    const pctCompleted = total > 0 ? Math.round((audited / total) * 100) : 0;

    // Sectors status
    const sectorStats: Record<string, { total: number; audited: number; pending: number }> = {};
    inventory.forEach(item => {
      const sec = item.localizacao || 'OUTROS';
      if (!sectorStats[sec]) {
        sectorStats[sec] = { total: 0, audited: 0, pending: 0 };
      }
      sectorStats[sec].total++;
      if (auditStatusMap[item.identificador]?.audited) {
        sectorStats[sec].audited++;
      } else {
        sectorStats[sec].pending++;
      }
    });

    return {
      total,
      audited,
      pending,
      pctCompleted,
      techCount: technicians.size || 1,
      sectorCount: sectors.size,
      sectorStats,
      activeTechs: Array.from(technicians)
    };
  }, [inventory, auditStatusMap]);

  // Filtered Inventory items
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = 
        item.equipamento.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.marcaModelo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.identificador.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.numSerie.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.localizacao.toLowerCase().includes(searchQuery.toLowerCase());

      const status = auditStatusMap[item.identificador]?.audited ? 'auditados' : 'pendentes';
      const matchStatus = statusFilter === 'todos' || statusFilter === status;
      const matchSector = sectorFilter === 'todos' || item.localizacao === sectorFilter;

      return matchSearch && matchStatus && matchSector;
    });
  }, [inventory, searchQuery, statusFilter, sectorFilter, auditStatusMap]);

  const uniqueSectors = useMemo(() => {
    return Array.from(new Set(inventory.map(item => item.localizacao))).filter(Boolean);
  }, [inventory]);

  // Custom blueprint upload helper
  const handleBlueprintUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      localStorage.setItem('orbis_custom_blueprint', base64);
      setCustomBlueprint(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleClearBlueprint = () => {
    localStorage.removeItem('orbis_custom_blueprint');
    setCustomBlueprint(null);
  };

  if (!isOpen) return null;

  return (
    <div id="assets-dashboard-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-sm overflow-hidden">
      <motion.div 
        id="assets-dashboard-card"
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-6xl h-[92vh] sm:h-[88vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden text-gray-800"
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-sky-500/20 rounded-xl text-sky-400 border border-sky-500/30 shrink-0">
              <Building2 className="w-5.5 h-5.5 sm:w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight">Painel de Cobertura & Ativos</h2>
              <p className="text-[10px] sm:text-xs text-slate-300">Auditoria inteligente do parque tecnológico hospitalar</p>
            </div>
          </div>
          <div className="flex items-center justify-between sm:justify-end space-x-4 w-full sm:w-auto border-t border-slate-700/40 sm:border-0 pt-2 sm:pt-0">
            {loading && (
              <span className="flex items-center text-xs text-sky-300 animate-pulse">
                <Grid className="w-3.5 h-3.5 animate-spin mr-1" /> Sincronizando...
              </span>
            )}
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer ml-auto sm:ml-0"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-col sm:flex-row bg-slate-100 border-b border-gray-200 px-4 sm:px-6 py-2 gap-1 sm:gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab('kpis')}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg flex items-center space-x-2 transition-all cursor-pointer justify-center sm:justify-start ${
              activeTab === 'kpis' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/55'
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span>Indicadores & Progresso</span>
          </button>
          <button 
            onClick={() => setActiveTab('table')}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg flex items-center space-x-2 transition-all cursor-pointer justify-center sm:justify-start ${
              activeTab === 'table' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/55'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span>Lista de Ativos ({inventory.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg flex items-center space-x-2 transition-all cursor-pointer justify-center sm:justify-start ${
              activeTab === 'map' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/55'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Planta Hospitalar & Setores</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 min-h-0">
          {/* TAB 1: KPIS & SUMMARY */}
          {activeTab === 'kpis' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider truncate">Total de Ativos</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-slate-950 mt-1">{stats.total}</p>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1 truncate">Cadastrados no banco</p>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                    <Grid className="w-6 h-6 sm:w-7 h-7" />
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider truncate">Auditados / Mapeados</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-green-600 mt-1">{stats.audited}</p>
                    <div className="flex items-center text-[11px] sm:text-xs text-green-600 font-medium mt-1 truncate">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span>{stats.pctCompleted}% do inventário</span>
                    </div>
                  </div>
                  <div className="p-3 bg-green-50 text-green-600 rounded-xl shrink-0">
                    <CheckCircle2 className="w-6 h-6 sm:w-7 h-7" />
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider truncate">Pendentes</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-amber-500 mt-1">{stats.pending}</p>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1 truncate">Aguardando validação</p>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-500 rounded-xl shrink-0">
                    <AlertTriangle className="w-6 h-6 sm:w-7 h-7" />
                  </div>
                </div>

                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider truncate">Técnicos em Campo</p>
                    <p className="text-2xl sm:text-3xl font-extrabold text-sky-600 mt-1">{stats.techCount}</p>
                    <p className="text-[11px] sm:text-xs text-gray-400 mt-1 truncate">Sincronizando dados</p>
                  </div>
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-xl shrink-0">
                    <Users className="w-6 h-6 sm:w-7 h-7" />
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-white p-4 sm:p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 sm:mb-2">
                  <span className="text-sm font-semibold text-gray-800">Progresso Geral de Auditoria</span>
                  <span className="text-xs sm:text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{stats.pctCompleted}% Concluído</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stats.pctCompleted}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full"
                  />
                </div>
                <p className="text-[11px] sm:text-xs text-gray-400 mt-2">
                  Falta auditar {stats.pending} de um total de {stats.total} equipamentos cadastrados.
                </p>
              </div>

              {/* Sector Compliance and Technical distribution split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Sector Compliance */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                    <Building2 className="w-4.5 h-4.5 mr-1.5 text-slate-700" />
                    Cobertura de Auditoria por Setor
                  </h3>
                  <div className="space-y-4">
                    {Object.keys(stats.sectorStats).map((secName) => {
                      const secData = stats.sectorStats[secName];
                      const secPct = Math.round((secData.audited / secData.total) * 100);
                      return (
                        <div key={secName} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold text-gray-700 gap-2">
                            <span className="truncate flex-1 min-w-0">{secName}</span>
                            <span className="shrink-0">{secData.audited} / {secData.total} ({secPct}%)</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                secPct === 100 
                                  ? 'bg-green-500' 
                                  : secPct > 50 
                                    ? 'bg-sky-500' 
                                    : 'bg-amber-400'
                              }`}
                              style={{ width: `${secPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Technicians & Recent activity */}
                <div className="bg-white p-4 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                  <h3 className="text-base font-bold text-gray-900 mb-3 flex items-center">
                    <Users className="w-4.5 h-4.5 mr-1.5 text-slate-700" />
                    Equipe de Técnicos Ativos
                  </h3>
                  
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[220px] pr-1">
                    {stats.activeTechs.length === 0 ? (
                      <div className="h-28 flex flex-col items-center justify-center text-center text-gray-400 bg-slate-50 rounded-lg border border-dashed border-gray-200">
                        <Users className="w-8 h-8 mb-1.5 stroke-1" />
                        <span className="text-xs">Nenhum técnico registrou auditorias ainda</span>
                      </div>
                    ) : (
                      stats.activeTechs.map((name, i) => {
                        const count = history.filter(h => h.auditorNome === name).length;
                        return (
                          <div key={name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100/80 transition-all border border-gray-100 gap-3">
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0">
                                {name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-gray-900 truncate">{name}</h4>
                                <p className="text-[10px] text-gray-500 truncate">Técnico Local de Auditoria</p>
                              </div>
                            </div>
                            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full shrink-0">
                              {count} {count === 1 ? 'ativo' : 'ativos'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between text-[11px] sm:text-xs text-gray-500 gap-2">
                    <span>Ativos integrados ao Firebase Cloud:</span>
                    <span className="font-bold text-slate-900 flex items-center">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                      Banco Sincronizado
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETAILED TABLE */}
          {activeTab === 'table' && (
            <div className="space-y-4">
              {/* Search, Status & Sector Filter controls */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Pesquisar por equipamento, marca, patrimônio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 text-xs text-gray-500 border border-gray-300 px-3 py-2 rounded-lg bg-slate-50 shrink-0">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filtros:</span>
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e: any) => setStatusFilter(e.target.value)}
                    className="border border-gray-300 bg-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer flex-1 sm:flex-initial"
                  >
                    <option value="todos">Status: Todos</option>
                    <option value="auditados">Auditados</option>
                    <option value="pendentes">Pendentes</option>
                  </select>

                  <select
                    value={sectorFilter}
                    onChange={(e) => setSectorFilter(e.target.value)}
                    className="border border-gray-300 bg-white text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[150px] sm:max-w-none flex-1 sm:flex-initial"
                  >
                    <option value="todos">Setor: Todos</option>
                    {uniqueSectors.map(sec => (
                      <option key={sec} value={sec}>{sec}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              {/* Mobile Card List View */}
              <div className="sm:hidden space-y-3">
                {filteredInventory.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 text-xs bg-white rounded-xl border border-gray-200 shadow-sm">
                    Nenhum ativo correspondente encontrado na pesquisa ou filtros selecionados.
                  </div>
                ) : (
                  filteredInventory.map((item) => {
                    const auditStatus = auditStatusMap[item.identificador];
                    const isAudited = auditStatus?.audited;
                    const rec = auditStatus?.record;

                    return (
                      <div key={item.identificador} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                        {/* Status Badge and Identifier */}
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-150 px-2 py-0.5 rounded border border-slate-200/60 truncate max-w-[120px]" title={item.identificador}>
                            ID: {item.identificador}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAudited ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                                <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> AUDITADO
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <AlertTriangle className="w-3 h-3 mr-1 shrink-0" /> PENDENTE
                              </span>
                            )}

                            {confirmDeleteId === item.identificador ? (
                              <div className="flex items-center space-x-1 bg-red-50 border border-red-200 p-0.5 rounded">
                                <button
                                  onClick={() => handleDeleteInventoryItem(item)}
                                  className="bg-red-600 hover:bg-red-700 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  Excluir
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[8px] font-extrabold px-1 py-0.5 rounded cursor-pointer"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(item.identificador)}
                                className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Excluir Ativo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Equipment Name and brand model */}
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-900 leading-snug">{item.equipamento}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{item.marcaModelo}</p>
                        </div>

                        {/* Location / Sector Padrão and Serial Number row */}
                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-[11px]">
                          <div className="min-w-0">
                            <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">Setor Padrão</span>
                            <span className="font-semibold text-slate-700 flex items-center mt-0.5">
                              <MapPin className="w-3 h-3 mr-1 text-indigo-400 shrink-0" />
                              <span className="truncate" title={item.localizacao}>{item.localizacao}</span>
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="text-gray-400 block text-[10px] uppercase tracking-wider font-semibold">Nº de Série</span>
                            <span className="font-mono text-slate-700 block mt-0.5 truncate" title={item.numSerie || 'N/D'}>{item.numSerie || 'N/D'}</span>
                          </div>
                        </div>

                        {/* Footer info & action button */}
                        <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
                          <div className="min-w-0 flex-1">
                            {isAudited && rec?.auditorNome && (
                              <p className="text-[10px] text-gray-400 truncate">
                                Por: <span className="font-semibold text-gray-600">{rec.auditorNome.split(' ')[0]}</span>
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isAudited && rec && (
                              <button
                                onClick={() => setSelectedReport(rec)}
                                className="px-2 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition-all flex items-center gap-1 cursor-pointer"
                                title="Visualizar Relatório de Auditoria"
                              >
                                <Camera className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>Ver Relatório</span>
                              </button>
                            )}
                            
                            <button
                              onClick={() => {
                                onSelectAuditItem(item);
                                onClose();
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-650 hover:bg-indigo-700 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span>{isAudited ? 'Re-auditar' : 'Auditar'}</span>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Desktop/Tablet Table Layout */}
              <div className="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider border-b border-gray-200">
                        <th className="px-4 sm:px-5 py-3">Ativo / ID</th>
                        <th className="px-4 sm:px-5 py-3">Equipamento</th>
                        <th className="px-4 sm:px-5 py-3 hidden md:table-cell">Marca / Modelo</th>
                        <th className="px-4 sm:px-5 py-3 hidden sm:table-cell">Setor Padrão</th>
                        <th className="px-4 sm:px-5 py-3 hidden lg:table-cell">Nº Série</th>
                        <th className="px-4 sm:px-5 py-3 text-center">Auditoria</th>
                        <th className="px-4 sm:px-5 py-3 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150 text-xs">
                      {filteredInventory.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                            Nenhum ativo correspondente encontrado na pesquisa ou filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        filteredInventory.map((item, index) => {
                          const auditStatus = auditStatusMap[item.identificador];
                          const isAudited = auditStatus?.audited;
                          const rec = auditStatus?.record;

                          return (
                            <tr key={item.identificador} className="hover:bg-slate-50/70 transition-all">
                              <td className="px-4 sm:px-5 py-3.5 font-mono text-slate-700 font-bold break-all">
                                {item.identificador}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 font-semibold text-slate-900">
                                {item.equipamento}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-gray-600 hidden md:table-cell">
                                {item.marcaModelo}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 font-medium text-indigo-700 hidden sm:table-cell">
                                <span className="flex items-center">
                                  <MapPin className="w-3 h-3 mr-1 text-indigo-400 shrink-0" />
                                  <span className="truncate max-w-[120px]">{item.localizacao}</span>
                                </span>
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 font-mono text-gray-500 hidden lg:table-cell">
                                {item.numSerie || 'N/D'}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-center">
                                {isAudited ? (
                                  <div className="inline-flex flex-col items-center gap-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                                      <CheckCircle2 className="w-3 h-3 mr-1 shrink-0" /> AUDITADO
                                    </span>
                                    {rec?.auditorNome && (
                                      <span className="text-[9px] text-gray-400 truncate max-w-[80px]" title={rec.auditorNome}>
                                        Por: {rec.auditorNome.split(' ')[0]}
                                      </span>
                                    )}
                                    {rec && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedReport(rec);
                                        }}
                                        className="mt-0.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-[9px] font-bold transition-all border border-sky-200 cursor-pointer"
                                        title="Visualizar relatório de auditoria e imagens"
                                      >
                                        <Camera className="w-2.5 h-2.5 text-sky-600 shrink-0" />
                                        <span>Relatório</span>
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-3 h-3 mr-1 shrink-0" /> PENDENTE
                                  </span>
                                )}
                              </td>
                              <td className="px-4 sm:px-5 py-3.5 text-right">
                                {confirmDeleteId === item.identificador ? (
                                  <div className="inline-flex items-center space-x-1.5 bg-red-50 border border-red-200 p-1 rounded-lg">
                                    <span className="text-[10px] font-extrabold text-red-700">Excluir?</span>
                                    <button
                                      onClick={() => handleDeleteInventoryItem(item)}
                                      className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      Sim
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                                    >
                                      Não
                                    </button>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center space-x-3">
                                    <button
                                      onClick={() => {
                                        onSelectAuditItem(item);
                                        onClose();
                                      }}
                                      className="inline-flex items-center text-[11px] font-bold text-sky-600 hover:text-sky-800 transition-colors cursor-pointer"
                                    >
                                      <span>{isAudited ? 'Re-auditar' : 'Auditar'}</span>
                                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteId(item.identificador)}
                                      className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                      title="Excluir ativo do inventário"
                                    >
                                      <Trash2 className="w-4 h-4 shrink-0" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HOSPITAL FLOOR PLAN & HEATMAP */}
          {activeTab === 'map' && (
            <div className="space-y-4 h-full flex flex-col">
              {/* Controls */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center">
                    <Layers className="w-4 h-4 mr-1.5 text-indigo-500" />
                    Planta Baixa Interativa do Hospital
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Visualize a cobertura das vistorias organizadas por área geográfica.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setHeatMapMode(!heatMapMode)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border transition-all cursor-pointer ${
                      heatMapMode 
                        ? 'bg-amber-50 text-amber-800 border-amber-200 shadow-sm' 
                        : 'bg-white text-gray-600 border-gray-300'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>{heatMapMode ? 'Desativar Mapa de Calor' : 'Ativar Mapa de Calor'}</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-slate-50 transition-all flex items-center space-x-1 cursor-pointer"
                    title="Selecione um arquivo de imagem da sua planta baixa (PNG/JPG)"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload da Planta</span>
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleBlueprintUpload}
                    accept="image/*"
                    className="hidden"
                  />

                  {customBlueprint && (
                    <button
                      onClick={handleClearBlueprint}
                      className="text-[10px] text-red-500 underline font-medium hover:text-red-700 cursor-pointer ml-1"
                    >
                      Remover personalizada
                    </button>
                  )}
                </div>
              </div>

              {/* Grid Split on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto">
                {/* Left Column (Map Stage) */}
                <div className="lg:col-span-8 flex-1 min-h-[400px] relative bg-slate-950 rounded-2xl border border-slate-800 shadow-inner overflow-hidden flex items-center justify-center p-4">
                  {customBlueprint ? (
                    /* Custom uploaded blueprint image background */
                    <div className="absolute inset-0 w-full h-full flex items-center justify-center overflow-hidden">
                      <img 
                        src={customBlueprint} 
                        alt="Planta Baixa Hospitalar Personalizada" 
                        className="w-full h-full object-contain opacity-80"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    /* Elegant built-in vector hospital blueprint diagram */
                    <svg className="w-full h-full max-w-4xl opacity-90 max-h-[500px]" viewBox="0 0 800 500" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Background Grid */}
                      <defs>
                        <pattern id="mapGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                          <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />
                        </pattern>
                      </defs>
                      <rect width="800" height="500" rx="16" fill="#090d16" />
                      <rect width="800" height="500" fill="url(#mapGrid)" rx="16" />

                      {/* Styled hospital outline corridors */}
                      {/* Main horizontal corridor */}
                      <rect x="80" y="210" width="640" height="60" rx="4" fill="#141c2f" stroke="#1d2d4c" strokeWidth="1" />
                      
                      {/* Vertical corridor left */}
                      <rect x="220" y="80" width="60" height="320" rx="4" fill="#141c2f" stroke="#1d2d4c" strokeWidth="1" />
                      {/* Vertical corridor right */}
                      <rect x="520" y="80" width="60" height="320" rx="4" fill="#141c2f" stroke="#1d2d4c" strokeWidth="1" />

                      {/* Sectors / Rooms borders */}
                      {/* Room PAA (Pronto Atendimento) */}
                      <rect x="80" y="80" width="130" height="120" rx="6" fill="#0c1e35" stroke="#163963" strokeWidth="2" strokeDasharray="4 4" />
                      <text x="145" y="145" fill="#4ea5ff" fontSize="12" fontWeight="bold" textAnchor="middle">PRONTO ATENDIMENTO (PAA)</text>

                      {/* Room CME (Central de Esterilização) */}
                      <rect x="80" y="280" width="130" height="130" rx="6" fill="#0c232f" stroke="#134763" strokeWidth="2" />
                      <text x="145" y="350" fill="#2eb0ff" fontSize="12" fontWeight="bold" textAnchor="middle">CME ESTERILIZAÇÃO</text>

                      {/* Room SGPIT (Tecnologia/Engenharia) */}
                      <rect x="290" y="80" width="220" height="120" rx="6" fill="#0c2d28" stroke="#135b4f" strokeWidth="2" />
                      <text x="400" y="145" fill="#2bf5cf" fontSize="12" fontWeight="bold" textAnchor="middle">ENG. CLÍNICA / TI (SGPIT)</text>

                      {/* Room ENDO (Endoscopia) */}
                      <rect x="590" y="80" width="130" height="120" rx="6" fill="#1e1837" stroke="#3a2f6c" strokeWidth="2" />
                      <text x="655" y="145" fill="#9f85ff" fontSize="12" fontWeight="bold" textAnchor="middle">DIAG. IMAGEM (ENDO)</text>

                      {/* Room UCMC (Coronária) */}
                      <rect x="290" y="280" width="220" height="130" rx="6" fill="#1a2e21" stroke="#325a3f" strokeWidth="2" />
                      <text x="400" y="350" fill="#4ade80" fontSize="12" fontWeight="bold" textAnchor="middle">UCMC CORONÁRIA</text>

                      {/* Room SEGE (Administração) */}
                      <rect x="590" y="280" width="130" height="130" rx="6" fill="#1e222d" stroke="#363f53" strokeWidth="2" />
                      <text x="655" y="350" fill="#94a3b8" fontSize="12" fontWeight="bold" textAnchor="middle">SEGE ADM / ENF</text>
                    </svg>
                  )}

                  {/* Interactive Heatmap Layers Overlay */}
                  <AnimatePresence>
                    {heatMapMode && Object.keys(stats.sectorStats).map((secName) => {
                      const secData = stats.sectorStats[secName];
                      const coords = dynamicSectorCoordinates[secName];
                      if (!coords) return null;

                      // Compute heatmap metrics
                      const pct = secData.total > 0 ? (secData.audited / secData.total) : 0;
                      // Colors based on completion level
                      let ringColor = 'rgba(239, 68, 68, 0.4)'; // red (none or low)
                      let glowColor = 'rgba(239, 68, 68, 0.25)';
                      if (pct >= 1) {
                        ringColor = 'rgba(16, 185, 129, 0.4)'; // green (100% completed)
                        glowColor = 'rgba(16, 185, 129, 0.25)';
                      } else if (pct > 0.4) {
                        ringColor = 'rgba(56, 189, 248, 0.4)'; // blue/sky (medium completed)
                        glowColor = 'rgba(56, 189, 248, 0.25)';
                      } else if (pct > 0) {
                        ringColor = 'rgba(245, 158, 11, 0.4)'; // orange (some completed)
                        glowColor = 'rgba(245, 158, 11, 0.25)';
                      }

                      // Map intensity based on total devices count in that sector
                      const radius = 40 + Math.min(secData.total * 6, 60);

                      return (
                        <motion.div
                          key={`heatmap-${secName}`}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
                          style={{
                            left: `${coords.x}%`,
                            top: `${coords.y}%`,
                            width: `${radius * 2}px`,
                            height: `${radius * 2}px`,
                            background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)`,
                            border: `1.5px dashed ${ringColor}`,
                            boxShadow: `0 0 15px ${glowColor}`
                          }}
                        />
                      );
                    })}
                  </AnimatePresence>

                  {/* Sector Pin Overlays */}
                  {Object.keys(stats.sectorStats).map((secName) => {
                    const secData = stats.sectorStats[secName];
                    const coords = dynamicSectorCoordinates[secName];
                    if (!coords) return null;

                    const isHovered = hoveredSector === secName;
                    const isSelected = selectedMapSector === secName;
                    const pct = secData.total > 0 ? Math.round((secData.audited / secData.total) * 100) : 0;
                    const isCompleted = secData.audited === secData.total;

                    return (
                      <div
                        key={`pin-${secName}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                        style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                        onMouseEnter={() => setHoveredSector(secName)}
                        onMouseLeave={() => setHoveredSector(null)}
                        onClick={() => {
                          setSelectedMapSector(isSelected ? null : secName);
                          // Filter the table view automatically and switch tabs
                          setSectorFilter(isSelected ? 'todos' : secName);
                          setActiveTab('table');
                        }}
                      >
                        <button 
                          className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-lg transition-all transform hover:scale-125 cursor-pointer ${
                            isCompleted 
                              ? 'bg-emerald-500 border-emerald-200 text-white' 
                              : secData.audited > 0 
                                ? 'bg-sky-500 border-sky-200 text-white' 
                                : 'bg-amber-500 border-amber-200 text-white'
                          }`}
                          title={`${secName}: ${pct}% Mapeado`}
                        >
                          <span className="text-[10px] font-extrabold">{coords.label}</span>
                        </button>

                        {/* Floating Indicator Tooltip */}
                        {(isHovered || isSelected) && (
                          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-60 bg-slate-900 border border-slate-700 text-white p-3 rounded-xl shadow-xl z-20 pointer-events-none space-y-1.5">
                            <div>
                              <h4 className="text-xs font-bold text-emerald-400 truncate">{coords.desc || secName}</h4>
                              <p className="text-[9px] text-slate-400 font-mono">ID: {coords.label}</p>
                            </div>
                            
                            <div className="text-[10px] text-slate-300 space-y-0.5 border-t border-slate-800 pt-1.5">
                              {coords.category && (
                                <p className="flex justify-between">
                                  <span className="text-slate-400">Grupo:</span>
                                  <span className="font-semibold text-emerald-400 text-right truncate max-w-[140px]">{coords.category}</span>
                                </p>
                              )}
                              {coords.floor && (
                                <p className="flex justify-between">
                                  <span className="text-slate-400">Pavimento:</span>
                                  <span className="font-semibold text-sky-400">{coords.floor}</span>
                                </p>
                              )}
                              {coords.latitude && coords.longitude ? (
                                <p className="flex flex-col text-[9px] text-slate-400 border-t border-slate-800/60 pt-1">
                                  <span>Coordenadas GPS:</span>
                                  <span className="font-mono text-emerald-400 font-bold select-all">
                                    📍 {coords.latitude}, {coords.longitude}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-[9px] text-amber-500/70 italic">Sem geolocalização cadastrada</p>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-1 mt-2 text-center text-[10px] border-t border-slate-800 pt-1.5">
                              <div>
                                <span className="block font-bold text-slate-300">{secData.total}</span>
                                <span className="text-[8px] text-slate-400">Total</span>
                              </div>
                              <div>
                                <span className="block font-bold text-emerald-400">{secData.audited}</span>
                                <span className="text-[8px] text-slate-400">Auditados</span>
                              </div>
                              <div>
                                <span className="block font-bold text-amber-400">{secData.pending}</span>
                                <span className="text-[8px] text-slate-400">Faltando</span>
                              </div>
                            </div>
                            <div className="mt-1 text-center">
                              <span className="inline-block text-[8px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-bold">
                                Clique para filtrar ativos na lista
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Google Drive Plantas & Projetos PDFs Manager (occupies 4 columns on large screens) */}
                <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-gray-200 p-4 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="border-b border-gray-200 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-sky-600 shrink-0" />
                        Projetos no Google Drive (PDF)
                      </h4>
                      <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
                        Acesse as pastas de projetos técnicos do Drive diretamente. Projetos em PDF facilitam a visualização rápida em qualquer navegador.
                      </p>
                    </div>

                    {/* PDF List */}
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {floorPlans.length === 0 ? (
                        <p className="text-[10px] text-gray-400 italic py-2 text-center">Nenhuma planta cadastrada.</p>
                      ) : (
                        floorPlans.map((plan) => (
                          <div key={plan.id} className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-sky-300 transition-all flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-gray-800 truncate" title={plan.name}>
                                {plan.name}
                              </p>
                              {plan.sector && (
                                <span className="inline-block text-[9px] bg-slate-100 text-slate-600 px-1 rounded font-medium mt-0.5 truncate max-w-full">
                                  Setor: {plan.sector}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <a
                                href={plan.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1 hover:bg-sky-50 text-sky-600 rounded-lg transition-colors cursor-pointer"
                                title="Abrir projeto no Google Drive"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleRemoveFloorPlan(plan.id)}
                                className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Excluir link de projeto"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Plant Form */}
                  <form onSubmit={handleAddFloorPlan} className="bg-white p-3 rounded-xl border border-gray-200/80 shadow-sm space-y-2">
                    <p className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                      <Plus className="w-3 h-3 text-indigo-500" />
                      Vincular Novo Projeto / Pasta PDF
                    </p>

                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="Nome (ex: Planta de Instalações Elétricas)"
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        className="w-full text-[10px] p-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />

                      <input
                        type="text"
                        placeholder="Link do Google Drive (URL)"
                        value={newPlanUrl}
                        onChange={(e) => setNewPlanUrl(e.target.value)}
                        className="w-full text-[10px] p-2 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        required
                      />

                      <select
                        value={newPlanSector}
                        onChange={(e) => setNewPlanSector(e.target.value)}
                        className="w-full text-[10px] p-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer bg-white"
                      >
                        <option value="todos">Selecione o Setor Vinculado (Opcional)</option>
                        {sectorsList.map((sec) => (
                          <option key={sec.id} value={sec.name}>
                            {sec.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold rounded-lg transition-colors cursor-pointer"
                    >
                      Adicionar Planta
                    </button>
                  </form>
                </div>
              </div>

              {/* Map Footer Info */}
              <div className="bg-slate-900 border border-slate-800 text-slate-300 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center space-x-2">
                  <BadgeInfo className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="text-xs">
                    Legenda do Mapa: <strong>Cores dos Alfinetes</strong> representam a cobertura do setor: 
                    <span className="mx-1.5 inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Concluído (100%), 
                    <span className="mx-1.5 inline-block w-2.5 h-2.5 bg-sky-500 rounded-full" /> Em andamento, 
                    <span className="mx-1.5 inline-block w-2.5 h-2.5 bg-amber-500 rounded-full" /> Não Iniciado.
                  </span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Total de {uniqueSectors.length} setores operacionais cadastrados no Orbis.
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
