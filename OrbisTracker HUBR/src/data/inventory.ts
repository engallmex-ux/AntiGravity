export interface InventoryItem {
  equipamento: string;
  marcaModelo: string;
  localizacao: string;
  contrato: string;
  identificador: string;
  numSerie: string;
  dataAquisicao: string;
  garantia: string;
}

export const INVENTORY_DATA: InventoryItem[] = [];
