
export enum StockStatus {
  DESABASTECIDO = "DESABASTECIDO", // Stock = 0
  SUBSTOCK = "SUBSTOCK", // MED > 0 y < 2 (Alerta de Pedido)
  NORMOSTOCK = "NORMOSTOCK", // MED >= 2 y <= 6
  SOBRESTOCK = "SOBRESTOCK", // MED > 6
  SIN_ROTACION = "SIN ROTACIÓN" // Stock > 0 y CPM = 0
}

export interface MedicationInput {
  id: string;
  name: string;
  currentStock: number;
  monthlyConsumption: number[]; // Array of last 12 months
  unitPrice: number;
  medtip?: string;
  medpet?: string;
  medest?: string;
  ff?: string;
}

export interface AnalyzedMedication {
  id: string; 
  name: string;
  currentStock: number; 
  unitPrice: number;
  
  // Details
  medtip?: string;
  medpet?: string;
  medest?: string;
  ff?: string;

  // Analysis results (SISMED 2026 IPRESS)
  cpm: number; // Consumo Promedio AJUSTADO (Sin picos)
  rawCpm: number; // Consumo Promedio SIMPLE (Con picos, para referencia)
  monthsOfProvision: number; // MED (Meses de Existencia Disponible)
  status: StockStatus; 
  expirationRisk: string; 
  quantityToOrder: number; 
  estimatedInvestment: number; 
  
  // Anomaly Audit
  anomalyDetails: string; 
  hasSpikes: boolean; // Flag para UI
  spikesCount: number; // Cuántos meses se eliminaron
  spikeThreshold: number; // El valor máximo permitido (Valores mayores a este se pintan de amarillo)
  
  // Historical context for export
  originalHistory: number[];
}

export interface AdditionalItem {
  id: string;
  name: string;
  quantity: number;
  observation?: string;
  sismedCode?: string; // Optional SISMED Code
  ff?: string; // Optional Pharmaceutical Form
}

export interface AuraAnalysisResult {
  medications: AnalyzedMedication[];
  indicators: {
    dmeScore: number; // % Disponibilidad Medicamentos Esenciales
    status: 'OPTIMO' | 'ALTO' | 'REGULAR' | 'BAJO'; 
    totalItems: number;
    availableItems: number; // Numerador
  };
  executiveSummary: string;
  timestamp: string;
  referenceDate?: string; // Fecha de Corte (YYYY-MM)
  analysisConfig?: {
    vaccinesExcluded: boolean; // Tracks if vaccines were filtered at input
  };
}

export interface ChartDataPoint {
  name: string;
  value: number;
}
