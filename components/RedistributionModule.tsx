import React, { useState, useMemo } from 'react';
import { Upload, FileSpreadsheet, Search, ArrowRightLeft, Building2, Package, AlertCircle, FileDown, Download, X, Save, ArrowRight, Merge, CheckCircle2, Circle } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AvailabilityRecord, RedistributionItem } from '../types';
import { toast } from 'sonner';

interface RedistributionModuleProps {
  onBack?: () => void;
}

export const RedistributionModule: React.FC<RedistributionModuleProps> = ({ onBack }) => {
  const [records, setRecords] = useState<AvailabilityRecord[]>([]);
  const [selectedMicrored, setSelectedMicrored] = useState<string>('');
  const [selectedProductCode, setSelectedProductCode] = useState<string>('');
  const [selectedProductName, setSelectedProductName] = useState<string>('');
  
  // Raw data for the current view (before consolidation)
  const [baseRedistributionData, setBaseRedistributionData] = useState<RedistributionItem[]>([]);
  // The data actually displayed (after consolidation)
  const [redistributionData, setRedistributionData] = useState<RedistributionItem[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- CONSOLIDATION STATE ---
  const [isConsolidateModalOpen, setIsConsolidateModalOpen] = useState(false);
  const [consolidationSelection, setConsolidationSelection] = useState<Set<string>>(new Set()); // IDs of secondary pharmacies to consolidate

  // --- REVIEW STATE ---
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());

  // --- MODAL STATE ---
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState({
      originEess: '',
      destinationMicrored: '',
      destinationEess: '',
      quantity: 0
  });

  // --- 1. FILE UPLOAD ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        // Use header: "A" to get data with column letters (A, B, C...) as keys
        const rawData = XLSX.utils.sheet_to_json(ws, { header: "A" }) as Record<string, any>[];

        // 1. Find Header Row
        let headerRowIndex = -1;
        const colMap: Record<string, string> = {}; // Map Field Name -> Column Letter (e.g., "STOCK" -> "K")

        for (let i = 0; i < Math.min(20, rawData.length); i++) {
            const row = rawData[i];
            const values = Object.values(row).map(v => String(v).toUpperCase());
            
            if (values.includes("STOCK") && values.includes("CPA")) {
                headerRowIndex = i;
                // Build Column Map
                Object.entries(row).forEach(([key, val]) => {
                    const header = String(val).toUpperCase().trim();
                    colMap[header] = key;
                });
                break;
            }
        }

        if (headerRowIndex === -1) {
            throw new Error("No se encontró la fila de cabecera (debe contener STOCK y CPA).");
        }

        // 2. Process Data Rows (Start after header)
        const parsedRecords: AvailabilityRecord[] = [];
        const consumptionCols = ['O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            
            // Helper to get value by mapped column name
            const getVal = (headerPart: string) => {
                const key = Object.keys(colMap).find(k => k.includes(headerPart));
                return key ? row[colMap[key]] : undefined;
            };

            // Basic Validation: Must have Microred and Med Code
            const microred = getVal("MICRORED");
            const medCode = getVal("MED COD") || getVal("CODIGO") || getVal("COD");
            
            if (!microred || !medCode) continue;

            const stock = Number(getVal("STOCK") || 0);
            const cpa = Number(getVal("CPA") || 0);
            
            // Fix Months Provision
            let monthsProvision = Number(getVal("MES PROV") || getVal("MESES") || 0);
            if ((monthsProvision === 0 || isNaN(monthsProvision)) && cpa > 0) {
                monthsProvision = stock / cpa;
            }

            // 3. Calculate Consumption from Columns O-Z
            let consumptionSum = 0;
            let consumptionMonths = 0;
            const monthlyConsumption: number[] = [];

            consumptionCols.forEach(colKey => {
                const val = Number(row[colKey]);
                if (!isNaN(val)) {
                    consumptionSum += val;
                    if (val > 0) consumptionMonths++;
                    monthlyConsumption.push(val);
                } else {
                    monthlyConsumption.push(0);
                }
            });

            parsedRecords.push({
                ue: getVal("UE") || '',
                red: getVal("RED") || '',
                microred: microred,
                codEess: getVal("COD EESS") || getVal("COD. EESS") || '',
                establishmentName: getVal("ESTABLECIMIENTO") || getVal("EESS") || '',
                category: getVal("CAT") || '',
                medCode: medCode,
                medName: getVal("DESCRIPCION") || getVal("PRODUCTO") || '',
                ff: getVal("F.F") || '',
                price: Number(getVal("PRECIO") || 0),
                type: getVal("TIPO") || '',
                pet: getVal("PET") || '',
                est: getVal("EST") || '',
                stock: stock,
                cpa: cpa,
                monthsProvision: monthsProvision,
                status: getVal("SITUACIÓN") || getVal("SITUACION") || '',
                expiryDate: getVal("VENCIMIENTO") || getVal("VENC") || '',
                consumptionSum: consumptionSum,
                consumptionMonths: consumptionMonths,
                monthlyConsumption: monthlyConsumption
            });
        }

        setRecords(parsedRecords);
        setLoading(false);
      } catch (err: any) {
        console.error(err);
        setError("Error al procesar el archivo: " + err.message);
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // --- 2. FILTERS ---
  const microredOptions = useMemo(() => {
    const unique = new Set(records.map(r => r.microred));
    return Array.from(unique).sort();
  }, [records]);

  const productOptions = useMemo(() => {
    if (!selectedMicrored) return [];
    const filtered = records.filter(r => r.microred === selectedMicrored);
    // Unique products by code
    const uniqueProducts = new Map();
    filtered.forEach(r => {
      if (!uniqueProducts.has(r.medCode)) {
        uniqueProducts.set(r.medCode, r.medName);
      }
    });
    return Array.from(uniqueProducts.entries()).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [records, selectedMicrored]);

  // --- 3. REDISTRIBUTION LOGIC ---
  const handleMicroredChange = (microred: string) => {
    setSelectedMicrored(microred);
    setSelectedProductCode('');
    setSelectedProductName('');
    setBaseRedistributionData([]);
    setRedistributionData([]);
    setConsolidationSelection(new Set()); // Reset consolidation on microred change
  };

  const calculateNeed = (stock: number, cpa: number, status: string): number => {
      // Formula: =SI.ERROR(SI(O(((6-J3)*I3)<0;K3="Sin Rotación");"";(6-J3)*I3);"")
      // J3 = Meses Prov (stock/cpa), I3 = CPA, K3 = Situacion
      // Simplified: If (6 - MonthsProv) * CPA < 0 OR Status == "Sin Rotación" -> 0
      // Else -> (6 - MonthsProv) * CPA
      
      if (status === "Sin Rotación") return 0;
      
      const monthsProv = cpa > 0 ? stock / cpa : 0;
      const need = (6 - monthsProv) * cpa;
      
      return need < 0 ? 0 : Math.ceil(need);
  };

  const handleProductChange = (productCode: string) => {
    setSelectedProductCode(productCode);
    if (!productCode) {
      setRedistributionData([]);
      setSelectedProductName('');
      return;
    }

    // 1. Get ALL establishments for the selected Microred (from all records)
    const allEstablishmentsInMicrored: { cod: string, name: string }[] = Array.from(new Set(
        records
            .filter(r => r.microred === selectedMicrored)
            .map(r => JSON.stringify({ cod: r.codEess, name: r.establishmentName }))
    )).map(s => JSON.parse(s));

    // 2. Get existing records for the selected product
    const productRecords = records.filter(r => 
        r.microred === selectedMicrored && r.medCode === productCode
    );

    // 3. Merge: Create a row for EVERY establishment
    const initialData: RedistributionItem[] = allEstablishmentsInMicrored.map(eess => {
        // Find if this establishment has the product
        const r = productRecords.find(pr => pr.codEess === eess.cod);

        if (r) {
            // Existing Record Logic
            const need = calculateNeed(r.stock, r.cpa, r.status);
            let suggestedTransfer = 0;
            if (r.status === 'SobreStock' && r.monthsProvision > 6) {
                suggestedTransfer = Math.floor(r.stock - (6 * r.cpa));
            }

            return {
                codEess: r.codEess,
                establishmentName: r.establishmentName,
                stock: r.stock,
                cpa: r.cpa,
                monthsProvision: r.monthsProvision,
                status: r.status,
                transferQty: suggestedTransfer > 0 ? suggestedTransfer : 0,
                receivedQty: 0,
                need: need,
                consumptionSum: r.consumptionSum || 0,
                consumptionMonths: r.consumptionMonths || 0,
                monthlyConsumption: r.monthlyConsumption || Array(12).fill(0)
            };
        } else {
            // Missing Record (Zero values)
            return {
                codEess: eess.cod,
                establishmentName: eess.name,
                stock: 0,
                cpa: 0,
                monthsProvision: 0,
                status: 'Sin Stock', // Or empty string
                transferQty: 0,
                receivedQty: 0,
                need: 0,
                consumptionSum: 0,
                consumptionMonths: 0,
                monthlyConsumption: Array(12).fill(0)
            };
        }
    });

    // Sort by codEess to ensure F01 (Principal) is above F02, F03 (Secondary)
    initialData.sort((a, b) => a.codEess.localeCompare(b.codEess));

    setBaseRedistributionData(initialData);
    // Initially, redistributionData is same as base (no consolidation applied yet unless persisted)
    // We trigger consolidation update via effect or direct call. For now direct:
    updateConsolidatedData(initialData, consolidationSelection);
  };

  // Helper to apply consolidation
  const updateConsolidatedData = (data: RedistributionItem[], selection: Set<string>) => {
      if (selection.size === 0) {
          setRedistributionData(data);
          return;
      }

      const consolidatedMap = new Map<string, RedistributionItem>();
      const processedSecondaries = new Set<string>();

      // Deep copy to avoid mutating base
      const workingData = data.map(item => ({...item}));

      workingData.forEach(item => {
          // Check if this item is a secondary pharmacy selected for consolidation
          if (selection.has(item.codEess)) {
              // Find its principal (Base Code + F01)
              // Assuming format XXXXXFyy -> Base is XXXXX
              const baseCode = item.codEess.substring(0, 5); 
              const principalCode = baseCode + 'F01';
              
              // If the principal exists in our data
              const principalItem = workingData.find(p => p.codEess === principalCode);
              
              if (principalItem) {
                  // Mark as processed so we don't add it to the final list as a standalone row
                  processedSecondaries.add(item.codEess);
                  
                  // Merge into Principal
                  // Note: We are mutating principalItem inside workingData array, which is fine as it's a copy
                  principalItem.stock += item.stock;
                  
                  // Recalculate Consumption from Monthly Data
                  if (principalItem.monthlyConsumption && item.monthlyConsumption) {
                      // Sum monthly vectors
                      for (let i = 0; i < 12; i++) {
                          principalItem.monthlyConsumption[i] = (principalItem.monthlyConsumption[i] || 0) + (item.monthlyConsumption[i] || 0);
                      }
                      
                      // Recalculate Sum and Months from new vector
                      principalItem.consumptionSum = principalItem.monthlyConsumption.reduce((a, b) => a + b, 0);
                      principalItem.consumptionMonths = principalItem.monthlyConsumption.filter(v => v > 0).length;
                      
                      // Recalculate CPA
                      // CPA = Total Consumption / Months with Consumption (if > 0)
                      if (principalItem.consumptionMonths > 0) {
                          principalItem.cpa = principalItem.consumptionSum / principalItem.consumptionMonths;
                      } else {
                          principalItem.cpa = 0;
                      }
                  } else {
                      // Fallback if no monthly data (shouldn't happen with new parsing)
                      principalItem.cpa += item.cpa;
                      principalItem.consumptionSum = (principalItem.consumptionSum || 0) + (item.consumptionSum || 0);
                      principalItem.consumptionMonths = Math.max(principalItem.consumptionMonths || 0, item.consumptionMonths || 0);
                  }
                  
                  // Recalculate derived fields for Principal
                  if (principalItem.cpa > 0) {
                      principalItem.monthsProvision = principalItem.stock / principalItem.cpa;
                  } else {
                      principalItem.monthsProvision = principalItem.stock > 0 ? 999 : 0;
                  }
                  
                  // Recalculate Status
                  if (principalItem.stock === 0) principalItem.status = 'Desabastecido';
                  else if (principalItem.monthsProvision < 2) principalItem.status = 'SubStock';
                  else if (principalItem.monthsProvision > 6) principalItem.status = 'SobreStock';
                  else principalItem.status = 'NormoStock';
                  
                  // Recalculate Need
                  principalItem.need = calculateNeed(principalItem.stock, principalItem.cpa, principalItem.status);

                  // Mark visually as consolidated
                  principalItem.isConsolidated = true;
              }
          }
      });

      // Filter out consolidated secondaries
      const finalData = workingData.filter(item => !processedSecondaries.has(item.codEess));
      setRedistributionData(finalData);
  };

  const handleTransferChange = (codEess: string, field: 'transferQty' | 'receivedQty', value: string) => {
    const numValue = parseFloat(value) || 0;
    
    // Update BOTH base and visible data to keep them in sync for exports/logic
    // This is tricky. If we update visible, we must update base.
    // Simpler: Update base, then re-apply consolidation.
    
    const newBase = baseRedistributionData.map(item => {
      if (item.codEess === codEess) {
        return { ...item, [field]: numValue };
      }
      return item;
    });
    
    setBaseRedistributionData(newBase);
    updateConsolidatedData(newBase, consolidationSelection);
  };

  // --- CONSOLIDATION HANDLERS ---
  const handleOpenConsolidateModal = () => {
      if (baseRedistributionData.length === 0) {
          toast.error("No hay datos para consolidar.");
          return;
      }
      setIsConsolidateModalOpen(true);
  };

  const toggleConsolidation = (codEess: string) => {
      setConsolidationSelection(prev => {
          const next = new Set(prev);
          if (next.has(codEess)) {
              next.delete(codEess);
          } else {
              next.add(codEess);
          }
          return next;
      });
  };

  const toggleGroupConsolidation = (secondaries: RedistributionItem[]) => {
      setConsolidationSelection(prev => {
          const next = new Set(prev);
          const allSelected = secondaries.every(s => prev.has(s.codEess));
          
          if (allSelected) {
              secondaries.forEach(s => next.delete(s.codEess));
          } else {
              secondaries.forEach(s => next.add(s.codEess));
          }
          return next;
      });
  };

  const applyConsolidationSelection = () => {
      updateConsolidatedData(baseRedistributionData, consolidationSelection);
      setIsConsolidateModalOpen(false);
      toast.success("Vista actualizada");
  };

  const toggleProductReview = (productCode: string) => {
      setReviewedProducts(prev => {
          const next = new Set(prev);
          if (next.has(productCode)) {
              next.delete(productCode);
          } else {
              next.add(productCode);
          }
          return next;
      });
  };

  // --- 4. TRANSFER LOGIC ---
  const handleOpenTransferModal = () => {
      if (!selectedMicrored || !selectedProductCode) {
          toast.error("Seleccione una Microred y un Producto primero.");
          return;
      }
      setTransferForm({
          originEess: '',
          destinationMicrored: selectedMicrored, // Default to current
          destinationEess: '',
          quantity: 0
      });
      setIsTransferModalOpen(true);
  };

  const handleSaveTransfer = () => {
      const { originEess, destinationMicrored, destinationEess, quantity } = transferForm;

      if (!originEess || !destinationEess || quantity <= 0) {
          toast.error("Complete todos los campos correctamente.");
          return;
      }

      if (originEess === destinationEess) {
          toast.error("El origen y destino no pueden ser el mismo.");
          return;
      }

      // Update Redistribution Data
      // We update BASE data, then re-consolidate
      const newBase = baseRedistributionData.map(item => {
          // 1. Subtract from Origin
          if (item.codEess === originEess) {
              return { ...item, transferQty: (item.transferQty || 0) + quantity };
          }
          // 2. Add to Destination
          if (item.codEess === destinationEess && destinationMicrored === selectedMicrored) {
              return { ...item, receivedQty: (item.receivedQty || 0) + quantity };
          }
          return item;
      });

      setBaseRedistributionData(newBase);
      updateConsolidatedData(newBase, consolidationSelection);

      toast.success("Transferencia registrada");
      setIsTransferModalOpen(false);
  };

  // --- 5. EXPORT FUNCTIONS ---
  const exportToExcel = () => {
    if (redistributionData.length === 0) return;

    const exportData = redistributionData.map(item => {
        const newStock = item.stock - item.transferQty + item.receivedQty;
        const newMonths = item.cpa > 0 ? (newStock / item.cpa) : (newStock > 0 ? 999 : 0);
        return {
            'COD': item.codEess,
            'Establecimiento': item.establishmentName + (item.isConsolidated ? ' (CONSOLIDADO)' : ''),
            'Stock Actual': item.stock,
            'CPA': item.cpa.toFixed(1),
            'Meses Prov.': item.monthsProvision.toFixed(1),
            'Situación': item.status,
            'Suma Consumo': item.consumptionSum || 0,
            'Meses Consumo': item.consumptionMonths || 0,
            'Necesidad (Estimada)': item.need || 0,
            'Transferido (Sale)': item.transferQty,
            'Recibido (Entra)': item.receivedQty,
            'Nuevo Stock': newStock,
            'Nuevo Meses Prov.': newMonths === 999 ? '∞' : newMonths.toFixed(1)
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Redistribución");
    XLSX.writeFile(wb, `Redistribucion_${selectedMicrored}_${selectedProductCode}.xlsx`);
  };

  const exportToPDF = () => {
    if (redistributionData.length === 0) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(16);
    doc.text(`Reporte de Redistribución - ${selectedMicrored}`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Producto: ${selectedProductCode} - ${selectedProductName}`, 14, 22);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData = redistributionData.map(item => {
        const newStock = item.stock - item.transferQty + item.receivedQty;
        const newMonths = item.cpa > 0 ? (newStock / item.cpa) : (newStock > 0 ? 999 : 0);
        return [
            item.codEess,
            item.establishmentName + (item.isConsolidated ? ' (C)' : ''),
            item.stock,
            item.cpa.toFixed(1),
            item.monthsProvision.toFixed(1),
            item.status,
            item.consumptionSum || 0,
            item.consumptionMonths || 0,
            item.need || 0,
            item.transferQty,
            item.receivedQty,
            newStock,
            newMonths === 999 ? '∞' : newMonths.toFixed(1)
        ];
    });

    autoTable(doc, {
        startY: 35,
        head: [['COD', 'EESS', 'Stock', 'CPA', 'Meses', 'Sit.', 'S. Cons', 'M. Cons', 'Nec.', 'Sale', 'Entra', 'N. Stock', 'N. Meses']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [13, 148, 136] }, // Teal color
        styles: { fontSize: 7, cellPadding: 1 }, // Smaller font for more columns
        columnStyles: {
            0: { cellWidth: 15 }, // COD
            1: { cellWidth: 35 }, // EESS Name
            5: { cellWidth: 15 }, // Status
        }
    });

    doc.save(`Redistribucion_${selectedMicrored}_${selectedProductCode}.pdf`);
  };

  // --- RENDER ---
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="h-6 w-6 text-teal-600" />
                Módulo de Redistribución
            </h2>
            <p className="text-gray-500 text-sm mt-1">
                Gestión de transferencias entre establecimientos por Microred
            </p>
        </div>
      </div>

      {/* UPLOAD SECTION */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-4">
            <div className="bg-green-50 p-3 rounded-full">
                <FileSpreadsheet className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cargar Archivo de Disponibilidad (Excel)
                </label>
                <input 
                    type="file" 
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 transition-colors"
                />
            </div>
            {records.length > 0 && (
                <div className="text-right">
                    <span className="text-2xl font-bold text-teal-600">{records.length.toLocaleString()}</span>
                    <p className="text-xs text-gray-500 uppercase font-bold">Registros Cargados</p>
                </div>
            )}
        </div>
        {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {error}
            </div>
        )}
      </div>

      {records.length > 0 && (
        <div className="space-y-6">
            {/* MICRORED SELECTOR */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    Seleccionar Microred
                </label>
                <select 
                    value={selectedMicrored}
                    onChange={(e) => handleMicroredChange(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                >
                    <option value="">-- Seleccione --</option>
                    {microredOptions.map(mr => (
                        <option key={mr} value={mr}>{mr}</option>
                    ))}
                </select>
            </div>

            {/* PRODUCT REVIEW TABLE (REPLACES DROPDOWN) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[350px]">
                <div className="p-3 border-b border-gray-200 bg-gray-50 font-bold text-sm text-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-indigo-600" />
                        Lista de Productos ({productOptions.length})
                    </div>
                    <div className="text-xs text-gray-500 font-normal">
                        {reviewedProducts.size} revisados
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-0">
                    {productOptions.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm italic p-4">
                            Seleccione una Microred para ver los productos
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold text-xs sticky top-0 z-10">
                                <tr>
                                    <th className="p-2 border-b w-10 text-center">Rev.</th>
                                    <th className="p-2 border-b w-20">Código</th>
                                    <th className="p-2 border-b">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {productOptions.map((prod) => {
                                    const isSelected = selectedProductCode === prod.code;
                                    const isReviewed = reviewedProducts.has(prod.code);
                                    return (
                                        <tr 
                                            key={prod.code} 
                                            className={`
                                                cursor-pointer transition-colors hover:bg-indigo-50
                                                ${isSelected ? 'bg-indigo-100' : ''}
                                            `}
                                            onClick={() => handleProductChange(prod.code)}
                                        >
                                            <td className="p-2 text-center" onClick={(e) => { e.stopPropagation(); toggleProductReview(prod.code); }}>
                                                {isReviewed ? (
                                                    <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                                                ) : (
                                                    <Circle className="h-5 w-5 text-gray-300 mx-auto hover:text-gray-400" />
                                                )}
                                            </td>
                                            <td className="p-2 font-mono text-xs font-bold text-gray-600">{prod.code}</td>
                                            <td className="p-2 text-xs text-gray-800">{prod.name}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* REDISTRIBUTION TABLE */}
      {redistributionData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Matriz de Redistribución</h3>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleOpenConsolidateModal}
                        className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
                    >
                        <Merge className="h-4 w-4" />
                        Consolidar Farmacias
                    </button>
                    <button
                        onClick={handleOpenTransferModal}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <ArrowRightLeft className="h-4 w-4" />
                        Registrar Transferencia
                    </button>
                    <button 
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                    >
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel
                    </button>
                    <button 
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors"
                    >
                        <FileDown className="h-4 w-4" />
                        PDF
                    </button>
                    <div className="text-sm text-gray-500 ml-2">
                        {redistributionData.length} Establecimientos
                    </div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs">
                        <tr>
                            <th className="p-3 border-b text-left">COD</th>
                            <th className="p-3 border-b text-left">Establecimiento</th>
                            <th className="p-3 border-b text-center">Stock</th>
                            <th className="p-3 border-b text-center">CPA</th>
                            <th className="p-3 border-b text-center">Meses</th>
                            <th className="p-3 border-b text-center">Situación</th>
                            <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Suma Cons.</th>
                            <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Meses Cons.</th>
                            <th className="p-3 border-b text-center bg-gray-200 text-gray-800">Necesidad</th>
                            <th className="p-3 border-b text-center bg-yellow-50 text-yellow-800 border-l border-yellow-200">Sale</th>
                            <th className="p-3 border-b text-center bg-green-50 text-green-800 border-l border-green-200">Entra</th>
                            <th className="p-3 border-b text-center bg-blue-50 text-blue-800 border-l border-blue-200">N. Stock</th>
                            <th className="p-3 border-b text-center bg-blue-50 text-blue-800">N. Meses</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {redistributionData.map((item) => {
                            const newStock = item.stock - item.transferQty + item.receivedQty;
                            const newMonths = item.cpa > 0 ? (newStock / item.cpa) : (newStock > 0 ? 999 : 0);
                            
                            // Status Color Logic
                            let statusColor = "bg-gray-100 text-gray-600";
                            if (item.status === "NormoStock") statusColor = "bg-green-100 text-green-800";
                            if (item.status === "SobreStock") statusColor = "bg-indigo-100 text-indigo-800";
                            if (item.status === "SubStock") statusColor = "bg-orange-100 text-orange-800";
                            if (item.status === "Desabastecido") statusColor = "bg-red-100 text-red-800";

                            // Indentation Logic for Secondary Pharmacies (e.g., F02, F03...)
                            // Check if code ends with Fxx where xx > 01
                            const isSecondary = /F\d{2}$/.test(item.codEess) && !item.codEess.endsWith('F01');

                            return (
                                <tr key={item.codEess} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 font-mono text-xs text-gray-500 font-bold">
                                        {item.codEess}
                                    </td>
                                    <td className={`p-3 font-medium text-gray-900 max-w-[200px] truncate ${isSecondary ? 'pl-8 text-gray-600 italic' : ''}`} title={item.establishmentName}>
                                        <div className="flex items-center gap-2">
                                            <span className="truncate">{item.establishmentName}</span>
                                            {item.isConsolidated && (
                                                <div className="shrink-0 bg-amber-100 text-amber-700 p-1 rounded border border-amber-200" title="Farmacia Consolidada">
                                                    <Merge className="h-3 w-3" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono">{item.stock}</td>
                                    <td className="p-3 text-center font-mono">{item.cpa.toFixed(1)}</td>
                                    <td className="p-3 text-center font-mono font-bold">{item.monthsProvision.toFixed(1)}</td>
                                    <td className="p-3 text-center">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                            {item.status}
                                        </span>
                                    </td>
                                    
                                    {/* CONSUMPTION DATA */}
                                    <td className="p-3 text-center font-mono text-xs text-gray-500 bg-gray-50">
                                        {item.consumptionSum || 0}
                                    </td>
                                    <td className="p-3 text-center font-mono text-xs text-gray-500 bg-gray-50">
                                        {item.consumptionMonths || 0}
                                    </td>

                                    {/* NECESIDAD */}
                                    <td className="p-3 text-center font-mono font-bold text-gray-700 bg-gray-50">
                                        {item.need ? item.need.toFixed(0) : '-'}
                                    </td>

                                    {/* INPUTS */}
                                    <td className="p-2 text-center border-l border-gray-200 bg-yellow-50/30">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={item.transferQty || ''}
                                            onChange={(e) => handleTransferChange(item.codEess, 'transferQty', e.target.value)}
                                            className="w-16 p-1 text-center border border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500 outline-none bg-white font-bold text-yellow-900"
                                            placeholder="0"
                                        />
                                    </td>
                                    <td className="p-2 text-center border-l border-gray-200 bg-green-50/30">
                                        <input 
                                            type="number" 
                                            min="0"
                                            value={item.receivedQty || ''}
                                            onChange={(e) => handleTransferChange(item.codEess, 'receivedQty', e.target.value)}
                                            className="w-16 p-1 text-center border border-green-300 rounded focus:ring-2 focus:ring-green-500 outline-none bg-white font-bold text-green-900"
                                            placeholder="0"
                                        />
                                    </td>

                                    {/* CALCULATED */}
                                    <td className="p-3 text-center font-mono font-bold text-blue-900 bg-blue-50/30 border-l border-blue-100">
                                        {newStock}
                                    </td>
                                    <td className="p-3 text-center font-mono font-bold text-blue-900 bg-blue-50/30">
                                        {newMonths === 999 ? '∞' : newMonths.toFixed(1)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* CONSOLIDATION MODAL */}
      {isConsolidateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[80vh]">
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2">
                          <Merge className="h-5 w-5 text-amber-400" />
                          <h3 className="font-bold text-lg">CONSOLIDAR FARMACIAS</h3>
                      </div>
                      <button onClick={() => setIsConsolidateModalOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto">
                      <p className="text-sm text-gray-600 mb-4">
                          Seleccione las farmacias secundarias que desea unificar con su farmacia principal. 
                          Los stocks y consumos se sumarán a la principal.
                      </p>
                      
                      <div className="space-y-6">
                          {/* Group by Base Code */}
                          {Object.entries(
                              baseRedistributionData.reduce((acc, item) => {
                                  const baseCode = item.codEess.substring(0, 5);
                                  if (!acc[baseCode]) acc[baseCode] = [];
                                  acc[baseCode].push(item);
                                  return acc;
                              }, {} as Record<string, RedistributionItem[]>)
                          ).filter(([_, group]) => group.length > 1).map(([baseCode, group]) => {
                              const principal = group.find(i => i.codEess.endsWith('F01')) || group[0];
                              const secondaries = group.filter(i => i !== principal);
                              
                              if (secondaries.length === 0) return null;

                              return (
                                  <div key={baseCode} className="border border-gray-200 rounded-lg overflow-hidden">
                                      <div className="bg-gray-100 p-3 font-bold text-sm text-gray-800 flex justify-between items-center">
                                          <label className="flex items-center gap-3 cursor-pointer select-none">
                                              <input 
                                                  type="checkbox"
                                                  checked={secondaries.length > 0 && secondaries.every(s => consolidationSelection.has(s.codEess))}
                                                  onChange={() => toggleGroupConsolidation(secondaries)}
                                                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                              />
                                              <span>Principal: {principal.establishmentName}</span>
                                          </label>
                                          <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">{principal.codEess}</span>
                                      </div>
                                      <div className="divide-y divide-gray-100">
                                          {secondaries.map(sec => (
                                              <label key={sec.codEess} className="flex items-center gap-3 p-3 hover:bg-amber-50 cursor-pointer transition-colors">
                                                  <input 
                                                      type="checkbox"
                                                      checked={consolidationSelection.has(sec.codEess)}
                                                      onChange={() => toggleConsolidation(sec.codEess)}
                                                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                  />
                                                  <div className="flex-1">
                                                      <div className="text-sm font-medium text-gray-700">{sec.establishmentName}</div>
                                                      <div className="text-xs text-gray-400 font-mono">{sec.codEess}</div>
                                                  </div>
                                                  <div className="text-xs text-gray-500">
                                                      Stock: {sec.stock} | CPA: {sec.cpa.toFixed(1)}
                                                  </div>
                                              </label>
                                          ))}
                                      </div>
                                  </div>
                              );
                          })}
                          
                          {/* Empty State if no groups found */}
                          {Object.values(baseRedistributionData.reduce((acc, item) => {
                                  const baseCode = item.codEess.substring(0, 5);
                                  if (!acc[baseCode]) acc[baseCode] = [];
                                  acc[baseCode].push(item);
                                  return acc;
                              }, {} as Record<string, RedistributionItem[]>)).every(g => g.length <= 1) && (
                                  <div className="text-center py-8 text-gray-400 italic">
                                      No se encontraron establecimientos con múltiples farmacias en esta vista.
                                  </div>
                              )
                          }
                      </div>
                  </div>

                  <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-200 shrink-0">
                      <button onClick={() => setIsConsolidateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancelar</button>
                      <button onClick={applyConsolidationSelection} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm">Aplicar Consolidación</button>
                  </div>
              </div>
          </div>
      )}

      {/* TRANSFER MODAL */}
      {isTransferModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200">
                  {/* Modal Header */}
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-teal-400" />
                          <h3 className="font-bold text-lg">REGISTRAR REDISTRIBUCIÓN</h3>
                      </div>
                      <button 
                          onClick={() => setIsTransferModalOpen(false)}
                          className="text-gray-400 hover:text-white transition-colors"
                      >
                          <X className="h-5 w-5" />
                      </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 space-y-6">
                      
                      {/* Product Info */}
                      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Producto a Transferir</label>
                          <div className="flex items-center gap-3">
                              <span className="bg-teal-100 text-teal-800 px-2 py-1 rounded text-xs font-mono font-bold">{selectedProductCode}</span>
                              <span className="font-medium text-gray-900">{selectedProductName}</span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* ORIGIN SECTION */}
                          <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">
                                  <ArrowRightLeft className="h-4 w-4 text-red-500" />
                                  REDISTRIBUCIÓN EN LA MR {selectedMicrored}
                              </div>
                              
                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">EESS ORIGEN</label>
                                  <select 
                                      value={transferForm.originEess}
                                      onChange={(e) => setTransferForm({...transferForm, originEess: e.target.value})}
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                  >
                                      <option value="">-- Seleccione Origen --</option>
                                      {redistributionData
                                          .filter(item => item.stock > 0) // Only show items with stock
                                          .map(item => (
                                              <option key={item.codEess} value={item.codEess}>
                                                  {item.establishmentName} (Stock: {item.stock})
                                              </option>
                                          ))
                                      }
                                  </select>
                              </div>

                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">CANTIDAD</label>
                                  <input 
                                      type="number"
                                      min="1"
                                      value={transferForm.quantity || ''}
                                      onChange={(e) => setTransferForm({...transferForm, quantity: parseInt(e.target.value) || 0})}
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none font-bold"
                                      placeholder="0"
                                  />
                              </div>
                          </div>

                          {/* DESTINATION SECTION */}
                          <div className="space-y-4">
                              <div className="flex items-center gap-2 text-sm font-bold text-gray-700 border-b border-gray-200 pb-2">
                                  <ArrowRight className="h-4 w-4 text-green-500" />
                                  DESTINO
                              </div>

                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">MICRORED</label>
                                  <select 
                                      value={transferForm.destinationMicrored}
                                      onChange={(e) => setTransferForm({...transferForm, destinationMicrored: e.target.value, destinationEess: ''})}
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                  >
                                      <option value="">-- Seleccione Microred --</option>
                                      {microredOptions.map(mr => (
                                          <option key={mr} value={mr}>{mr}</option>
                                      ))}
                                  </select>
                              </div>

                              <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">EESS DESTINO</label>
                                  <select 
                                      value={transferForm.destinationEess}
                                      onChange={(e) => setTransferForm({...transferForm, destinationEess: e.target.value})}
                                      disabled={!transferForm.destinationMicrored}
                                      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-gray-100"
                                  >
                                      <option value="">-- Seleccione Destino --</option>
                                      {/* Filter records by selected Destination Microred and Product Code to get valid destinations */}
                                      {records
                                          .filter(r => r.microred === transferForm.destinationMicrored && r.medCode === selectedProductCode)
                                          .map(r => (
                                              <option key={r.codEess} value={r.codEess}>
                                                  {r.establishmentName}
                                              </option>
                                          ))
                                      }
                                  </select>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-200">
                      <button 
                          onClick={() => setIsTransferModalOpen(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleSaveTransfer}
                          className="px-4 py-2 text-sm font-bold text-white bg-gray-900 hover:bg-black rounded-lg transition-colors flex items-center gap-2"
                      >
                          <Save className="h-4 w-4" />
                          GUARDAR
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
