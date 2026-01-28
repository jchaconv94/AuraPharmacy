
import React, { useState, useRef } from 'react';
import { Trash2, Activity, Upload, FileSpreadsheet, Calendar, Check, AlertCircle, AlertTriangle, X, Syringe, Settings2, Play, RefreshCw } from 'lucide-react';
import { read, utils } from 'xlsx';
import { MedicationInput } from '../types';

interface InputSectionProps {
  onAnalyze: (data: MedicationInput[], referenceDate: string, excludeVaccines: boolean) => void;
  onReset: () => void;
  isAnalyzing: boolean;
  hasAnalyzedData: boolean; // Prop to know if there is active data
}

// Sample data with spikes for demonstration
const SAMPLE_DATA: MedicationInput[] = [
  {
    id: '00143',
    name: 'Paracetamol 500mg (Con Pico Anormal)',
    currentStock: 1000,
    unitPrice: 0.10,
    monthlyConsumption: [450, 480, 460, 2000, 460, 450, 455, 460, 470, 480, 450, 460],
    ff: 'TABLETA',
    medtip: 'MED',
    medpet: '01',
    medest: 'S',
  },
  {
    id: '02312',
    name: 'Amoxicilina 500mg (Estable)',
    currentStock: 0,
    unitPrice: 0.50,
    monthlyConsumption: [200, 210, 190, 220, 200, 205, 195, 200, 210, 190, 200, 210],
    ff: 'TABLETA',
    medtip: 'MED',
    medpet: '01',
    medest: 'N',
  },
  {
    id: '05432',
    name: 'Ibuprofeno 400mg (Varios Picos)',
    currentStock: 150, 
    unitPrice: 0.20,
    monthlyConsumption: [100, 500, 110, 105, 500, 110, 100, 105, 110, 115, 120, 110],
    ff: 'TABLETA',
    medtip: 'MED',
    medpet: '01',
    medest: 'S',
  }
];

