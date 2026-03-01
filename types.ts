
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
  cpmExcludingLows?: number; // Consumo Promedio AJUSTADO (Sin picos Y sin bajos)
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
  
  // Low Consumption Audit
  hasLows?: boolean; // Flag para UI (Consumos muy bajos)
  lowThreshold?: number; // El valor mínimo (Valores menores a este se pintan de otro color)

  // Low Rotation Flag
  isSporadic: boolean; // NEW: Indica si es de baja rotación para mostrar etiqueta visual

  // User Selection Memory
  selectedCpaMode?: 'ADJUSTED' | 'SIMPLE'; // Persist user choice
  excludedIndices?: number[]; // Persist manually excluded months

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

// --- NEW AUTHENTICATION & ADMIN TYPES ---

export type UserRole = 'ADMIN' | 'FARMACIA' | 'INVITADO';

export type AppModule = 'DASHBOARD' | 'ANALYSIS' | 'ADMIN_USERS' | 'ADMIN_ROLES' | 'PROFILE' | 'REDISTRIBUTION';

export interface HealthFacility {
  code: string; // Codigo IPRESS
  name: string;
  category: string;
}

export interface Personnel {
  id: string; // Internal ID
  firstName: string;
  lastName: string;
  dni: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  facilityCode: string; // Link to HealthFacility
}

export interface User {
  username: string;
  role: UserRole;
  personnelId: string;
  isActive: boolean;
  personnelData?: Personnel; // Hydrated data
  facilityData?: HealthFacility; // Hydrated data
  permissions: AppModule[]; // Computed from Role
}

export interface SystemConfig {
  verificationDelaySeconds: number; // Tiempo de espera para el botón de validar
  apiUrl?: string; // NUEVO: URL dinámica del backend
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  systemConfig: SystemConfig; // Configuración global disponible en el contexto
}

export interface RoleConfig {
  role: UserRole;
  label: string;
  allowedModules: AppModule[];
}

// --- FILTER TYPES ---
export type QuickFilterOption = 'ALL' | 'PENDING' | 'REQ_POSITIVE' | 'REQ_ZERO';

// --- REDISTRIBUTION MODULE TYPES ---

export interface AvailabilityRecord {
  ue: string;
  red: string;
  microred: string;
  codEess: string;
  establishmentName: string;
  category: string;
  medCode: string;
  medName: string;
  ff: string;
  price: number;
  type: string;
  pet: string; // Petitorio?
  est: string; // Estrategico?
  stock: number;
  cpa: number;
  monthsProvision: number;
  status: string; // Situacion (NormoStock, etc.)
  expiryDate?: string; // Fecha mas prox vencimiento
  consumptionSum?: number; // Suma de consumos
  consumptionMonths?: number; // Meses con consumo
  monthlyConsumption?: number[]; // Array of 12 months consumption
}

export interface RedistributionItem {
  codEess: string;
  establishmentName: string;
  stock: number;
  cpa: number;
  monthsProvision: number;
  status: string;
  // Redistribution fields
  transferQty: number; // Cantidad a transferir (negativo = sale, positivo = entra)
  receivedQty: number; // Cantidad recibida (redundante con transferQty pero útil para UI explicita)
  need?: number; // Necesidad calculada
  consumptionSum?: number;
  consumptionMonths?: number;
  monthlyConsumption?: number[];
  isConsolidated?: boolean;
}
