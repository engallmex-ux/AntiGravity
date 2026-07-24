import React, { useRef, useState, useEffect } from 'react';
import { 
  Camera, Upload, Trash2, RefreshCw, CheckCircle, 
  Image as ImageIcon, Sparkles, FolderOpen,
  ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Maximize2, X,
  Check, Lock, ArrowRight, Info, HelpCircle
} from 'lucide-react';
import { LabelImage } from '../types';

export const PHOTO_SEQUENCE_STEPS: {
  type: LabelImage['labelType'];
  title: string;
  shortLabel: string;
  hint: string;
  example: string;
}[] = [
  {
    type: 'geral',
    title: '1. FOTO FRONTAL GERAL DO EQUIPAMENTO',
    shortLabel: 'Frontal',
    hint: 'Fotografe o equipamento inteiro de frente, mostrando visor, botões e design geral frontal.',
    example: 'Ideal para reconhecimento visual do modelo pelo Gemini.'
  },
  {
    type: 'serie',
    title: '2. NÚMERO DE SÉRIE (S/N)',
    shortLabel: 'Nº Série',
    hint: 'Foque bem na placa metálica ou etiqueta traseira/lateral contendo o número de série (S/N).',
    example: 'Crucial para o registro e rastreabilidade jurídica do ativo.'
  },
  {
    type: 'patrimonio',
    title: '3. NÚMERO DE PATRIMÔNIO / TAG',
    shortLabel: 'Patrimônio',
    hint: 'Fotografe bem de perto a etiqueta de patrimônio/inventário ou tag RFID/NFC do hospital.',
    example: 'Permite identificar o código inventariado do hospital.'
  },
  {
    type: 'calibracao',
    title: '4. SELO / ETIQUETA DE CALIBRAÇÃO',
    shortLabel: 'Calibração',
    hint: 'Registre a etiqueta do selo do laboratório de metrologia parceiro com datas de validade.',
    example: 'Garante o controle metrológico ativo.'
  },
  {
    type: 'manutencao',
    title: '5. ETIQUETA DE MANUTENÇÃO PREVENTIVA',
    shortLabel: 'Preventiva',
    hint: 'Fotografe a etiqueta de controle de preventiva do hospital ou selo de próxima manutenção.',
    example: 'Comprova que a revisão periódica está em dia.'
  },
  {
    type: 'seguranca',
    title: '6. SEGURANÇA ELÉTRICA (NBR 60601)',
    shortLabel: 'Seg. Elétrica',
    hint: 'Fotografe o selo ou laudo do último ensaio de segurança elétrica e isolamento.',
    example: 'Item de conformidade obrigatório em ambiente clínico.'
  },
  {
    type: 'tecnica',
    title: '7. CARACTERÍSTICAS TÉCNICAS',
    shortLabel: 'Caract. Técnicas',
    hint: 'Foque na placa traseira/dados elétricos (potência, corrente, voltagem, fabricante).',
    example: 'Facilita a extração automática da ficha técnica pelo robô.'
  }
];

interface CameraCaptureProps {
  images: LabelImage[];
  onAddImage: (img: LabelImage) => void;
  onRemoveImage: (id: string) => void;
  onClearImages: () => void;
  onProcess: () => void;
  isProcessing: boolean;
  isPhotoSequenceEnabled?: boolean;
}

