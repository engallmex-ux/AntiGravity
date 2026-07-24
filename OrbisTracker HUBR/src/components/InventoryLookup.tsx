import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Tag, Binary, ClipboardCheck, X, Database, Radio, Wifi, QrCode, Camera, Upload, Sparkles, Link } from 'lucide-react';
import { INVENTORY_DATA, InventoryItem } from '../data/inventory';

interface InventoryLookupProps {
  onSelectItem: (item: InventoryItem) => void;
  isNfcTagEnabled?: boolean;
  activeInventory?: InventoryItem[];
}

/**
 * Componente: InventoryLookup
 * Descrição: Oferece uma barra de pesquisa rápida de equipamentos cadastrados no inventário
 * físico do hospital. Permite auto-completar todo o formulário com um único clique, otimizando
 * o tempo de auditoria clínica. Inclui suporte integrado para validação por Tag RFID/NFC.
 */
export default function InventoryLookup({ onSelectItem, isNfcTagEnabled = true, activeInventory: propActiveInventory }: InventoryLookupProps) {
  const [query, setQuery] = useState<string>('');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [results, setResults] = useState<InventoryItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [localActiveInventory, setLocalActiveInventory] = useState<InventoryItem[]>(INVENTORY_DATA);
  const [isCustomDb, setIsCustomDb] = useState<boolean>(false);

  const activeInventory = propActiveInventory || localActiveInventory;

  // Load custom inventory if exists
  useEffect(() => {
    const loadInventory = () => {
      const saved = localStorage.getItem('orbis_custom_inventory');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setLocalActiveInventory(parsed);
            setIsCustomDb(true);
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }
      setLocalActiveInventory(INVENTORY_DATA);
      setIsCustomDb(false);
    };

    loadInventory();
    
    window.addEventListener('orbis_db_updated', loadInventory);
    window.addEventListener('storage', loadInventory);
    return () => {
      window.removeEventListener('orbis_db_updated', loadInventory);
      window.removeEventListener('storage', loadInventory);
    };
  }, []);

  // Estados específicos para Validação de Tag RFID/NFC
  const [isNfcMenuOpen, setIsNfcMenuOpen] = useState<boolean>(false);
  const [nfcStatus, setNfcStatus] = useState<{ type: 'idle' | 'scanning' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' });
  const [nfcSimValue, setNfcSimValue] = useState<string>('');

  // Estados e Referências para Validação por Código QR / Etiqueta de Patrimônio
  const [isQrMenuOpen, setIsQrMenuOpen] = useState<boolean>(false);
  const [qrStatus, setQrStatus] = useState<{ type: 'idle' | 'scanning' | 'success' | 'error'; text: string }>({ type: 'idle', text: '' });
  const [isScanningQr, setIsScanningQr] = useState<boolean>(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  const handleQrFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setQrStatus({ type: 'scanning', text: 'Enviando imagem para decodificação com Inteligência Artificial Orbis Vision...' });
    setIsScanningQr(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Str = reader.result as string;
      try {
        const response = await fetch('/api/scan-qrcode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Str })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Falha ao processar imagem.');
        }

        const data = await response.json();
        if (data.code) {
          // Look up matching item in inventory
          const cleanCode = data.code.trim().toLowerCase();
          const found = activeInventory.find(item => {
            const iden = (item.identificador || '').trim().toLowerCase();
            const pat = (item.numSerie || '').trim().toLowerCase();
            return iden === cleanCode || iden.includes(cleanCode) || pat === cleanCode || pat.includes(cleanCode);
          });

          if (found) {
            handleChooseItem(found);
            setQrStatus({
              type: 'success',
              text: `Código QR [${data.code}] decodificado com sucesso! Equipamento "${found.equipamento}" localizado e carregado.`
            });
            // Beep of success
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gain = audioCtx.createGain();
              osc.connect(gain);
              gain.connect(audioCtx.destination);
              osc.frequency.value = 1046.50; // High C beep
              gain.gain.setValueAtTime(0, audioCtx.currentTime);
              gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
              gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
              osc.start();
              osc.stop(audioCtx.currentTime + 0.2);
            } catch (soundErr) {}
          } else {
            // It read a valid HU code, but it's not in the database yet (it's a new tag stuck on equipment)
            setQrStatus({
              type: 'success',
              text: `Código QR [${data.code}] decodificado! Ativo novo ou pré-impresso identificado. Vinculando o novo código ao formulário para iniciar o registro.`
            });
            
            onSelectItem({
              equipamento: '',
              marcaModelo: '',
              localizacao: '',
              contrato: 'Não',
              identificador: data.code,
              numSerie: data.numSerie || '',
              dataAquisicao: '',
              garantia: ''
            });
          }
        } else {
          // Check if serial/patrimonio was found
          if (data.numSerie || data.numPatrimonio) {
            const cleanSn = (data.numSerie || '').trim().toLowerCase();
            const cleanPat = (data.numPatrimonio || '').trim().toLowerCase();
            
            const found = activeInventory.find(item => {
              const iden = (item.identificador || '').trim().toLowerCase();
              const sn = (item.numSerie || '').trim().toLowerCase();
              return (cleanPat && (iden === cleanPat || iden.includes(cleanPat))) || 
                     (cleanSn && (sn === cleanSn || sn.includes(cleanSn)));
            });

            if (found) {
              handleChooseItem(found);
              setQrStatus({
                type: 'success',
                text: `Equipamento localizado pelo número de patrimônio/série por extenso!`
              });
              return;
            }
          }
          setQrStatus({
            type: 'error',
            text: 'Nenhum QR Code válido no padrão HU-SIGLA-SEQUENCIAL-ORB foi identificado nesta foto.'
          });
        }
      } catch (err: any) {
        setQrStatus({
          type: 'error',
          text: `Erro de leitura: ${err.message || 'Verifique a iluminação e tente focar mais perto.'}`
        });
      } finally {
        setIsScanningQr(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Fecha o dropdown de sugestões caso ocorra um clique fora do elemento
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Processa a mudança no campo de texto de pesquisa
  const handleSearchChange = (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const cleanQuery = val.toLowerCase();
    // Filtra itens com base no nome do equipamento, marca, série, tag ou localização
    const filtered = activeInventory.filter(item => 
      item.equipamento.toLowerCase().includes(cleanQuery) ||
      item.marcaModelo.toLowerCase().includes(cleanQuery) ||
      item.numSerie.toLowerCase().includes(cleanQuery) ||
      item.identificador.toLowerCase().includes(cleanQuery) ||
      item.localizacao.toLowerCase().includes(cleanQuery)
    );

    // Limita o resultado às 8 principais recomendações para uma interface limpa
    setResults(filtered.slice(0, 8));
    setIsOpen(true);
  };

  // Trata a seleção de um equipamento na lista suspensa
  const handleChooseItem = (item: InventoryItem) => {
    onSelectItem(item);
    setQuery(`${item.equipamento} - ${item.marcaModelo}`);
    setIsOpen(false);
  };

  // Reseta a pesquisa
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  // Processa a leitura de uma Tag RFID/NFC (simulada ou física)
  const processNfcTagValue = (tagVal: string) => {
    if (!tagVal.trim()) return;

    const cleanTag = tagVal.trim().toLowerCase();
    
    // Busca um ativo com base no identificador (patrimônio) ou número de série
    const found = activeInventory.find(item => {
      const iden = (item.identificador || '').trim().toLowerCase();
      const sn = (item.numSerie || '').trim().toLowerCase();
      return iden === cleanTag || iden.includes(cleanTag) || sn === cleanTag || sn.includes(cleanTag);
    });

    if (found) {
      handleChooseItem(found);
      setNfcStatus({
        type: 'success',
        text: `Tag RFID/NFC [${tagVal}] reconhecida! Equipamento "${found.equipamento}" selecionado com sucesso.`
      });

      // Emite um aviso sonoro (beep clínico) de sucesso
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.frequency.value = 880; // Beep de frequência agradável (nota Lá)
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 0.05);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
      } catch (e) {}
    } else {
      setNfcStatus({
        type: 'error',
        text: `Tag RFID/NFC [${tagVal}] lida com sucesso, mas nenhum ativo correspondente foi encontrado no HU-Brasil.`
      });
    }

    setTimeout(() => {
      setNfcStatus({ type: 'idle', text: '' });
    }, 5000);
  };

  // Executa escaneamento físico real via Web NFC API (NDEFReader)
  const handleStartPhysicalNFC = async () => {
    setNfcStatus({ type: 'scanning', text: 'Aproxime o verso do celular da tag RFID/NFC física...' });
    
    if (!('NDEFReader' in window)) {
      setNfcStatus({
        type: 'error',
        text: 'A API Web NFC não está disponível neste navegador/dispositivo. Utilize o simulador clínico abaixo.'
      });
      setTimeout(() => setNfcStatus({ type: 'idle', text: '' }), 6000);
      return;
    }

    try {
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      
      ndef.addEventListener("readingerror", () => {
        setNfcStatus({ type: 'error', text: 'Erro ao ler tag NFC física. Tente novamente ou use outra tag.' });
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
        processNfcTagValue(tagVal);
      });
    } catch (error: any) {
      console.error(error);
      setNfcStatus({
        type: 'error',
        text: `Erro de Inicialização NFC: ${error.message || 'Permissão negada ou hardware desativado.'}`
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm relative space-y-3" ref={dropdownRef} id="inventory-lookup-container">
      
      {/* Cabeçalho da Pesquisa com Foco no Dado do Banco de Dados */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardCheck className="w-4 h-4 text-emerald-600 animate-pulse" />
          Atalho de Busca no Inventário Hospitalar
        </label>
        
        {/* Destaque para os Itens Ativos no Banco de Dados */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[11px] font-bold border border-emerald-200 shadow-xs animate-pulse">
          <Database className="w-3.5 h-3.5 text-emerald-600" />
          <span>{activeInventory.length} {isCustomDb ? 'Itens Customizados' : 'Itens Ativos Cadastrados'}</span>
        </div>
      </div>

      <div className="relative space-y-2">
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => query.trim() && setIsOpen(true)}
              placeholder="Pesquise por Nº de Série, Patrimônio, Marca, Modelo ou Setor..."
              className="w-full pl-9 pr-8 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
            {query && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Botão de Pesquisa/Validação NFC e RFID */}
          {isNfcTagEnabled && (
            <button
              type="button"
              onClick={() => {
                setIsNfcMenuOpen(!isNfcMenuOpen);
                setIsQrMenuOpen(false);
              }}
              className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isNfcMenuOpen
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Validar ativo através de Tag RFID / NFC"
            >
              <Radio className={`w-4 h-4 ${isNfcMenuOpen ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">RFID / NFC</span>
            </button>
          )}

          {/* Botão de Leitura de QR Code via Câmera/Foto */}
          <button
            type="button"
            onClick={() => {
              setIsQrMenuOpen(!isQrMenuOpen);
              setIsNfcMenuOpen(false);
            }}
            className={`py-2 px-3 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isQrMenuOpen
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Escanear ou fazer upload de Etiqueta QR"
          >
            <QrCode className={`w-4 h-4 ${isQrMenuOpen ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">Escanear QR Code</span>
          </button>
        </div>

        {/* Menu/Painel de validação por QR Code via IA Vision */}
        {isQrMenuOpen && (
          <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 text-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-indigo-150 pb-1.5">
              <span className="font-bold text-indigo-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />
                Leitor Inteligente de QR Code & Etiquetas (Orbis Vision)
              </span>
              <button
                type="button"
                onClick={() => setIsQrMenuOpen(false)}
                className="text-indigo-400 hover:text-indigo-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status do QR Code */}
            {qrStatus.text && (
              <div className={`p-2.5 rounded-lg border text-[11px] leading-relaxed ${
                qrStatus.type === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-200' :
                qrStatus.type === 'error' ? 'bg-rose-50 text-rose-950 border-rose-200' :
                'bg-indigo-50 text-indigo-950 border-indigo-200 animate-pulse'
              }`}>
                {qrStatus.text}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 space-y-1.5">
                <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Processar Imagem de Campo</span>
                <input
                  type="file"
                  ref={qrInputRef}
                  onChange={handleQrFileChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => qrInputRef.current?.click()}
                  disabled={isScanningQr}
                  className="w-full py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <Camera className="w-4 h-4 animate-pulse" />
                  Escanear com Câmera ou Galeria
                </button>
              </div>

              <div className="flex-1 p-2.5 bg-indigo-100/40 rounded-xl border border-indigo-150 flex flex-col justify-between">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Como Funciona:</span>
                <p className="text-[10px] text-indigo-950 leading-relaxed mt-1">
                  1. Aponte a câmera do celular para a etiqueta com o QR code impresso.<br />
                  2. Tire a foto garantindo boa iluminação e foco.<br />
                  3. A IA lê o código <strong className="font-semibold text-indigo-900">HU-[SIGLA]-[SEQ]-ORB</strong>, busca no banco e autocompleta na hora!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Menu/Painel de validação por Tag RFID/NFC */}
        {isNfcTagEnabled && isNfcMenuOpen && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3 animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-600" />
                Validação por Tag RFID / NFC do Ativo
              </span>
              <button
                type="button"
                onClick={() => setIsNfcMenuOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Status do NFC */}
            {nfcStatus.text && (
              <div className={`p-2.5 rounded-lg border text-[11px] ${
                nfcStatus.type === 'success' ? 'bg-emerald-50 text-emerald-950 border-emerald-200' :
                nfcStatus.type === 'error' ? 'bg-red-50 text-red-950 border-red-200' :
                'bg-blue-50 text-blue-950 border-blue-200 animate-pulse'
              }`}>
                {nfcStatus.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Leitura Física */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Leitor de Campo (Físico)</span>
                <button
                  type="button"
                  onClick={handleStartPhysicalNFC}
                  className="w-full py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  Escanear Tag Física (Web NFC)
                </button>
              </div>

              {/* Simulador Clínico de RFID */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Simulador de RFID / NFC</span>
                <div className="flex gap-1">
                  <select
                    value={nfcSimValue}
                    onChange={(e) => setNfcSimValue(e.target.value)}
                    className="flex-1 p-1.5 text-[11px] border border-slate-200 bg-white rounded-lg focus:outline-none"
                  >
                    <option value="">Selecione uma Tag...</option>
                    <option value="PA0008">Tag: PA0008 (Ventilador Intermed)</option>
                    <option value="10022410">Tag: 10022410 (Ventilador Mindray)</option>
                    <option value="UDIDE0036">Tag: UDIDE0036 (Desfibrilador Instramed)</option>
                    <option value="7817927">Tag: 7817927 (Bomba de Infusão)</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (nfcSimValue) {
                        processNfcTagValue(nfcSimValue);
                      }
                    }}
                    disabled={!nfcSimValue}
                    className="px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Simular
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-normal">
              Ao aproximar a Tag RFID ou escolher uma opção no simulador, o sistema localiza instantaneamente o registro, preenche o prontuário de inspeção e registra automaticamente a localização geográfica (GPS).
            </p>
          </div>
        )}

        {/* Dropdown de Resultados da Pesquisa */}
        {isOpen && results.length > 0 && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 animate-scale-up">
            <div className="p-2 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Equipamentos Encontrados no Cadastro
            </div>
            {results.map((item, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleChooseItem(item)}
                className="w-full text-left p-3 hover:bg-emerald-50/40 flex flex-col gap-1 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-emerald-950">
                    {item.equipamento}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-500">
                    {item.marcaModelo}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-0.5 text-[10px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    Setor: <strong className="text-slate-700">{item.localizacao}</strong>
                  </span>
                  {item.numSerie && item.numSerie !== "Not in source" && (
                    <span className="flex items-center gap-1 font-mono">
                      <Binary className="w-3 h-3 text-slate-400" />
                      S/N: <strong className="text-emerald-800">{item.numSerie.split(',')[0]}</strong>
                    </span>
                  )}
                  {item.identificador && (
                    <span className="flex items-center gap-1 font-mono">
                      <Tag className="w-3 h-3 text-slate-400" />
                      TAG: <strong className="text-blue-800">{item.identificador.split(',')[0]}</strong>
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {isOpen && query.trim() && results.length === 0 && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-4 text-center text-xs text-slate-500">
            Nenhum equipamento cadastrado corresponde aos critérios informados.
          </div>
        )}
      </div>

      <p className="text-[10.5px] text-slate-400 leading-relaxed">
        <strong>Agilidade Operacional:</strong> Os <span className="font-bold text-slate-500">{activeInventory.length} itens</span> listados acima correspondem aos registros ativos do {isCustomDb ? 'cadastro importado' : 'HU-Brasil'}. Selecione um equipamento para auto-preencher dados como marca, modelo, série e número de patrimônio de forma 100% automatizada.
      </p>
    </div>
  );
}
