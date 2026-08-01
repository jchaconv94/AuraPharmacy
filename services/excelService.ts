import * as XLSX from 'xlsx';
import { AvailabilityRecord } from '../types';

export const parseAvailabilityExcel = async (file: File): Promise<AvailabilityRecord[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Use header: 1 to get array of arrays, then find the header row
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        
        if (jsonData.length === 0) {
          reject(new Error("El archivo está vacío"));
          return;
        }

        // Find header row (look for "COD EESS" or "ESTABLECIMIENTO")
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i] as any[];
          if (row.includes("COD EESS") || row.includes("ESTABLECIMIENTO")) {
            headerRowIndex = i;
            break;
          }
        }

        if (headerRowIndex === -1) {
          reject(new Error("No se encontró la fila de cabecera (buscando 'COD EESS' o 'ESTABLECIMIENTO')"));
          return;
        }

        const headers = jsonData[headerRowIndex] as string[];
        const rows = jsonData.slice(headerRowIndex + 1) as any[];

        const records: AvailabilityRecord[] = rows.map((row: any[]) => {
          const getVal = (key: string) => {
            const idx = headers.indexOf(key);
            return idx !== -1 ? row[idx] : undefined;
          };

          // Helper to clean strings
          const cleanStr = (val: any) => val ? String(val).trim() : '';
          // Helper to parse numbers
          const cleanNum = (val: any) => {
            if (typeof val === 'number') return val;
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
          };

          return {
            ue: cleanStr(getVal("UE")),
            red: cleanStr(getVal("RED")),
            microred: cleanStr(getVal("MICRORED")),
            codEess: cleanStr(getVal("COD EESS")),
            establishmentName: cleanStr(getVal("ESTABLECIMIENTO")),
            category: cleanStr(getVal("CAT")),
            medCode: cleanStr(getVal("MED COD")),
            medName: cleanStr(getVal("DESCRIPCION DEL PRODUCTO")),
            ff: cleanStr(getVal("F.F")),
            price: cleanNum(getVal("PRECIO")),
            type: cleanStr(getVal("TIPO")),
            pet: cleanStr(getVal("PET")),
            est: cleanStr(getVal("EST")),
            stock: cleanNum(getVal("STOCK")),
            cpa: cleanNum(getVal("CPA")),
            monthsProvision: cleanNum(getVal("MES PROV")),
            status: cleanStr(getVal("SITUACIÓN")),
            expiryDate: cleanStr(getVal("FECHA MAS PROX VENCIMIENTO"))
          };
        }).filter(r => r.codEess && r.medCode); // Filter empty rows

        resolve(records);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};
