
import { MedicationInput, AuraAnalysisResult, StockStatus, AnalyzedMedication } from "../types";

// Helper: Calculate Median
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// 1. Math Helpers (SISMED + Spike Detection)
const calculateAdjustedCPM = (history: number[]): { adjusted: number; raw: number; spikes: number; details: string; threshold: number } => {
  const nonZeroMonths = history.filter(val => val > 0);
  
  if (nonZeroMonths.length === 0) {
    return { adjusted: 0, raw: 0, spikes: 0, details: "Sin consumo histórico", threshold: 0 };
  }

  const rawSum = nonZeroMonths.reduce((a, b) => a + b, 0);
  const rawAvg = rawSum / nonZeroMonths.length;

  const median = calculateMedian(nonZeroMonths);
  // Threshold logic: If median is very low (<5), tolerance is higher (3x). Otherwise 1.5x.
  const threshold = median < 5 ? median * 3 : median * 1.5;

  // Identify normal values vs spikes
  const validMonths = nonZeroMonths.filter(val => val <= threshold);
  const spikes = nonZeroMonths.filter(val => val > threshold);
  
  let adjustedAvg = 0;
  if (validMonths.length > 0) {
    adjustedAvg = validMonths.reduce((a, b) => a + b, 0) / validMonths.length;
  } else {
    // Fallback if all values are spikes (rare but possible in erratic items)
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
    threshold 
  };
};

const analyzeItemLocally = (item: MedicationInput): AnalyzedMedication => {
  const history = item.monthlyConsumption;
  const { adjusted: cpm, raw: rawCpm, spikes, details, threshold } = calculateAdjustedCPM(history);
  
  const monthsOfProvision = cpm > 0 ? item.currentStock / cpm : (item.currentStock > 0 ? Infinity : 0);

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
    status = StockStatus.SUBSTOCK;
  }

  // Detect special handling items
  const upperName = item.name.toUpperCase();
  const isVaccineOrDiluent = upperName.includes("VACUNA") || upperName.includes("DILUYENTE");

  // Suggest Order Quantity to reach 6 months coverage
  let quantityToOrder = 0;

  // CRITICAL CHANGE: If it is a Vaccine or Diluent, we do NOT calculate requirement (it is 0).
  // Otherwise, proceed with normal logic.
  if (!isVaccineOrDiluent && status !== StockStatus.SOBRESTOCK && status !== StockStatus.SIN_ROTACION) {
     const targetStock = cpm * 6;
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

  // Add a note in anomalyDetails if it was excluded from ordering logic
  let finalAnomalyDetails = details;
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
    
    originalHistory: history
  };
};

export const analyzeInventoryWithAura = async (
  inventory: MedicationInput[], 
  referenceDate?: string,
  vaccinesExcluded: boolean = false
): Promise<AuraAnalysisResult> => {
  // NOTE: This function is now fully local and deterministic. No API Key required.

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

    // Calculate Stats for Summary (Deterministic)
    const spikesFound = analyzedMedications.filter(m => m.hasSpikes).length;
    const itemsDesabastecidos = analyzedMedications.filter(m => m.status === StockStatus.DESABASTECIDO).length;
    
    const savings = analyzedMedications.reduce((acc, m) => {
         if (m.hasSpikes && m.quantityToOrder > 0) {
            const inflatedTarget = m.rawCpm * 6;
            const inflatedOrder = Math.max(0, inflatedTarget - m.currentStock);
            const diff = inflatedOrder - m.quantityToOrder;
            return acc + (diff * m.unitPrice);
         }
         return acc;
    }, 0);

    const investment = analyzedMedications.reduce((sum, m) => sum + m.estimatedInvestment, 0);

    // DETERMINISTIC SUMMARY GENERATOR
    let summary = `Resumen Ejecutivo Aura (${new Date().toLocaleDateString()}):\n\n`;
    summary += `Se han analizado ${totalItems} ítems con fecha de corte ${referenceDate || 'Actual'}. `;
    summary += `El indicador de Disponibilidad (DME) es del ${dmeScore.toFixed(1)}% (${indicatorStatus}).\n\n`;
    
    if (spikesFound > 0) {
        summary += `DETECCIÓN DE ANOMALÍAS:\n`;
        summary += `Se identificaron ${spikesFound} medicamentos con picos de consumo atípicos. `;
        summary += `Aura ha ajustado el cálculo (CPA) excluyendo estos picos, lo que representa un AHORRO ESTIMADO de S/ ${savings.toLocaleString('es-PE', { minimumFractionDigits: 2 })} al evitar compras infladas por sobrestock proyectado.\n\n`;
    } else {
        summary += `El consumo histórico presenta un comportamiento estable sin picos atípicos significativos.\n\n`;
    }

    summary += `ESTADO DE INVENTARIO:\n`;
    summary += `- Críticos (Desabastecidos): ${itemsDesabastecidos} ítems.\n`;
    summary += `- Inversión Sugerida Total: S/ ${investment.toLocaleString('es-PE', { minimumFractionDigits: 2 })} para asegurar 6 meses de abastecimiento (Normostock).`;

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
        vaccinesExcluded // Store the decision
      }
    };

  } catch (error) {
    console.error("Aura analysis failed:", error);
    // Fallback logic
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