export default function CameraCapture({
  images,
  onAddImage,
  onRemoveImage,
  onClearImages,
  onProcess,
  isProcessing,
  isPhotoSequenceEnabled = true
}: CameraCaptureProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedLabelType, setSelectedLabelType] = useState<LabelImage['labelType']>('geral');
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(true);

  // Popup Alert State for the Guided Sequence flow
  const [nextStepAlert, setNextStepAlert] = useState<{
    show: boolean;
    addedStepTitle: string;
    nextStepTitle: string;
    nextStepHint: string;
  } | null>(null);

  // Carousel & Zoom states
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Lightbox modal states
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);
  const [lightboxScale, setLightboxScale] = useState<number>(1);
  const [lightboxPan, setLightboxPan] = useState({ x: 0, y: 0 });
  const [isLightboxDragging, setIsLightboxDragging] = useState<boolean>(false);
  const [lightboxDragStart, setLightboxDragStart] = useState({ x: 0, y: 0 });

  // Reset zoom and panning when image changes
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setLightboxScale(1);
    setLightboxPan({ x: 0, y: 0 });
  }, [activeIdx]);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setScale(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  };

  const handleResetZoom = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  // Adjust active index if image count changes
  useEffect(() => {
    if (images.length > 0 && activeIdx >= images.length) {
      setActiveIdx(images.length - 1);
    }
  }, [images.length, activeIdx]);

  // Synchronize selectedLabelType with the current step in the recommended sequence
  useEffect(() => {
    if (isPhotoSequenceEnabled) {
      const nextIdx = Math.min(images.length, PHOTO_SEQUENCE_STEPS.length - 1);
      setSelectedLabelType(PHOTO_SEQUENCE_STEPS[nextIdx].type);
    }
  }, [images.length, isPhotoSequenceEnabled]);

  // Resize and convert image file to base64
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600; // Resolution for excellent OCR
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          
          const newImage: LabelImage = {
            id: Math.random().toString(36).substring(2, 9),
            base64,
            mimeType: 'image/jpeg',
            labelType: selectedLabelType,
            fileName: file.name || `foto_${selectedLabelType}.jpg`,
            width,
            height
          };
          onAddImage(newImage);
          // Auto select the newly added image in the carousel
          setActiveIdx(images.length);

          // If guided mode is enabled, show the next step interactive popup
          if (isPhotoSequenceEnabled) {
            const currentIdx = images.length;
            const addedStep = PHOTO_SEQUENCE_STEPS[currentIdx];
            const nextStepVal = PHOTO_SEQUENCE_STEPS[currentIdx + 1] || null;
            if (addedStep && nextStepVal) {
              setNextStepAlert({
                show: true,
                addedStepTitle: addedStep.shortLabel,
                nextStepTitle: nextStepVal.title,
                nextStepHint: nextStepVal.hint
              });
            }
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      (Array.from(e.target.files) as File[]).forEach(file => {
        processImageFile(file);
      });
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      (Array.from(e.target.files) as File[]).forEach(file => {
        processImageFile(file);
      });
    }
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      (Array.from(e.dataTransfer.files) as File[]).forEach(file => {
        if (file.type.startsWith('image/')) {
          processImageFile(file);
        }
      });
    }
  };

  const labelTypeNames: Record<LabelImage['labelType'], string> = {
    geral: 'Geral (Tudo em Um)',
    serie: 'Nº Série',
    patrimonio: 'Patrimônio / TAG',
    tecnica: 'Caract. Técnicas',
    calibracao: 'Etiqueta Calibração',
    manutencao: 'Etiqueta Preventiva',
    seguranca: 'Segurança Elétrica'
  };

  // Main Carousel Panning Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setPan({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  // Fullscreen Lightbox Panning Handlers
  const handleLightboxMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (lightboxScale <= 1) return;
    setIsLightboxDragging(true);
    setLightboxDragStart({ x: e.clientX - lightboxPan.x, y: e.clientY - lightboxPan.y });
  };

  const handleLightboxMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isLightboxDragging || lightboxScale <= 1) return;
    setLightboxPan({
      x: e.clientX - lightboxDragStart.x,
      y: e.clientY - lightboxDragStart.y
    });
  };

  const handleLightboxMouseUpOrLeave = () => {
    setIsLightboxDragging(false);
  };

  const handleLightboxTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lightboxScale <= 1 || e.touches.length !== 1) return;
    setIsLightboxDragging(true);
    const touch = e.touches[0];
    setLightboxDragStart({ x: touch.clientX - lightboxPan.x, y: touch.clientY - lightboxPan.y });
  };

  const handleLightboxTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isLightboxDragging || lightboxScale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    setLightboxPan({
      x: touch.clientX - lightboxDragStart.x,
      y: touch.clientY - lightboxDragStart.y
    });
  };

  // Navigation functions
  const nextSlide = () => {
    if (images.length === 0) return;
    setActiveIdx(prev => (prev + 1) % images.length);
  };

  const prevSlide = () => {
    if (images.length === 0) return;
    setActiveIdx(prev => (prev - 1 + images.length) % images.length);
  };

  const handleRemoveActiveImage = (id: string) => {
    onRemoveImage(id);
    if (activeIdx >= images.length - 1) {
      setActiveIdx(Math.max(0, images.length - 2));
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden" id="camera-capture-container">
      {/* Tab Header / Image type selector */}
      <div className="p-5 border-b border-slate-100 bg-slate-50/50">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-600" />
          Capturar Fotos das Etiquetas
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Tire fotos em tela cheia usando a câmera do seu celular ou anexe da galeria. O Gemini lerá tudo!
        </p>

        {/* Interactive Visual Stepper (Only when guided mode is enabled) */}
        {isPhotoSequenceEnabled ? (
          <div className="mt-4" id="photo-sequence-stepper">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                Padrão de Sequência Fotográfica Recomendada
              </span>
              <span className="text-[10px] font-mono text-emerald-700 bg-emerald-100/50 px-2.5 py-0.5 rounded-full font-bold">
                Progresso: {Math.min(images.length, 7)} de 7 Etapas
              </span>
            </div>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {PHOTO_SEQUENCE_STEPS.map((step, idx) => {
                const isCompleted = images.some(img => img.labelType === step.type);
                const isActive = selectedLabelType === step.type;
                const stepNumber = idx + 1;
                
                return (
                  <button
                    key={step.type}
                    type="button"
                    id={`stepper-btn-${step.type}`}
                    onClick={() => setSelectedLabelType(step.type)}
                    className={`relative p-2 rounded-xl text-left border transition-all flex flex-col justify-between min-h-[68px] group ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50/75 ring-2 ring-emerald-500/15 shadow-2xs'
                        : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/45'
                        : 'border-slate-200 bg-white/70 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                    title={`${step.title}: ${step.hint}`}
                  >
                    {/* Step Top: Badge / Check */}
                    <div className="flex items-center justify-between w-full">
                      <span className={`text-[8.5px] font-mono font-bold ${
                        isActive ? 'text-emerald-700' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                      }`}>
                        ETAPA {stepNumber}
                      </span>
                      {isCompleted ? (
                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                      ) : isActive ? (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                      )}
                    </div>

                    {/* Step Title */}
                    <div className="mt-1">
                      <span className={`text-[10px] font-bold block leading-tight truncate ${
                        isActive ? 'text-emerald-950' : isCompleted ? 'text-emerald-800' : 'text-slate-500'
                      }`}>
                        {step.shortLabel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Glowing Reminder Banner (Pop-up style warning / guide) */}
            {(() => {
              const activeStep = PHOTO_SEQUENCE_STEPS.find(s => s.type === selectedLabelType) || PHOTO_SEQUENCE_STEPS[0];
              const nextStepIdx = PHOTO_SEQUENCE_STEPS.findIndex(s => s.type === selectedLabelType) + 1;
              const nextStep = nextStepIdx < PHOTO_SEQUENCE_STEPS.length ? PHOTO_SEQUENCE_STEPS[nextStepIdx] : null;

              return (
                <div className="mt-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-xl p-4 shadow-md relative overflow-hidden animate-fade-in border border-emerald-500/20" id="dynamic-photo-prompt">
                  {/* Decorative background element */}
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-white/5 skew-x-12 pointer-events-none transform translate-x-10" />
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-white/20 backdrop-blur-xs rounded text-[9px] font-black tracking-wider uppercase">
                          INSTRUÇÃO DE FOTO ATUAL
                        </span>
                        <span className="text-[10px] text-emerald-200 bg-black/20 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 animate-pulse">
                          <Camera className="w-3 h-3" />
                          Padrão de Qualidade
                        </span>
                      </div>
                      
                      <h3 className="text-base font-extrabold tracking-tight flex items-center gap-1.5 mt-1 text-white">
                        {activeStep.title}
                      </h3>
                      
                      <p className="text-xs text-emerald-50/95 leading-relaxed font-medium">
                        {activeStep.hint}
                      </p>
                      
                      <div className="text-[10px] text-teal-100/80 font-mono italic flex items-center gap-1 mt-1.5 bg-emerald-950/20 px-2 py-1 rounded w-fit">
                        <Info className="w-3.5 h-3.5 text-emerald-300 flex-shrink-0" />
                        <span>Dica Técnica: {activeStep.example}</span>
                      </div>
                    </div>

                    {/* Upcoming flow prompt */}
                    {nextStep && (
                      <div className="flex-shrink-0 md:border-l md:border-white/10 md:pl-5 flex flex-col justify-center min-w-[150px]">
                        <span className="text-[8.5px] text-emerald-200/80 font-bold uppercase tracking-wider block">
                          A Seguir na Fila:
                        </span>
                        <span className="text-xs font-bold flex items-center gap-1.5 text-white mt-1">
                          {nextStep.shortLabel}
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-300" />
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          /* Free-style manual selection chips when guided mode is disabled */
          <div className="mt-4 animate-fade-in" id="free-photo-chips">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              🏷️ Escolha a Categoria da Foto a ser Tirada:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(labelTypeNames) as LabelImage['labelType'][]).map((type) => (
                <button
                  key={type}
                  type="button"
                  id={`chip-${type}`}
                  onClick={() => setSelectedLabelType(type)}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium transition-all cursor-pointer ${
                    selectedLabelType === type
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/10'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  {labelTypeNames[type]}
                </button>
              ))}
            </div>
            {/* Simple hint block */}
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-slate-600 text-xs flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span>Modo Livre Ativo. Selecione a categoria acima antes de anexar ou capturar a foto.</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-5 space-y-6">
        {/* Main Capture Hub */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Native Camera Trigger Card */}
          <div 
            onClick={() => cameraInputRef.current?.click()}
            className="group relative rounded-xl border-2 border-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/40 p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-emerald-700 min-h-[160px]"
            id="camera-trigger-card"
          >
            <input
              type="file"
              ref={cameraInputRef}
              onChange={handleCameraChange}
              accept="image/*"
              capture="environment"
              className="hidden"
            />
            <div className="p-4 bg-emerald-600 text-white rounded-full shadow-md mb-3 transition-transform group-hover:scale-105">
              <Camera className="w-8 h-8" />
            </div>
            <span className="text-sm font-semibold text-emerald-950">Abrir Câmera do Celular</span>
            <span className="text-[11px] text-emerald-700 mt-1 max-w-[200px]">
              Tira foto em tela cheia (vertical/horizontal) com excelente foco e resolução.
            </span>
          </div>

          {/* File Picker / Drag and Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => galleryInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[160px] ${
              dragActive
                ? 'border-slate-800 bg-slate-50'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400'
            }`}
            id="gallery-trigger-card"
          >
            <input
              type="file"
              ref={galleryInputRef}
              onChange={handleGalleryChange}
              multiple
              accept="image/*"
              className="hidden"
            />
            <div className="p-4 bg-white rounded-full shadow-sm border border-slate-200 mb-3 text-slate-500">
              <FolderOpen className="w-8 h-8 text-slate-400" />
            </div>
            <span className="text-sm font-semibold text-slate-800">Escolher da Galeria / Arquivos</span>
            <span className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Arraste imagens ou selecione fotos já tiradas do seu dispositivo.
            </span>
          </div>
        </div>

        {/* Selected Photos Showcase (Interactive Carousel with Zoom) */}
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              Etiquetas para Leitura ({images.length})
            </span>
            {images.length > 0 && (
              <button
                type="button"
                onClick={onClearImages}
                id="btn-clear-images"
                className="text-xs text-red-500 hover:text-red-700 font-semibold transition-colors"
              >
                Limpar Todas
              </button>
            )}
          </div>

          {images.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-center">
              <ImageIcon className="w-10 h-10 text-slate-300 stroke-[1.2] mb-1.5" />
              <p className="text-xs font-semibold text-slate-600">Nenhuma foto adicionada</p>
              <p className="text-[10px] text-slate-400 max-w-[260px] mt-0.5">Tire fotos das etiquetas ou da placa de identificação acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Main Carousel Window with Zoom & Pan */}
              <div 
                className={`relative rounded-xl border border-slate-200 bg-slate-900 overflow-hidden flex items-center justify-center min-h-[300px] h-[320px] sm:h-[380px] shadow-sm select-none ${
                  scale > 1 ? 'cursor-grab active:cursor-grabbing' : ''
                }`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleMouseUpOrLeave}
                id="carousel-main-display"
              >
                {/* Active Image (translatable + zoomable) */}
                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    src={images[activeIdx].base64}
                    alt={images[activeIdx].fileName}
                    className="max-w-full max-h-full object-contain pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Left Navigation Chevron */}
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all hover:scale-105 active:scale-95"
                    title="Foto Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}

                {/* Right Navigation Chevron */}
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-all hover:scale-105 active:scale-95"
                    title="Próxima Foto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                {/* Floating Top Header (Delete & Fullscreen) */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                  {/* Category overlay label */}
                  <span className="px-2.5 py-1 bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold rounded-lg uppercase tracking-wide">
                    {activeIdx + 1} / {images.length} • {labelTypeNames[images[activeIdx].labelType]}
                  </span>

                  <div className="flex gap-1.5 pointer-events-auto">
                    {/* Fullscreen Button */}
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="p-2 bg-black/70 hover:bg-black/90 text-white rounded-lg transition-all hover:scale-105"
                      title="Tela Cheia / Lupa"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    {/* Delete Active Slide Button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveActiveImage(images[activeIdx].id)}
                      className="p-2 bg-red-600/90 hover:bg-red-600 text-white rounded-lg transition-all hover:scale-105"
                      title="Excluir esta Foto"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Floating Bottom Center Zoom Controls */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/85 backdrop-blur-xs px-3 py-1.5 rounded-full shadow-lg border border-white/10">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    disabled={scale <= 1}
                    className="p-1 text-slate-300 hover:text-white disabled:text-slate-600 transition-colors"
                    title="Reduzir Zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-white font-mono font-bold w-12 text-center">
                    {scale.toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={scale >= 4}
                    className="p-1 text-slate-300 hover:text-white disabled:text-slate-600 transition-colors"
                    title="Aumentar Zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  {scale > 1 && (
                    <button
                      type="button"
                      onClick={handleResetZoom}
                      className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors ml-1 border-l border-white/10 pl-2"
                      title="Resetar Zoom"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Thumbnails strip at the bottom */}
              <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin">
                {images.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`relative rounded-lg overflow-hidden border-2 aspect-square w-14 h-14 flex-shrink-0 transition-all ${
                      idx === activeIdx
                        ? 'border-emerald-500 scale-102 ring-2 ring-emerald-500/25 shadow-sm'
                        : 'border-slate-200 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={img.base64}
                      alt={img.fileName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 text-[8px] text-white py-0.5 truncate text-center leading-none">
                      {labelTypeNames[img.labelType].split(' ')[0]}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* AI Process Trigger Button */}
        <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
          <button
            type="button"
            id="btn-process-ocr"
            onClick={onProcess}
            disabled={images.length === 0 || isProcessing}
            className={`w-full py-3.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 shadow transition-all ${
              images.length === 0
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-600/15 active:scale-[0.99]'
            }`}
          >
            {isProcessing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Analisando Etiquetas via Inteligência Artificial...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 fill-white/10 text-emerald-200" />
                <span>Extrair Dados da Imagem ({images.length} {images.length === 1 ? 'Foto' : 'Fotos'})</span>
              </>
            )}
          </button>
          
          {images.length > 0 && !isProcessing && (
            <div className="text-[11px] text-center text-emerald-700 mt-1 flex items-center justify-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Imagens prontas para análise. Nossa IA vai cruzar e preencher todos os dados!
            </div>
          )}
        </div>
      </div>

      {/* Lightbox Modal (Fullscreen Zoom Viewer) */}
      {isLightboxOpen && images.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col justify-between p-4"
          id="lightbox-overlay"
        >
          {/* Top Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
            <div className="flex flex-col">
              <span className="text-sm font-bold truncate max-w-xs md:max-w-md">
                {images[activeIdx].fileName}
              </span>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                {labelTypeNames[images[activeIdx].labelType]}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-xs font-mono bg-white/10 px-2.5 py-1 rounded-full text-slate-300 font-bold">
                {activeIdx + 1} / {images.length}
              </span>
              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Large Image View with Zoom and Pan */}
          <div 
            className={`flex-1 flex items-center justify-center overflow-hidden relative select-none ${
              lightboxScale > 1 ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
            onMouseDown={handleLightboxMouseDown}
            onMouseMove={handleLightboxMouseMove}
            onMouseUp={handleLightboxMouseUpOrLeave}
            onMouseLeave={handleLightboxMouseUpOrLeave}
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxMouseUpOrLeave}
          >
            <div 
              className="w-full h-full flex items-center justify-center transition-transform duration-200 ease-out"
              style={{
                transform: `translate(${lightboxPan.x}px, ${lightboxPan.y}px) scale(${lightboxScale})`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={images[activeIdx].base64}
                alt={images[activeIdx].fileName}
                className="max-w-full max-h-full object-contain pointer-events-none"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Left Nav in Fullscreen */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                className="absolute left-4 p-3 bg-white/10 hover:bg-white/25 hover:scale-105 active:scale-95 text-white rounded-full transition-all"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Right Nav in Fullscreen */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                className="absolute right-4 p-3 bg-white/10 hover:bg-white/25 hover:scale-105 active:scale-95 text-white rounded-full transition-all"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Bar: Thumbnails & Zoom Controls */}
          <div className="border-t border-white/10 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Small Thumbnails strip */}
            <div className="flex gap-2 overflow-x-auto py-1 scrollbar-thin max-w-full md:max-w-xl">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`relative rounded-lg overflow-hidden border-2 aspect-square w-12 h-12 flex-shrink-0 transition-all ${
                    idx === activeIdx
                      ? 'border-emerald-500 scale-102 ring-2 ring-emerald-500/25 shadow-sm'
                      : 'border-white/10 opacity-50 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.base64}
                    alt={img.fileName}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </button>
              ))}
            </div>

            {/* Fullscreen Zoom Controls */}
            <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/5">
              <button
                type="button"
                onClick={() => setLightboxScale(prev => Math.max(prev - 0.5, 1))}
                disabled={lightboxScale <= 1}
                className="p-1.5 text-slate-300 hover:text-white disabled:text-slate-600 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-xs text-white font-mono font-bold w-12 text-center">
                {lightboxScale.toFixed(1)}x
              </span>
              <button
                type="button"
                onClick={() => setLightboxScale(prev => Math.min(prev + 0.5, 5))}
                disabled={lightboxScale >= 5}
                className="p-1.5 text-slate-300 hover:text-white disabled:text-slate-600 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              {lightboxScale > 1 && (
                <button
                  type="button"
                  onClick={() => { setLightboxScale(1); setLightboxPan({ x: 0, y: 0 }); }}
                  className="p-1.5 text-emerald-400 hover:text-emerald-300 transition-colors ml-1 border-l border-white/10 pl-2.5"
                  title="Reset Zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Guided Next Step Popup Alert Modal */}
      {isPhotoSequenceEnabled && nextStepAlert && nextStepAlert.show && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[100] flex items-center justify-center p-4 animate-fade-in" id="next-step-popup-overlay">
          <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xl p-6 max-w-sm w-full text-center relative animate-scale-up" id="next-step-popup-container">
            {/* Success Badge */}
            <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mb-4 shadow-2xs">
              <Check className="h-6 w-6 stroke-[3] animate-bounce" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 tracking-tight">
              Foto Registrada!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Etapa de <strong className="text-emerald-700">{nextStepAlert.addedStepTitle}</strong> concluída com sucesso.
            </p>

            {/* Next Step Box */}
            <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/80 rounded-2xl border border-emerald-100/70 text-left">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-widest block mb-1">
                👉 PRÓXIMA FOTO RECOMENDADA:
              </span>
              <span className="text-sm font-extrabold text-slate-950 block leading-tight">
                {nextStepAlert.nextStepTitle}
              </span>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                {nextStepAlert.nextStepHint}
              </p>
            </div>

            {/* Action button */}
            <button
              type="button"
              onClick={() => setNextStepAlert(null)}
              className="mt-5 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl cursor-pointer shadow-sm hover:shadow transition-all flex items-center justify-center gap-1.5"
            >
              <Camera className="w-4 h-4" />
              <span>Preparar Próxima Foto</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
