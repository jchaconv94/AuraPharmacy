import * as XLSX from "xlsx";
import { ImmunizationInitialInventoryItem, ImmunizationProduct } from "../types";
import { consolidateItemsByCompositeKey, getItemUniqueCompositeKey } from "./immunizationDomain";

export interface ImmunizationImportRow {
  rowNumber: number;
  originalRowNumbers?: number[];
  codigoSismed: string;
  excelDescription: string;
  officialDescription: string;
  lote: string;
  expirationDate: string;
  quantity: number;
  unitPrice: number;
  fundingSource: string;
  supplyType: string;
  observation: string;
  productId?: string;
  compositeKey?: string;
  status: "VALID" | "CONSOLIDATED" | "INVALID";
  isExistingInDraft?: boolean;
  selected?: boolean;
  consolidatedCount?: number;
  errors: string[];
  warnings: string[];
}

export interface ImmunizationImportPreview {
  fileName: string;
  sheetName: string;
  rows: ImmunizationImportRow[];
  missingColumns: string[];
  isInvalidFile?: boolean;
  fileError?: string;
  totalRawRows: number;
  validCount: number;
  newCount: number;
  existingCount: number;
  consolidatedCount: number;
  invalidCount: number;
  warningCount: number;
  totalQuantity: number;
  totalValue: number;
}

const COLUMN_ALIASES = {
  codigoSismed: ["codigo_sismed", "cod_sismed", "codigo", "cod", "medcod", "id_producto", "id producto", "codigo sismed"],
  description: ["descripcion", "producto", "nombre", "biologicos/diluyentes/jeringas", "biologicos", "xnom"],
  lote: ["lote", "n lote", "nro lote", "numero lote", "no lote"],
  expirationDate: ["fecha_vencimiento", "vencimiento", "fec_vencim", "fecha vencimiento", "fecha de vencimiento"],
  quantity: ["saldo", "stock", "stock fisico", "saldo fisico", "cantidad", "saldo disponible"],
  unitPrice: ["precio", "precio unitario", "precio_det", "precio detalle", "precio_cab", "costo unitario"],
  fundingSource: ["ffinan", "fuente financiamiento", "fuente de financiamiento"],
  supplyType: ["tipsum", "tipo suministro", "tipo de suministro", "desc_tipsum"],
  observation: ["observacion", "observaciones", "nota", "comentario"]
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

const REQUIRED_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: "codigoSismed", label: "Codigo SISMED" },
  { key: "lote", label: "Lote" },
  { key: "expirationDate", label: "Fecha de vencimiento" },
  { key: "quantity", label: "Saldo fisico" },
  { key: "unitPrice", label: "Precio unitario" },
  { key: "fundingSource", label: "Fuente de financiamiento" },
  { key: "supplyType", label: "Tipo de suministro" }
];

