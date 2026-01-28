
import { MedicationInput, AuraAnalysisResult, StockStatus, AnalyzedMedication } from "../types";

// Helper: Calculate Median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// 1. Math Helpers (SISMED + Spike Detection)
const calculateAdjustedCPM = (history: number[]): { adjusted: number; raw: number; spikes: number; details: string; threshold: number; isSporadic: boolean } => {
  const nonZeroMonths = history.filter(val => val > 0);
  const frequency = nonZeroMonths.length;
  
  if (frequency === 0) {
    return { adjusted: 0, raw: 0, spikes: 0, details: "Sin consumo histórico", threshold: 0, isSporadic: false };
  }

  const rawSum = nonZeroMonths.reduce((a, b) => a + b, 0);

  // --- LOGIC CHANGE: SPORADIC CONSUMPTION ---
  // RULE: Frequency <= 5 is considered Sporadic (Low Rotation).
  if (frequency <= 5) {
      const activeMonthsAverage = rawSum / frequency;
      return {
          adjusted: activeMonthsAverage,
          raw: activeMonthsAverage, 
          spikes: 0,
          details: `Consumo Esporádico (${frequency} salidas/año). CPA basado en meses activos.`,
          threshold: 5, 
          isSporadic: true
      };
  }

  // --- NORMAL LOGIC (High Frequency > 5 months) ---
  const rawAvg = rawSum / frequency;
  const median = calculateMedian(nonZeroMonths);
  
  // Threshold logic: 
  let calculatedThreshold = median < 5 ? median * 3 : median * 1.5;
  if (calculatedThreshold < 3.5) calculatedThreshold = 3.5; 
  
  const threshold = calculatedThreshold;

  // Identify normal values vs spikes
  const validMonths = nonZeroMonths.filter(val => val <= threshold);
  const spikes = nonZeroMonths.filter(val => val > threshold);
  
  let adjustedAvg = 0;
  if (validMonths.length > 0) {
    adjustedAvg = validMonths.reduce((a, b) => a + b, 0) / validMonths.length;
  } else {
    adjustedAvg = median;
  }

  let details = `Promedio: ${adjustedAvg.toFixed(1)}`;
  if (spikes.length > 0) {
    details = `Se excluyeron ${spikes.length} picos atípicos (Ref: >${threshold.toFixed(0)})`;
  }

  return { 
    adjusted: adjustedAvg, 
    raw: rawAvg, 
    spikes: spikes.length, 
    details,
    threshold,
    isSporadic: false
  };
};

const analyzeItemLocally = (item: MedicationInput): AnalyzedMedication => {
  const history = item.monthlyConsumption;
  const { adjusted: cpm, raw: rawCpm, spikes, details, threshold, isSporadic } = calculateAdjustedCPM(history);
  
  const monthsOfProvision = cpm > 0 ? item.currentStock / cpm : (item.currentStock > 0 ? Infinity : 0);

  // 1. Initial Status Calculation
  let status = StockStatus.NORMOSTOCK;
  if (item.currentStock === 0) {
    status = StockStatus.DESABASTECIDO; 
  } else if (cpm === 0 && item.currentStock > 0) {
    status = StockStatus.SIN_ROTACION; 
  } else if (monthsOfProvision > 6) {
    status = StockStatus.SOBRESTOCK; 
  } else if (monthsOfProvision >= 2 && monthsOfProvision <= 6) {
    status = StockStatus.NORMOSTOCK; 
  } else {
    // Covers monthsOfProvision < 2
    status = StockStatus.SUBSTOCK;
  }

  // 2. Anomaly Details Appending
  let finalAnomalyDetails = details;
  
  // Detect special handling items
  const upperName = item.name.toUpperCase();
  const isVaccineOrDiluent = upperName.includes("VACUNA") || upperName.includes("DILUYENTE");

  // Suggest Order Quantity
  let quantityToOrder = 0;

  if (!isVaccineOrDiluent && status !== StockStatus.SOBRESTOCK && status !== StockStatus.SIN_ROTACION) {
     
     const MIN_SAFETY_STOCK = 2; // Always maintain at least 2 units physically
     let targetStock = 0;

     if (isSporadic) {
        // --- SPORADIC LOGIC (BAJA ROTACIÓN) ---
        // Frequency <= 5 months.
        // STRATEGY: Aim for 3 months coverage (Buffer Zone).
        // Why? User request: 2 months is too risky. If we order just enough for 2 months, 
        // a single consumption event drops the item back into Substock immediately.
        // 3 months provides a buffer to stay within Normostock (2-6) after a sale.
        
        targetStock = cpm * 3; 

        // Hard Floor: Never aim for less than 2 units physically.
        targetStock = Math.max(targetStock, MIN_SAFETY_STOCK);

        if (item.currentStock < targetStock) {
            if (!finalAnomalyDetails.includes("Normostock")) {
                 finalAnomalyDetails += " | Ajuste: Cobertura Estratégica (3 meses)";
             }
        }

     } else {
        // --- NORMAL LOGIC (ALTA ROTACIÓN) ---
        // Frequency > 5 months.
        // STRATEGY: Build stock for 6 months coverage (Normostock Ceiling).
        targetStock = cpm * 6;
        targetStock = Math.max(targetStock, MIN_SAFETY_STOCK);
     }

     if (item.currentStock < targetStock) {
        quantityToOrder = Math.ceil(targetStock - item.currentStock);
     }
  }
  
  if (quantityToOrder < 0) quantityToOrder = 0;

  let expirationRisk = "BAJO";
  if (status === StockStatus.SIN_ROTACION || monthsOfProvision > 18) {
    expirationRisk = "ALTO";
  } else if (monthsOfProvision > 12) {
    expirationRisk = "MEDIO";
  }

  if (isVaccineOrDiluent) {
      finalAnomalyDetails = "Item de Inmunizaciones (No genera req.)";
  }

  return {
    id: item.id,
    name: item.name,
    currentStock: item.currentStock,
    unitPrice: item.unitPrice,
    medtip: item.medtip,
    medpet: item.medpet,
    medest: item.medest,
    ff: item.ff,
    
    cpm: cpm, 
    rawCpm: rawCpm,
    monthsOfProvision: monthsOfProvision,
    status: status,
    
    expirationRisk: expirationRisk,
    quantityToOrder: quantityToOrder,
    estimatedInvestment: quantityToOrder * item.unitPrice,
    
    anomalyDetails: finalAnomalyDetails,
    hasSpikes: spikes > 0,
    spikesCount: spikes,
    spikeThreshold: threshold, 
    
    isSporadic: isSporadic,
    originalHistory: history
  };
};

