
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
  
  // Table
  YELLOW_HIGHLIGHT: [255, 215, 0] as [number, number, number],
  BG_GREEN_CELL: [220, 252, 231] as [number, number, number], // Green-100
  TEXT_GREEN_DARK: [20, 83, 45] as [number, number, number], // Green-900
};

const formatCurrency = (val: number) => `S/ ${val.toLocaleString('es-PE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const getMonthHeaders = (refDate?: string) => {
    if (!refDate) return ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9", "M10", "M11", "M12"];
    const [yearStr, monthStr] = refDate.split('-');
    const date = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
    const headers = [];
    for (let i = 0; i < 12; i++) {
        const d = new Date(date);
        d.setMonth(d.getMonth() - (11 - i));
        const mName = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
        const yShort = d.getFullYear().toString().slice(2);
        headers.push(`${mName}-${yShort}`);
    }
    return headers;
};

export const generateFullReportPDF = (
    result: AuraAnalysisResult, 
    filteredTableItems?: AnalyzedMedication[],
    additionalItems?: AdditionalItem[]
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
      doc.setFontSize(24);
      doc.text("AURA", 15, 16);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(230, 230, 230);
      doc.text("SISTEMA INTELIGENTE DE GESTIÓN FARMACÉUTICA", 45, 16);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(COLORS.WHITE[0], COLORS.WHITE[1], COLORS.WHITE[2]);
      doc.text(`CORTE: ${result.referenceDate || 'ACTUAL'}`, pageWidth - 15, 16, { align: "right" });

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

      const stats = [
        { label: "Desabastecido", val: result.medications.filter(m => m.status === StockStatus.DESABASTECIDO).length, color: COLORS.RED },
        { label: "SubStock", val: result.medications.filter(m => m.status === StockStatus.SUBSTOCK).length, color: COLORS.ORANGE },
        { label: "NormoStock", val: result.medications.filter(m => m.status === StockStatus.NORMOSTOCK).length, color: COLORS.GREEN },
        { label: "SobreStock", val: result.medications.filter(m => m.status === StockStatus.SOBRESTOCK).length, color: COLORS.INDIGO },
        { label: "Sin Rotación", val: result.medications.filter(m => m.status === StockStatus.SIN_ROTACION).length, color: COLORS.GRAY },
      ];
      const maxVal = Math.max(...stats.map(s => s.val), 1);
      const totalItems = result.indicators.totalItems || 1;

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
          const percentage = ((stat.val / totalItems) * 100).toFixed(1) + "%";

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
      const isLow = result.indicators.dmeScore < 70;
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
      doc.text(`${result.indicators.dmeScore.toFixed(1)}%`, rightX + (rightColW/2), dmeY + 30, { align: "center" });

      doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
      const badgeW = 35;
      doc.roundedRect(rightX + (rightColW/2) - (badgeW/2), dmeY + 36, badgeW, 7, 3, 3, "F");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(result.indicators.status, rightX + (rightColW/2), dmeY + 40.5, { align: "center" });

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
      doc.text(`ACTUAL: ${result.indicators.availableItems}/${result.indicators.totalItems}`, rightX + rightColW - 10, dmeY + 65, { align: "right" });

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


      // ==========================================
      // PAGE 2: EXECUTIVE SUMMARY (DEDICATED)
      // ==========================================
      doc.addPage();
      
      // Header Page 2 - BLACK
      doc.setFillColor(COLORS.BLACK[0], COLORS.BLACK[1], COLORS.BLACK[2]);
      doc.rect(0, 0, pageWidth, 24, "F"); // Slightly larger header for section page
      
      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("RESUMEN EJECUTIVO", 15, 16);

      // Summary Content - Large text for readability since it's a full page
      doc.setFontSize(12);
      doc.setTextColor(COLORS.TEXT_DARK[0], COLORS.TEXT_DARK[1], COLORS.TEXT_DARK[2]);
      doc.setFont("helvetica", "normal");

      // Split text
      const summaryLines = doc.splitTextToSize(result.executiveSummary, pageWidth - 30);
      doc.text(summaryLines, 15, 40);


      // ==========================================
      // PAGE 3+: DATA MATRIX (DEDICATED START)
      // ==========================================
      doc.addPage();

      // Header Page 3 - BLACK
      doc.setFillColor(COLORS.BLACK[0], COLORS.BLACK[1], COLORS.BLACK[2]);
      doc.rect(0, 0, pageWidth, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("MATRIZ DE REQUERIMIENTO DETALLADA", 15, 16);

      // Table Start Position
      const tableStartY = 35;

      const runAutoTable = (autoTable as any).default || (autoTable as any);
      const monthHeaders = getMonthHeaders(result.referenceDate);
      
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
        const row: any = {
            id: item.id,
            name: item.name,
            ff: item.ff || '-',
            type: item.medtip || 'MED',
            stock: item.currentStock.toLocaleString(),
            rawCpm: item.rawCpm.toFixed(1),
            cpm: item.cpm.toFixed(1),
            monthsProvision: isFinite(item.monthsOfProvision) ? item.monthsOfProvision.toFixed(1) : '∞',
            status: item.status,
            req: item.quantityToOrder > 0 ? item.quantityToOrder : '-',
            _spikeThreshold: item.spikeThreshold,
            _history: item.originalHistory,
            _statusEnum: item.status
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
            rawCpm: { cellWidth: 10, textColor: 100 },
            cpm: { cellWidth: 10, fontStyle: 'bold', textColor: COLORS.TEAL_DARK },
            monthsProvision: { cellWidth: 10, fontStyle: 'bold' },
            status: { cellWidth: 18, fontSize: 5 },
            req: { cellWidth: 10, fontStyle: 'bold', textColor: COLORS.PIE_BLUE }
        },
        didParseCell: function(data: any) {
            if (data.section !== 'body') return;
            const row = data.row.raw;
            
            if (data.column.dataKey && String(data.column.dataKey).startsWith('m')) {
                const idx = parseInt(String(data.column.dataKey).substring(1));
                const val = row._history ? row._history[idx] : 0;
                const threshold = row._spikeThreshold;

                if (val > threshold && val > 0) {
                    data.cell.styles.fillColor = COLORS.YELLOW_HIGHLIGHT;
                    data.cell.styles.textColor = COLORS.RED;
                    data.cell.styles.fontStyle = 'bold';
                } else if (val > 0) {
                    data.cell.styles.fillColor = COLORS.BG_GREEN_CELL;
                    data.cell.styles.textColor = COLORS.TEXT_GREEN_DARK;
                } else {
                    if (val === 0) data.cell.styles.textColor = [200, 200, 200];
                }
            }
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

      doc.save(`Reporte_Aura_${new Date().toISOString().split('T')[0]}.pdf`);

  } catch (error: any) {
      console.error(error);
      alert("Error generando el PDF: " + (error.message || "Error desconocido"));
  }
};
