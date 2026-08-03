import { jsPDF } from "jspdf";
import fontRegularUrl from "../assets/fonts/NotoSans-Regular.ttf?url";
import fontBoldUrl from "../assets/fonts/NotoSans-Bold.ttf?url";

export const PDF_UNICODE_FONT = "NotoSans";

const FONT_REGULAR_FILE = "NotoSans-Regular.ttf";
const FONT_BOLD_FILE = "NotoSans-Bold.ttf";

type FontData = {
  regular: string;
  bold: string;
};

type JsPdfWithVfs = jsPDF & {
  addFileToVFS(fileName: string, fileData: string): void;
  addFont(fileName: string, postScriptName: string, fontStyle: string): string;
  getFontList(): Record<string, string[]>;
};

let fontDataPromise: Promise<FontData> | null = null;

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

const fetchFontBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar la fuente PDF: ${url} (status ${response.status})`);
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  if (bytes.length < 12) {
    throw new Error(`Fuente no válida (tamaño insuficiente): ${url}`);
  }

  // Check magic bytes for TrueType font: 0x00, 0x01, 0x00, 0x00 or "true" or "OTTO"
  const isTtfHeader = (bytes[0] === 0x00 && bytes[1] === 0x01 && bytes[2] === 0x00 && bytes[3] === 0x00);
  const isTrueHeader = (bytes[0] === 0x74 && bytes[1] === 0x72 && bytes[2] === 0x75 && bytes[3] === 0x65);
  const isOttoHeader = (bytes[0] === 0x4F && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4F);

  if (!isTtfHeader && !isTrueHeader && !isOttoHeader) {
    throw new Error(`La URL ${url} no devolvió una fuente TTF válida.`);
  }

  return arrayBufferToBase64(buffer);
};

const loadPdfFontData = (): Promise<FontData> => {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all([
      fetchFontBase64(fontRegularUrl),
      fetchFontBase64(fontBoldUrl)
    ]).then(([regular, bold]) => ({ regular, bold }));
  }

  return fontDataPromise;
};

export const ensurePdfUnicodeFont = async (doc: jsPDF): Promise<string> => {
  try {
    const fontData = await loadPdfFontData();
    const pdfDoc = doc as JsPdfWithVfs;
    const registeredFonts = pdfDoc.getFontList();

    if (!registeredFonts[PDF_UNICODE_FONT]) {
      pdfDoc.addFileToVFS(FONT_REGULAR_FILE, fontData.regular);
      pdfDoc.addFont(FONT_REGULAR_FILE, PDF_UNICODE_FONT, "normal");
      pdfDoc.addFileToVFS(FONT_BOLD_FILE, fontData.bold);
      pdfDoc.addFont(FONT_BOLD_FILE, PDF_UNICODE_FONT, "bold");
    }

    const fontObj = (pdfDoc as any).internal?.getFont?.(PDF_UNICODE_FONT, "normal");
    if (!fontObj || !fontObj.metadata || !fontObj.metadata.Unicode || !fontObj.metadata.Unicode.widths) {
      throw new Error("Invalid font metadata for NotoSans");
    }

    doc.setFont(PDF_UNICODE_FONT, "normal");
    return PDF_UNICODE_FONT;
  } catch (err) {
    console.warn("Could not load or register NotoSans font, falling back to helvetica:", err);
    try {
      doc.setFont("helvetica", "normal");
    } catch {
      // ignore fallback error
    }
    return "helvetica";
  }
};

