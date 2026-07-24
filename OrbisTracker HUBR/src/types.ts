export interface AccessoryItem {
  id: string;
  tipo: 'Cabo de Força' | 'Bateria' | 'Sensor' | 'Acessório Geral' | 'Consumível';
  descricao: string;
  numSerie?: string;
  codigoAcessorio?: string; // ex: MON-102-ACC-1
  base64Image?: string; // Foto opcional do acessório
}

export interface FormFields {
  equipamento: string;
  fabricante: string;
  modelo: string;
  numSerie: string;
  numPatrimonio: string;
  setor: string;
  observacoes: string;
  condicao: string; // "Boa" | "Regular" | "Ruim" | "Não localizado" | "Em Manutenção"
  
  // Geolocation coordinates
  latitude?: number;
  longitude?: number;
  
  // Calibration
  temCalibracao: boolean;
  executadoPorCal: string;
  dataCal: string;
  proxCal: string;

  // Preventive Maintenance
  temManutencao: boolean;
  executadoPorManut: string;
  dataManut: string;
  proxManut: string;

  // Electrical Safety
  temSegurancaEletrica: boolean;
  executadoPorSegElet: string;
  dataSegElet: string;
  proxSegElet: string;

  // New features
  isNewEquipment?: boolean; // Se o ativo é recém-chegado / novo no hospital
  isTrainingItem?: boolean; // Se o ativo é para treinamento / outro item (não médico)
  numeroOSGets?: string;    // Número da O.S. (Sistema GETS) se em manutenção

  // Leased/Owned, Manual, Unique Code and Accessories
  propriedade?: 'Próprio' | 'Alugado' | 'Comodato';
  linkManual?: string;
  ativoCodigo?: string; // ex: MON-102
  driveFolderUrl?: string; // URL da pasta exclusiva criada no Google Drive
  accessories?: AccessoryItem[];
}

export interface LabelImage {
  id: string;
  base64: string;
  mimeType: string;
  labelType: 'serie' | 'patrimonio' | 'tecnica' | 'calibracao' | 'manutencao' | 'seguranca' | 'geral';
  fileName: string;
  width?: number;
  height?: number;
  url?: string; // URL da foto salva no servidor local ou OneDrive
}

export interface InspectionRecord extends FormFields {
  id: string;
  timestamp: string;
  status: 'completo' | 'pendente' | 'enviado';
  googleFormUrl?: string;
  imagesCount: number;
  images?: LabelImage[];
  googleSheetRowSynced?: boolean;
  googleDriveLinks?: string[];
  auditorNome?: string;
  auditorEmail?: string;
  auditorRE?: string;
}

export interface FormMapping {
  formUrl: string;
  mappings: {
    equipamento: string;
    fabricante: string;
    modelo: string;
    numSerie: string;
    numPatrimonio: string;
    setor: string;
    observacoes: string;
    condicao: string;
    executadoPorCal: string;
    dataCal: string;
    proxCal: string;
    executadoPorManut: string;
    proxManut: string;
    proxSegElet: string;
  };
}

export interface Sector {
  id: string;
  name: string;
  description: string;
  x: number;
  y: number;
  category?: string;
  floor?: string;
  latitude?: number;
  longitude?: number;
}


