import fs from "node:fs";
import { jsPDF } from "jspdf";
import autoTableModule from "jspdf-autotable";

const autoTable = typeof autoTableModule === "function" ? autoTableModule : autoTableModule.default;
const PDF_FONT = "NotoSans";
const outDir = "reportes-ejemplo";
fs.mkdirSync(outDir, { recursive: true });
const outPath = `${outDir}/MOVIMIENTO_BIOLOGICO_UNGET_EJEMPLO_A4.pdf`;
const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
doc.addFileToVFS("NotoSans-Regular.ttf", fs.readFileSync("assets/fonts/NotoSans-Regular.ttf").toString("base64"));
doc.addFont("NotoSans-Regular.ttf", PDF_FONT, "normal");
doc.addFileToVFS("NotoSans-Bold.ttf", fs.readFileSync("assets/fonts/NotoSans-Bold.ttf").toString("base64"));
doc.addFont("NotoSans-Bold.ttf", PDF_FONT, "bold");
doc.setFont(PDF_FONT, "normal");
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 3;
const quantity = value => Number(value || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
const percent = value => `${Number(value || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const rows = [
  {
    codigoSismed: "54003",
    descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS",
    dosisUnidad: 20,
    saldoAlmacenAnterior: 150,
    saldoIpressAnterior: 320,
    lote: "0374MA05",
    expirationDate: "31/10/2026",
    ingresoMes: 400,
    fechaRecepcion: "22/07/2026",
    totalDisponible: 870,
    distribucionIpress: 220,
    consumoFrascos: 95,
    consumoDosis: 1900,
    noDisponibleRed: 2,
    noDisponibleIpress: 4,
    totalMovimiento: 321,
    dosisAplicadas: 1775,
    dosisPerdidas: 125,
    factorPerdida: 6.58,
    saldoAlmacen: 328,
    saldoEess: 441,
    saldoTotalFrascos: 769,
    saldoTotalDosis: 15380,
    observacion: "Distribución regular a IPRESS. Baja IPRESS por deterioro: 4 frascos."
  },
  {
    codigoSismed: "54003",
    descripcion: "VACUNA ANTITUBERCULOSA (BCG) - INYECTABLE - 20 DOSIS",
    dosisUnidad: 20,
    saldoAlmacenAnterior: 40,
    saldoIpressAnterior: 80,
    lote: "56565565",
    expirationDate: "20/05/2027",
    ingresoMes: 0,
    fechaRecepcion: "",
    totalDisponible: 120,
    distribucionIpress: 60,
    consumoFrascos: 18,
    consumoDosis: 360,
    noDisponibleRed: 0,
    noDisponibleIpress: 1,
    totalMovimiento: 79,
    dosisAplicadas: 340,
    dosisPerdidas: 20,
    factorPerdida: 5.56,
    saldoAlmacen: -20,
    saldoEess: 121,
    saldoTotalFrascos: 101,
    saldoTotalDosis: 2020,
    observacion: "Cambio de lote regularizado por reajuste auditado."
  },
  {
    codigoSismed: "55001",
    descripcion: "JERINGA DESCARTABLE 1 ML CON AGUJA",
    dosisUnidad: 1,
    saldoAlmacenAnterior: 1000,
    saldoIpressAnterior: 2500,
    lote: "JER-2026-09",
    expirationDate: "30/09/2028",
    ingresoMes: 3000,
    fechaRecepcion: "15/07/2026",
    totalDisponible: 6500,
    distribucionIpress: 1800,
    consumoFrascos: 1100,
    consumoDosis: 1100,
    noDisponibleRed: 0,
    noDisponibleIpress: 10,
    totalMovimiento: 2910,
    dosisAplicadas: 1090,
    dosisPerdidas: 10,
    factorPerdida: 0.91,
    saldoAlmacen: 2200,
    saldoEess: 3190,
    saldoTotalFrascos: 5390,
    saldoTotalDosis: 5390,
    observacion: "Uso en campaña regular de inmunizaciones."
  }
];

doc.setFillColor(15, 118, 110);
doc.rect(0, 0, pageWidth, 22, "F");
doc.setTextColor(255, 255, 255);
doc.setFont(PDF_FONT, "bold");
doc.setFontSize(12);
doc.text("MOVIMIENTO BIOLÓGICO MENSUAL CONSOLIDADO UNGET", margin, 9);
doc.setFont(PDF_FONT, "normal");
doc.setFontSize(7.5);
doc.text("Periodo: 2026-07  |  Ámbito: UNGET  |  Bellavista", margin, 15);
doc.text("Generado por: ejemplo  |  Cierre UNGET: pendiente", pageWidth - margin, 15, { align: "right" });

autoTable(doc, {
  startY: 24,
  margin: { left: margin, right: margin, bottom: 10 },
  tableWidth: pageWidth - margin * 2,
  head: [
    [
      { content: "CÓDIGO\nSISMED", rowSpan: 2 },
      { content: "BIOLÓGICOS/DILUYENTES/JERINGAS", rowSpan: 2 },
      { content: "PRESENTACIÓN\nDOSIS/UNIDAD\n(a)", rowSpan: 2 },
      { content: "SALDO DISPONIBLE PARA EL MES X FRASCO", colSpan: 7 },
      { content: "MOVIMIENTO DEL MES X FRASCO", colSpan: 6 },
      { content: "MOVIMIENTO DEL MES X DOSIS", colSpan: 3 },
      { content: "SALDO\nALMACÉN\n(ñ=b+d-f-i)", rowSpan: 2 },
      { content: "SALDO\nEESS\n(o=c+f-g-j)", rowSpan: 2 },
      { content: "SALDO\nTOTAL\nFRASCOS\n(p=ñ+o)", rowSpan: 2 },
      { content: "SALDO\nTOTAL\nDOSIS\n(q=p*a)", rowSpan: 2 },
      { content: "OBSERVACIONES", rowSpan: 2 }
    ],
    [
      "SALDO ALMACÉN\nRED MES\nANTERIOR\n(b)",
      "SALDO IPRESS\nMES ANTERIOR\n(c)",
      "N° LOTE",
      "(*)FECHA DE\nVENCIMIENTO",
      "INGRESO EN EL\nMES (d)",
      "FECHA DE\nRECEP.",
      "TOTAL DISPONIBLE\nPARA EL MES\n(e=b+c+d)",
      "DISTRIBUCIÓN\nA IPRESS\n(f)",
      "CONSUMO DEL\nMES FCO\n(g)",
      "CONSUMO DEL\nMES DOSIS\n(h=g*a)",
      "(*)DETERIORADO\n/VENCIDO O\nTRANSFERIDO\nRED (i)",
      "(*)DETERIORADO\n/VENCIDO O\nTRANSFERIDO\nIPRESS (j)",
      "TOTAL DE\nMOVIMIENTO\nDEL MES\n(k=f+g+i+j)",
      "DOSIS\nAPLICADAS\n(l)",
      "DOSIS\nPERDIDAS\n(m=h-l)",
      "% FACTOR\nPÉRDIDA\n(n=(m/h)*100)"
    ]
  ],
  body: rows.map(row => [
    row.codigoSismed,
    row.descripcion,
    quantity(row.dosisUnidad),
    quantity(row.saldoAlmacenAnterior),
    quantity(row.saldoIpressAnterior),
    row.lote,
    row.expirationDate,
    quantity(row.ingresoMes),
    row.fechaRecepcion,
    quantity(row.totalDisponible),
    quantity(row.distribucionIpress),
    quantity(row.consumoFrascos),
    quantity(row.consumoDosis),
    quantity(row.noDisponibleRed),
    quantity(row.noDisponibleIpress),
    quantity(row.totalMovimiento),
    quantity(row.dosisAplicadas),
    quantity(row.dosisPerdidas),
    percent(row.factorPerdida),
    quantity(row.saldoAlmacen),
    quantity(row.saldoEess),
    quantity(row.saldoTotalFrascos),
    quantity(row.saldoTotalDosis),
    row.observacion
  ]),
  theme: "grid",
  styles: { font: PDF_FONT, fontSize: 4.6, cellPadding: 0.45, textColor: [30, 41, 59], lineColor: [71, 85, 105], lineWidth: 0.08, halign: "center", valign: "middle", overflow: "linebreak" },
  headStyles: { fillColor: [255, 242, 204], textColor: [0, 0, 0], fontStyle: "bold", fontSize: 4.05, halign: "center", valign: "middle" },
  bodyStyles: { minCellHeight: 8, halign: "center", valign: "middle" },
  columnStyles: {
    0: { cellWidth: 8, fontStyle: "bold" },
    1: { cellWidth: 43, fontStyle: "bold" },
    2: { cellWidth: 8 },
    3: { cellWidth: 9 },
    4: { cellWidth: 9 },
    5: { cellWidth: 10 },
    6: { cellWidth: 10 },
    7: { cellWidth: 8 },
    8: { cellWidth: 10 },
    9: { cellWidth: 9 },
    10: { cellWidth: 9 },
    11: { cellWidth: 8 },
    12: { cellWidth: 8 },
    13: { cellWidth: 13 },
    14: { cellWidth: 13 },
    15: { cellWidth: 9 },
    16: { cellWidth: 8 },
    17: { cellWidth: 8 },
    18: { cellWidth: 10 },
    19: { cellWidth: 9 },
    20: { cellWidth: 9 },
    21: { cellWidth: 9 },
    22: { cellWidth: 9 },
    23: { cellWidth: 45 }
  }
});

const pageCount = doc.getNumberOfPages();
for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
  doc.setPage(pageNumber);
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text("ToolKit SISMED Web - Módulo Inmunizaciones", margin, pageHeight - 5);
  doc.text(`Página ${pageNumber} de ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: "right" });
}

fs.writeFileSync(outPath, Buffer.from(doc.output("arraybuffer")));
console.log(outPath);
