import React, { useState, useMemo } from 'react';
import { Upload, FileSpreadsheet, Search, ArrowRightLeft, Building2, Package, AlertCircle, X, ArrowRight, Merge, CheckCircle2, Circle, Filter, ChevronLeft, ChevronRight, Sparkles, TrendingUp, TrendingDown, AlertTriangle, ClipboardList, Trash2, MousePointerClick } from 'lucide-react';
import * as XLSX from 'xlsx';
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
  const [productSearch, setProductSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reviewFilter, setReviewFilter] = useState('ALL');


  // --- CONFIRMATION MODAL STATE ---
  const [isReviewConfirmOpen, setIsReviewConfirmOpen] = useState(false);
  const [pendingNextProductCode, setPendingNextProductCode] = useState<string | null>(null);
  const [autoReviewEnabled, setAutoReviewEnabled] = useState(false);

  // --- DETAIL MODAL STATE ---
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<RedistributionItem | null>(null);

  // --- TRANSFER LIST STATE ---
  const [transferList, setTransferList] = useState<{
      id: string;
      productCode: string;
      productName: string;
      quantity: number;
      originCod: string;
      originName: string;
      destinationCod: string;
      destinationName: string;
  }[]>([]);
  const [isTransferListOpen, setIsTransferListOpen] = useState(false);
  const [quickTransferSource, setQuickTransferSource] = useState<RedistributionItem | null>(null);
  const [quickTransferDestination, setQuickTransferDestination] = useState<RedistributionItem | null>(null);
  const [isQuickTransferConfirmOpen, setIsQuickTransferConfirmOpen] = useState(false);
  const [quickTransferQty, setQuickTransferQty] = useState<string>('');



  // --- 1. FILE UPLOAD ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate File Extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        toast.error("Formato de archivo incorrecto. Por favor suba un archivo Excel (.xlsx o .xls).");
        return;
    }

    setLoading(true);
    setError(null);

    // Simulate processing delay for animation
    setTimeout(() => {
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
                throw new Error("Estructura inválida: No se encontró la fila de cabecera con 'STOCK' y 'CPA'.");
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
            toast.success("Archivo procesado correctamente");
          } catch (err: any) {
            console.error(err);
            setError("Error al procesar el archivo: " + err.message);
            toast.error("Error al procesar el archivo");
            setLoading(false);
          }
        };
        reader.readAsBinaryString(file);
    }, 1500); // 1.5s delay for animation
  };

  // --- 2. FILTERS ---
  const microredOptions = useMemo(() => {
    const unique = new Set(records.map(r => r.microred));
    return Array.from(unique).sort();
  }, [records]);

  const productOptions = useMemo(() => {
    if (!selectedMicrored) return [];
    const filtered = records.filter(r => r.microred === selectedMicrored);
    
    // Aggregate data by product code
    const productMap = new Map<string, {
        name: string;
        totalStock: number;
        monthlyVector: number[];
    }>();

    filtered.forEach(r => {
        if (!productMap.has(r.medCode)) {
            productMap.set(r.medCode, { 
                name: r.medName, 
                totalStock: 0, 
                monthlyVector: Array(12).fill(0)
            });
        }
        const entry = productMap.get(r.medCode)!;
        entry.totalStock += r.stock;
        
        // Sum monthly consumption vector to calculate consolidated CPA correctly
        if (r.monthlyConsumption && r.monthlyConsumption.length === 12) {
            for(let i = 0; i < 12; i++) {
                entry.monthlyVector[i] += r.monthlyConsumption[i];
            }
        }
    });

    return Array.from(productMap.entries()).map(([code, data]) => {
        // Calculate consolidated metrics based on summed vector
        const totalConsumption = data.monthlyVector.reduce((a, b) => a + b, 0);
        const activeMonths = data.monthlyVector.filter(v => v > 0).length;
        
        const cpa = activeMonths > 0 ? (totalConsumption / activeMonths) : 0;
        const months = cpa > 0 ? (data.totalStock / cpa) : (data.totalStock > 0 ? 999 : 0);
        
        let status = 'NormoStock';
        if (data.totalStock === 0) status = 'Desabastecido';
        else if (months < 2) status = 'SubStock';
        else if (months > 6) status = 'SobreStock';
        
        return {
            code,
            name: data.name,
            cpa: cpa,
            months: months,
            status: status
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [records, selectedMicrored]);

  const filteredProductOptions = useMemo(() => {
      let result = productOptions;

      // 1. Text Search
      if (productSearch) {
          const lower = productSearch.toLowerCase();
          result = result.filter(p => 
              p.name.toLowerCase().includes(lower) || 
              p.code.toLowerCase().includes(lower)
          );
      }

      // 2. Status Filter
      if (statusFilter !== 'ALL') {
          result = result.filter(p => p.status === statusFilter);
      }

      // 3. Review Filter
      if (reviewFilter !== 'ALL') {
          result = result.filter(p => {
              const isReviewed = reviewedProducts.has(p.code);
              return reviewFilter === 'REVIEWED' ? isReviewed : !isReviewed;
          });
      }

      return result;
  }, [productOptions, productSearch, statusFilter, reviewFilter, reviewedProducts]);

  const microredStats = useMemo(() => {
      if (!selectedMicrored) return null;
      const mrRecords = records.filter(r => r.microred === selectedMicrored);
      const establishments = new Set(mrRecords.map(r => r.codEess)).size;
      const totalItems = mrRecords.length;
      return { establishments, totalItems };
  }, [selectedMicrored, records]);

  // --- 3. REDISTRIBUTION LOGIC ---
  const handleMicroredChange = (microred: string) => {
    setSelectedMicrored(microred);
    setSelectedProductCode('');
    setSelectedProductName('');
    setBaseRedistributionData([]);
    setRedistributionData([]);
    setConsolidationSelection(new Set()); // Reset consolidation on microred change
    setProductSearch('');
    setStatusFilter('ALL');
    setReviewFilter('ALL');
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
    
    // Find and set product name
    const product = productOptions.find(p => p.code === productCode);
    if (product) setSelectedProductName(product.name);

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
            
            // Calculate redistribution suggestion (negative need)
            // If Overstock and Months > 6, suggest transferring out excess to reach 6 months
            let redistributionSuggestion = 0;
            if (r.status === 'SobreStock' && r.monthsProvision > 6) {
                redistributionSuggestion = Math.floor(r.stock - (6 * r.cpa));
            }

            return {
                codEess: r.codEess,
                establishmentName: r.establishmentName,
                stock: r.stock,
                cpa: r.cpa,
                monthsProvision: r.monthsProvision,
                status: r.status,
                transferQty: 0, // Default to 0, user must input manually
                receivedQty: 0,
                need: need > 0 ? need : (redistributionSuggestion > 0 ? -redistributionSuggestion : 0), // Positive = Need, Negative = Excess to distribute
                consumptionSum: r.consumptionSum || 0,
                consumptionMonths: r.consumptionMonths || 0,
                monthlyConsumption: r.monthlyConsumption || Array(12).fill(0),
                simulationQty: 0
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
                monthlyConsumption: Array(12).fill(0),
                simulationQty: 0
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
                  const baseNeed = calculateNeed(principalItem.stock, principalItem.cpa, principalItem.status);
                  let baseRedist = 0;
                  if (principalItem.status === 'SobreStock' && principalItem.monthsProvision > 6) {
                      baseRedist = Math.floor(principalItem.stock - (6 * principalItem.cpa));
                  }
                  principalItem.need = baseNeed > 0 ? baseNeed : (baseRedist > 0 ? -baseRedist : 0);

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
    // Allow clearing the input
    if (value === '') {
        const newBase = baseRedistributionData.map(item => {
            if (item.codEess === codEess) {
                return { ...item, [field]: 0 };
            }
            return item;
        });
        setBaseRedistributionData(newBase);
        updateConsolidatedData(newBase, consolidationSelection);
        return;
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue < 0) return;

    // Validation: Cannot transfer more than stock
    if (field === 'transferQty') {
        const visibleItem = redistributionData.find(i => i.codEess === codEess);
        if (visibleItem && numValue > visibleItem.stock) {
            toast.error(`No puede transferir más del stock disponible (${visibleItem.stock})`);
            return;
        }
    }
    
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

  const handleSimulationChange = (codEess: string, value: string) => {
      // Allow clearing the input (empty string) or typing "-"
      let numValue = 0;
      
      if (value === '' || value === '-') {
          numValue = 0;
      } else {
          const parsed = parseInt(value);
          if (!isNaN(parsed)) {
              numValue = parsed;
          } else {
              return; // Invalid input (e.g. letters), ignore
          }
      }

      const newBase = baseRedistributionData.map(item => {
        if (item.codEess === codEess) {
          return { 
              ...item, 
              simulationQty: numValue,
              simulationInput: value 
          };
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
  
  const handleNavigateProduct = (direction: 'prev' | 'next') => {
      if (!selectedProductCode) return;
      
      const currentIndex = filteredProductOptions.findIndex(p => p.code === selectedProductCode);
      if (currentIndex === -1) return;

      const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex >= 0 && newIndex < filteredProductOptions.length) {
          const nextProductCode = filteredProductOptions[newIndex].code;

          // Logic for NEXT direction
          if (direction === 'next') {
              const isAlreadyReviewed = reviewedProducts.has(selectedProductCode);
              
              if (!isAlreadyReviewed) {
                  if (autoReviewEnabled) {
                      // Auto-mark and navigate
                      setReviewedProducts(prev => new Set(prev).add(selectedProductCode));
                      handleProductChange(nextProductCode);
                  } else {
                      // Show modal
                      setPendingNextProductCode(nextProductCode);
                      setIsReviewConfirmOpen(true);
                  }
                  return; 
              }
          }
          
          // Default navigation (Prev or Next if already reviewed)
          handleProductChange(nextProductCode);
      }
  };

  const handleConfirmReviewNavigation = (shouldMarkReviewed: boolean) => {
      if (shouldMarkReviewed && selectedProductCode) {
          setReviewedProducts(prev => new Set(prev).add(selectedProductCode));
      }
      
      if (pendingNextProductCode) {
          handleProductChange(pendingNextProductCode);
      }
      
      setIsReviewConfirmOpen(false);
      setPendingNextProductCode(null);
  };

  const handleOpenDetailModal = (item: RedistributionItem) => {
      setSelectedDetailItem(item);
      setIsDetailModalOpen(true);
  };

  const handleNavigateDetailItem = (direction: 'prev' | 'next') => {
      if (!selectedDetailItem) return;
      
      const currentIndex = redistributionData.findIndex(item => item.codEess === selectedDetailItem.codEess);
      if (currentIndex === -1) return;

      const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
      
      if (newIndex >= 0 && newIndex < redistributionData.length) {
          setSelectedDetailItem(redistributionData[newIndex]);
      }
  };

  // --- SMART REDISTRIBUTION LOGIC ---
  // Removed as per user request

  // --- QUICK TRANSFER LOGIC ---
  const handleQuickTransferClick = (item: RedistributionItem, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent opening detail modal

      // If clicking the same source, deselect
      if (quickTransferSource?.codEess === item.codEess) {
          setQuickTransferSource(null);
          return;
      }

      // If no source selected, select this as source
      if (!quickTransferSource) {
          if (item.stock <= 0) {
              toast.error("Este establecimiento no tiene stock para transferir.");
              return;
          }
          setQuickTransferSource(item);
          toast.info(`Origen seleccionado: ${item.establishmentName}. Ahora seleccione el destino.`);
          return;
      }

      // If source selected, this is the destination
      if (quickTransferSource) {
          if (quickTransferSource.codEess === item.codEess) return; // Should be handled by deselect above but safety check

          // Set destination and open modal
          setQuickTransferDestination(item);
          
          // Calculate suggested quantity
          const maxTransfer = quickTransferSource.stock;
          const currentNeed = item.need || 0;
          const suggestedQty = currentNeed > 0 ? Math.min(maxTransfer, currentNeed) : 1;
          
          setQuickTransferQty(suggestedQty.toString());
          setIsQuickTransferConfirmOpen(true);
      }
  };

  const executeTransfer = (sourceCod: string, destCod: string, qty: number) => {
      // Update BOTH base and visible data to keep them in sync for exports/logic
      const newBase = baseRedistributionData.map(item => {
          // 1. Subtract from Origin
          if (item.codEess === sourceCod) {
              return { ...item, transferQty: (item.transferQty || 0) + qty };
          }
          // 2. Add to Destination
          if (item.codEess === destCod) {
              return { ...item, receivedQty: (item.receivedQty || 0) + qty };
          }
          return item;
      });
      
      setBaseRedistributionData(newBase);
      updateConsolidatedData(newBase, consolidationSelection);
  };

  const confirmQuickTransfer = () => {
      if (!quickTransferSource || !quickTransferDestination) return;

      const qty = parseInt(quickTransferQty);
      const maxTransfer = quickTransferSource.stock;

      if (isNaN(qty) || qty <= 0) {
          toast.error("Cantidad inválida.");
          return;
      }
      if (qty > maxTransfer) {
          toast.error(`No puede transferir más del stock disponible (${maxTransfer}).`);
          return;
      }

      // Add to list
      const newTransfer = {
          id: Date.now().toString(),
          productCode: selectedProductCode,
          productName: selectedProductName,
          quantity: qty,
          originCod: quickTransferSource.codEess,
          originName: quickTransferSource.establishmentName,
          destinationCod: quickTransferDestination.codEess,
          destinationName: quickTransferDestination.establishmentName
      };

      setTransferList(prev => [...prev, newTransfer]);
      
      // Execute Transfer (Updates both Source and Destination visually)
      executeTransfer(quickTransferSource.codEess, quickTransferDestination.codEess, qty);

      toast.success("Transferencia agregada a la lista");
      
      // Reset state
      setQuickTransferSource(null);
      setQuickTransferDestination(null);
      setIsQuickTransferConfirmOpen(false);
      setQuickTransferQty('');
  };

  const cancelQuickTransfer = () => {
      setQuickTransferDestination(null);
      setIsQuickTransferConfirmOpen(false);
      setQuickTransferQty('');
      // We keep the source selected so they can choose another destination if they want
  };

  const removeTransferFromList = (id: string) => {
      const transfer = transferList.find(t => t.id === id);
      if (transfer) {
          // Reverse the transfer in the main table
          executeTransfer(transfer.originCod, transfer.destinationCod, -transfer.quantity);
          toast.info("Transferencia revertida");
      }
      setTransferList(prev => prev.filter(t => t.id !== id));
  };

  const exportTransferList = () => {
      if (transferList.length === 0) return;

      const exportData = transferList.map(t => ({
          'COD. MED': t.productCode,
          'DESCRIPCION MED': t.productName,
          'CANTIDAD': t.quantity,
          'COD. EESS ORIGEN': t.originCod,
          'EESS ORIGEN': t.originName,
          'COD. EESS DESTINO': t.destinationCod,
          'EESS DESTINO': t.destinationName
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Distribución");
      XLSX.writeFile(wb, `Lista_Distribucion_${selectedMicrored}_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  // --- 5. EXPORT FUNCTIONS ---
  // Removed as per user request

  // --- RENDER ---
  return (
    <div className="p-6 w-full max-w-[98%] mx-auto space-y-6 animate-in fade-in duration-300">
      
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
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 transition-all hover:shadow-xl">
        <div className="flex flex-col items-center justify-center text-center">
            
            {loading ? (
                <div className="py-12 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                        <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <FileSpreadsheet className="h-8 w-8 text-indigo-600 animate-pulse" />
                        </div>
                    </div>
                    <h3 className="mt-6 text-xl font-bold text-gray-900">Procesando Archivo Excel</h3>
                    <p className="text-gray-500 mt-2 text-sm">Validando estructura y cargando registros...</p>
                </div>
            ) : (
                <>
                    <div className="w-full max-w-2xl mx-auto border-2 border-dashed border-indigo-200 rounded-xl p-10 bg-indigo-50/30 hover:bg-indigo-50 transition-all group cursor-pointer relative">
                        <input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-300">
                            <div className="bg-white p-4 rounded-full shadow-md group-hover:shadow-lg transition-shadow">
                                <FileSpreadsheet className="h-10 w-10 text-indigo-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Cargar Archivo de Disponibilidad</h3>
                                <p className="text-sm text-gray-500 mt-1">Arrastre su archivo Excel aquí o haga clic para buscar</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium bg-indigo-100 px-3 py-1 rounded-full">
                                <Sparkles className="h-3 w-3" />
                                <span>Formato .xlsx o .xls requerido</span>
                            </div>
                        </div>
                    </div>

                    {records.length > 0 && (
                        <div className="mt-8 flex items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="text-center px-6 py-3 bg-green-50 rounded-xl border border-green-100">
                                <span className="block text-3xl font-bold text-green-600">{records.length.toLocaleString()}</span>
                                <span className="text-xs font-bold text-green-800 uppercase tracking-wider">Registros Cargados</span>
                            </div>
                            <div className="h-10 w-px bg-gray-200"></div>
                            <div className="text-left">
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    Datos validados correctamente
                                </p>
                                <p className="text-xs text-gray-400 mt-1">Listo para análisis de redistribución</p>
                            </div>
                        </div>
                    )}
                </>
            )}

            {error && (
                <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm flex items-center gap-3 border border-red-100 animate-in shake duration-300">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{error}</span>
                </div>
            )}
        </div>
      </div>

      {records.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* MICRORED SELECTOR */}
            <div className="md:col-span-4 bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-[220px] flex flex-col">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    Seleccionar Microred
                </label>
                <select 
                    value={selectedMicrored}
                    onChange={(e) => handleMicroredChange(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none mb-4"
                >
                    <option value="">-- Seleccione --</option>
                    {microredOptions.map(mr => (
                        <option key={mr} value={mr}>{mr}</option>
                    ))}
                </select>

                {/* Stats Summary to fill space */}
                <div className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col justify-center gap-2">
                    {selectedMicrored && microredStats ? (
                        <>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Establecimientos:</span>
                                <span className="font-bold text-gray-900">{microredStats.establishments}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Total Productos:</span>
                                <span className="font-bold text-gray-900">{productOptions.length}</span>
                            </div>
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Registros:</span>
                                <span className="font-bold text-gray-900">{microredStats.totalItems.toLocaleString()}</span>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-400 text-xs italic">
                            Seleccione una microred para ver el resumen de datos disponibles.
                        </div>
                    )}
                </div>
            </div>

            {/* PRODUCT REVIEW TABLE (REPLACES DROPDOWN) */}
            <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[220px]">
                <div className="p-3 border-b border-gray-200 bg-gray-50 font-bold text-sm text-gray-700 flex justify-between items-center gap-4">
                    <div className="flex items-center gap-2 shrink-0">
                        <Package className="h-4 w-4 text-indigo-600" />
                        <span className="hidden sm:inline">Lista de Productos</span>
                        <span className="sm:hidden">Productos</span>
                        <span className="text-xs text-gray-500 font-normal">({productOptions.length})</span>
                    </div>
                    
                    {/* Search Input */}
                    <div className="flex-1 max-w-xs relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input 
                            type="text"
                            placeholder="Buscar por código o nombre..."
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                        />
                    </div>

                    <div className="text-xs text-gray-500 font-normal shrink-0">
                        {reviewedProducts.size} rev.
                    </div>
                </div>
                <div className="overflow-y-auto flex-1 p-0">
                    {productOptions.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-gray-400 text-sm italic p-4">
                            Seleccione una Microred para ver los productos
                        </div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold text-xs sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-2 border-b w-14 text-center relative group hover:bg-gray-200 transition-colors cursor-pointer">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>Rev.</span>
                                            <Filter className={`h-3 w-3 ${reviewFilter !== 'ALL' ? 'text-indigo-600 fill-indigo-600' : 'text-gray-400'}`} />
                                        </div>
                                        <select 
                                            value={reviewFilter}
                                            onChange={(e) => setReviewFilter(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            title="Filtrar por estado de revisión"
                                        >
                                            <option value="ALL">Todos</option>
                                            <option value="REVIEWED">Revisados</option>
                                            <option value="PENDING">Pendientes</option>
                                        </select>
                                    </th>
                                    <th className="p-2 border-b w-20 text-left">Código</th>
                                    <th className="p-2 border-b text-left">Descripción</th>
                                    <th className="p-2 border-b w-16 text-center">CPA</th>
                                    <th className="p-2 border-b w-16 text-center">Meses</th>
                                    <th className="p-2 border-b w-28 text-center relative group hover:bg-gray-200 transition-colors cursor-pointer">
                                        <div className="flex items-center justify-center gap-1">
                                            <span>Situación</span>
                                            <Filter className={`h-3 w-3 ${statusFilter !== 'ALL' ? 'text-indigo-600 fill-indigo-600' : 'text-gray-400'}`} />
                                        </div>
                                        <select 
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            title="Filtrar por situación"
                                        >
                                            <option value="ALL">Todos</option>
                                            <option value="NormoStock">NormoStock</option>
                                            <option value="SobreStock">SobreStock</option>
                                            <option value="SubStock">SubStock</option>
                                            <option value="Desabastecido">Desabastecido</option>
                                        </select>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProductOptions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-4 text-center text-gray-400 italic text-xs">
                                            No se encontraron productos
                                        </td>
                                    </tr>
                                ) : (
                                    filteredProductOptions.map((prod) => {
                                        const isSelected = selectedProductCode === prod.code;
                                        const isReviewed = reviewedProducts.has(prod.code);
                                        
                                        let statusColor = "bg-gray-100 text-gray-600";
                                        if (prod.status === "NormoStock") statusColor = "bg-green-100 text-green-800";
                                        if (prod.status === "SobreStock") statusColor = "bg-indigo-100 text-indigo-800";
                                        if (prod.status === "SubStock") statusColor = "bg-orange-100 text-orange-800";
                                        if (prod.status === "Desabastecido") statusColor = "bg-red-100 text-red-800";

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
                                                <td className="p-2 text-xs text-gray-800 truncate max-w-[200px]" title={prod.name}>{prod.name}</td>
                                                <td className="p-2 text-center text-xs font-mono">{prod.cpa.toFixed(1)}</td>
                                                <td className="p-2 text-center text-xs font-mono font-bold">{prod.months === 999 ? '∞' : prod.months.toFixed(1)}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusColor}`}>
                                                        {prod.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
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
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    {(() => {
                        const selectedProduct = productOptions.find(p => p.code === selectedProductCode);
                        return selectedProduct ? (
                            <>
                                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-xs font-mono border border-indigo-200">{selectedProduct.code}</span>
                                <span className="truncate max-w-md text-sm sm:text-base" title={selectedProduct.name}>{selectedProduct.name}</span>
                            </>
                        ) : (
                            "Matriz de Redistribución"
                        );
                    })()}
                </h3>
                <div className="flex items-center gap-3">
                    {/* Navigation Arrows */}
                    {selectedProductCode && (
                        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200 mr-2">
                            <button 
                                onClick={() => handleNavigateProduct('prev')}
                                disabled={filteredProductOptions.findIndex(p => p.code === selectedProductCode) <= 0}
                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                                title="Producto Anterior"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="w-px h-4 bg-gray-300 mx-0.5"></div>
                            <button 
                                onClick={() => handleNavigateProduct('next')}
                                disabled={filteredProductOptions.findIndex(p => p.code === selectedProductCode) >= filteredProductOptions.length - 1}
                                className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-gray-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none transition-all"
                                title="Siguiente Producto"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}

                    {/* Consolidate Button - Only show if there are secondary pharmacies */}
                    {baseRedistributionData.some(item => /F\d{2}$/.test(item.codEess) && !item.codEess.endsWith('F01')) && (
                        <button
                            onClick={handleOpenConsolidateModal}
                            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors shadow-sm"
                        >
                            <Merge className="h-4 w-4" />
                            <span className="hidden sm:inline">Consolidar</span>
                        </button>
                    )}
                    
                    <button
                        onClick={() => setIsTransferListOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-bold hover:bg-gray-900 transition-colors shadow-sm relative"
                        title="Ver Lista de Distribución"
                    >
                        <ClipboardList className="h-4 w-4" />
                        <span className="hidden sm:inline">Lista de Distribución</span>
                        {transferList.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                                {transferList.length}
                            </span>
                        )}
                    </button>



                    <div className="text-xs text-gray-500 ml-2 border-l pl-3 border-gray-300 font-medium">
                        {redistributionData.length} Est.
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
                            <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Suma Cons.</th>
                            <th className="p-3 border-b text-center bg-gray-50 text-gray-600 font-semibold text-[10px] uppercase tracking-wider">Meses Cons.</th>
                            <th className="p-3 border-b text-center">CPA</th>
                            <th className="p-3 border-b text-center">Meses</th>
                            <th className="p-3 border-b text-center">Situación</th>
                            <th className="p-3 border-b text-center bg-gray-200 text-gray-800">Balance</th>
                            <th className="p-3 border-b text-center bg-purple-50 text-purple-800 border-l border-purple-200 w-20">Estimar</th>
                            <th className="p-3 border-b text-center bg-yellow-50 text-yellow-800 border-l border-yellow-200 w-16">Sale</th>
                            <th className="p-3 border-b text-center bg-green-50 text-green-800 border-l border-green-200 w-16">Entra</th>
                            <th className="p-3 border-b text-center bg-blue-50 text-blue-800 border-l border-blue-200">N. Stock</th>
                            <th className="p-3 border-b text-center bg-blue-50 text-blue-800">N. Meses</th>
                            <th className="p-3 border-b text-center text-gray-500 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {redistributionData.map((item) => {
                            const newStock = item.stock - (item.transferQty || 0) + (item.receivedQty || 0) + (item.simulationQty || 0);
                            const newMonths = item.cpa > 0 ? (newStock / item.cpa) : (newStock > 0 ? 999 : 0);
                            
                            // Check if record is effectively empty (no stock, no cpa, no consumption)
                            const isGhost = item.stock === 0 && item.cpa === 0 && item.consumptionSum === 0;

                            // Status Color Logic
                            let statusColor = "bg-gray-100 text-gray-600";
                            if (item.status === "NormoStock") statusColor = "bg-green-100 text-green-800";
                            if (item.status === "SobreStock") statusColor = "bg-indigo-100 text-indigo-800";
                            if (item.status === "SubStock") statusColor = "bg-orange-100 text-orange-800";
                            if (item.status === "Desabastecido") statusColor = "bg-red-100 text-red-800";

                            // Indentation Logic for Secondary Pharmacies (e.g., F02, F03...)
                            // Check if code ends with Fxx where xx > 01
                            const isSecondary = /F\d{2}$/.test(item.codEess) && !item.codEess.endsWith('F01');
                            
                            const isSelected = quickTransferSource?.codEess === item.codEess;

                            // --- SMART ANALYSIS BADGES ---
                            let analysisBadge = null;
                            
                            // 1. Dead Stock (Donor)
                            if (item.stock > 0 && (item.consumptionMonths || 0) <= 1) {
                                analysisBadge = (
                                    <div className="ml-2 text-red-500" title="Sin Rotación: Candidato a Donante Total">
                                        <AlertTriangle className="h-4 w-4" />
                                    </div>
                                );
                            }
                            // 2. High Rotation (Receiver)
                            else if (item.status !== 'SobreStock' && (item.consumptionMonths || 0) >= 6) {
                                analysisBadge = (
                                    <div className="ml-2 text-emerald-600" title="Alta Rotación: Buen candidato para recibir stock">
                                        <TrendingUp className="h-4 w-4" />
                                    </div>
                                );
                            }
                            // 3. Overstock Donor
                            else if (item.status === 'SobreStock' && item.monthsProvision > 6) {
                                analysisBadge = (
                                    <div className="ml-2 text-blue-500" title="Excedente: Candidato a Donante">
                                        <TrendingDown className="h-4 w-4" />
                                    </div>
                                );
                            }

                            return (
                                <tr 
                                    key={item.codEess} 
                                    className={`
                                        transition-colors cursor-pointer group
                                        ${quickTransferSource?.codEess === item.codEess 
                                            ? 'bg-indigo-50 ring-2 ring-indigo-500 ring-inset' 
                                            : quickTransferSource 
                                                ? 'hover:bg-green-100 hover:ring-2 hover:ring-green-500 hover:ring-inset cursor-crosshair' 
                                                : 'hover:bg-blue-100'
                                        }
                                    `}
                                    onClick={() => handleOpenDetailModal(item)}
                                >
                                    <td className="p-3 font-mono text-xs text-gray-500 font-bold">
                                        {item.codEess}
                                    </td>
                                    <td className={`p-3 font-medium text-gray-900 max-w-[200px] truncate ${isSecondary ? 'pl-8 text-gray-600 italic' : ''}`} title={item.establishmentName}>
                                        <div className="flex items-center">
                                            <span className="truncate">{item.establishmentName}</span>
                                            {item.isConsolidated && (
                                                <div className="shrink-0 bg-amber-100 text-amber-700 p-1 rounded border border-amber-200 ml-2" title="Farmacia Consolidada">
                                                    <Merge className="h-3 w-3" />
                                                </div>
                                            )}
                                            {analysisBadge}
                                        </div>
                                    </td>
                                    <td className="p-3 text-center font-mono">{isGhost ? '' : item.stock}</td>
                                    
                                    {/* CONSUMPTION DATA */}
                                    <td className={`p-3 text-center font-mono text-xs ${isSelected ? 'text-indigo-700 font-bold' : 'text-gray-500 bg-gray-50 group-hover:bg-transparent'}`}>
                                        {isGhost ? '' : (item.consumptionSum || 0)}
                                    </td>
                                    <td className={`p-3 text-center font-mono text-xs ${isSelected ? 'text-indigo-700 font-bold' : 'text-gray-500 bg-gray-50 group-hover:bg-transparent'}`}>
                                        {isGhost ? '' : (item.consumptionMonths || 0)}
                                    </td>

                                    <td className="p-3 text-center font-mono">{isGhost ? '' : item.cpa.toFixed(1)}</td>
                                    <td className="p-3 text-center font-mono font-bold">{isGhost ? '' : item.monthsProvision.toFixed(1)}</td>
                                    <td className="p-3 text-center">
                                        {!isGhost && (
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusColor}`}>
                                                {item.status}
                                            </span>
                                        )}
                                    </td>
                                    
                                    {/* NECESIDAD / EXCEDENTE / BALANCE */}
                                    <td className={`p-3 text-center font-mono font-bold ${
                                        isSelected ? 'text-indigo-700' :
                                        (item.need || 0) > 0 ? 'text-blue-600 bg-blue-50 group-hover:bg-transparent' : 
                                        (item.need || 0) < 0 ? 'text-red-600 bg-red-50 group-hover:bg-transparent' : 'text-gray-400 bg-gray-50 group-hover:bg-transparent'
                                    }`}>
                                        {isGhost ? '' : (item.need !== 0 ? item.need : '-')}
                                    </td>

                                    {/* ESTIMAR (Simulation Input) */}
                                    <td className={`p-2 text-center border-l border-purple-100 ${isSelected ? '' : 'bg-purple-50 group-hover:bg-transparent'}`} onClick={(e) => e.stopPropagation()}>
                                        <input 
                                            type="text" // text to allow "-"
                                            value={item.simulationInput !== undefined ? item.simulationInput : (item.simulationQty === 0 ? '' : item.simulationQty)}
                                            onChange={(e) => handleSimulationChange(item.codEess, e.target.value)}
                                            placeholder="+/-"
                                            className={`w-16 p-1 text-center border rounded focus:ring-2 focus:ring-purple-500 outline-none text-xs font-bold ${
                                                (item.simulationQty || 0) < 0 ? 'text-red-600 border-red-300 bg-red-50' : 
                                                (item.simulationQty || 0) > 0 ? 'text-blue-600 border-blue-300 bg-blue-50' : 'border-gray-300 text-gray-600'
                                            }`}
                                            disabled={isGhost}
                                        />
                                    </td>

                                    {/* SALE (Read Only) */}
                                    <td className={`p-3 text-center border-l border-yellow-100 ${isSelected ? '' : 'bg-yellow-50 group-hover:bg-transparent'}`}>
                                        {(item.transferQty || 0) > 0 ? (
                                            <span className="font-bold text-yellow-700">-{item.transferQty}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>

                                    {/* ENTRA (Read Only) */}
                                    <td className={`p-3 text-center border-l border-green-100 ${isSelected ? '' : 'bg-green-50 group-hover:bg-transparent'}`}>
                                        {(item.receivedQty || 0) > 0 ? (
                                            <span className="font-bold text-green-700">+{item.receivedQty}</span>
                                        ) : (
                                            <span className="text-gray-300">-</span>
                                        )}
                                    </td>

                                    {/* CALCULATED */}
                                    <td className={`p-3 text-center font-mono font-bold border-l border-blue-100 ${
                                        isSelected ? 'text-indigo-900' : 
                                        newStock < 0 ? 'text-red-600 bg-red-50 group-hover:bg-transparent' : 'text-blue-900 bg-blue-50/30 group-hover:bg-transparent'
                                    }`}>
                                        {newStock === 0 ? '' : newStock}
                                    </td>
                                    <td className={`p-3 text-center font-mono font-bold border-l border-blue-100 ${
                                        isSelected ? 'text-indigo-900' : 
                                        'text-blue-900 bg-blue-50/30 group-hover:bg-transparent'
                                    }`}>
                                        <div className="flex items-center justify-center gap-2">
                                            <span>{newStock === 0 ? '' : (newMonths === 999 ? '∞' : newMonths.toFixed(1))}</span>
                                            {newStock > 0 && (
                                                <div 
                                                    className={`w-3 h-3 rounded-full shadow-sm border border-white ${
                                                        newMonths > 6 ? 'bg-indigo-500' : 
                                                        newMonths >= 2 ? 'bg-green-500' : 
                                                        newMonths > 0 ? 'bg-orange-500' : 'bg-red-500'
                                                    }`} 
                                                    title={
                                                        newMonths > 6 ? 'SobreStock Estimado' : 
                                                        newMonths >= 2 ? 'NormoStock Estimado' : 
                                                        newMonths > 0 ? 'SubStock Estimado' : 'Desabastecido Estimado'
                                                    }
                                                ></div>
                                            )}
                                        </div>
                                    </td>
                                    
                                    {/* QUICK TRANSFER ACTION */}
                                    <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <button 
                                            onClick={(e) => handleQuickTransferClick(item, e)}
                                            className={`
                                                p-1.5 rounded-lg transition-all shadow-sm border
                                                ${quickTransferSource?.codEess === item.codEess 
                                                    ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700' 
                                                    : quickTransferSource 
                                                        ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:scale-105' 
                                                        : 'bg-white text-gray-400 border-gray-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200'
                                                }
                                            `}
                                            title={quickTransferSource ? (quickTransferSource.codEess === item.codEess ? "Cancelar Selección" : "Transferir Aquí") : "Seleccionar como Origen"}
                                        >
                                            <MousePointerClick className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* QUICK TRANSFER CONFIRMATION MODAL */}
      {isQuickTransferConfirmOpen && quickTransferSource && quickTransferDestination && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[90] p-4 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-800 transform transition-all scale-100">
                  {/* Premium Header */}
                  <div className="relative p-6 pb-0 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-white tracking-tight">
                          Confirmar Transferencia
                      </h3>
                      <button 
                        onClick={cancelQuickTransfer} 
                        className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-full"
                      >
                        <X className="h-5 w-5" />
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                      {/* Product Line: Code + Name */}
                      <div className="flex items-center gap-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
                          <span className="bg-teal-500/20 text-teal-400 px-2 py-1 rounded text-sm font-mono font-bold border border-teal-500/30 shrink-0">
                              {selectedProductCode}
                          </span>
                          <div className="text-white text-lg font-bold leading-tight truncate" title={selectedProductName}>
                              {selectedProductName}
                          </div>
                      </div>

                      {/* Origin & Destination Cards */}
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-stretch">
                          {/* Origin Card */}
                          <div className="bg-gray-800/80 p-5 rounded-xl border border-indigo-500/30 flex flex-col relative overflow-hidden group hover:border-indigo-500/50 transition-colors">
                              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                              <div className="mb-4">
                                  <div className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-1.5 opacity-80">De (Origen)</div>
                                  <div className="text-white font-bold text-lg leading-snug line-clamp-2" title={quickTransferSource.establishmentName}>
                                      {quickTransferSource.establishmentName}
                                  </div>
                              </div>
                              <div className="mt-auto pt-3 border-t border-gray-700/50">
                                  <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Stock Disponible</div>
                                  <div className="text-3xl font-mono font-bold text-indigo-400">{quickTransferSource.stock}</div>
                              </div>
                          </div>

                          {/* Arrow */}
                          <div className="flex items-center justify-center text-gray-600 px-1">
                              <ArrowRight className="h-6 w-6" />
                          </div>

                          {/* Destination Card */}
                          <div className="bg-gray-800/80 p-5 rounded-xl border border-green-500/30 flex flex-col text-right relative overflow-hidden group hover:border-green-500/50 transition-colors">
                              <div className="absolute top-0 right-0 w-1 h-full bg-green-500"></div>
                              <div className="mb-4">
                                  <div className="text-[10px] text-green-400 font-bold uppercase tracking-widest mb-1.5 opacity-80">A (Destino)</div>
                                  <div className="text-white font-bold text-lg leading-snug line-clamp-2" title={quickTransferDestination.establishmentName}>
                                      {quickTransferDestination.establishmentName}
                                  </div>
                              </div>
                              <div className="mt-auto pt-3 border-t border-gray-700/50">
                                  <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Necesidad</div>
                                  <div className="text-3xl font-mono font-bold text-green-400">{(quickTransferDestination.need || 0) > 0 ? quickTransferDestination.need : 0}</div>
                              </div>
                          </div>
                      </div>

                      {/* Input Section */}
                      <div className="text-center py-2">
                          <label className="block text-xs font-bold text-gray-500 mb-4 uppercase tracking-widest">Cantidad a Transferir</label>
                          <div className="relative inline-block group">
                              <input 
                                  type="number" 
                                  value={quickTransferQty}
                                  onChange={(e) => setQuickTransferQty(e.target.value)}
                                  className="w-48 bg-transparent text-6xl font-bold text-center text-white border-b-2 border-gray-700 focus:border-indigo-500 outline-none pb-2 transition-all placeholder-gray-800 font-mono group-hover:border-gray-600"
                                  placeholder="0"
                                  autoFocus
                                  min="1"
                                  max={quickTransferSource.stock}
                                  onKeyDown={(e) => {
                                      if (e.key === 'Enter') confirmQuickTransfer();
                                      if (e.key === 'Escape') cancelQuickTransfer();
                                  }}
                              />
                          </div>
                          <div className="text-xs text-gray-600 mt-4 font-medium">
                              Presione <span className="text-gray-400 font-bold">Enter</span> para confirmar
                          </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-4 pt-2">
                          <button 
                              onClick={cancelQuickTransfer}
                              className="px-4 py-3 bg-gray-800 text-gray-300 rounded-xl font-bold hover:bg-gray-700 transition-all border border-gray-700 text-sm"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={confirmQuickTransfer}
                              className="px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 text-sm"
                          >
                              <span>Confirmar</span>
                              <ArrowRight className="h-4 w-4" />
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* TRANSFER LIST MODAL */}
      {isTransferListOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80] p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]">
                  <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2">
                          <ClipboardList className="h-5 w-5 text-teal-400" />
                          <h3 className="font-bold text-lg">LISTA DE DISTRIBUCIÓN</h3>
                      </div>
                      <button onClick={() => setIsTransferListOpen(false)} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-0">
                      {transferList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                              <ClipboardList className="h-12 w-12 mb-3 opacity-20" />
                              <p>No hay transferencias registradas aún.</p>
                              <p className="text-sm mt-1">Utilice el botón de acción en la tabla para agregar transferencias.</p>
                          </div>
                      ) : (
                          <table className="w-full text-sm text-left">
                              <thead className="bg-gray-100 text-gray-700 font-bold uppercase text-xs sticky top-0 z-10">
                                  <tr>
                                      <th className="p-3 border-b">Producto</th>
                                      <th className="p-3 border-b text-center">Cant.</th>
                                      <th className="p-3 border-b">Origen</th>
                                      <th className="p-3 border-b">Destino</th>
                                      <th className="p-3 border-b text-center">Acción</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                  {transferList.map((t) => (
                                      <tr key={t.id} className="hover:bg-gray-50">
                                          <td className="p-3">
                                              <div className="font-bold text-gray-800">{t.productName}</div>
                                              <div className="font-mono text-xs text-gray-500">{t.productCode}</div>
                                          </td>
                                          <td className="p-3 text-center font-bold text-lg text-indigo-600">{t.quantity}</td>
                                          <td className="p-3">
                                              <div className="text-gray-800">{t.originName}</div>
                                              <div className="font-mono text-xs text-gray-500">{t.originCod}</div>
                                          </td>
                                          <td className="p-3">
                                              <div className="text-gray-800">{t.destinationName}</div>
                                              <div className="font-mono text-xs text-gray-500">{t.destinationCod}</div>
                                          </td>
                                          <td className="p-3 text-center">
                                              <button 
                                                  onClick={() => removeTransferFromList(t.id)}
                                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                  title="Eliminar"
                                              >
                                                  <Trash2 className="h-4 w-4" />
                                              </button>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      )}
                  </div>

                  <div className="bg-gray-50 p-4 flex justify-between items-center border-t border-gray-200 shrink-0">
                      <div className="text-sm text-gray-600 font-medium">
                          Total Transferencias: <span className="font-bold text-gray-900">{transferList.length}</span>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => setIsTransferListOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cerrar</button>
                          <button 
                              onClick={exportTransferList}
                              disabled={transferList.length === 0}
                              className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                              <FileSpreadsheet className="h-4 w-4" />
                              Exportar Lista
                          </button>
                      </div>
                  </div>
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

      {/* REVIEW CONFIRMATION MODAL */}
      {isReviewConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
                  <div className="p-6 text-center">
                      <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="h-8 w-8 text-indigo-600" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-2">¿Marcar como Revisado?</h3>
                      <p className="text-sm text-gray-600 mb-6">
                          Estás pasando al siguiente producto. ¿Deseas marcar <strong>{productOptions.find(p => p.code === selectedProductCode)?.name || selectedProductCode}</strong> como revisado antes de continuar?
                      </p>
                      
                      <div className="flex flex-col gap-3">
                          <button 
                              onClick={() => handleConfirmReviewNavigation(true)}
                              className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                          >
                              Sí, marcar y continuar
                          </button>
                          <button 
                              onClick={() => handleConfirmReviewNavigation(false)}
                              className="w-full py-2.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition-colors"
                          >
                              No, solo continuar
                          </button>
                          
                          <label className="flex items-center justify-center gap-2 mt-2 cursor-pointer text-xs text-gray-500 hover:text-indigo-600 transition-colors">
                              <input 
                                  type="checkbox" 
                                  checked={autoReviewEnabled}
                                  onChange={(e) => setAutoReviewEnabled(e.target.checked)}
                                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              No volver a preguntar (marcar automáticamente al avanzar)
                          </label>

                          <button 
                              onClick={() => setIsReviewConfirmOpen(false)}
                              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium mt-2"
                          >
                              Cancelar
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* DETAIL MODAL */}
      {isDetailModalOpen && selectedDetailItem && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden border border-gray-800 flex flex-col max-h-[90vh]">
                  {/* Header */}
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                      <div className="flex-1 min-w-0 mr-4">
                          {/* Product Line */}
                          <div className="flex items-center gap-3 mb-2">
                              <span className="bg-teal-500/20 text-teal-400 px-2 py-0.5 rounded text-sm font-mono font-bold border border-teal-500/30 shrink-0">
                                  {selectedProductCode}
                              </span>
                              <h2 className="text-xl font-bold text-white leading-tight truncate" title={selectedProductName}>
                                  {selectedProductName}
                              </h2>
                          </div>
                          
                          {/* Establishment Line */}
                          <div className="flex items-center gap-3">
                              <span className="text-gray-500 text-sm font-mono font-bold bg-gray-800 px-2 py-0.5 rounded shrink-0">
                                  {selectedDetailItem.codEess}
                              </span>
                              <p className="text-gray-300 text-base truncate" title={selectedDetailItem.establishmentName}>
                                  {selectedDetailItem.establishmentName}
                              </p>
                          </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                          {/* Navigation */}
                          <div className="flex items-center bg-gray-800 rounded-lg p-1 border border-gray-700">
                              <button 
                                  onClick={() => handleNavigateDetailItem('prev')}
                                  disabled={redistributionData.findIndex(i => i.codEess === selectedDetailItem.codEess) <= 0}
                                  className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                  title="Establecimiento Anterior"
                              >
                                  <ChevronLeft className="h-5 w-5" />
                              </button>
                              <div className="w-px h-5 bg-gray-700 mx-1"></div>
                              <button 
                                  onClick={() => handleNavigateDetailItem('next')}
                                  disabled={redistributionData.findIndex(i => i.codEess === selectedDetailItem.codEess) >= redistributionData.length - 1}
                                  className="p-2 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                  title="Siguiente Establecimiento"
                              >
                                  <ChevronRight className="h-5 w-5" />
                              </button>
                          </div>

                          <button 
                              onClick={() => setIsDetailModalOpen(false)}
                              className="text-gray-500 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                          >
                              <X className="h-6 w-6" />
                          </button>
                      </div>
                  </div>

                  {/* KPI Cards */}
                  <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-900/50">
                      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Stock Actual</div>
                          <div className="text-3xl font-bold text-white">{selectedDetailItem.stock}</div>
                      </div>
                      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                          <div className="text-gray-400 text-xs font-bold uppercase mb-1">CPA (Promedio)</div>
                          <div className="text-3xl font-bold text-teal-400">{selectedDetailItem.cpa.toFixed(1)}</div>
                      </div>
                      <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-700">
                          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Meses Disp.</div>
                          <div className="text-3xl font-bold text-blue-400">
                              {selectedDetailItem.monthsProvision === 999 ? '∞' : selectedDetailItem.monthsProvision.toFixed(1)}
                          </div>
                      </div>
                      <div className={`p-4 rounded-xl border ${
                          selectedDetailItem.status === 'NormoStock' ? 'bg-green-900/20 border-green-800' :
                          selectedDetailItem.status === 'SobreStock' ? 'bg-indigo-900/20 border-indigo-800' :
                          selectedDetailItem.status === 'SubStock' ? 'bg-orange-900/20 border-orange-800' :
                          'bg-red-900/20 border-red-800'
                      }`}>
                          <div className="text-gray-400 text-xs font-bold uppercase mb-1">Situación</div>
                          <div className={`text-2xl font-bold ${
                              selectedDetailItem.status === 'NormoStock' ? 'text-green-400' :
                              selectedDetailItem.status === 'SobreStock' ? 'text-indigo-400' :
                              selectedDetailItem.status === 'SubStock' ? 'text-orange-400' :
                              'text-red-400'
                          }`}>
                              {selectedDetailItem.status}
                          </div>
                      </div>
                  </div>

                  {/* Consumption Table */}
                  <div className="p-6 overflow-x-auto">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4">
                          <h3 className="text-white font-bold flex items-center gap-2">
                              <FileSpreadsheet className="h-4 w-4 text-teal-500" />
                              Histórico de Consumo (Últimos 12 Meses)
                          </h3>
                          <div className="flex gap-3">
                              <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2">
                                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Suma Total</span>
                                  <span className="text-white font-mono font-bold text-lg leading-none">{selectedDetailItem.consumptionSum}</span>
                              </div>
                              <div className="bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700 flex items-center gap-2">
                                  <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Meses con Consumo</span>
                                  <span className="text-white font-mono font-bold text-lg leading-none">{selectedDetailItem.consumptionMonths}</span>
                              </div>
                          </div>
                      </div>
                      <div className="border border-gray-700 rounded-lg overflow-hidden">
                          <div className="grid grid-cols-12 divide-x divide-gray-700 bg-gray-950 text-gray-400 text-xs font-bold uppercase text-center">
                              {['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'].map((month, i) => (
                                  <div key={i} className="p-3">{month}</div>
                              ))}
                          </div>
                          <div className="grid grid-cols-12 divide-x divide-gray-700 bg-gray-900 text-white font-mono text-sm font-bold text-center">
                              {selectedDetailItem.monthlyConsumption && selectedDetailItem.monthlyConsumption.length === 12 ? (
                                  selectedDetailItem.monthlyConsumption.map((val, i) => (
                                      <div key={i} className={`p-4 ${val === 0 ? 'text-gray-600' : ''}`}>
                                          {val}
                                      </div>
                                  ))
                              ) : (
                                  <div className="col-span-12 p-4 text-gray-500 italic">
                                      No hay datos de consumo mensual disponibles.
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  {/* Footer */}
                  <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex justify-end">
                      <button 
                          onClick={() => setIsDetailModalOpen(false)}
                          className="px-6 py-2 bg-white text-gray-900 font-bold rounded-lg hover:bg-gray-100 transition-colors"
                      >
                          Cerrar
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* TRANSFER MODAL REMOVED */}
    </div>
  );
};