export const analyzeInventoryWithAura = async (
  inventory: MedicationInput[], 
  referenceDate?: string,
  vaccinesExcluded: boolean = false
): Promise<AuraAnalysisResult> => {
  try {
    const analyzedMedications = inventory.map(analyzeItemLocally);

    // Calculate Indicators
    const availableItems = analyzedMedications.filter(m => 
      m.status === StockStatus.NORMOSTOCK || 
      m.status === StockStatus.SOBRESTOCK || 
      m.status === StockStatus.SIN_ROTACION
    ).length;
    
    const totalItems = analyzedMedications.length;
    const dmeScore = totalItems > 0 ? (availableItems / totalItems) * 100 : 0;
    
    let indicatorStatus: 'OPTIMO' | 'ALTO' | 'REGULAR' | 'BAJO' = 'BAJO';
    if (dmeScore >= 90) indicatorStatus = 'OPTIMO';
    else if (dmeScore >= 80) indicatorStatus = 'ALTO';
    else if (dmeScore >= 70) indicatorStatus = 'REGULAR';
    else indicatorStatus = 'BAJO';

    // Calculate Stats for Summary
    const spikesFound = analyzedMedications.filter(m => m.hasSpikes).length;
    const itemsDesabastecidos = analyzedMedications.filter(m => m.status === StockStatus.DESABASTECIDO).length;
    
    const investment = analyzedMedications.reduce((sum, m) => sum + m.estimatedInvestment, 0);

    let summary = `Resumen Ejecutivo Aura (${new Date().toLocaleDateString()}):\n\n`;
    summary += `Se han analizado ${totalItems} ítems. Disponibilidad (DME): ${dmeScore.toFixed(1)}% (${indicatorStatus}).\n\n`;
    
    if (spikesFound > 0) {
        summary += `Aura ajustó ${spikesFound} ítems con picos atípicos para evitar sobrestock.\n`;
    }
    summary += `Estrategia Baja Rotación (< 6 meses/año): Se asegura cobertura de 3 meses. Esto evita caer en desabastecimiento inmediato tras una salida, manteniéndose en rango Normostock.\n`;
    summary += `ESTADO: ${itemsDesabastecidos} ítems críticos. Inversión Sugerida: S/ ${investment.toLocaleString('es-PE', { minimumFractionDigits: 2 })}.`;

    return {
      medications: analyzedMedications,
      indicators: {
        dmeScore,
        status: indicatorStatus,
        totalItems,
        availableItems
      },
      executiveSummary: summary,
      timestamp: new Date().toISOString(),
      referenceDate: referenceDate,
      analysisConfig: {
        vaccinesExcluded 
      }
    };

  } catch (error) {
    console.error("Aura analysis failed:", error);
    const analyzed = inventory.map(analyzeItemLocally);
    return {
        medications: analyzed,
        indicators: {
          dmeScore: 0,
          status: 'BAJO',
          totalItems: analyzed.length,
          availableItems: 0
        },
        executiveSummary: "Error en el cálculo local.",
        timestamp: new Date().toISOString(),
        referenceDate: referenceDate,
        analysisConfig: { vaccinesExcluded: false }
    };
  }
};