export const InputSection: React.FC<InputSectionProps> = ({ onAnalyze, onReset, isAnalyzing, hasAnalyzedData }) => {
  const [items, setItems] = useState<MedicationInput[]>([]);
  const [tempItems, setTempItems] = useState<MedicationInput[]>([]); // Store items temporarily while asking for date
  
  // Modal State
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isVaccineModalOpen, setIsVaccineModalOpen] = useState(false); // NEW: Vaccine Check
  const [excludeVaccinesSelection, setExcludeVaccinesSelection] = useState(true); // Default selection
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false); 
  const [showReanalysisWarning, setShowReanalysisWarning] = useState(false);

  // Default to CURRENT month
  const [referenceDate, setReferenceDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().slice(0, 7);
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processData = (parsedItems: MedicationInput[]) => {
      onReset(); // Clear previous analysis when new data is processed
      setTempItems(parsedItems);
      setIsDateModalOpen(true); // Open modal immediately after parsing
  };

  const loadSampleData = () => {
    processData(SAMPLE_DATA);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data, { type: 'array' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        alert("El archivo no contiene hojas válidas.");
        return;
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      const jsonData = utils.sheet_to_json<any>(worksheet);
      const rawData = utils.sheet_to_json<any>(worksheet, { header: "A" });

      const parsedItems: MedicationInput[] = jsonData.map((row: any, index: number): MedicationInput | null => {
        const findKey = (keys: string[]) => Object.keys(row).find(k => keys.some(key => k.toLowerCase().includes(key.toLowerCase())));
        const findExactKey = (keys: string[]) => Object.keys(row).find(k => keys.some(key => k.toLowerCase() === key.toLowerCase()));

        const nameKey = findKey(['descrip', 'medicamento', 'nombre']);
        const stockKey = findExactKey(['stock', 'stock_actual', 'stk']);
        const priceKey = findKey(['precio', 'costo', 'unit']);
        const codeKey = findKey(['codigo', 'cod']);
        const ffKey = findKey(['ff', 'forma', 'presentacion', 'farmaceutica']);
        const tipKey = findKey(['tip', 'tipo', 'medtip']);
        const petKey = findKey(['pet', 'petitorio', 'medpet']);
        
        let estValue = undefined;
        // Safe access for rawData lookahead
        if (rawData && rawData[index + 1] && rawData[index + 1]['AH']) {
            estValue = rawData[index + 1]['AH'];
        } 
        if (!estValue) {
            const estKey = findKey(['estrategico', 'medest', 'situacion', 'condicion']);
            if (estKey) estValue = row[estKey];
        }

        const name = nameKey ? row[nameKey] : `Item ${index + 1}`;
        const stock = stockKey ? Number(row[stockKey]) : 0;
        const price = priceKey ? Number(row[priceKey]) : 0;
        const code = codeKey ? String(row[codeKey]) : (Date.now() + index).toString();
        
        const months: number[] = [];
        const monthNames = [
            ['enero', 'ene', 'mes01', 'mes1'], ['febrero', 'feb', 'mes02', 'mes2'], ['marzo', 'mar', 'mes03', 'mes3'],
            ['abril', 'abr', 'mes04', 'mes4'], ['mayo', 'may', 'mes05', 'mes5'], ['junio', 'jun', 'mes06', 'mes6'],
            ['julio', 'jul', 'mes07', 'mes7'], ['agosto', 'ago', 'mes08', 'mes8'], ['setiembre', 'septiembre', 'set', 'sep', 'mes09', 'mes9'],
            ['octubre', 'oct', 'mes10'], ['noviembre', 'nov', 'mes11'], ['diciembre', 'dic', 'mes12']
        ];

        monthNames.forEach(names => {
            const key = findKey(names);
            if (key) {
                const val = Number(row[key]);
                months.push(isNaN(val) ? 0 : val);
            } else {
                months.push(0); 
            }
        });

        if (!nameKey && !stockKey) return null;

        return {
          id: code,
          name: String(name),
          currentStock: isNaN(stock) ? 0 : stock,
          unitPrice: isNaN(price) ? 0 : price,
          monthlyConsumption: months,
          ff: ffKey ? String(row[ffKey]) : undefined,
          medtip: tipKey ? String(row[tipKey]) : undefined,
          medpet: petKey ? String(row[petKey]) : undefined,
          medest: estValue ? String(estValue) : undefined,
        };
      }).filter((item): item is MedicationInput => item !== null);

      if (parsedItems.length === 0) {
        alert("Error: No se detectaron columnas válidas.");
        return;
      }

      processData(parsedItems);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err: any) {
      console.error("Error parsing Excel:", err);
      alert(`Error al procesar: ${err.message}`);
    }
  };

  const triggerFileUpload = () => {
    // Check if we have analyzed data that might be lost
    if (hasAnalyzedData) {
        setShowOverwriteWarning(true);
    } else {
        fileInputRef.current?.click();
    }
  };

  const confirmOverwrite = () => {
      setShowOverwriteWarning(false);
      fileInputRef.current?.click();
  };

  const handleConfirmDate = () => {
    setItems(tempItems);
    setTempItems([]);
    setIsDateModalOpen(false);
  };

  // --- CLEAR LOGIC ---
  const handleClearClick = () => {
      // Show confirmation modal
      setShowClearWarning(true);
  };

  const confirmClearAll = () => {
      setItems([]);
      onReset(); // This clears the Analysis Result in App.tsx
      setShowClearWarning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- ANALYSIS EXECUTION LOGIC (WITH VACCINE CHECK) ---
  const handleExecuteClick = () => {
      if (hasAnalyzedData) {
          setShowReanalysisWarning(true);
      } else {
          setExcludeVaccinesSelection(true); // Reset to default true every time modal opens
          setIsVaccineModalOpen(true);
      }
  };

  const confirmReanalysis = () => {
      setShowReanalysisWarning(false);
      setExcludeVaccinesSelection(true);
      setIsVaccineModalOpen(true);
  };

  const handleRunAnalysis = () => {
      let finalData = [...items];
      const excludeVaccines = excludeVaccinesSelection;
      
      if (excludeVaccines) {
          finalData = finalData.filter(item => {
              const name = item.name.toUpperCase();
              return !name.includes("VACUNA") && !name.includes("DILUYENTE");
          });
      }

      // Pass the excludeVaccines decision to App.tsx so it knows the data is already filtered
      onAnalyze(finalData, referenceDate, excludeVaccines);
      setIsVaccineModalOpen(false);
  };

  return (
    <>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
      
      {/* Upload Section */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-full max-w-2xl bg-teal-50 border-2 border-dashed border-teal-200 rounded-xl p-4 sm:p-8 text-center relative hover:bg-teal-100/50 transition-colors">
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept=".xlsx, .xls, .csv"
            />
            
            <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-full shadow-sm">
                    <FileSpreadsheet className="h-8 w-8 text-teal-600" />
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mt-2">Cargar Requerimiento IPRESS</h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto hidden sm:block">
                    Suba su Excel con histórico (Ene-Dic o Jul-Dic).
                    <br />
                    <span className="text-xs text-teal-600 font-bold">
                        Aura detectará automáticamente los picos anormales y calculará el "CPA".
                    </span>
                </p>
                <p className="text-sm text-gray-500 max-w-md mx-auto block sm:hidden">
                   Suba su archivo Excel para comenzar el análisis.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-6 w-full sm:w-auto justify-center">
                    <button 
                        onClick={triggerFileUpload}
                        className="w-full sm:w-auto justify-center px-6 py-3 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        <Upload className="h-4 w-4" />
                        Subir Archivo
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Item Preview */}
      {items.length > 0 && (
        <div className="space-y-4 animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center max-w-5xl mx-auto px-1 gap-3">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex flex-wrap items-center gap-2">
              Items Cargados ({items.length})
              <span className="text-xs font-normal bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full normal-case whitespace-nowrap">
                Corte: {referenceDate}
              </span>
            </h3>
            <button 
              onClick={handleClearClick}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 bg-red-50 px-3 py-2 rounded hover:bg-red-100 transition-colors w-full sm:w-auto justify-center border border-red-100"
            >
              <Trash2 className="h-3 w-3" /> Limpiar Todo
            </button>
          </div>
          
          {/* Scrollable Table Container for Mobile */}
          <div className="bg-gray-50 rounded-lg border border-gray-200 max-h-60 overflow-y-auto max-w-5xl mx-auto shadow-sm overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left font-bold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap">Código</th>
                  <th className="px-3 py-2 text-left font-bold text-gray-600 text-xs uppercase tracking-wider min-w-[150px]">Descripción</th>
                  <th className="px-3 py-2 text-right font-bold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap">Stock</th>
                  <th className="px-3 py-2 text-center font-bold text-gray-600 text-xs uppercase tracking-wider whitespace-nowrap">Meses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-xs font-mono text-gray-500 font-medium w-24 whitespace-nowrap">{item.id}</td>
                    <td className="px-3 py-1.5 text-gray-900 truncate max-w-[150px] sm:max-w-[300px] text-xs font-medium" title={item.name}>{item.name}</td>
                    <td className="px-3 py-1.5 text-right font-mono text-xs font-bold text-gray-700 whitespace-nowrap">{item.currentStock.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-center text-xs text-gray-500 whitespace-nowrap">
                      {item.monthlyConsumption.filter(v => v > 0).length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={handleExecuteClick}
              disabled={isAnalyzing}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-gray-900 text-white font-bold text-sm rounded-full hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
            >
              {isAnalyzing ? (
                <>
                  <Activity className="h-4 w-4 animate-spin" />
                  Calculando CPA...
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" />
                  Ejecutar Análisis Aura
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* VACCINE CONFIG MODAL */}
    {isVaccineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border-t-4 border-blue-500">
                <div className="p-6 sm:p-8 flex flex-col items-center text-center">
                    
                    <div className="bg-blue-50 p-4 rounded-full mb-4">
                       <Settings2 className="h-8 w-8 text-blue-600" />
                    </div>

                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                       Configuración de Análisis
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-500 mb-6 max-w-xs mx-auto">
                       Antes de procesar la matriz, defina cómo desea tratar los productos de la cadena de frío.
                    </p>

                    <div className="w-full space-y-3">
                        {/* Option 1: Exclude (Selected by Default) */}
                        <div
                            onClick={() => setExcludeVaccinesSelection(true)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer group border-2 ${
                                excludeVaccinesSelection 
                                ? 'bg-teal-50 border-teal-500 shadow-md ring-1 ring-teal-500/20' 
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors ${
                                    excludeVaccinesSelection ? 'bg-teal-200 text-teal-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                     <Syringe className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <span className={`block font-bold text-sm ${excludeVaccinesSelection ? 'text-teal-900' : 'text-gray-700'}`}>
                                        Excluir Vacunas y Diluyentes
                                    </span>
                                    <span className="block text-xs text-gray-500">Se eliminarán del cálculo (Recomendado)</span>
                                </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                excludeVaccinesSelection ? 'border-teal-500' : 'border-gray-300'
                            }`}>
                                {excludeVaccinesSelection && <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />}
                            </div>
                        </div>

                        {/* Option 2: Include All */}
                        <div
                            onClick={() => setExcludeVaccinesSelection(false)}
                            className={`w-full flex items-center justify-between p-4 rounded-xl transition-all cursor-pointer group border-2 ${
                                !excludeVaccinesSelection 
                                ? 'bg-teal-50 border-teal-500 shadow-md ring-1 ring-teal-500/20' 
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg transition-colors ${
                                    !excludeVaccinesSelection ? 'bg-teal-200 text-teal-800' : 'bg-gray-100 text-gray-500'
                                }`}>
                                     <FileSpreadsheet className="h-5 w-5" />
                                </div>
                                <div className="text-left">
                                    <span className={`block font-bold text-sm ${!excludeVaccinesSelection ? 'text-teal-900' : 'text-gray-700'}`}>
                                        Incluir Todo
                                    </span>
                                    <span className="block text-xs text-gray-500">Analizar todos los ítems cargados</span>
                                </div>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                !excludeVaccinesSelection ? 'border-teal-500' : 'border-gray-300'
                            }`}>
                                {!excludeVaccinesSelection && <div className="h-2.5 w-2.5 rounded-full bg-teal-500" />}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 w-full mt-8">
                        <button 
                            onClick={() => setIsVaccineModalOpen(false)}
                            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleRunAnalysis}
                            className="flex-1 py-2.5 text-sm font-bold text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center gap-2"
                        >
                            <Play className="h-4 w-4 fill-current" />
                            Aceptar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* MANDATORY DATE MODAL */}
    {isDateModalOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border-t-4 border-teal-600">
          <div className="p-6 sm:p-8 flex flex-col items-center text-center">
            
            <div className="bg-teal-100 p-4 rounded-full mb-4">
               <Calendar className="h-8 w-8 text-teal-700" />
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
              Confirme la Fecha del Reporte
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 mb-6">
              Para realizar un cálculo preciso, Aura necesita saber a qué mes corresponde la última columna de datos.
            </p>

            <div className="w-full bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center justify-center gap-1 mb-2">
                    Mes de Corte (Mes 12)
                </label>
                <input 
                    type="month" 
                    value={referenceDate}
                    onChange={(e) => setReferenceDate(e.target.value)}
                    className="w-full text-center px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-gray-900 font-bold text-lg shadow-sm bg-white"
                />
            </div>
            
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex gap-3 text-left mb-6">
               <AlertCircle className="h-5 w-5 text-blue-600 shrink-0" />
               <p className="text-xs text-blue-800">
                  <strong>Nota:</strong> Si descargó el reporte hoy, la fecha por defecto suele ser correcta.
               </p>
            </div>

            <button
              onClick={handleConfirmDate}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-all shadow-md transform hover:scale-[1.02]"
            >
              <Check className="h-5 w-5" />
              Confirmar y Cargar Datos
            </button>
          </div>
        </div>
      </div>
    )}

    {/* OVERWRITE WARNING MODAL */}
    {showOverwriteWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="bg-amber-500 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                         <AlertTriangle className="h-6 w-6" />
                         <h3 className="font-bold text-lg">¡Atención! Datos no guardados</h3>
                    </div>
                    <button onClick={() => setShowOverwriteWarning(false)} className="hover:bg-amber-600 p-1 rounded transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Actualmente hay un análisis realizado en pantalla. 
                        <br/><br/>
                        <strong>Si sube un nuevo archivo, los resultados actuales se perderán permanentemente</strong> si no los ha exportado (PDF/Excel).
                    </p>
                    <p className="text-gray-500 text-xs italic mb-6">
                        ¿Desea continuar y sobrescribir los datos actuales?
                    </p>
                    
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setShowOverwriteWarning(false)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmOverwrite}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors shadow-sm"
                        >
                            Continuar y Sobrescribir
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* REANALYSIS WARNING MODAL */}
    {showReanalysisWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="bg-amber-500 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                         <AlertTriangle className="h-6 w-6" />
                         <h3 className="font-bold text-lg">Reiniciar Análisis</h3>
                    </div>
                    <button onClick={() => setShowReanalysisWarning(false)} className="hover:bg-amber-600 p-1 rounded transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Ya existe un análisis generado. Si vuelve a ejecutarlo:
                    </p>
                    <ul className="list-disc list-inside text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-100 mb-6 space-y-1">
                        <li>Se perderá el <strong>progreso de la auditoría</strong>.</li>
                        <li>Se restablecerán las <strong>validaciones manuales</strong>.</li>
                        <li>Los datos volverán a su estado calculado original.</li>
                    </ul>
                    <p className="text-gray-500 text-xs italic mb-6">
                        ¿Está seguro que desea volver a calcular y perder los cambios actuales?
                    </p>
                    
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setShowReanalysisWarning(false)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmReanalysis}
                            className="px-4 py-2 bg-amber-600 text-white rounded-lg font-bold text-sm hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-2"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Sí, Reiniciar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* CLEAR ALL WARNING MODAL */}
    {showClearWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="bg-red-600 p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2">
                         <Trash2 className="h-6 w-6" />
                         <h3 className="font-bold text-lg">Eliminar Datos</h3>
                    </div>
                    <button onClick={() => setShowClearWarning(false)} className="hover:bg-red-700 p-1 rounded transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-gray-700 mb-4 text-sm leading-relaxed">
                        Esta acción eliminará <strong>todos los items cargados</strong> y el <strong>análisis generado</strong> actualmente.
                    </p>
                    <p className="text-red-600 font-bold text-xs mb-6 bg-red-50 p-3 rounded border border-red-100 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Esta acción no se puede deshacer.
                    </p>
                    
                    <div className="flex gap-3 justify-end">
                        <button 
                            onClick={() => setShowClearWarning(false)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={confirmClearAll}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm hover:bg-red-700 transition-colors shadow-sm"
                        >
                            Sí, Eliminar Todo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}
    </>
  );
};
