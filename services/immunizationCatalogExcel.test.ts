import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseImmunizationCatalogExcel } from "./immunizationExcelService";
import { ImmunizationProduct } from "../types";

const existingProducts: ImmunizationProduct[] = [
  {
    id: "p1",
    codigoSismed: "54003",
    descripcion: "VACUNA ANTITUBERCULOSA (BCG)",
    tipoProducto: "VACUNA",
    dosisUnidad: 20,
    isActive: true
  },
  {
    id: "p2",
    codigoSismed: "13024",
    descripcion: "DILUYENTE PARA VACUNA BCG",
    tipoProducto: "DILUYENTE",
    dosisUnidad: 1,
    isActive: true
  }
];

const productTypes = [
  { code: "VACUNA", name: "Vacuna", isActive: true },
  { code: "DILUYENTE", name: "Diluyente", isActive: true },
  { code: "JERINGA", name: "Jeringa", isActive: true },
  { code: "INSUMO", name: "Insumo", isActive: true }
];

const createExcelFile = (data: any[], fileName = "catalogo.xlsx"): File => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hoja1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return new File([wbout], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
};

describe("parseImmunizationCatalogExcel", () => {
  it("rechaza archivos con extensiones no válidas", async () => {
    const file = new File(["dummy text"], "catalogo.pdf", { type: "application/pdf" });
    const result = await parseImmunizationCatalogExcel(file, existingProducts, productTypes);

    expect(result.isInvalidFile).toBe(true);
    expect(result.fileError).toContain("Formato no válido");
  });

  it("rechaza archivos excel sin las columnas requeridas (Código SISMED y Descripción)", async () => {
    const file = createExcelFile([
      { "Columna Inventada": "123", "Otra": "ABC" }
    ]);
    const result = await parseImmunizationCatalogExcel(file, existingProducts, productTypes);

    expect(result.isInvalidFile).toBe(true);
    expect(result.fileError).toContain("El archivo no tiene la estructura");
  });

  it("detecta productos nuevos y duplicados por código o descripción", async () => {
    const file = createExcelFile([
      {
        "Codigo SISMED": "99901",
        "Descripcion": "VACUNA CONTRA LA FIEBRE AMARILLA",
        "Tipo Producto": "VACUNA",
        "Dosis por Unidad": 10
      },
      {
        "Codigo SISMED": "54003", // Duplicado de código existente
        "Descripcion": "VACUNA BCG NUEVO NOMBRE",
        "Tipo Producto": "VACUNA",
        "Dosis por Unidad": 20
      },
      {
        "Codigo SISMED": "99902",
        "Descripcion": "DILUYENTE PARA VACUNA BCG", // Duplicado de descripción existente
        "Tipo Producto": "DILUYENTE",
        "Dosis por Unidad": 1
      },
      {
        "Codigo SISMED": "", // Fila inválida
        "Descripcion": "PRODUCTO SIN CODIGO"
      }
    ]);

    const result = await parseImmunizationCatalogExcel(file, existingProducts, productTypes);

    expect(result.isInvalidFile).toBe(false);
    expect(result.totalRows).toBe(4);
    expect(result.newCount).toBe(1);
    expect(result.duplicateCodeCount).toBe(1);
    expect(result.duplicateDescCount).toBe(1);
    expect(result.invalidCount).toBe(1);

    expect(result.rows[0].status).toBe("NEW");
    expect(result.rows[0].codigoSismed).toBe("99901");

    expect(result.rows[1].status).toBe("DUPLICATE_CODE");
    expect(result.rows[1].duplicateTarget?.id).toBe("p1");

    expect(result.rows[2].status).toBe("DUPLICATE_DESC");
    expect(result.rows[2].duplicateTarget?.id).toBe("p2");

    expect(result.rows[3].status).toBe("INVALID");
    expect(result.rows[3].errors.length).toBeGreaterThan(0);
  });
});