const normalizeText = (value: unknown): string => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[°ºª]/g, " ")
  .replace(/[_-]+/g, " ")
  .replace(/[^a-zA-Z0-9/ ]/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const normalizedAliases = Object.fromEntries(
  Object.entries(COLUMN_ALIASES).map(([key, aliases]) => [key, aliases.map(normalizeText)])
) as Record<ColumnKey, string[]>;

const findHeader = (rows: unknown[][]) => {
  let best = { index: -1, columns: {} as Partial<Record<ColumnKey, number>>, score: 0 };

  rows.slice(0, 30).forEach((row, rowIndex) => {
    const columns: Partial<Record<ColumnKey, number>> = {};
    row.forEach((cell, columnIndex) => {
      const normalized = normalizeText(cell);
      if (!normalized) return;
      (Object.keys(normalizedAliases) as ColumnKey[]).forEach(key => {
        if (columns[key] === undefined && normalizedAliases[key].includes(normalized)) {
          columns[key] = columnIndex;
        }
      });
    });
    const score = REQUIRED_COLUMNS.filter(item => columns[item.key] !== undefined).length;
    if (score > best.score) best = { index: rowIndex, columns, score };
  });

  return best;
};

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let text = String(value ?? "").trim().replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    text = text.lastIndexOf(",") > text.lastIndexOf(".")
      ? text.replace(/\./g, "").replace(",", ".")
      : text.replace(/,/g, "");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  text = text.replace(/[^0-9.-]/g, "");
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const MONTH_NAMES_MAP: Record<string, number> = {
  ene: 1, enero: 1, jan: 1, january: 1,
  feb: 2, febrero: 2, february: 2,
  mar: 3, marzo: 3, march: 3,
  abr: 4, abril: 4, apr: 4, april: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6, june: 6,
  jul: 7, julio: 7, july: 7,
  ago: 8, agosto: 8, aug: 8, august: 8,
  set: 9, sep: 9, setiembre: 9, septiembre: 9, sept: 9, september: 9,
  oct: 10, octubre: 10, october: 10,
  nov: 11, noviembre: 11, november: 11,
  dic: 12, diciembre: 12, dec: 12, december: 12
};

export const toIsoDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;

  // 1. Objeto Date de JavaScript
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Número (código de fecha de Excel, ej. 46326)
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
      }
    } catch {
      // continuar con fallback
    }
  }

  // Limpieza inicial de texto
  let text = String(value).trim();
  if (!text) return null;

  // Eliminar caracteres invisibles, control o saltos de línea
  text = text.replace(/[\r\n\t]/g, " ").replace(/\u00a0/g, " ").trim();

  // 3. String numérico de Excel (ej: "46326" o "46326.5")
  if (/^\d{5}(\.\d+)?$/.test(text)) {
    const num = parseFloat(text);
    if (num > 20000 && num < 80000) {
      try {
        const parsed = XLSX.SSF.parse_date_code(num);
        if (parsed && parsed.y && parsed.m && parsed.d) {
          return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
        }
      } catch {
        // continuar
      }
    }
  }

  // 4. Si contiene hora, extraer solo la parte de la fecha (ej: "31/10/2026 00:00:00" -> "31/10/2026" o "2026-10-31T...")
  const datePartOnly = text.split(/[ T]/)[0]?.trim() || text;

  // 5. Formato ISO: YYYY-MM-DD o YYYY/MM/DD o YYYY.MM.DD
  const isoMatch = datePartOnly.match(/^(\d{4})[-/.\s]([01]?\d)[-/.\s]([0-3]?\d)$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 6. Formato común local: DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY (o con año de 2 dígitos DD/MM/YY)
  const localMatch = datePartOnly.match(/^([0-3]?\d)[-/.\s]([01]?\d)[-/.\s](\d{2}|\d{4})$/);
  if (localMatch) {
    let d = parseInt(localMatch[1], 10);
    let m = parseInt(localMatch[2], 10);
    let y = parseInt(localMatch[3].length === 2 ? (parseInt(localMatch[3], 10) > 50 ? `19${localMatch[3]}` : `20${localMatch[3]}`) : localMatch[3], 10);

    // Detección inteligente si d y m estuvieran invertidos (ej. si el primer número es > 12 es claramente día)
    if (m > 12 && d <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 7. Formato con mes en texto: "31-OCT-2026", "31/OCTUBRE/2026", "31 OCT 2026", "OCT-2026", "OCTUBRE 2026"
  const textMonthMatch = text.match(/^([0-3]?\d)?[-/.\s]*([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)[-/.\s]*(\d{2}|\d{4})$/i);
  if (textMonthMatch) {
    const rawDay = textMonthMatch[1];
    const rawMonthStr = textMonthMatch[2].toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3);
    const rawYear = textMonthMatch[3];
    const monthNum = MONTH_NAMES_MAP[rawMonthStr];
    if (monthNum) {
      const y = parseInt(rawYear.length === 2 ? (parseInt(rawYear, 10) > 50 ? `19${rawYear}` : `20${rawYear}`) : rawYear, 10);
      let d = rawDay ? parseInt(rawDay, 10) : 0;
      if (!d || d < 1 || d > 31) {
        // Si no se especificó día (ej: "OCT-2026"), calcular el último día de ese mes
        d = new Date(y, monthNum, 0).getDate();
      }
      return `${String(y).padStart(4, "0")}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // 8. Formato Mes/Año simple: MM/YYYY o MM-YYYY o YYYY-MM
  const monthYearMatch1 = datePartOnly.match(/^([01]?\d)[-/.](\d{4})$/);
  if (monthYearMatch1) {
    const m = parseInt(monthYearMatch1[1], 10);
    const y = parseInt(monthYearMatch1[2], 10);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const lastDay = new Date(y, m, 0).getDate();
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  const monthYearMatch2 = datePartOnly.match(/^(\d{4})[-/.]([01]?\d)$/);
  if (monthYearMatch2) {
    const y = parseInt(monthYearMatch2[1], 10);
    const m = parseInt(monthYearMatch2[2], 10);
    if (m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
      const lastDay = new Date(y, m, 0).getDate();
      return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  // 9. Fallback con Date.parse nativo
  const timestamp = Date.parse(text);
  if (!isNaN(timestamp)) {
    const dt = new Date(timestamp);
    if (dt.getFullYear() >= 1900 && dt.getFullYear() <= 2100) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }

  return null;
};

const cellValue = (row: unknown[], columns: Partial<Record<ColumnKey, number>>, key: ColumnKey) => {
  const index = columns[key];
  return index === undefined ? "" : row[index];
};

export const parseImmunizationInventoryExcel = async (
  file: File,
  products: ImmunizationProduct[],
  existingDraftItems?: ImmunizationInitialInventoryItem[]
): Promise<ImmunizationImportPreview> => {
  const fileNameLower = file.name.toLowerCase();
  const isValidExtension =
    fileNameLower.endsWith(".xlsx") ||
    fileNameLower.endsWith(".xls") ||
    fileNameLower.endsWith(".csv");

  if (!isValidExtension) {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: REQUIRED_COLUMNS.map(item => item.label),
      isInvalidFile: true,
      fileError: "Formato no válido. El archivo debe ser una hoja de cálculo Excel (.xlsx, .xls) o archivo .csv.",
      totalRawRows: 0,
      validCount: 0,
      newCount: 0,
      existingCount: 0,
      consolidatedCount: 0,
      invalidCount: 0,
      warningCount: 0,
      totalQuantity: 0,
      totalValue: 0
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  } catch {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: REQUIRED_COLUMNS.map(item => item.label),
      isInvalidFile: true,
      fileError: "No se pudo leer el archivo. Verifique que no esté dañado o protegido con contraseña.",
      totalRawRows: 0,
      validCount: 0,
      newCount: 0,
      existingCount: 0,
      consolidatedCount: 0,
      invalidCount: 0,
      warningCount: 0,
      totalQuantity: 0,
      totalValue: 0
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: REQUIRED_COLUMNS.map(item => item.label),
      isInvalidFile: true,
      fileError: "El archivo no contiene hojas de cálculo.",
      totalRawRows: 0,
      validCount: 0,
      newCount: 0,
      existingCount: 0,
      consolidatedCount: 0,
      invalidCount: 0,
      warningCount: 0,
      totalQuantity: 0,
      totalValue: 0
    };
  }

  const sheet = workbook.Sheets[sheetName];
  // raw:false conserva codigos formateados con ceros a la izquierda en el Excel.
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", dateNF: "yyyy-mm-dd" });
  const header = findHeader(rawRows);
  const missingColumns = REQUIRED_COLUMNS
    .filter(item => header.columns[item.key] === undefined)
    .map(item => item.label);

  if (header.index < 0 || header.score === 0 || missingColumns.length > 0) {
    return {
      fileName: file.name,
      sheetName,
      rows: [],
      missingColumns,
      isInvalidFile: true,
      fileError: `El archivo no tiene la estructura de columnas requerida para el inventario inicial.${
        missingColumns.length > 0 ? ` Faltan: ${missingColumns.join(", ")}.` : ""
      }`,
      totalRawRows: 0,
      validCount: 0,
      newCount: 0,
      existingCount: 0,
      consolidatedCount: 0,
      invalidCount: 0,
      warningCount: 0,
      totalQuantity: 0,
      totalValue: 0
    };
  }

  const catalog = new Map(products.map(product => [normalizeText(product.codigoSismed).replace(/\s/g, ""), product]));
  const parsedRows = rawRows.slice(header.index + 1).flatMap((row, offset) => {
    const values = Object.keys(header.columns).map(key => cellValue(row, header.columns, key as ColumnKey));
    if (values.every(value => String(value ?? "").trim() === "")) return [];

    const codigoSismed = String(cellValue(row, header.columns, "codigoSismed") ?? "").trim();
    const excelDescription = String(cellValue(row, header.columns, "description") ?? "").trim();
    const lote = String(cellValue(row, header.columns, "lote") ?? "").trim();
    const expCellCol = header.columns.expirationDate;
    const expRawVal = cellValue(row, header.columns, "expirationDate");
    let expirationDate = toIsoDate(expRawVal);
    if (!expirationDate && expCellCol !== undefined) {
      const cellAddress = XLSX.utils.encode_cell({ r: header.index + offset + 1, c: expCellCol });
      const cellObj = sheet[cellAddress];
      if (cellObj) {
        expirationDate = toIsoDate(cellObj.v) || toIsoDate(cellObj.w);
      }
    }
    const quantity = parseNumber(cellValue(row, header.columns, "quantity"));
    const unitPrice = parseNumber(cellValue(row, header.columns, "unitPrice"));
    const fundingSource = String(cellValue(row, header.columns, "fundingSource") ?? "").trim();
    const supplyType = String(cellValue(row, header.columns, "supplyType") ?? "").trim();
    const observation = String(cellValue(row, header.columns, "observation") ?? "").trim();
    const product = catalog.get(normalizeText(codigoSismed).replace(/\s/g, ""));
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!codigoSismed) {
      errors.push("Código SISMED vacío");
    } else if (!product) {
      errors.push("Código SISMED no existe en el catálogo maestro de biológicos");
    } else if (!product.isActive) {
      errors.push("Producto inactivo en el catálogo maestro");
    } else if (!product.id) {
      errors.push("Producto sin identificador válido en BD");
    }

    if (!lote) errors.push("Lote vacío");
    if (!expirationDate) errors.push("Fecha de vencimiento inválida o no especificada");
    if (quantity === null || quantity < 0) errors.push("Saldo físico inválido (debe ser mayor o igual a 0)");
    if (unitPrice === null || unitPrice < 0) errors.push("Precio unitario inválido (debe ser mayor o igual a 0)");
    if (!fundingSource) errors.push("Fuente de financiamiento vacía");
    if (!supplyType) errors.push("Tipo de suministro vacío");

    if (product && excelDescription && normalizeText(excelDescription) !== normalizeText(product.descripcion)) {
      warnings.push("La descripción del Excel difiere; se usará la oficial del catálogo");
    }

    const rowNum = header.index + offset + 2;
    const isInvalid = errors.length > 0;

    return [{
      rowNumber: rowNum,
      originalRowNumbers: [rowNum],
      codigoSismed,
      excelDescription,
      officialDescription: product?.descripcion || (excelDescription || "No encontrado en catálogo"),
      lote,
      expirationDate: expirationDate || "",
      quantity: quantity ?? 0,
      unitPrice: unitPrice ?? 0,
      fundingSource,
      supplyType,
      observation,
      productId: product?.id,
      status: (isInvalid ? "INVALID" : "VALID") as "VALID" | "CONSOLIDATED" | "INVALID",
      selected: !isInvalid,
      errors,
      warnings
    } satisfies ImmunizationImportRow];
  });

  // Consolidar filas válidas duplicadas por clave única concatenada
  const invalidRows = parsedRows.filter(r => r.status === "INVALID");
  const validRows = parsedRows.filter(r => r.status === "VALID");

  const consolidatedMap = new Map<string, ImmunizationImportRow>();
  for (const row of validRows) {
    const key = getItemUniqueCompositeKey({
      codigoSismedSnapshot: row.codigoSismed,
      lote: row.lote,
      expirationDate: row.expirationDate,
      unitPrice: row.unitPrice,
      fundingSource: row.fundingSource,
      supplyType: row.supplyType
    });

    const existing = consolidatedMap.get(key);
    if (existing) {
      const mergedObs = [existing.observation, row.observation]
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join("; ");
      const mergedWarnings = [...existing.warnings];
      const mergedRowNumbers = [...(existing.originalRowNumbers || [existing.rowNumber]), row.rowNumber];
      const count = (existing.consolidatedCount || 1) + 1;

      if (!mergedWarnings.some(w => w.includes("consolidada por clave única"))) {
        mergedWarnings.push(`Fila consolidada por clave única (${count} registros sumados)`);
      } else {
        const warningIdx = mergedWarnings.findIndex(w => w.includes("consolidada por clave única"));
        if (warningIdx >= 0) {
          mergedWarnings[warningIdx] = `Fila consolidada por clave única (${count} registros sumados)`;
        }
      }

      consolidatedMap.set(key, {
        ...existing,
        compositeKey: key,
        status: "CONSOLIDATED",
        quantity: existing.quantity + row.quantity,
        observation: mergedObs,
        consolidatedCount: count,
        originalRowNumbers: mergedRowNumbers,
        warnings: mergedWarnings
      });
    } else {
      consolidatedMap.set(key, {
        ...row,
        compositeKey: key,
        consolidatedCount: 1
      });
    }
  }

  const existingCompositeKeys = new Set(
    (existingDraftItems || []).map(it => getItemUniqueCompositeKey(it))
  );
  const existingCodeLots = new Set(
    (existingDraftItems || []).map(it => `${(it.codigoSismedSnapshot || "").trim().toUpperCase()}|${(it.lote || "").trim().toUpperCase()}`)
  );

  const processedValidRows = Array.from(consolidatedMap.values()).map(row => {
    const isExisting =
      existingCompositeKeys.has(row.compositeKey || "") ||
      existingCodeLots.has(`${row.codigoSismed.toUpperCase()}|${row.lote.toUpperCase()}`);

    return {
      ...row,
      isExistingInDraft: isExisting,
      selected: !isExisting // En modo SKIP_EXISTING por defecto, las existentes inician desmarcadas
    };
  });

  const processedInvalidRows = invalidRows.map(r => ({
    ...r,
    isExistingInDraft: false,
    selected: false
  }));

  const finalRows = [...processedInvalidRows, ...processedValidRows].sort((a, b) => a.rowNumber - b.rowNumber);

  const validCount = processedValidRows.length;
  const newCount = processedValidRows.filter(r => !r.isExistingInDraft).length;
  const existingCount = processedValidRows.filter(r => r.isExistingInDraft).length;
  const consolidatedCount = processedValidRows.filter(r => r.status === "CONSOLIDATED").length;
  const invalidCount = processedInvalidRows.length;
  const warningCount = finalRows.filter(r => r.warnings.length > 0 && r.status !== "INVALID").length;
  const totalQuantity = processedValidRows.reduce((sum, r) => sum + r.quantity, 0);
  const totalValue = processedValidRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);

  return {
    fileName: file.name,
    sheetName,
    rows: finalRows,
    missingColumns: [],
    isInvalidFile: false,
    totalRawRows: parsedRows.length,
    validCount,
    newCount,
    existingCount,
    consolidatedCount,
    invalidCount,
    warningCount,
    totalQuantity,
    totalValue
  };
};

export const toInventoryItems = (rows: ImmunizationImportRow[]): ImmunizationInitialInventoryItem[] => {
  const mapped = rows.map(row => ({
    productId: row.productId!,
    codigoSismedSnapshot: row.codigoSismed,
    excelDescriptionSnapshot: row.excelDescription || undefined,
    lote: row.lote,
    expirationDate: row.expirationDate,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    fundingSource: row.fundingSource,
    supplyType: row.supplyType,
    observation: row.observation || undefined
  }));
  return consolidateItemsByCompositeKey(mapped);
};

export const downloadImmunizationInventoryTemplate = () => {
  const worksheet = XLSX.utils.json_to_sheet([{
    "Codigo SISMED": "",
    "Descripcion": "",
    "Lote": "",
    "Fecha de vencimiento": "",
    "Saldo fisico": "",
    "Precio unitario": "",
    "Fuente de financiamiento": "",
    "Tipo de suministro": "",
    "Observacion": ""
  }]);
  worksheet["!cols"] = [12, 38, 18, 20, 14, 16, 24, 22, 30].map(width => ({ wch: width }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario inicial");
  XLSX.writeFile(workbook, "Plantilla_Inventario_Inicial_Inmunizaciones.xlsx");
};

// ==========================================
// IMPORTACIÓN DEL CATÁLOGO BIOLÓGICO MAESTRO
// ==========================================

export interface ImmunizationProductImportRow {
  rowNumber: number;
  codigoSismed: string;
  descripcion: string;
  tipoProducto: string;
  dosisUnidad: number;
  isActive: boolean;
  observacion: string;
  status: "NEW" | "DUPLICATE_CODE" | "DUPLICATE_DESC" | "INVALID";
  duplicateTarget?: ImmunizationProduct;
  fileDuplicateRow?: number;
  errors: string[];
  warnings: string[];
  selected?: boolean;
}

export interface ImmunizationProductImportPreview {
  fileName: string;
  sheetName: string;
  rows: ImmunizationProductImportRow[];
  missingColumns: string[];
  isInvalidFile?: boolean;
  fileError?: string;
  totalRows: number;
  newCount: number;
  duplicateCodeCount: number;
  duplicateDescCount: number;
  invalidCount: number;
}

const CATALOG_COLUMN_ALIASES = {
  codigoSismed: ["codigo_sismed", "cod_sismed", "codigo sismed", "codigo", "cod", "medcod", "id_producto", "id producto"],
  descripcion: ["descripcion", "producto", "nombre", "denominacion", "biologicos", "medicamento", "insumo", "xnom", "descripcion_producto"],
  tipoProducto: ["tipo_producto", "tipo producto", "tipo", "clasificacion", "grupo", "categoria"],
  dosisUnidad: [
    "dosis/unidad",
    "dosis o unidad",
    "dosis/unidad (dosis o unidad)",
    "dosis_unidad",
    "dosis unidad",
    "dosis",
    "dosis por unidad",
    "dosis_por_unidad",
    "presentacion",
    "cant_dosis"
  ],
  isActive: ["estado", "is_active", "activo", "activa"],
  observacion: ["observacion", "observaciones", "nota", "comentario", "obs"]
} as const;

type CatalogColumnKey = keyof typeof CATALOG_COLUMN_ALIASES;

const CATALOG_REQUIRED_COLUMNS: Array<{ key: CatalogColumnKey; label: string }> = [
  { key: "codigoSismed", label: "Código SISMED" },
  { key: "descripcion", label: "Descripción" }
];

const normalizedCatalogAliases = Object.fromEntries(
  Object.entries(CATALOG_COLUMN_ALIASES).map(([key, aliases]) => [key, aliases.map(normalizeText)])
) as Record<CatalogColumnKey, string[]>;

const findCatalogHeader = (rows: unknown[][]) => {
  let best = { index: -1, columns: {} as Partial<Record<CatalogColumnKey, number>>, score: 0 };

  rows.slice(0, 30).forEach((row, rowIndex) => {
    const columns: Partial<Record<CatalogColumnKey, number>> = {};
    row.forEach((cell, columnIndex) => {
      const normalized = normalizeText(cell);
      if (!normalized) return;
      (Object.keys(normalizedCatalogAliases) as CatalogColumnKey[]).forEach(key => {
        if (columns[key] === undefined && normalizedCatalogAliases[key].includes(normalized)) {
          columns[key] = columnIndex;
        }
      });
    });
    // Puntuación: al menos código y descripción
    const hasCode = columns.codigoSismed !== undefined;
    const hasDesc = columns.descripcion !== undefined;
    const score = (hasCode ? 2 : 0) + (hasDesc ? 2 : 0) + (columns.tipoProducto !== undefined ? 1 : 0) + (columns.dosisUnidad !== undefined ? 1 : 0);
    if (score > best.score && hasCode && hasDesc) {
      best = { index: rowIndex, columns, score };
    }
  });

  return best;
};

const resolveProductType = (rawType: string, rawDesc: string, allowedTypes: Array<{ code: string; name: string }>): string => {
  const normType = normalizeText(rawType);
  const normDesc = normalizeText(rawDesc);

  if (normType) {
    const match = allowedTypes.find(t => normalizeText(t.code) === normType || normalizeText(t.name) === normType);
    if (match) return match.code;
    if (normType.includes("vacun")) return "VACUNA";
    if (normType.includes("jering") || normType.includes("aguja")) return "JERINGA";
    if (normType.includes("diluy")) return "DILUYENTE";
    if (normType.includes("insum")) return "INSUMO";
  }

  // Deducción por descripción si no vino columna de tipo
  if (normDesc.includes("vacun") || normDesc.includes("antigen") || normDesc.includes("toxoide") || normDesc.includes("bcg") || normDesc.includes("polio")) {
    return "VACUNA";
  }
  if (normDesc.includes("diluy")) {
    return "DILUYENTE";
  }
  if (normDesc.includes("jering") || normDesc.includes("aguja") || normDesc.includes("cateter")) {
    return "JERINGA";
  }
  if (normDesc.includes("cloruro") || normDesc.includes("agua") || normDesc.includes("algodon") || normDesc.includes("guante")) {
    return "INSUMO";
  }

  return allowedTypes.length > 0 ? allowedTypes[0].code : "VACUNA";
};

export const parseImmunizationCatalogExcel = async (
  file: File,
  existingProducts: ImmunizationProduct[],
  allowedTypes: Array<{ code: string; name: string }> = []
): Promise<ImmunizationProductImportPreview> => {
  // Validación 1: Extensión o tipo de archivo
  const lowerName = file.name.toLowerCase();
  const validExtensions = [".xlsx", ".xls", ".csv"];
  const hasValidExt = validExtensions.some(ext => lowerName.endsWith(ext));
  if (!hasValidExt) {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: [],
      isInvalidFile: true,
      fileError: "Formato no válido. Debe ser un archivo Excel (.xlsx, .xls) o .csv.",
      totalRows: 0,
      newCount: 0,
      duplicateCodeCount: 0,
      duplicateDescCount: 0,
      invalidCount: 0
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    const arrayBuf = await file.arrayBuffer();
    workbook = XLSX.read(arrayBuf, { type: "array", cellDates: false });
  } catch (err: any) {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: [],
      isInvalidFile: true,
      fileError: "El archivo está dañado o no se puede leer como hoja de cálculo.",
      totalRows: 0,
      newCount: 0,
      duplicateCodeCount: 0,
      duplicateDescCount: 0,
      invalidCount: 0
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      fileName: file.name,
      sheetName: "",
      rows: [],
      missingColumns: [],
      isInvalidFile: true,
      fileError: "El archivo no contiene ninguna hoja con datos.",
      totalRows: 0,
      newCount: 0,
      duplicateCodeCount: 0,
      duplicateDescCount: 0,
      invalidCount: 0
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });

  if (!rawRows || rawRows.length === 0) {
    return {
      fileName: file.name,
      sheetName,
      rows: [],
      missingColumns: [],
      isInvalidFile: true,
      fileError: "La hoja de cálculo está completamente vacía.",
      totalRows: 0,
      newCount: 0,
      duplicateCodeCount: 0,
      duplicateDescCount: 0,
      invalidCount: 0
    };
  }

  // Detectar cabeceras requeridas
  const header = findCatalogHeader(rawRows);
  const missingColumns = CATALOG_REQUIRED_COLUMNS
    .filter(item => header.columns[item.key] === undefined)
    .map(item => item.label);

  if (header.index < 0 || missingColumns.length > 0) {
    return {
      fileName: file.name,
      sheetName,
      rows: [],
      missingColumns: missingColumns.length > 0 ? missingColumns : ["Código SISMED", "Descripción"],
      isInvalidFile: true,
      fileError: `El archivo no tiene la estructura del catálogo. Faltan las columnas: ${missingColumns.join(", ")}. Asegúrese de incluir encabezados como 'Código SISMED' y 'Descripción'.`,
      totalRows: 0,
      newCount: 0,
      duplicateCodeCount: 0,
      duplicateDescCount: 0,
      invalidCount: 0
    };
  }

  // Mapas para detección rápida de duplicados en BD
  const dbCodeMap = new Map<string, ImmunizationProduct>();
  const dbDescMap = new Map<string, ImmunizationProduct>();

  for (const prod of existingProducts) {
    const normC = normalizeText(prod.codigoSismed).replace(/\s/g, "");
    const normD = normalizeText(prod.descripcion);
    if (normC) dbCodeMap.set(normC, prod);
    if (normD) dbDescMap.set(normD, prod);
  }

  // Mapas para detectar duplicados dentro del mismo archivo
  const fileCodeSet = new Map<string, number>();
  const fileDescSet = new Map<string, number>();

  const rows: ImmunizationProductImportRow[] = [];

  const dataRows = rawRows.slice(header.index + 1);

  dataRows.forEach((row, offset) => {
    const rowNumber = header.index + offset + 2;
    const values = Object.keys(header.columns).map(k => {
      const idx = header.columns[k as CatalogColumnKey];
      return idx === undefined ? "" : row[idx];
    });

    // Ignorar filas totalmente vacías
    if (values.every(v => String(v ?? "").trim() === "")) return;

    const getVal = (key: CatalogColumnKey) => {
      const idx = header.columns[key];
      return idx === undefined ? "" : String(row[idx] ?? "").trim();
    };

    const codigoSismed = getVal("codigoSismed");
    const descripcion = getVal("descripcion");
    const rawTipo = getVal("tipoProducto");
    const rawDosis = getVal("dosisUnidad");
    const rawActive = getVal("isActive");
    const observacion = getVal("observacion");

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar código
    if (!codigoSismed) {
      errors.push("Código SISMED ausente");
    }

    // Validar descripción
    if (!descripcion) {
      errors.push("Descripción de producto ausente");
    }

    const normCode = normalizeText(codigoSismed).replace(/\s/g, "");
    const normDesc = normalizeText(descripcion);

    // Resolver tipo y dosis
    const tipoProducto = resolveProductType(rawTipo, descripcion, allowedTypes);
    let dosisUnidad = parseNumber(rawDosis);
    if (dosisUnidad === null || dosisUnidad <= 0) {
      dosisUnidad = 1;
    }

    // Estado activo/inactivo
    let isActive = true;
    if (rawActive) {
      const normAct = normalizeText(rawActive);
      if (normAct.includes("inactiv") || normAct === "no" || normAct === "false" || normAct === "0") {
        isActive = false;
      }
    }

    let status: ImmunizationProductImportRow["status"] = "NEW";
    let duplicateTarget: ImmunizationProduct | undefined;
    let fileDuplicateRow: number | undefined;

    if (errors.length > 0) {
      status = "INVALID";
    } else {
      // 1. Revisar si ya existe en la base de datos por Código
      const existingByCode = dbCodeMap.get(normCode);
      // 2. Revisar si ya existe en la base de datos por Descripción
      const existingByDesc = dbDescMap.get(normDesc);

      // 3. Revisar si se repite en el mismo archivo
      const prevRowWithCode = fileCodeSet.get(normCode);
      const prevRowWithDesc = fileDescSet.get(normDesc);

      if (prevRowWithCode !== undefined) {
        status = "INVALID";
        fileDuplicateRow = prevRowWithCode;
        errors.push(`Código duplicado en el mismo archivo (ya apareció en la fila ${prevRowWithCode})`);
      } else if (prevRowWithDesc !== undefined) {
        status = "INVALID";
        fileDuplicateRow = prevRowWithDesc;
        errors.push(`Descripción duplicada en el mismo archivo (ya apareció en la fila ${prevRowWithDesc})`);
      } else if (existingByCode) {
        status = "DUPLICATE_CODE";
        duplicateTarget = existingByCode;
        warnings.push(`Código ya registrado en catálogo maestro: "${existingByCode.descripcion}"`);
      } else if (existingByDesc) {
        status = "DUPLICATE_DESC";
        duplicateTarget = existingByDesc;
        warnings.push(`Descripción ya registrada con código "${existingByDesc.codigoSismed}"`);
      }

      if (!fileDuplicateRow && normCode) fileCodeSet.set(normCode, rowNumber);
      if (!fileDuplicateRow && normDesc) fileDescSet.set(normDesc, rowNumber);
    }

    rows.push({
      rowNumber,
      codigoSismed,
      descripcion,
      tipoProducto,
      dosisUnidad,
      isActive,
      observacion,
      status,
      duplicateTarget,
      fileDuplicateRow,
      errors,
      warnings,
      selected: status === "NEW"
    });
  });

  const newCount = rows.filter(r => r.status === "NEW").length;
  const duplicateCodeCount = rows.filter(r => r.status === "DUPLICATE_CODE").length;
  const duplicateDescCount = rows.filter(r => r.status === "DUPLICATE_DESC").length;
  const invalidCount = rows.filter(r => r.status === "INVALID").length;

  return {
    fileName: file.name,
    sheetName,
    rows,
    missingColumns,
    isInvalidFile: false,
    totalRows: rows.length,
    newCount,
    duplicateCodeCount,
    duplicateDescCount,
    invalidCount
  };
};

export const downloadImmunizationCatalogTemplate = () => {
  // Plantilla limpia sin filas de ejemplo, lista para llenar
  const headers = [
    {
      "Codigo SISMED": "",
      "Descripcion": "",
      "Tipo Producto": "",
      "Dosis/Unidad (Dosis o Unidad)": "",
      "Estado": "",
      "Observacion": ""
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(headers);
  // Limpiar la fila vacía de datos dejando únicamente la fila 1 de encabezados
  XLSX.utils.sheet_add_json(worksheet, [], { skipHeader: true });

  worksheet["!cols"] = [
    { wch: 16 }, // Codigo SISMED
    { wch: 60 }, // Descripcion
    { wch: 20 }, // Tipo Producto (VACUNA, DILUYENTE, JERINGA, INSUMO)
    { wch: 30 }, // Dosis/Unidad (Dosis o Unidad)
    { wch: 14 }, // Estado (Activo / Inactivo)
    { wch: 35 }  // Observacion
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Catálogo Biológico");
  XLSX.writeFile(workbook, "Plantilla_Catalogo_Biologico_Inmunizaciones.xlsx");
};
