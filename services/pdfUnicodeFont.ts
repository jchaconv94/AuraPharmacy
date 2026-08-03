import { jsPDF } from "jspdf";

export const PDF_UNICODE_FONT = "NotoSans";

const FONT_REGULAR_FILE = "NotoSans-Regular.ttf";
const FONT_BOLD_FILE = "NotoSans-Bold.ttf";

const fontRegularUrl = new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url).href;
const fontBoldUrl = new URL("../assets/fonts/NotoSans-Bold.ttf", import.meta.url).href;

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
    throw new Error(`No se pudo cargar la fuente PDF: ${url}`);
  }
  return arrayBufferToBase64(await response.arrayBuffer());
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

export const ensurePdfUnicodeFont = async (doc: jsPDF): Promise<void> => {
  const fontData = await loadPdfFontData();
  const pdfDoc = doc as JsPdfWithVfs;
  const registeredFonts = pdfDoc.getFontList();

  if (!registeredFonts[PDF_UNICODE_FONT]) {
    pdfDoc.addFileToVFS(FONT_REGULAR_FILE, fontData.regular);
    pdfDoc.addFont(FONT_REGULAR_FILE, PDF_UNICODE_FONT, "normal");
    pdfDoc.addFileToVFS(FONT_BOLD_FILE, fontData.bold);
    pdfDoc.addFont(FONT_BOLD_FILE, PDF_UNICODE_FONT, "bold");
  }

  doc.setFont(PDF_UNICODE_FONT, "normal");
};
