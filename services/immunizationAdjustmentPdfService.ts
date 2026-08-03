import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";
import { ensurePdfUnicodeFont, PDF_UNICODE_FONT } from "./pdfUnicodeFont";
import { ImmunizationAdjustment, ImmunizationAdjustmentItem } from "../types";

interface AdjustmentPdfOptions {
  adjustment: ImmunizationAdjustment;
  items: ImmunizationAdjustmentItem[];
  ownerName: string;
}

const currency = (value: number) => `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const quantity = (value: number) => value.toLocaleString("es-PE", { maximumFractionDigits: 2 });
const formatDateTime = (value?: string) => value
  ? new Date(value).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" })
  : new Date().toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });

const operationLabel = (item: ImmunizationAdjustmentItem) => {
  if (item.operationType === "RECLASSIFY_SOURCE") return "ORIGEN";
  if (item.operationType === "RECLASSIFY_TARGET") return "DESTINO";
  if (item.operationType === "NEW_LAYER") return "NUEVO";
  return item.differenceQuantity > 0 ? "ENTRADA" : "SALIDA";
};

export const createImmunizationAdjustmentPdf = async ({ adjustment, items, ownerName }: AdjustmentPdfOptions): Promise<jsPDF> => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfFont = await ensurePdfUnicodeFont(doc);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const adjustmentCode = adjustment.id || "SIN-ID";

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont(pdfFont, "bold");
  doc.setFontSize(15);
  doc.text("CONSTANCIA DE REAJUSTE DE STOCK BIOLÓGICO", margin, 12);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(8.5);
  doc.text("ToolKit SISMED Web - DIRESA San Martín - Módulo Inmunizaciones", margin, 18);
  doc.text(`ID: ${adjustmentCode}`, pageWidth - margin, 18, { align: "right" });

  doc.setTextColor(30, 41, 59);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, 34, pageWidth - margin * 2, 32, 3, 3, "F");
  doc.setFont(pdfFont, "bold");
  doc.setFontSize(8);
  doc.text("DATOS GENERALES", margin + 4, 40);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(8.5);
  doc.text(`Periodo: ${adjustment.period}`, margin + 4, 47);
  doc.text(`Ámbito: ${adjustment.ownerType}`, margin + 4, 53);
  doc.text(`Ubicación: ${ownerName}`, margin + 4, 59, { maxWidth: 82 });
  doc.text(`Usuario: ${adjustment.createdBy || "-"}`, 112, 47);
  doc.text(`Fecha y hora: ${formatDateTime(adjustment.createdAt)}`, 112, 53);
  doc.text(`Estado: ${adjustment.status === "APPLIED" ? "APLICADO" : "ANULADO"}`, 112, 59);

  const autoTable = typeof autoTableModule === "function"
    ? autoTableModule
    : (autoTableModule as unknown as { default: typeof autoTableModule }).default;
  if (!autoTable) throw new Error("No se pudo inicializar el generador de tablas PDF.");

  autoTable(doc, {
    startY: 72,
    tableWidth: 170,
    margin: { left: margin, right: margin, bottom: 28 },
    head: [["CÓDIGO / PRODUCTO", "LOTE", "VCTO.", "P. UNIT.", "FUENTE / SUM.", "SIST.", "FÍSICO", "DIF.", "TIPO"]],
    body: items.map(item => [
      `${item.operationType === "RECLASSIFY_SOURCE" ? "[ORIGEN] " : item.operationType === "RECLASSIFY_TARGET" ? "[DESTINO] " : ""}${item.product?.codigoSismed || "-"}\n${item.product?.descripcion || "Producto"}`,
      item.lote,
      item.expirationDate,
      currency(item.unitPrice),
      `${item.fundingSource} / ${item.supplyType}`,
      quantity(item.systemQuantity),
      quantity(item.physicalQuantity),
      `${item.differenceQuantity > 0 ? "+" : ""}${quantity(item.differenceQuantity)}`,
      operationLabel(item)
    ]),
    theme: "grid",
    styles: { font: pdfFont, fontSize: 6.8, cellPadding: 2, textColor: [51, 65, 85], lineColor: [226, 232, 240], lineWidth: 0.15, valign: "middle" },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.5 },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 23 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18, halign: "right" },
      4: { cellWidth: 20 },
      5: { cellWidth: 12, halign: "right" },
      6: { cellWidth: 12, halign: "right" },
      7: { cellWidth: 12, halign: "right", fontStyle: "bold" },
      8: { cellWidth: 17, halign: "center", fontStyle: "bold" }
    },
    didParseCell: hook => {
      const item = items[hook.row.index];
      if (hook.section === "body" && item?.operationType === "RECLASSIFY_SOURCE") {
        hook.cell.styles.fillColor = [245, 243, 255];
      }
      if (hook.section === "body" && item?.operationType === "RECLASSIFY_TARGET") {
        hook.cell.styles.fillColor = [240, 253, 250];
      }
      if (hook.section === "body" && hook.column.index === 7) {
        const value = item?.differenceQuantity || 0;
        hook.cell.styles.textColor = value > 0 ? [5, 150, 105] : [220, 38, 38];
      }
    }
  });

  const tableEnd = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 78;
  let detailY = tableEnd + 8;
  if (detailY > pageHeight - 72) {
    doc.addPage();
    detailY = 20;
  }

  doc.setFont(pdfFont, "bold");
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.text("MOTIVO", margin, detailY);
  doc.setFont(pdfFont, "normal");
  doc.setFontSize(8.5);
  const reasonLines = doc.splitTextToSize(adjustment.reason, pageWidth - margin * 2);
  doc.text(reasonLines, margin, detailY + 5);
  detailY += 8 + reasonLines.length * 4;

  doc.setFont(pdfFont, "bold");
  doc.text("OBSERVACION / SUSTENTO", margin, detailY);
  doc.setFont(pdfFont, "normal");
  const observationLines = doc.splitTextToSize(adjustment.observation, pageWidth - margin * 2);
  doc.text(observationLines, margin, detailY + 5);
  detailY += 18 + observationLines.length * 4;

  if (detailY < pageHeight - 42) {
    doc.setDrawColor(148, 163, 184);
    doc.line(margin + 8, detailY + 14, 84, detailY + 14);
    doc.line(126, detailY + 14, pageWidth - margin - 8, detailY + 14);
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("Responsable de Inmunizaciones", 49, detailY + 19, { align: "center" });
    doc.text(`Responsable ${adjustment.ownerType}`, 151, detailY + 19, { align: "center" });
  }

  const pageCount = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont(pdfFont, "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text("Documento generado automáticamente. El reajuste modifica el stock y permanece en la auditoría del sistema.", margin, pageHeight - 9);
    doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 9, { align: "right" });
  }

  return doc;
};

export const downloadImmunizationAdjustmentPdf = async (options: AdjustmentPdfOptions): Promise<void> => {
  const doc = await createImmunizationAdjustmentPdf(options);
  const code = (options.adjustment.id || "reajuste").replace(/[^a-zA-Z0-9-]/g, "");
  doc.save(`CONSTANCIA_REAJUSTE_${options.adjustment.period}_${code}.pdf`);
};
