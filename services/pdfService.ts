
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AuraAnalysisResult, StockStatus, AnalyzedMedication, AdditionalItem } from "../types";

// --- COLORS PALETTE (PREMIUM UI MATCH) ---
const COLORS = {
  TEAL_HEADER: [0, 150, 136] as [number, number, number], // #009688
  TEAL_DARK: [13, 148, 136] as [number, number, number],
  TEXT_DARK: [17, 24, 39] as [number, number, number], // Gray-900
  TEXT_GRAY: [107, 114, 128] as [number, number, number], // Gray-500
  WHITE: [255, 255, 255] as [number, number, number],
  BLACK: [0, 0, 0] as [number, number, number],
  PURPLE: [147, 51, 234] as [number, number, number], // Purple-600 for extra items
  
  // Status Colors
  RED: [239, 68, 68] as [number, number, number],      // Desabastecido
  ORANGE: [245, 158, 11] as [number, number, number],  // Substock
  GREEN: [16, 185, 129] as [number, number, number],   // Normostock
  INDIGO: [99, 102, 241] as [number, number, number],  // Sobrestock
  GRAY: [107, 114, 128] as [number, number, number],   // Sin Rotacion (Text)
  
  // Chart Colors
  PIE_BLUE: [59, 130, 246] as [number, number, number], // Blue-500
  PIE_PURPLE: [168, 85, 247] as [number, number, number], // Purple-500

  // Backgrounds for Cards
  BG_RED_LIGHT: [254, 242, 242] as [number, number, number], 
  BG_GREEN_LIGHT: [236, 253, 245] as [number, number, number], 
  
  // Table Highlights
  YELLOW_HIGHLIGHT: [255, 215, 0] as [number, number, number],
  BG_GREEN_CELL: [220, 252, 231] as [number, number, number], // Green-100
  TEXT_GREEN_DARK: [20, 83, 45] as [number, number, number], // Green-900
  
  // CPA Active Backgrounds
  BG_ACTIVE_SIMPLE: [191, 219, 254] as [number, number, number], // Blue-200 (Darker than Blue-50)
  BG_ACTIVE_ADJUSTED: [153, 246, 228] as [number, number, number], // Teal-200 (Darker than Teal-50)
  TEXT_INACTIVE: [156, 163, 175] as [number, number, number], // Gray-400

  // New Status Colors for Cells
  BG_GRAY_EXCLUDED: [229, 231, 235] as [number, number, number], // Gray-200
  TEXT_GRAY_EXCLUDED: [107, 114, 128] as [number, number, number], // Gray-500
  BG_ORANGE_LOW: [255, 237, 213] as [number, number, number], // Orange-100
  TEXT_ORANGE_LOW: [154, 52, 18] as [number, number, number], // Orange-800
};

