import * as XLSX from "xlsx";
import { ImmunizationInitialInventoryItem, ImmunizationProduct } from "../types";
import { consolidateItemsByCompositeKey, getItemUniqueCompositeKey } from "./immunizationDomain";

export interface ImmunizationImportRow {
  rowNumber: number;
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
  errors: string[];
  warnings: string[];
}

export interface ImmunizationImportPreview {
  fileName: string;
  sheetName: string;
  rows: ImmunizationImportRow[];
  missingColumns: string[];
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

const toIsoDate = (value: unknown): string | null => {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${String(parsed.y).padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoMatch = text.match(/^(\d{4})[-/]([01]?\d)[-/]([0-3]?\d)$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  const localMatch = text.match(/^([0-3]?\d)[-/]([01]?\d)[-/](\d{2}|\d{4})$/);
  if (localMatch) {
    const year = localMatch[3].length === 2 ? `20${localMatch[3]}` : localMatch[3];
    return `${year}-${localMatch[2].padStart(2, "0")}-${localMatch[1].padStart(2, "0")}`;
  }
  return null;
};

const cellValue = (row: unknown[], columns: Partial<Record<ColumnKey, number>>, key: ColumnKey) => {
  const index = columns[key];
  return index === undefined ? "" : row[index];
};

export const parseImmunizationInventoryExcel = async (
  file: File,
  products: ImmunizationProduct[]
): Promise<ImmunizationImportPreview> => {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("El archivo no contiene hojas.");
  const sheet = workbook.Sheets[sheetName];
  // raw:false conserva codigos formateados con ceros a la izquierda en el Excel.
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "", dateNF: "yyyy-mm-dd" });
  const header = findHeader(rawRows);
  const missingColumns = REQUIRED_COLUMNS
    .filter(item => header.columns[item.key] === undefined)
    .map(item => item.label);

  if (header.index < 0 || header.score === 0) {
    return { fileName: file.name, sheetName, rows: [], missingColumns: REQUIRED_COLUMNS.map(item => item.label) };
  }

  const catalog = new Map(products.map(product => [normalizeText(product.codigoSismed).replace(/\s/g, ""), product]));
  const rows = rawRows.slice(header.index + 1).flatMap((row, offset) => {
    const values = Object.keys(header.columns).map(key => cellValue(row, header.columns, key as ColumnKey));
    if (values.every(value => String(value ?? "").trim() === "")) return [];

    const codigoSismed = String(cellValue(row, header.columns, "codigoSismed") ?? "").trim();
    const excelDescription = String(cellValue(row, header.columns, "description") ?? "").trim();
    const lote = String(cellValue(row, header.columns, "lote") ?? "").trim();
    const expirationDate = toIsoDate(cellValue(row, header.columns, "expirationDate"));
    const quantity = parseNumber(cellValue(row, header.columns, "quantity"));
    const unitPrice = parseNumber(cellValue(row, header.columns, "unitPrice"));
    const fundingSource = String(cellValue(row, header.columns, "fundingSource") ?? "").trim();
    const supplyType = String(cellValue(row, header.columns, "supplyType") ?? "").trim();
    const observation = String(cellValue(row, header.columns, "observation") ?? "").trim();
    const product = catalog.get(normalizeText(codigoSismed).replace(/\s/g, ""));
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!codigoSismed) errors.push("Codigo SISMED vacio");
    else if (!product) errors.push("Codigo SISMED no existe en el catalogo");
    else if (!product.isActive) errors.push("Producto inactivo en el catalogo");
    else if (!product.id) errors.push("Producto sin identificador valido");
    if (!lote) errors.push("Lote vacio");
    if (!expirationDate) errors.push("Fecha de vencimiento invalida");
    if (quantity === null || quantity < 0) errors.push("Saldo fisico invalido");
    if (unitPrice === null || unitPrice < 0) errors.push("Precio unitario invalido");
    if (!fundingSource) errors.push("Fuente de financiamiento vacia");
    if (!supplyType) errors.push("Tipo de suministro vacio");
    if (product && excelDescription && normalizeText(excelDescription) !== normalizeText(product.descripcion)) {
      warnings.push("La descripcion difiere; se usara la del catalogo maestro");
    }

    return [{
      rowNumber: header.index + offset + 2,
      codigoSismed,
      excelDescription,
      officialDescription: product?.descripcion || "No encontrado",
      lote,
      expirationDate: expirationDate || "",
      quantity: quantity ?? 0,
      unitPrice: unitPrice ?? 0,
      fundingSource,
      supplyType,
      observation,
      productId: product?.id,
      errors,
      warnings
    } satisfies ImmunizationImportRow];
  });

  // Consolidar filas válidas duplicadas por clave única
  const invalidRows = rows.filter(r => r.errors.length > 0);
  const validRows = rows.filter(r => r.errors.length === 0);

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
      const mergedObs = [existing.observation, row.observation].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join("; ");
      const mergedWarnings = [...existing.warnings];
      if (!mergedWarnings.some(w => w.includes("consolidada"))) {
        mergedWarnings.push("Fila consolidada por duplicidad de producto/lote/precio/fuente/suministro");
      }
      consolidatedMap.set(key, {
        ...existing,
        quantity: existing.quantity + row.quantity,
        observation: mergedObs,
        warnings: mergedWarnings
      });
    } else {
      consolidatedMap.set(key, { ...row });
    }
  }

  const finalRows = [...invalidRows, ...Array.from(consolidatedMap.values())];

  return { fileName: file.name, sheetName, rows: finalRows, missingColumns };
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