const formatCurrency = (val: number) => `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const getMonthHeaders = (refDate?: string, numMonths = 12) => {
    if (!refDate) {
        const headers = [];
        for (let i = 1; i <= numMonths; i++) headers.push(`M${i}`);
        return headers;
    }
    const [yearStr, monthStr] = refDate.split('-');
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const headers = [];
    for (let i = 0; i < numMonths; i++) {
        const d = new Date(date);
        d.setMonth(d.getMonth() - ((numMonths - 1) - i));
        const mName = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
        const yShort = d.getFullYear().toString().slice(2);
        headers.push(`${mName}-${yShort}`);
    }
    return headers;
};

// --- HELPER: Replicate Logic for PDF Dynamic Calculation ---
const calculateDynamicMetricsPDF = (item: AnalyzedMedication) => {
    let activeCpm = 0;
    const excludedIndices = item.excludedIndices || [];
    const mode = item.selectedCpaMode || 'ADJUSTED';

    if (excludedIndices.length === 0) {
        activeCpm = mode === 'SIMPLE' ? item.rawCpm : item.cpm;
    } else {
        // Manual Recalculation
        const history = item.originalHistory;
        const threshold = item.spikeThreshold || 0;
        const isSporadic = item.isSporadic;
        
        const valuesToAverage: number[] = [];

        history.forEach((val, idx) => {
            if (val === 0) return; // Ignore zeros
            if (excludedIndices.includes(idx)) return; // User excluded

            if (mode === 'SIMPLE') {
                valuesToAverage.push(val);
            } else {
                // ADJUSTED MODE
                if (isSporadic) {
                    // Sporadic: No spike exclusion, just average active months
                    valuesToAverage.push(val);
                } else {
                    // Normal: Exclude spikes
                    if (val <= threshold) {
                        valuesToAverage.push(val);
                    }
                }
            }
        });

        activeCpm = valuesToAverage.length > 0
            ? valuesToAverage.reduce((a, b) => a + b, 0) / valuesToAverage.length
            : 0;
    }
    
    // Calculate Months
    const activeMonths = activeCpm > 0 
        ? item.currentStock / activeCpm 
        : (item.currentStock > 0 ? Infinity : 0);

    // Calculate Status
    let activeStatus = StockStatus.NORMOSTOCK;
    if (item.currentStock === 0) {
        activeStatus = StockStatus.DESABASTECIDO;
    } else if (activeCpm === 0 && item.currentStock > 0) {
        activeStatus = StockStatus.SIN_ROTACION;
    } else if (activeMonths > 6) {
        activeStatus = StockStatus.SOBRESTOCK;
    } else if (activeMonths >= 2 && activeMonths <= 6) {
        activeStatus = StockStatus.NORMOSTOCK;
    } else {
        activeStatus = StockStatus.SUBSTOCK;
    }

    return { activeCpm, activeMonths, activeStatus };
};

const formatDateToMonthYear = (dateStr?: string) => {
    if (!dateStr) return 'ACTUAL';
    try {
        const [year, month] = dateStr.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        // Check if date is valid
        if (isNaN(date.getTime())) return dateStr;
        
        const monthName = date.toLocaleString('es-ES', { month: 'long' });
        return `${monthName.toUpperCase()} ${year}`;
    } catch (e) {
        return dateStr;
    }
};

export const generateFullReportPDF = (
    result: AuraAnalysisResult, 
    filteredTableItems?: AnalyzedMedication[],
    additionalItems?: AdditionalItem[],
    establishmentName: string = 'ESTABLECIMIENTO DE SALUD',
    responsibleName: string = ''
) => {
  try {
      // 1. Initialize Landscape PDF (A4 Landscape: 297mm x 210mm)
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.width; 
      
      // ==========================================
      // PAGE 1: DASHBOARD & GRAPHS
      // ==========================================
      
      doc.setFillColor(COLORS.TEAL_HEADER[0], COLORS.TEAL_HEADER[1], COLORS.TEAL_HEADER[2]);
      doc.rect(0, 0, pageWidth, 24, "F");
      
      doc.setTextColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("DISPONIBILIDAD DE MEDICAMENTOS", 15, 14);

      // Date subtitle on left
      const formattedDate = formatDateToMonthYear(result.referenceDate);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(240, 240, 240);
      doc.text(`CORTE: ${formattedDate}`, 15, 20);
      
      // Establishment Info (with Code & Category if available)
      const facilityName = result.establishmentName ? result.establishmentName.toUpperCase() : establishmentName.toUpperCase();
      const facilityText = result.codEess 
        ? `${result.codEess.toUpperCase()} - ${facilityName}`
        : facilityName;

      const hasMicrored = !!result.microred;

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
      doc.text(facilityText, pageWidth - 15, hasMicrored ? 12 : 15, { align: "right" });

      // Microred Info
      if (hasMicrored) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 245, 235); // Slight minty white highlight for microred
        doc.text(`MICRORED: ${result.microred!.toUpperCase()}`, pageWidth - 15, 18, { align: "right" });
      }

      // --- LAYOUT CALCULATIONS (SYMMETRY) ---
      const margin = 15;
      const startY = 35;
      const totalWidth = pageWidth - (margin * 2); // 297 - 30 = 267mm
      const gap = 10;
      
      // Right Column Width (Fixed for Indicators) approx 1/3
      const rightColW = 95;
      // Left Column Width (Fluid for Chart) approx 2/3
      const leftColW = totalWidth - rightColW - gap;

      // Heights Calculation for Symmetry
      const cardGap = 8;
      const rightCardH = 72; // Height of each small card on right
      const totalH = (rightCardH * 2) + cardGap; // ~152mm Total Height

      // Coordinates
      const leftX = margin;
      const rightX = margin + leftColW + gap;
      
      const dmeY = startY;
      const distY = startY + rightCardH + cardGap;


      // 1. LEFT PANEL: AVAILABILITY CHART
      doc.setDrawColor(220, 220, 220); // Light Gray Border
      doc.setLineWidth(0.3);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(leftX, startY, leftColW, totalH, 4, 4, "S"); // Stroke only for clean look

      doc.setFontSize(11);
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.setFont("helvetica", "bold");
      doc.text("DISTRIBUCIÓN DE DISPONIBILIDAD", leftX + 10, startY + 12);

      // --- RECALCULATE STATUSES FOR CHARTS ---
      const recalculatedMedications = result.medications.map(m => {
          const { activeStatus } = calculateDynamicMetricsPDF(m);
          return { ...m, status: activeStatus };
      });

      const stats = [
        { label: "Desabastecido", val: recalculatedMedications.filter(m => m.status === StockStatus.DESABASTECIDO).length, color: COLORS.RED },
        { label: "SubStock", val: recalculatedMedications.filter(m => m.status === StockStatus.SUBSTOCK).length, color: COLORS.ORANGE },
        { label: "NormoStock", val: recalculatedMedications.filter(m => m.status === StockStatus.NORMOSTOCK).length, color: COLORS.GREEN },
        { label: "SobreStock", val: recalculatedMedications.filter(m => m.status === StockStatus.SOBRESTOCK).length, color: COLORS.INDIGO },
        { label: "Sin Rotación", val: recalculatedMedications.filter(m => m.status === StockStatus.SIN_ROTACION).length, color: COLORS.GRAY },
      ];
      const maxVal = Math.max(...stats.map(s => s.val), 1);
      const totalItems = result.indicators.totalItems || 1; // Keep original total or recalculate? Recalculate is safer.
      const recalculatedTotal = recalculatedMedications.length || 1;

      // Chart Dimensions
      const chartBottomMargin = 20;
      const chartTopMargin = 30;
      const chartAreaH = totalH - chartBottomMargin - chartTopMargin;
      const chartBaseY = startY + totalH - chartBottomMargin;
      
      const barWidth = 22;
      const totalBarsWidth = (barWidth * stats.length);
      const availableSpaceForSpacing = leftColW - 40 - totalBarsWidth; // 20mm padding each side
      const barGap = availableSpaceForSpacing / (stats.length - 1);

      doc.setDrawColor(245, 245, 245);
      doc.line(leftX + 10, chartBaseY, leftX + leftColW - 10, chartBaseY); // X-Axis

      let currentBarX = leftX + 20;

      stats.forEach(stat => {
          const barHeight = (stat.val / maxVal) * chartAreaH;
          const percentage = ((stat.val / recalculatedTotal) * 100).toFixed(1) + "%";

          doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
          doc.rect(currentBarX, chartBaseY - barHeight, barWidth, barHeight, "F");

          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
          doc.text(stat.val.toString(), currentBarX + (barWidth / 2), chartBaseY - barHeight - 8, { align: "center" });

          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
          doc.text(percentage, currentBarX + (barWidth / 2), chartBaseY - barHeight - 2, { align: "center" });

          doc.setFontSize(8); 
          doc.setFont("helvetica", "bold"); 
          doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
          doc.text(stat.label, currentBarX + (barWidth / 2), chartBaseY + 6, { align: "center" });

          currentBarX += barWidth + barGap;
      });

      // 2. RIGHT TOP: DME INDICATOR
      // Recalculate DME Score
      const availableItemsCount = recalculatedMedications.filter(m => 
          m.status === StockStatus.NORMOSTOCK || 
          m.status === StockStatus.SOBRESTOCK || 
          m.status === StockStatus.SIN_ROTACION
      ).length;
      
      const dmeScore = recalculatedTotal > 0 ? (availableItemsCount / recalculatedTotal) * 100 : 0;
      
      let indicatorStatus = 'BAJO';
      if (dmeScore >= 90) indicatorStatus = 'OPTIMO';
      else if (dmeScore >= 80) indicatorStatus = 'ALTO';
      else if (dmeScore >= 70) indicatorStatus = 'REGULAR';

      const isLow = dmeScore < 70;
      const cardBg = isLow ? COLORS.BG_RED_LIGHT : COLORS.BG_GREEN_LIGHT;
      const cardText = isLow ? COLORS.RED : ([6, 78, 59] as [number, number, number]);
      const badgeBg = isLow ? ([252, 165, 165] as [number, number, number]) : ([110, 231, 183] as [number, number, number]);

      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(cardBg[0], cardBg[1], cardBg[2]);
      doc.roundedRect(rightX, dmeY, rightColW, rightCardH, 4, 4, "FD");

      doc.setFontSize(9);
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.setFont("helvetica", "bold");
      doc.text("INDICADOR DME", rightX + (rightColW/2), dmeY + 12, { align: "center" });

      doc.setFontSize(40);
      doc.setTextColor(cardText[0], cardText[1], cardText[2]);
      doc.setFont("helvetica", "bold");
      doc.text(`${dmeScore.toFixed(1)}%`, rightX + (rightColW/2), dmeY + 30, { align: "center" });

      doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
      const badgeW = 35;
      doc.roundedRect(rightX + (rightColW/2) - (badgeW/2), dmeY + 36, badgeW, 7, 3, 3, "F");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(indicatorStatus, rightX + (rightColW/2), dmeY + 40.5, { align: "center" });

      doc.setFontSize(7);
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.setFont("helvetica", "normal");
      doc.text("Porcentaje de medicamentos esenciales", rightX + (rightColW/2), dmeY + 49, { align: "center" });
      doc.text("con stock disponible (Normo + Sobre).", rightX + (rightColW/2), dmeY + 53, { align: "center" });

      doc.setDrawColor(200, 200, 200);
      doc.line(rightX + 8, dmeY + 60, rightX + rightColW - 8, dmeY + 60);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.text("META: >90%", rightX + 10, dmeY + 65);
      doc.text(`ACTUAL: ${availableItemsCount}/${recalculatedTotal}`, rightX + rightColW - 10, dmeY + 65, { align: "right" });

      // 3. RIGHT BOTTOM: DISTRIBUTION
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(rightX, distY, rightColW, rightCardH, 4, 4, "S");

      doc.setFontSize(9);
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.setFont("helvetica", "bold");
      doc.text("DISTRIBUCIÓN DE ÍTEMS", rightX + 10, distY + 12);

      const typeStats = result.medications.reduce((acc, item) => {
        const rawType = (item.medtip || '').toUpperCase().trim();
        const cat = (rawType.startsWith('M') || item.name.includes('TABLET')) ? 'MEDS' : 'INSUMOS';
        if (!acc[cat]) acc[cat] = { count: 0, money: 0 };
        acc[cat].count++;
        acc[cat].money += item.estimatedInvestment;
        return acc;
      }, {} as Record<string, {count: number, money: number}>);

      const itemsData = [
          { label: 'MEDICAMENTOS', val: typeStats['MEDS']?.count || 0, money: typeStats['MEDS']?.money || 0, color: COLORS.PIE_BLUE },
          { label: 'INSUMOS', val: typeStats['INSUMOS']?.count || 0, money: typeStats['INSUMOS']?.money || 0, color: COLORS.PIE_PURPLE }
      ];
      const total = itemsData.reduce((a,b) => a + b.val, 0);

      let barY = distY + 24;
      itemsData.forEach(item => {
          doc.setFontSize(8);
          doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
          doc.setFont("helvetica", "bold");
          doc.text(item.label, rightX + 10, barY - 2);

          const maxBarW = rightColW - 55;
          const pct = total > 0 ? item.val / total : 0;
          const barW = pct * maxBarW;

          doc.setFillColor(243, 244, 246);
          doc.roundedRect(rightX + 10, barY, maxBarW, 6, 2, 2, "F");
          doc.setFillColor(item.color[0], item.color[1], item.color[2]);
          if (barW > 0) {
              doc.roundedRect(rightX + 10, barY, barW, 6, 2, 2, "F");
          }

          doc.setFontSize(9);
          doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
          doc.text(`${item.val} (${(pct*100).toFixed(0)}%)`, rightX + rightColW - 10, barY + 4.5, { align: "right" });

          doc.setFontSize(8);
          doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
          doc.setFont("helvetica", "normal");
          doc.text(formatCurrency(item.money), rightX + 10, barY + 11);
          barY += 20; 
      });

      doc.setDrawColor(240, 240, 240);
      doc.line(rightX + 10, distY + 60, rightX + rightColW - 10, distY + 60);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.text("TOTAL ÍTEMS", rightX + 10, distY + 66);
      doc.setFontSize(10);
      doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
      doc.text(total.toString(), rightX + rightColW - 10, distY + 66, { align: "right" });

      // Footer Page 1
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(150, 150, 150);
      doc.text(`RESPONSABLE: ${responsibleName.toUpperCase()}`, pageWidth - 15, pageHeight - 10, { align: "right" });


      // ==========================================
      // PAGE 2: EXECUTIVE SUMMARY (DEDICATED)
      // ==========================================
      doc.addPage();
      
      // Header Page 2 - BLACK
      doc.setFillColor(COLORS.BLACK[0], COLORS.BLACK[1], COLORS.BLACK[2]);
      doc.rect(0, 0, pageWidth, 24, "F"); 
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMEN EJECUTIVO", 15, 12);

      // Subtitle
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(240, 240, 240);
      doc.text(`CORTE: ${formattedDate}`, 15, 18);

      // Establishment Info (Right side page 2)
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
      doc.text(facilityText, pageWidth - 15, hasMicrored ? 12 : 15, { align: "right" });

      if (hasMicrored) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(220, 245, 235);
        doc.text(`MICRORED: ${result.microred!.toUpperCase()}`, pageWidth - 15, 18, { align: "right" });
      }

      // Compute Indicator Metrics
      const normoCount = result.medications.filter((m: any) => m.status === 'NORMOSTOCK').length;
      const sobreCount = result.medications.filter((m: any) => m.status === 'SOBRESTOCK').length;
      const desabastecidoCount = result.medications.filter((m: any) => m.status === 'DESABASTECIDO').length;
      const subCount = result.medications.filter((m: any) => m.status === 'SUBSTOCK').length;
      const sinRotacionCount = result.medications.filter((m: any) => m.status === 'SIN_ROTACION').length;
      const execEvaluatedItemsCount = normoCount + sobreCount + desabastecidoCount + subCount;
      const execAvailableItems = normoCount + sobreCount;
      const execDmeScore = execEvaluatedItemsCount > 0 ? (execAvailableItems / execEvaluatedItemsCount) * 100 : 0;
      
      let execIndicatorStatus = 'CRÍTICA';
      let execIndicatorColor = COLORS.RED;
      if (execDmeScore >= 90) { execIndicatorStatus = 'ÓPTIMA'; execIndicatorColor = COLORS.GREEN; }
      else if (execDmeScore >= 80) { execIndicatorStatus = 'ACEPTABLE'; execIndicatorColor = COLORS.INDIGO; }
      else if (execDmeScore >= 70) { execIndicatorStatus = 'EN ALERTA'; execIndicatorColor = COLORS.ORANGE; }

      let currentY = 40;

      // BOX 1: MAIN INDICATOR
      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(15, currentY, pageWidth - 30, 45, 3, 3, "FD");

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
      doc.text("DISPONIBILIDAD DE MEDICAMENTOS ESENCIALES (DME)", 25, currentY + 15);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.text("Ficha Técnica del Indicador 39 (Meta: 100%)", 25, currentY + 22);

      // Score Value
      doc.setFontSize(28);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(execIndicatorColor[0], execIndicatorColor[1], execIndicatorColor[2]);
      doc.text(`${execDmeScore.toFixed(1)}%`, pageWidth - 25, currentY + 22, { align: "right" });
      
      // Score Label
      doc.setFontSize(14);
      doc.text(execIndicatorStatus, pageWidth - 25, currentY + 30, { align: "right" });

      // Evaluated Subtext
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
      doc.text(`Cálculo basado en ${execEvaluatedItemsCount} ítems con rotación activa`, 25, currentY + 35);
      
      currentY += 55;

      // BOX 2: BREAKDOWN
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
      doc.text("SITUACIÓN DE STOCK", 15, currentY);
      currentY += 8;

      const drawStatRow = (y: number, label: string, count: number, color: number[], description: string) => {
         doc.setFillColor(color[0], color[1], color[2]);
         doc.circle(20, y - 1, 3, "F");
         
         doc.setFontSize(10);
         doc.setFont("helvetica", "bold");
         doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
         doc.text(`${count.toString()}`, 35, y, { align: 'right' });
         
         doc.setFontSize(10);
         doc.setFont("helvetica", "bold");
         doc.text(label, 45, y);

         doc.setFontSize(9);
         doc.setFont("helvetica", "normal");
         doc.setTextColor(COLORS.TEXT_GRAY[0], COLORS.TEXT_GRAY[1], COLORS.TEXT_GRAY[2]);
         doc.text(`- ${description}`, 90, y);
      };

      drawStatRow(currentY, "Normostock", normoCount, COLORS.GREEN, "Cubre de 2 a 6 meses de demanda"); currentY += 10;
      drawStatRow(currentY, "Sobrestock", sobreCount, COLORS.INDIGO, "Mayor a 6 meses (Riesgo de vencimiento u obsolescencia)"); currentY += 10;
      drawStatRow(currentY, "Substock", subCount, COLORS.ORANGE, "Menor a 2 meses (Riesgo de desabastecimiento)"); currentY += 10;
      drawStatRow(currentY, "Desabastecido", desabastecidoCount, COLORS.RED, "Stock agotado (0) con historial de consumo"); currentY += 10;
      
      doc.setDrawColor(230, 230, 230);
      doc.line(15, currentY, pageWidth - 15, currentY);
      currentY += 10;

      drawStatRow(currentY, "Sin Rotación", sinRotacionCount, COLORS.GRAY, "Sin rotación reciente (Excluidos del cálculo DME)"); currentY += 15;


      // BOX 3: INTERVENTIONS & RECOMMENDATIONS
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
      doc.text("INTERVENCIONES Y REQUERIMIENTO", 15, currentY);
      currentY += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const spikesFound = result.medications.filter((m: any) => m.hasSpikes).length;

      const investment = result.medications.reduce((sum: number, m: any) => sum + (m.estimatedInvestment || 0), 0);

      const bullets = [
         `• Control de Sobrestock: El sistema identificó y ajustó el Consumo Promedio de ${spikesFound} ítems que presentaban picos atípicos.`,
         `• Estrategia de Baja Rotación: Los ítems con movimiento esporádico (< 6 meses activos al año) aseguran una cobertura preventiva de 3 meses.`,
         `• Presupuesto Estimado: Se sugiere una inversión proyectada de S/ ${investment.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} para cubrir los requerimientos priorizados y restablecer la disponibilidad al nivel de Normostock.`
      ];

      bullets.forEach(b => {
         const lines = doc.splitTextToSize(b, pageWidth - 30);
         doc.text(lines, 15, currentY);
         currentY += lines.length * 5;
      });

      // Footer Page 2
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(150, 150, 150);
      doc.text(`RESPONSABLE: ${responsibleName.toUpperCase()}`, pageWidth - 15, pageHeight - 10, { align: "right" });


      // ==========================================
      // PAGE 3+: DATA MATRIX (DEDICATED START)
      // ==========================================
      // PAGE 2+: DETAILED TABLE
      // ==========================================
      doc.addPage();

      // Table Start Position
      const tableStartY = 35;

      const runAutoTable = (autoTable as any).default || (autoTable as any);
      const numMonths = result.medications.length > 0 && result.medications[0].originalHistory ? result.medications[0].originalHistory.length : 12;
      const monthHeaders = getMonthHeaders(result.referenceDate, numMonths);
      
      const columns = [
        { header: 'COD', dataKey: 'id' },
        { header: 'DESCRIPCIÓN', dataKey: 'name' },
        { header: 'F.F.', dataKey: 'ff' }, 
        { header: 'TIPO', dataKey: 'type' },
        ...monthHeaders.map((m, i) => ({ header: m, dataKey: `m${i}` })),
        { header: 'STOCK', dataKey: 'stock' }, 
        { header: 'CPA(S)', dataKey: 'rawCpm' },
        { header: 'CPA(A)', dataKey: 'cpm' },
        { header: 'MESES', dataKey: 'monthsProvision' }, 
        { header: 'ESTADO', dataKey: 'status' },
        { header: 'REQ', dataKey: 'req' },
      ];

      const itemsToRender = filteredTableItems || result.medications;

      const tableData = itemsToRender.map(item => {
        // --- KEY CHANGE: Use Dynamic Metrics for PDF Report ---
        const { activeMonths, activeStatus } = calculateDynamicMetricsPDF(item);
        
        const row: any = {
            id: item.id,
            name: item.name,
            ff: item.ff || '-',
            type: item.medtip || 'MED',
            stock: item.currentStock.toLocaleString(),
            rawCpm: item.rawCpm.toFixed(1),
            cpm: item.cpm.toFixed(1),
            // Use active calculated values
            monthsProvision: isFinite(activeMonths) ? activeMonths.toFixed(1) : '∞',
            status: activeStatus,
            req: item.quantityToOrder > 0 ? item.quantityToOrder : '-',
            _spikeThreshold: item.spikeThreshold,
            _lowThreshold: item.lowThreshold || 0,
            _excludedIndices: item.excludedIndices || [],
            _history: item.originalHistory,
            _statusEnum: activeStatus, // Use active status for coloring
            _selectedMode: item.selectedCpaMode || 'ADJUSTED' // Pass mode to parse cell
        };
        item.originalHistory.forEach((val, idx) => { row[`m${idx}`] = val; });
        return row;
      });

      runAutoTable(doc, {
        columns: columns,
        body: tableData,
        startY: tableStartY,
        theme: 'grid',
        styles: { 
            fontSize: 6, 
            cellPadding: 1, 
            valign: 'middle', 
            halign: 'center', 
            lineColor: [220, 220, 220], 
            lineWidth: 0.1 
        },
        headStyles: { fillColor: COLORS.BLACK, textColor: 255, fontSize: 6, fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            id: { cellWidth: 10 },
            name: { cellWidth: 45, halign: 'left' },
            ff: { cellWidth: 12 },
            type: { cellWidth: 8 },
            stock: { cellWidth: 10, fontStyle: 'bold' },
            rawCpm: { cellWidth: 10 },
            cpm: { cellWidth: 10 },
            monthsProvision: { cellWidth: 10, fontStyle: 'bold' },
            status: { cellWidth: 18, fontSize: 5 },
            req: { cellWidth: 10, fontStyle: 'bold', textColor: COLORS.PIE_BLUE }
        },
        didDrawPage: function(data: any) {
            // Header on every page of the table
            doc.setFillColor(COLORS.BLACK[0], COLORS.BLACK[1], COLORS.BLACK[2]);
            doc.rect(0, 0, pageWidth, 24, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(14);
            doc.setFont("helvetica", "bold");
            doc.text("MATRIZ DE REQUERIMIENTO DETALLADA", 15, 12);
            
            // Subtitle
            const formattedDate = formatDateToMonthYear(result.referenceDate);
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(240, 240, 240);
            doc.text(`CORTE: ${formattedDate}`, 15, 18);

            // Establishment Info
            const facilityName = result.establishmentName ? result.establishmentName.toUpperCase() : establishmentName.toUpperCase();
            const facilityText = result.codEess 
              ? `${result.codEess.toUpperCase()} - ${facilityName}`
              : facilityName;

            const hasMicrored = !!result.microred;
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
            doc.text(facilityText, pageWidth - 15, hasMicrored ? 12 : 15, { align: "right" });

            // Microred Info
            if (hasMicrored) {
              doc.setFontSize(10);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(220, 245, 235); // Slight minty highlight
              doc.text(`MICRORED: ${result.microred!.toUpperCase()}`, pageWidth - 15, 18, { align: "right" });
            }

            // Footer Page 3+
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(150, 150, 150);
            doc.text(`RESPONSABLE: ${responsibleName.toUpperCase()}`, pageWidth - 15, pageHeight - 10, { align: "right" });
        },
        didParseCell: function(data: any) {
            if (data.section !== 'body') return;
            const row = data.row.raw;
            
            // Highlight Months
            if (data.column.dataKey && String(data.column.dataKey).startsWith('m')) {
                const idx = parseInt(String(data.column.dataKey).substring(1));
                const val = row._history ? row._history[idx] : 0;
                const threshold = row._spikeThreshold;
                const lowThreshold = row._lowThreshold;
                const isExcluded = row._excludedIndices && row._excludedIndices.includes(idx);

                if (isExcluded) {
                    data.cell.styles.fillColor = COLORS.BG_GRAY_EXCLUDED;
                    data.cell.styles.textColor = COLORS.TEXT_GRAY_EXCLUDED;
                    // Note: Strikethrough is handled in didDrawCell
                } else if (val > threshold && val > 0) {
                    data.cell.styles.fillColor = COLORS.YELLOW_HIGHLIGHT;
                    data.cell.styles.textColor = COLORS.RED;
                    data.cell.styles.fontStyle = 'bold';
                } else if (val < lowThreshold && val > 0) {
                    data.cell.styles.fillColor = COLORS.BG_ORANGE_LOW;
                    data.cell.styles.textColor = COLORS.TEXT_ORANGE_LOW;
                    // data.cell.styles.fontStyle = 'bold'; // Optional
                } else if (val > 0) {
                    data.cell.styles.fillColor = COLORS.BG_GREEN_CELL;
                    data.cell.styles.textColor = COLORS.TEXT_GREEN_DARK;
                } else {
                    if (val === 0) data.cell.styles.textColor = [200, 200, 200];
                }
            }

            // Highlight Active CPA Column
            if (data.column.dataKey === 'rawCpm') { // CPA Simple
                if (row._selectedMode === 'SIMPLE') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = [30, 64, 175]; // Blue-800 (Stronger than original but not black)
                    data.cell.styles.fillColor = [219, 234, 254]; // Blue-100 (Visible but not overwhelming)
                } else {
                    data.cell.styles.textColor = COLORS.TEXT_INACTIVE;
                }
            }

            if (data.column.dataKey === 'cpm') { // CPA Adjusted
                if (row._selectedMode === 'ADJUSTED') {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.textColor = [30, 64, 175]; // Blue-800 (Same as Simple)
                    data.cell.styles.fillColor = [219, 234, 254]; // Blue-100 (Same as Simple)
                } else {
                    data.cell.styles.textColor = COLORS.TEXT_INACTIVE;
                }
            }

            // Color Status
            if (data.column.dataKey === 'status') {
                 if (row._statusEnum === StockStatus.DESABASTECIDO) {
                     data.cell.styles.fillColor = [254, 226, 226]; 
                     data.cell.styles.textColor = COLORS.RED;
                 } else if (row._statusEnum === StockStatus.SOBRESTOCK) {
                     data.cell.styles.fillColor = [224, 231, 255]; 
                     data.cell.styles.textColor = COLORS.PIE_BLUE;
                 } else if (row._statusEnum === StockStatus.NORMOSTOCK) {
                     data.cell.styles.fillColor = [209, 250, 229]; 
                     data.cell.styles.textColor = [6, 95, 70];
                 } else if (row._statusEnum === StockStatus.SUBSTOCK) {
                     data.cell.styles.fillColor = [255, 237, 213]; 
                     data.cell.styles.textColor = COLORS.ORANGE;
                 } else if (row._statusEnum === StockStatus.SIN_ROTACION) {
                     data.cell.styles.fillColor = [243, 244, 246]; 
                     data.cell.styles.textColor = COLORS.GRAY;
                 }
            }
        },
        didDrawCell: function(data: any) {
            if (data.section !== 'body') return;
            const row = data.row.raw;
            // Draw Strikethrough for Excluded Months OR Yellow Spikes (in Adjusted Mode)
            if (data.column.dataKey && String(data.column.dataKey).startsWith('m')) {
                 const idx = parseInt(String(data.column.dataKey).substring(1));
                 const val = row._history ? row._history[idx] : 0;
                 const threshold = row._spikeThreshold;
                 const isExcluded = row._excludedIndices && row._excludedIndices.includes(idx);
                 const isSpike = val > threshold && val > 0;
                 const isAdjustedMode = row._selectedMode === 'ADJUSTED';

                 // Condition: User Excluded OR (Is Spike AND Adjusted Mode)
                 if (isExcluded || (isSpike && isAdjustedMode)) {
                     const doc = data.doc;
                     const { x, y, width, height } = data.cell;
                     
                     // Use Gray for Excluded, Red for Spikes
                     if (isExcluded) {
                        doc.setDrawColor(156, 163, 175); // Gray-400
                     } else {
                        doc.setDrawColor(220, 38, 38); // Red-600
                     }
                     
                     doc.setLineWidth(0.2);
                     // Horizontal line in the middle
                     doc.line(x + 2, y + height / 2, x + width - 2, y + height / 2);
                 }
            }
        }
      });

      // ==========================================
      // PAGE FINAL: ADDITIONAL ITEMS (IF ANY)
      // ==========================================
      if (additionalItems && additionalItems.length > 0) {
          doc.addPage();
          
          // Header Page Final - PURPLE
          doc.setFillColor(COLORS.PURPLE[0], COLORS.PURPLE[1], COLORS.PURPLE[2]);
          doc.rect(0, 0, pageWidth, 24, "F");

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text("REQUERIMIENTOS ADICIONALES", 15, 16);
          
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          // FIX: Align Right to prevent overlap
          doc.text("ÍTEMS AGREGADOS MANUALMENTE", pageWidth - 15, 16, { align: "right" });

          const addTableData = additionalItems.map((item, index) => ({
              idx: index + 1,
              code: item.sismedCode || '-',
              name: item.name,
              ff: item.ff || '-',
              qty: item.quantity,
              obs: item.observation || '-'
          }));

          runAutoTable(doc, {
              startY: 35,
              theme: 'grid',
              columns: [
                  { header: '#', dataKey: 'idx' },
                  { header: 'CÓDIGO', dataKey: 'code' },
                  { header: 'DESCRIPCIÓN DEL PRODUCTO', dataKey: 'name' },
                  { header: 'F.F.', dataKey: 'ff' },
                  { header: 'CANTIDAD', dataKey: 'qty' },
                  { header: 'OBSERVACIÓN', dataKey: 'obs' },
              ],
              body: addTableData,
              headStyles: { fillColor: COLORS.PURPLE, textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
              styles: { fontSize: 10, cellPadding: 3, valign: 'middle' },
              columnStyles: {
                  idx: { cellWidth: 15, halign: 'center' },
                  code: { cellWidth: 25, halign: 'center' },
                  name: { halign: 'left' },
                  ff: { cellWidth: 25, halign: 'left' },
                  qty: { cellWidth: 25, halign: 'center', fontStyle: 'bold' },
                  obs: { cellWidth: 60, halign: 'left' }
              }
          });
      }

      doc.save(`Reporte_Toolkit_SISMED_${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error: any) {
      console.error(error);
      alert("Error generando el PDF: " + (error.message || "Error desconocido"));
  }
};
