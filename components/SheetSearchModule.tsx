import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Search, Database, RefreshCw, AlertCircle, Link as LinkIcon, FileSpreadsheet, Settings, Save, Check, CheckCircle2, XCircle, Copy, X, Plus, Trash2, Building2, ChevronRight, ChevronLeft, MapPin, Clock, AlertTriangle, Download, Filter, ArrowLeft, ChevronDown, LayoutGrid, List, Grid, Table2, ArrowUp, ArrowDown, ArrowUpDown, Hospital, Monitor, Stethoscope, Package, Wifi, WifiOff, FileClock, Maximize2, Minimize2, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface SIGData {
  ALMCOD: string;
  DESC_ALM: string;
  ID_Producto: string;
  CODIGO_SIG: string;
  Nombre: string;
  Lote: string;
  Fec_Vencim: string;
  Reg_Sanitario: string;
  TIPSUM: string;
  DESC_TIPSUM: string;
  FFINAN: string;
  DESC_FFINAN: string;
  Saldo: string;
  Precio_Det: string;
  Precio_Cab: string;
  FECHA_DEL_EQUIPO?: string;
  Ultima_Actualizacion: string;
  sourceId?: string;
  [key: string]: any;
}

interface SheetSource {
  id: string;
  name: string;
  urlIndex: number;
  lastUpdate?: string;
  lastUpdateTime?: number;
  equipmentDate?: string;
  equipmentDateTime?: number;
}

const parseDataDate = (str?: string): number => {
    if (!str) return 0;
    // Intentar parseo nativo primero
    let d = new Date(str);
    if (!isNaN(d.getTime())) return d.getTime();
    
    // Intentar DD/MM/YYYY HH:MM:SS (común en sheets latinas)
    try {
        const parts = str.trim().split(/\s+/);
        const datePart = parts[0].replace(',', '');
        const timePart = parts[1] || '00:00:00';
        const dateMatch = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateMatch) {
            const [, day, month, year] = dateMatch;
            d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}`);
            return d.getTime() || 0;
        }
    } catch(e) {}
    
    return 0;
};

const formatFullDate = (timestamp?: number): string => {
    if (!timestamp || timestamp === 0) return 'Sin fecha';
    const d = new Date(timestamp);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
};

const datesMatch = (ts1?: number, ts2?: number): boolean => {
    if (!ts1 || !ts2) return true;
    const d1 = new Date(ts1);
    const d2 = new Date(ts2);
    return d1.getDate() === d2.getDate() && 
           d1.getMonth() === d2.getMonth() && 
           d1.getFullYear() === d2.getFullYear();
};

const getUpdateStatus = (timestamp?: number) => {
    if (!timestamp || timestamp === 0) return { color: 'bg-gray-400', label: 'Sin datos', fullLabel: 'Sin datos' };
    
    const now = new Date().getTime();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
        return { color: 'bg-emerald-500', label: 'Actualizado recientemente', fullLabel: 'Actualizado recientemente' };
    }
    
    // Dentro de la hora (<= 1 hora): Verde
    if (diffHours <= 1) {
        const minLabel = diffMinutes <= 0 ? '< 1m' : `${diffMinutes}m`;
        const minFullLabel = diffMinutes <= 0 ? 'Menos de un minuto' : `${diffMinutes} minuto${diffMinutes !== 1 ? 's' : ''}`;
        return { 
            color: 'bg-emerald-500', 
            label: `Hace ${minLabel}`,
            fullLabel: `Hace ${minFullLabel}`
        };
    }
    
    // Entre 1 y 24 horas: Amarillo
    if (diffHours <= 24) {
        const hrs = Math.floor(diffHours);
        const mins = diffMinutes % 60;
        return { 
            color: 'bg-amber-500', 
            label: `Hace ${hrs}h ${mins}m`,
            fullLabel: `Hace ${hrs} hora${hrs !== 1 ? 's' : ''} ${mins} minuto${mins !== 1 ? 's' : ''}`
        };
    }
    
    // Más de 24 horas: Rojo
    const days = Math.floor(diffHours / 24);
    const hrs = Math.floor(diffHours) % 24;
    return { 
        color: 'bg-red-500', 
        label: `Hace ${days}d ${hrs}h`,
        fullLabel: `Hace ${days} día${days !== 1 ? 's' : ''} ${hrs} hora${hrs !== 1 ? 's' : ''}`
    };
};

const renderSyncStatusPill = (timestamp?: number) => {
    const statusObj = getUpdateStatus(timestamp);
    const isEmerald = statusObj.color.includes('emerald') || statusObj.color.includes('bg-emerald-500');
    const isAmber = statusObj.color.includes('amber') || statusObj.color.includes('bg-amber-500');
    const isRed = statusObj.color.includes('red') || statusObj.color.includes('bg-red-500');
    
    let containerClass = "bg-slate-50 text-slate-500 border-slate-200";
    let dotClass = "bg-slate-400";
    
    if (isEmerald) {
        containerClass = "bg-[#f0fdf4] text-[#166534] border-[#bbf7d0] hover:bg-[#e8fbf0]";
        dotClass = "bg-[#22c55e]";
    } else if (isAmber) {
        containerClass = "bg-[#fffbeb] text-[#92400e] border-[#fef08a] hover:bg-[#fff9db]";
        dotClass = "bg-[#f59e0b]";
    } else if (isRed) {
        containerClass = "bg-[#fef2f2] text-[#991b1b] border-[#fecaca] hover:bg-[#fee2e2]";
        dotClass = "bg-[#ef4444]";
    }
    
    return (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8.5px] font-black tracking-wide border shadow-3xs transition-colors select-none whitespace-nowrap overflow-hidden ${containerClass}`}>
            <span className={`h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full shrink-0 ${dotClass}`} />
            <span className="truncate">{statusObj.label}</span>
        </span>
    );
};

const getSheetType = (name: string): 'CS' | 'PS' | 'ALM' | 'HOSP' | 'OTRO' => {
    const u = name.toUpperCase();
    if (u.includes('C.S.') || u.includes('CENTRO DE SALUD')) return 'CS';
    if (u.includes('P.S.') || u.includes('PUESTO DE SALUD')) return 'PS';
    if (u.includes('ALM') || u.includes('ALMACEN')) return 'ALM';
    if (u.includes('HOSP') || u.includes('HOSPITAL')) return 'HOSP';
    return 'OTRO';
};

const formatDate = (dateValue: any): string => {
    if (!dateValue) return '';
    const str = String(dateValue).trim();
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(str)) {
        return str;
    }
    try {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) {
            const day = date.getDate().toString().padStart(2, '0');
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    } catch (e) {}
    return str;
};

interface UngetConfig {
  url: string;
  name: string;
}

const formatAlmCode = (code: string | undefined): string => {
    if (!code) return '-';
    const c = String(code).trim();
    if (c.length >= 8) {
        if (c.substring(5, 8).toUpperCase() === 'F01') {
            return c.substring(0, 5);
        }
        return c.substring(0, c.length - 2);
    }
    return c;
};

const getItemExpiration = (item: SIGData): { month: number; year: number } | null => {
    if (!item || !item.Fec_Vencim) return null;
    const parts = item.Fec_Vencim.split(/[\/\-]/);
    if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);

        let month = 0, year = 2000;

        if (p0 > 1000) {
            year = p0;
            month = p1 - 1;
        } else if (p2 > 1000 || p2 < 100) {
            year = p2 < 100 ? p2 + 2000 : p2;
            if (p0 > 12) {
                month = p1 - 1;
            } else if (p1 > 12) {
                month = p0 - 1;
            } else {
                month = p1 - 1;
            }
        }
        if (!isNaN(month) && !isNaN(year)) {
            return { month: month + 1, year };
        }
    } else if (parts.length === 2) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        if (!isNaN(p0) && !isNaN(p1)) {
            const month = p0;
            const year = p1 < 100 ? p1 + 2000 : p1;
            return { month, year };
        }
    }
    return null;
};

const getAlmCodeForSheet = (sheetId: string, sheetData: SIGData[]): string => {
    const row = sheetData.find(r => r.sourceId === sheetId && r.ALMCOD);
    return row ? formatAlmCode(row.ALMCOD) : '';
};

const getExpirationStats = (records: SIGData[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
    const nextMonthYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    
    const expired: SIGData[] = [];
    const expiringThisMonth: SIGData[] = [];
    const expiringNextMonth: SIGData[] = [];
    
    records.forEach(r => {
        const stock = parseFloat(String(r.Saldo || '0').replace(/,/g, ''));
        if (stock <= 0) return;
        if (!r.Fec_Vencim) return;
        
        const parts = r.Fec_Vencim.split(/[\/\-]/);
        if (parts.length === 3) {
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            const p2 = parseInt(parts[2], 10);

            let day = 1, month = 0, year = 2000;

            if (p0 > 1000) {
                // format YYYY-MM-DD
                year = p0;
                month = p1 - 1;
                day = p2;
            } else if (p2 > 1000 || p2 < 100) {
                // format DD/MM/YYYY or MM/DD/YYYY
                year = p2 < 100 ? p2 + 2000 : p2;
                if (p0 > 12) {
                    day = p0;
                    month = p1 - 1;
                } else if (p1 > 12) {
                    month = p0 - 1;
                    day = p1;
                } else {
                    // Default to DD/MM/YYYY
                    day = p0;
                    month = p1 - 1;
                }
            }

            if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                const expDate = new Date(year, month, day);
                // Consider expired strictly if end of the day passed
                expDate.setHours(23, 59, 59, 999);
                
                if (expDate < today) {
                    expired.push(r);
                } else if (month === currentMonth && year === currentYear) {
                    expiringThisMonth.push(r);
                } else if (month === nextMonth && year === nextMonthYear) {
                    expiringNextMonth.push(r);
                }
            }
        } else if (parts.length === 2) {
            // MM/YYYY or MM/YY
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            if (!isNaN(p0) && !isNaN(p1)) {
                const month = p0 - 1;
                const year = p1 < 100 ? p1 + 2000 : p1;
                // Expiry is end of the month
                const expDate = new Date(year, month + 1, 0, 23, 59, 59, 999);
                if (expDate < today) {
                    expired.push(r);
                } else if (month === currentMonth && year === currentYear) {
                    expiringThisMonth.push(r);
                } else if (month === nextMonth && year === nextMonthYear) {
                    expiringNextMonth.push(r);
                }
            }
        }
    });

    return { 
        expired, 
        expiringThisMonth,
        expiringNextMonth,
        expiredCount: expired.length, 
        expiringThisMonthCount: expiringThisMonth.length,
        expiringNextMonthCount: expiringNextMonth.length
    };
};

export const SheetSearchModule: React.FC = () => {
    const { user, hasPermission } = useAuth();
    const canAccess = hasPermission('SIG_SEARCH');

    // Configuración
    const [scriptUrls, setScriptUrls] = useState<UngetConfig[]>([]);
    const [sources, setSources] = useState<SheetSource[]>([]);
    const [data, setData] = useState<SIGData[]>([]);
    
    // UI states
    const [isLoading, setIsLoading] = useState(false);
    const [isSilentSyncing, setIsSilentSyncing] = useState(false);
    const [isConfigLoading, setIsConfigLoading] = useState(true); // Nuevo: Estado para carga de config
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sheetSearchTerm, setSheetSearchTerm] = useState('');
    const [ungetSearchTerm, setUngetSearchTerm] = useState('');
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    
    // Filtros Avanzados (Sidebar Derecha)
    const [isAdvancedFiltersSidebarOpen, setIsAdvancedFiltersSidebarOpen] = useState(false);
    const [filter_CS, setFilter_CS] = useState(true);
    const [filter_PS, setFilter_PS] = useState(true);
    const [filter_ALM, setFilter_ALM] = useState(true);
    const [filter_HOSP, setFilter_HOSP] = useState(true);
    const [filter_OTRO, setFilter_OTRO] = useState(true);

    const [filter_emerald, setFilter_emerald] = useState(true);
    const [filter_amber, setFilter_amber] = useState(true);
    const [filter_red, setFilter_red] = useState(true);
    const [filter_gray, setFilter_gray] = useState(true);

    const [filterSortOrder, setFilterSortOrder] = useState<string>('name_asc');
    const [filterHasPendingExpirations, setFilterHasPendingExpirations] = useState<boolean>(false);
    const [filterDateLimit, setFilterDateLimit] = useState<'all' | '1h' | '12h' | '24h' | '3d' | '7d'>('all');
    
    // Estados para dropdowns de filtros personalizados
    const [isDateLimitDropdownOpen, setIsDateLimitDropdownOpen] = useState(false);
    const [isSortOrderDropdownOpen, setIsSortOrderDropdownOpen] = useState(false);
    const [isExportDateLimitDropdownOpen, setIsExportDateLimitDropdownOpen] = useState(false);
    
    // Navigation hierarchy
    const [viewLevel, setViewLevel] = useState<'ungets' | 'sheets' | 'data'>('ungets');
    const [selectedUngetIndex, setSelectedUngetIndex] = useState<number | null>(null);
    const [selectedSourceId, setSelectedSourceId] = useState<string>(''); 
    const [sheetsViewMode, setSheetsViewMode] = useState<'grid' | 'list' | 'compact' | 'table'>('grid');
    const [isTableFullscreen, setIsTableFullscreen] = useState(false);
    const [stockModalSourceId, setStockModalSourceId] = useState<string | null>(null);
    const [stockModalSearchTerm, setStockModalSearchTerm] = useState('');

    // Handler to toggle native fullscreen + React state
    const handleToggleTableFullscreen = (targetState: boolean) => {
        const elem = document.documentElement;
        if (targetState) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen().catch(err => console.error("Error enabling full-screen mode:", err));
            } else if ((elem as any).webkitRequestFullscreen) {
                (elem as any).webkitRequestFullscreen();
            } else if ((elem as any).msRequestFullscreen) {
                (elem as any).msRequestFullscreen();
            }
            setIsTableFullscreen(true);
        } else {
            if (document.exitFullscreen && document.fullscreenElement) {
                document.exitFullscreen().catch(err => console.error("Error exiting full-screen mode:", err));
            } else if ((document as any).webkitExitFullscreen) {
                (document as any).webkitExitFullscreen();
            } else if ((document as any).msExitFullscreen) {
                (document as any).msExitFullscreen();
            }
            setIsTableFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => {
            const isNativeFullScreen = !!document.fullscreenElement || 
                                       !!(document as any).webkitFullscreenElement || 
                                       !!(document as any).msFullscreenElement;
            if (!isNativeFullScreen) {
                setIsTableFullscreen(false);
            }
        };

        document.addEventListener('fullscreenchange', handleFullScreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullScreenChange);
        document.addEventListener('msfullscreenchange', handleFullScreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullScreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullScreenChange);
            document.removeEventListener('msfullscreenchange', handleFullScreenChange);
        };
    }, []);
    // Modal & Config
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
    const [isDataFiltersOpen, setIsDataFiltersOpen] = useState(false);
    const [dataFilterTipsum, setDataFilterTipsum] = useState<string>('all');
    const [dataFilterFFinan, setDataFilterFFinan] = useState<string>('all');
    const [dataFilterStock, setDataFilterStock] = useState<string>('all');
    const [dataFilterExpiration, setDataFilterExpiration] = useState<string>('all');
    const [dataFilterExpMonth, setDataFilterExpMonth] = useState<string>('all');
    const [dataFilterExpYear, setDataFilterExpYear] = useState<string>('all');
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
    const [reportSort, setReportSort] = useState<{ field: 'name' | 'status' | 'date', order: 'asc' | 'desc' }>({ field: 'date', order: 'asc' });
    const reportTableRef = useRef<HTMLDivElement>(null);

    const exportReportToExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Reporte de Actualización', {
            views: [{ showGridLines: true }]
        });

        // Generar fecha actual formateada
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        const currentDateStr = `${day}-${month}-${year}`;

        // Fila 1: Título del Reporte
        ws.addRow([`Reporte de actualización de Stock detallado SISMED ${currentDateStr}`]);
        ws.mergeCells('A1:G1');
        const titleCell = ws.getCell('A1');
        titleCell.font = {
            name: 'Calibri',
            size: 16,
            bold: true,
            color: { argb: '000000' }
        };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(1).height = 40;

        // Fila 2: En blanco para espaciado
        ws.addRow([]);
        ws.getRow(2).height = 12;

        // Fila 3: Encabezados de Columnas
        const headers = [
            'COD. SISMED',
            'ESTABLECIMIENTO',
            'ESTADO DE ACTUALIZACION',
            'FECHA DEL EQUIPO',
            'ULTIMA ACTUALIZACION',
            'VENCIDOS',
            'VENCEN ESTE MES',
            'VENCEN PROX. MES'
        ];

        ws.addRow(headers);
        
        ws.getRow(3).eachCell(cell => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: '002060' }
            };
            cell.font = {
                color: { argb: 'FFFFFF' },
                bold: true,
                name: 'Calibri',
                size: 11
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFFFFF' } },
                left: { style: 'thin', color: { argb: 'FFFFFF' } },
                bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
                right: { style: 'thin', color: { argb: 'FFFFFF' } }
            };
        });
        ws.getRow(3).height = 25;

        // Rellenar Datos (Fila 4 en adelante)
        sortedReportSources.forEach((sheet, idx) => {
            const lastDash = sheet.name.lastIndexOf('-');
            const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
            const code = getAlmCodeForSheet(sheet.id, data);
            const status = getUpdateStatus(sheet.lastUpdateTime);
            
            const sheetData = data.filter(r => r.sourceId === sheet.id);
            const { expiredCount, expiringThisMonthCount, expiringNextMonthCount } = getExpirationStats(sheetData);

            let bgArgb = 'FFFFFF';
            let fontArgb = '000000';
            
            if (status.color === 'bg-red-500') {
                bgArgb = 'FF8080'; // Rojo suave / agradable
                fontArgb = '000000';
            } else if (status.color === 'bg-amber-500') {
                bgArgb = 'FFC000'; // Amarillo/Ambar
                fontArgb = '000000';
            } else if (status.color === 'bg-emerald-500') {
                bgArgb = '92D050'; // Verde
                fontArgb = '000000';
            } else if (status.color === 'bg-gray-400') {
                bgArgb = 'D9D9D9'; // Gris
                fontArgb = '595959';
            }

            const codeStr = code ? String(code).trim() : '';

            const row = ws.addRow([
                codeStr,
                description,
                status.label,
                sheet.equipmentDateTime ? formatFullDate(sheet.equipmentDateTime) : 'No disponible',
                sheet.lastUpdateTime ? formatFullDate(sheet.lastUpdateTime) : 'No sincronizado',
                expiredCount,
                expiringThisMonthCount,
                expiringNextMonthCount
            ]);

            row.eachCell((cell, colNumber) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: bgArgb }
                };
                cell.font = {
                    color: { argb: fontArgb },
                    name: 'Calibri',
                    size: 11
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFF' } }
                };
                
                if (colNumber === 1) {
                    cell.numFmt = '@'; // Forzar formato texto para preservar ceros a la izquierda
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber === 2) {
                    cell.alignment = { horizontal: 'left', vertical: 'middle' };
                } else {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            });
            row.height = 20;
        });

        ws.getColumn(1).width = 15;
        ws.getColumn(2).width = 35;
        ws.getColumn(3).width = 32;
        ws.getColumn(4).width = 25;
        ws.getColumn(5).width = 25;
        ws.getColumn(6).width = 15;
        ws.getColumn(7).width = 20;
        ws.getColumn(8).width = 20;

        const buffer = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Reporte_General_Stock_${formatFullDate(Date.now()).replace(/[:/ ]/g, '_')}.xlsx`);
    };
    
    // States for Export Options Modal
    const [isExportOptionsModalOpen, setIsExportOptionsModalOpen] = useState(false);
    const [exportCS, setExportCS] = useState(true);
    const [exportPS, setExportPS] = useState(true);
    const [exportALM, setExportALM] = useState(true);
    const [exportHOSP, setExportHOSP] = useState(true);
    const [exportOTRO, setExportOTRO] = useState(true);

    const [exportEmerald, setExportEmerald] = useState(true);
    const [exportAmber, setExportAmber] = useState(true);
    const [exportRed, setExportRed] = useState(true);
    const [exportGray, setExportGray] = useState(true);

    const [exportDateLimit, setExportDateLimit] = useState<'all' | '1h' | '12h' | '24h' | '3d' | '7d'>('all');
    const [exportHasPendingExpirations, setExportHasPendingExpirations] = useState<boolean>(false);
    const [exportScope, setExportScope] = useState<'single' | 'all'>('single');
    const [editingIndex, setEditingIndex] = useState<number | null>(null); // Nuevo: índice que se está editando
    const [tempUrls, setTempUrls] = useState<UngetConfig[]>([]);
    const [newUrlInput, setNewUrlInput] = useState('');
    const [newNameInput, setNewNameInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<SIGData | null>(null);

    // Modal para vencimientos en tabla
    const [isExpirationModalOpen, setIsExpirationModalOpen] = useState(false);
    const [expirationModalType, setExpirationModalType] = useState<'expired' | 'expiring' | null>(null);

    const maxUrlsAllowed = user?.maxUrlsAllowed;

    // Publicar evento al cambiar el estado de los filtros avanzados para contraer el sidebar de App.tsx
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('toggle-advanced-filters', {
            detail: { open: isAdvancedFiltersSidebarOpen }
        }));
    }, [isAdvancedFiltersSidebarOpen]);

    // Cerrar automáticamente los filtros avanzados si se sale del nivel de sheets/establecimientos
    useEffect(() => {
        if (viewLevel !== 'sheets') {
            setIsAdvancedFiltersSidebarOpen(false);
        }
        if (viewLevel !== 'data') {
            setIsDataFiltersOpen(false);
            setDataFilterTipsum('all');
            setDataFilterFFinan('all');
            setDataFilterStock('all');
            setDataFilterExpiration('all');
        }
    }, [viewLevel]);

    // Initialize from server
    useEffect(() => {
        if (!user || !canAccess) return;
        
        const loadConfigs = async () => {
            setIsConfigLoading(true);
            
            // 1. CARGA RÁPIDA DESDE CACHÉ (Optimistic UI)
            const savedUrls = localStorage.getItem(`aura_sig_urls_${user.username}`);
            if (savedUrls) {
                try {
                    const parsed = JSON.parse(savedUrls);
                    if (Array.isArray(parsed) && parsed.length > 0) setScriptUrls(parsed);
                } catch(e) {}
            }
            
            const savedSources = localStorage.getItem(`aura_sig_sources_${user.username}`);
            if (savedSources) {
                try {
                    const parsed = JSON.parse(savedSources);
                    if (Array.isArray(parsed)) setSources(parsed);
                } catch(e) {}
            }

            const savedData = localStorage.getItem(`aura_sig_data_${user.username}`);
            if (savedData) {
                try {
                    const parsed = JSON.parse(savedData);
                    if (Array.isArray(parsed)) setData(parsed);
                } catch(e) {}
            }

            // 2. CARGA EN SEGUNDO PLANO DESDE EL SERVIDOR
            try {
                const remoteConfigs = await api.getUngetConfigs(user.username);
                if (remoteConfigs && remoteConfigs.length > 0) {
                    setScriptUrls(remoteConfigs);
                } else if (savedUrls) {
                    // Si no hay remoto pero sí local, intentar migrar al servidor
                    try {
                        const parsed = JSON.parse(savedUrls);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            const migrated = parsed.map(u => typeof u === 'string' ? { url: u, name: `UNGET ${Math.random().toString(36).substr(2, 4).toUpperCase()}` } : u);
                            setScriptUrls(migrated);
                            await api.saveUngetConfigs(user.username, migrated);
                        }
                    } catch(e) {}
                }
            } catch(e) {
                console.error("Error loading configs:", e);
            } finally {
                setIsConfigLoading(false);
            }
        };

        loadConfigs();
    }, [user, canAccess]);

    if (!canAccess) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-12 text-center">
                <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex flex-col items-center max-w-md">
                    <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                    <h3 className="text-xl font-black text-gray-900 mb-2">Acceso Restringido</h3>
                    <p className="text-gray-500 text-sm">
                        Su rol actual no tiene permisos para utilizar el módulo de Consulta Stock (SIG). 
                        Contacte al administrador para solicitar acceso.
                    </p>
                </div>
            </div>
        );
    }

    // Save to local storage when state changes
    useEffect(() => {
        if (!user || isConfigLoading) return; // IMPORTANTE: No guardar si aún estamos cargando la config inicial
        try {
            localStorage.setItem(`aura_sig_urls_${user.username}`, JSON.stringify(scriptUrls));
            localStorage.setItem(`aura_sig_sources_${user.username}`, JSON.stringify(sources));
        } catch (e) {
            console.warn("Storage quota exceeded for URLs/Sources.", e);
        }

        try {
            localStorage.setItem(`aura_sig_data_${user.username}`, JSON.stringify(data));
        } catch (e) {
            console.warn("Storage quota exceeded. Data will not be cached locally.", e);
        }
        
        if (sources.length > 0 && selectedSourceId !== '' && !sources.find(s => s.id === selectedSourceId)) {
            setSelectedSourceId('');
        }
    }, [scriptUrls, sources, data, selectedSourceId, user]);

    const fetchData = async (overrideUrls?: UngetConfig[], silent: boolean = false) => {
        if (isConfigLoading && !overrideUrls) return; 

        const urlsToUse = overrideUrls || scriptUrls;

        if (urlsToUse.length === 0) {
            if (!silent) {
                setError("Primero debe configurar al menos una URL de Web App de Apps Script.");
                setTempUrls([...urlsToUse]);
                setIsConfigOpen(true);
            }
            return;
        }

        if (!silent) {
            // Limpiar error inmediatamente al iniciar una carga válida
            setError(null);
            setIsLoading(true);
        } else {
            setIsSilentSyncing(true);
        }

        try {
            let allData: SIGData[] = [];
            let newSources: SheetSource[] = [];

            // Fetch todas las URLs en paralelo
            const fetchPromises = urlsToUse.map(async (config, urlIndex) => {
                try {
                    const response = await fetch(config.url);
                    if (!response.ok) throw new Error("HTTP " + response.status);
                    const json = await response.json();
                    
                    if (Array.isArray(json)) {
                        json.forEach((sheet: any) => {
                            const uniqueSourceId = `${urlIndex}_${sheet.id}`;
                            
                            let lastUpdateStr = '';
                            let lastUpdateTime = 0;
                            let equipmentDateStr = '';
                            let equipmentDateTime = 0;
                            
                            if (Array.isArray(sheet.data) && sheet.data.length > 0) {
                                // Tomar el dato de la primera fila de datos (que es la segunda de la hoja según el usuario)
                                const firstRow = sheet.data[0];
                                
                                // Capturar ÚLTIMA ACTUALIZACIÓN
                                if (firstRow.ULTIMA_ACTUALIZACION || firstRow.Ultima_Actualizacion || firstRow['ULTIMA ACTUALIZACION']) {
                                    lastUpdateStr = firstRow.ULTIMA_ACTUALIZACION || firstRow.Ultima_Actualizacion || firstRow['ULTIMA ACTUALIZACION'];
                                    lastUpdateTime = parseDataDate(lastUpdateStr);
                                }
                                
                                // Capturar FECHA DEL EQUIPO
                                if (firstRow.FECHA_DEL_EQUIPO || firstRow['FECHA DEL EQUIPO']) {
                                    equipmentDateStr = firstRow.FECHA_DEL_EQUIPO || firstRow['FECHA DEL EQUIPO'];
                                    equipmentDateTime = parseDataDate(equipmentDateStr);
                                }
                            }

                            newSources.push({ 
                                id: uniqueSourceId, 
                                name: sheet.name, 
                                urlIndex,
                                lastUpdate: lastUpdateStr,
                                lastUpdateTime: lastUpdateTime || undefined,
                                equipmentDate: equipmentDateStr,
                                equipmentDateTime: equipmentDateTime || undefined
                            });
                            
                            if (Array.isArray(sheet.data)) {
                                const validData = sheet.data.filter((row: any) => row && (row.ID_Producto || row.Nombre)).map((row: any) => {
                                    const rawUltima = row.ULTIMA_ACTUALIZACION || row.Ultima_Actualizacion || row['ULTIMA ACTUALIZACION'];
                                    const rawEquipo = row.FECHA_DEL_EQUIPO || row['FECHA DEL EQUIPO'];
                                    
                                    return {
                                        ...row,
                                        Fec_Vencim: formatDate(row.Fec_Vencim),
                                        Ultima_Actualizacion: formatDate(rawUltima),
                                        FECHA_DEL_EQUIPO: formatDate(rawEquipo),
                                        sourceId: uniqueSourceId
                                    };
                                });
                                allData = [...allData, ...validData];
                            }
                        });
                    }
                } catch (err: any) {
                    console.error(`Error fetching URL index ${urlIndex}:`, err);
                    throw new Error(`Fallo en fuente ${urlIndex + 1}: ${err.message}`);
                }
            });

            await Promise.all(fetchPromises);
            
            setSources(newSources);
            setData(allData);
            
            if (allData.length === 0 && !silent) {
               setError("No se encontraron registros en las hojas de cálculo. Revise que tengan información.");
            } else if (allData.length > 0 && silent && error) {
                setError(null); // Clear previous errors silently
            }
            
        } catch (err: any) {
            if (!silent) setError("Ocurrió un error al cargar los datos: " + err.message);
            else console.error("Silent auto-sync failed:", err);
        } finally {
            if (!silent) setIsLoading(false);
            else setIsSilentSyncing(false);
        }
    };

    // Al montar y cargar la configuración, hacer refresh de los datos.
    useEffect(() => {
        if (!isConfigLoading && scriptUrls.length > 0) {
            // Si no hay datos cacheados, hacemos fetch con UI de carga, sino, silent
            fetchData(undefined, data.length > 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConfigLoading]); // Solo cuando termine de cargar la configuración

    // Sincronización automática periódica y al enfocar ventana
    useEffect(() => {
        if (isConfigLoading || scriptUrls.length === 0) return;

        // Auto-sync cada 15 minutos (900000 ms)
        const AUTO_SYNC_INTERVAL = 15 * 60 * 1000;
        const intervalId = setInterval(() => {
            fetchData(undefined, true);
        }, AUTO_SYNC_INTERVAL);

        // Auto-sync al volver la pestaña (si ha pasado más de 10 minutos desde la última vez)
        let lastSyncTime = Date.now();
        const handleFocus = () => {
            const now = Date.now();
            if (now - lastSyncTime > 10 * 60 * 1000) {
                lastSyncTime = now;
                fetchData(undefined, true);
            }
        };

        window.addEventListener('focus', handleFocus);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scriptUrls, isConfigLoading]);

    const handleSaveConfig = async () => {
        if (!user) return;
        
        setIsLoading(true);
        try {
            const result = await api.saveUngetConfigs(user.username, tempUrls);
            if (result.success) {
                setScriptUrls([...tempUrls]);
                setIsConfigOpen(false);
                toast.success("Configuración guardada en la nube.");
                
                // Sincronizar datos inmediatamente con las nuevas URLs
                fetchData(tempUrls);
            } else {
                toast.error("Error al guardar en el servidor: " + result.message);
            }
        } catch (e) {
            toast.error("Error de conexión al guardar configuración.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUrl = () => {
        const url = newUrlInput.trim();
        const name = newNameInput.trim() || `UNGET ${tempUrls.length + 1}`;
        
        if (!url) return;

        if (editingIndex !== null) {
            // Caso edición
            const updated = [...tempUrls];
            updated[editingIndex] = { url, name };
            setTempUrls(updated);
            setEditingIndex(null);
        } else {
            // Caso nuevo
            if (maxUrlsAllowed && tempUrls.length >= maxUrlsAllowed) {
                toast.error(`Ha alcanzado el límite máximo de ${maxUrlsAllowed} URLs para su rol.`);
                return;
            }
            if (tempUrls.find(u => u.url === url)) {
                toast.error("Esta URL ya está registrada.");
                return;
            }
            setTempUrls([...tempUrls, { url, name }]);
        }

        setNewUrlInput('');
        setNewNameInput('');
    };

    const handleEditUrl = (index: number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const config = tempUrls[index];
        setEditingIndex(index);
        setNewUrlInput(config.url);
        setNewNameInput(config.name);
        setIsConfigOpen(true);
    };

    const handleDirectEdit = (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const config = scriptUrls[index];
        setTempUrls([...scriptUrls]);
        setEditingIndex(index);
        setNewUrlInput(config.url);
        setNewNameInput(config.name);
        setIsConfigOpen(true);
    };

    const handleDirectDelete = async (index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!user) return;
        
        // Usamos una confirmación por toast en lugar de window.confirm que falla en iframes
        toast("¿Eliminar esta conexión?", {
                description: `Se borrará el acceso a "${scriptUrls[index].name}"`,
                action: {
                    label: "Eliminar",
                    onClick: async () => {
                        const updated = scriptUrls.filter((_, idx) => idx !== index);
                        setIsLoading(true);
                        try {
                            const result = await api.saveUngetConfigs(user.username, updated);
                            if (result.success) {
                                setScriptUrls(updated);
                                if (selectedUngetIndex === index) {
                                    setViewLevel('ungets');
                                    setSelectedUngetIndex(null);
                                }
                                toast.success("Eliminado correctamente");
                            }
                        } catch(e) {
                            toast.error("Error al eliminar");
                        } finally {
                            setIsLoading(false);
                        }
                    }
                },
                cancel: {
                    label: "Cancelar",
                    onClick: () => {}
                }
            });
    };

    const handleSelectUnget = (index: number) => {
        setSelectedUngetIndex(index);
        setViewLevel('sheets');
        setSelectedSourceId('');
        setSearchTerm('');
    };

    const handleSelectSheet = (sourceId: string) => {
        if (isTableFullscreen) {
            setStockModalSourceId(sourceId);
            setStockModalSearchTerm('');
        } else {
            setSelectedSourceId(sourceId);
            setViewLevel('data');
            setSearchTerm('');
        }
    };

    const goBack = () => {
        if (viewLevel === 'data') {
            setViewLevel('sheets');
            setSelectedSourceId('');
        } else if (viewLevel === 'sheets') {
            setViewLevel('ungets');
            setSelectedUngetIndex(null);
        }
    };

    const handleRemoveUrl = (indexToRemove: number) => {
        setTempUrls(tempUrls.filter((_, idx) => idx !== indexToRemove));
    };

    const exportCurrentSheetToExcel = () => {
        if (!selectedSourceId) return;
        const sheetInfo = sources.find(s => s.id === selectedSourceId);
        if (!sheetInfo) return;

        const dataToExport = filteredData.map(r => ({
            'ALMCOD': r.ALMCOD || '',
            'DESC_ALM': r.DESC_ALM || sheetInfo.name || '',
            'ID_Producto': r.ID_Producto || '',
            'CODIGO_SIG': r.CODIGO_SIG || r.SIGA || '',
            'Nombre': r.Nombre || r.DESC_ITEM || '',
            'Lote': r.Lote || r.LOTE || '',
            'Fec_Vencim': r.Fec_Vencim || r.VENCIMIENTO || '',
            'Reg_Sanitario': r.Reg_Sanitario || r.REG_SANITARIO || '',
            'TIPSUM': r.TIPSUM || '',
            'DESC_TIPSUM': r.DESC_TIPSUM || r.TIPO_SUMINISTRO || '',
            'FFINAN': r.FFINAN || '',
            'DESC_FFINAN': r.DESC_FFINAN || r.FF || '',
            'Saldo': r.Saldo !== undefined ? r.Saldo : (r.SALDO !== undefined ? r.SALDO : ''),
            'Precio_Det': r.Precio_Det || r.PRECIO_COMPRA || '',
            'Precio_Cab': r.Precio_Cab || r.PRECIO_REF || '',
            'FECHA DEL EQUIPO': r.FECHA_DEL_EQUIPO || '',
            'ULTIMA ACTUALIZACION': r.Ultima_Actualizacion || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock");
        XLSX.writeFile(wb, `Stock_${sheetInfo.name}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
    };

    const exportModalStockToExcel = () => {
        if (!stockModalSourceId) return;
        const sheetInfo = sources.find(s => s.id === stockModalSourceId);
        if (!sheetInfo) return;

        const dataToExport = modalStockData.map(r => ({
            'ALMCOD': r.ALMCOD || '',
            'DESC_ALM': r.DESC_ALM || sheetInfo.name || '',
            'ID_Producto': r.ID_Producto || '',
            'CODIGO_SIG': r.CODIGO_SIG || r.SIGA || '',
            'Nombre': r.Nombre || r.DESC_ITEM || '',
            'Sub_Grupo': r.Sub_Grupo || '',
            'Saldo': typeof r.Saldo !== 'undefined' ? r.Saldo : (r.CANTIDAD || 0),
            'Precio_Cab': r.Precio_Cab || r.PRECIO_REF || '',
            'Lote': r.Lote || r.LOTE || '',
            'Fec_Vencim': r.Fec_Vencim ? formatDate(r.Fec_Vencim) : r.FECHA_VENCIMIENTO || '',
            'Mes_Vencim': r.Mes_Vencim || '',
            'Año_Vencim': r.Año_Vencim || '',
            'Reg_Sanitario': r.Reg_Sanitario || r.REGISTRO_SANITARIO || '',
            'TIPSUM': r.TIPSUM || r.TIPO_SUMINISTRO || '',
            'DESC_TIPSUM': r.DESC_TIPSUM || '',
            'ESTMNT': r.ESTMNT || '',
            'FFINAN': r.FFINAN || r.FUENTE_FINANCIAMIENTO || '',
            'DESC_FFINAN': r.DESC_FFINAN || '',
            'FECHA DEL EQUIPO': r.FECHA_DEL_EQUIPO || '',
            'Ultima_Actualizacion': r.Ultima_Actualizacion || ''
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock");
        XLSX.writeFile(wb, `Stock_${sheetInfo.name}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
    };

    const exportAllEstablishmentsToExcel = () => {
        if (selectedUngetIndex === null) return;
        setExportScope('single');
        // Pre-populate modal filters with the currently active advanced sidebar filters
        setExportCS(filter_CS);
        setExportPS(filter_PS);
        setExportALM(filter_ALM);
        setExportHOSP(filter_HOSP);
        setExportOTRO(filter_OTRO);

        setExportEmerald(filter_emerald);
        setExportAmber(filter_amber);
        setExportRed(filter_red);
        setExportGray(filter_gray);

        setExportHasPendingExpirations(filterHasPendingExpirations);
        setExportDateLimit(filterDateLimit);

        setIsExportOptionsModalOpen(true);
    };

    const filteredExportSourcesCount = useMemo(() => {
        if (exportScope === 'single' && selectedUngetIndex === null) return 0;
        return sources.filter(s => {
            if (exportScope === 'single' && s.urlIndex !== selectedUngetIndex) return false;
            
            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !exportCS) return false;
            if (typeValue === 'PS' && !exportPS) return false;
            if (typeValue === 'ALM' && !exportALM) return false;
            if (typeValue === 'HOSP' && !exportHOSP) return false;
            if (typeValue === 'OTRO' && !exportOTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !exportEmerald) return false;
            if (colorValue === 'bg-amber-500' && !exportAmber) return false;
            if (colorValue === 'bg-red-500' && !exportRed) return false;
            if (colorValue === 'bg-gray-400' && !exportGray) return false;

            // Date limit filter
            if (exportDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (exportDateLimit === '1h' && diffHours > 1) return false;
                if (exportDateLimit === '12h' && diffHours > 12) return false;
                if (exportDateLimit === '24h' && diffHours > 24) return false;
                if (exportDateLimit === '3d' && diffHours > 72) return false;
                if (exportDateLimit === '7d' && diffHours > 168) return false;
            }

            return true;
        }).length;
    }, [
        sources,
        selectedUngetIndex,
        exportScope,
        exportCS,
        exportPS,
        exportALM,
        exportHOSP,
        exportOTRO,
        exportEmerald,
        exportAmber,
        exportRed,
        exportGray,
        exportDateLimit
    ]);

    const executeExportAllEstablishmentsToExcel = () => {
        if (exportScope === 'single' && selectedUngetIndex === null) return;
        
        // Filter sources based on conditions configured in the export modal
        const filteredSources = sources.filter(s => {
            if (exportScope === 'single' && s.urlIndex !== selectedUngetIndex) return false;
            
            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !exportCS) return false;
            if (typeValue === 'PS' && !exportPS) return false;
            if (typeValue === 'ALM' && !exportALM) return false;
            if (typeValue === 'HOSP' && !exportHOSP) return false;
            if (typeValue === 'OTRO' && !exportOTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !exportEmerald) return false;
            if (colorValue === 'bg-amber-500' && !exportAmber) return false;
            if (colorValue === 'bg-red-500' && !exportRed) return false;
            if (colorValue === 'bg-gray-400' && !exportGray) return false;

            // Date limit filter
            if (exportDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (exportDateLimit === '1h' && diffHours > 1) return false;
                if (exportDateLimit === '12h' && diffHours > 12) return false;
                if (exportDateLimit === '24h' && diffHours > 24) return false;
                if (exportDateLimit === '3d' && diffHours > 72) return false;
                if (exportDateLimit === '7d' && diffHours > 168) return false;
            }

            return true;
        });

        const filteredSourceIds = new Set(filteredSources.map(s => s.id));

        // Filter data items belonging to the filtered sources
        const ungetData = data.filter(r => {
            if (!r.sourceId || !filteredSourceIds.has(r.sourceId)) return false;

            // Expiration filter
            if (exportHasPendingExpirations) {
                const { expiredCount, expiringThisMonthCount } = getExpirationStats([r]);
                if (expiredCount === 0 && expiringThisMonthCount === 0) return false;
            }
            
            return true;
        });

        if (ungetData.length === 0) {
            alert('No hay registros de stock que coincidan con los filtros seleccionados para exportar.');
            return;
        }

        const dataToExport = ungetData.map(r => {
            const sheetInfo = sources.find(s => s.id === r.sourceId);
            const ungetInfo = sheetInfo ? scriptUrls[sheetInfo.urlIndex] : null;
            return {
                'UNGET': ungetInfo ? ungetInfo.name : 'N/A',
                'ALMCOD': r.ALMCOD || '',
                'DESC_ALM': r.DESC_ALM || (sheetInfo ? sheetInfo.name : ''),
                'ID_Producto': r.ID_Producto || '',
                'CODIGO_SIG': r.CODIGO_SIG || r.SIGA || '',
                'Nombre': r.Nombre || r.DESC_ITEM || '',
                'Lote': r.Lote || r.LOTE || '',
                'Fec_Vencim': r.Fec_Vencim || r.VENCIMIENTO || '',
                'Reg_Sanitario': r.Reg_Sanitario || r.REG_SANITARIO || '',
                'TIPSUM': r.TIPSUM || '',
                'DESC_TIPSUM': r.DESC_TIPSUM || r.TIPO_SUMINISTRO || '',
                'FFINAN': r.FFINAN || '',
                'DESC_FFINAN': r.DESC_FFINAN || r.FF || '',
                'Saldo': r.Saldo !== undefined ? r.Saldo : (r.SALDO !== undefined ? r.SALDO : ''),
                'Precio_Det': r.Precio_Det || r.PRECIO_COMPRA || '',
                'Precio_Cab': r.Precio_Cab || r.PRECIO_REF || '',
                'FECHA DEL EQUIPO': r.FECHA_DEL_EQUIPO || '',
                'ULTIMA ACTUALIZACION': r.Ultima_Actualizacion || ''
            };
        });

        const ungetName = (exportScope === 'single' && selectedUngetIndex !== null) ? (scriptUrls[selectedUngetIndex]?.name || 'UNGET') : 'Regional';
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Stock Consolidado");
        
        if (exportScope === 'single') {
            XLSX.writeFile(wb, `Stock_Consolidado_${ungetName}_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
        } else {
            XLSX.writeFile(wb, `Stock_Consolidado_Regional_${new Date().toISOString().split('T')[0]}.xlsx`.replace(/\s+/g, '_'));
        }
        
        setIsExportOptionsModalOpen(false);
    };

    const exportAllUngetsToExcel = () => {
        if (data.length === 0) return;
        setExportScope('all');
        // Pre-populate modal filters with the currently active advanced sidebar filters
        setExportCS(filter_CS);
        setExportPS(filter_PS);
        setExportALM(filter_ALM);
        setExportHOSP(filter_HOSP);
        setExportOTRO(filter_OTRO);

        setExportEmerald(filter_emerald);
        setExportAmber(filter_amber);
        setExportRed(filter_red);
        setExportGray(filter_gray);

        setExportHasPendingExpirations(filterHasPendingExpirations);
        setExportDateLimit(filterDateLimit);

        setIsExportOptionsModalOpen(true);
    };

    const copyScript = () => {
        navigator.clipboard.writeText(scriptCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const scriptCode = `function doGet(e) {
  // Reemplace 'VUESTRO_ID_AQUI' con el ID real de su Google Sheet
  // Por defecto he colocado el que suministró:
  var id = '1vic6MeMiA5Jk4_UWx8nI462yXe8irgxAoMncJiekOOA';
  
  try {
    var ss = SpreadsheetApp.openById(id);
    var sheets = ss.getSheets();
    var result = [];
    
    for (var i = 0; i < sheets.length; i++) {
        var sheet = sheets[i];
        var data = sheet.getDataRange().getValues();
        if (data.length < 2) continue; // Saltar sin datos
        
        var headers = data[0];
        var rows = [];
        
        for (var j = 1; j < data.length; j++) {
            var row = data[j];
            var obj = {};
            var hasData = false;
            for (var k = 0; k < headers.length; k++) {
                if (headers[k]) {
                    obj[headers[k].toString().trim()] = row[k] !== undefined ? row[k].toString() : "";
                    if (row[k]) hasData = true;
                }
            }
            if(hasData) rows.push(obj);
        }
        
        result.push({
            id: sheet.getSheetId().toString(),
            name: sheet.getName(),
            data: rows
        });
    }
    
    // Devolver un JSON válido respetando el Cross-Origin (CORS)
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
      return ContentService.createTextOutput(JSON.stringify({error: err.message})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

    const filteredUngets = useMemo(() => {
        if (!ungetSearchTerm.trim()) return scriptUrls;
        const term = ungetSearchTerm.toLowerCase();
        return scriptUrls.filter(u => u.name.toLowerCase().includes(term));
    }, [scriptUrls, ungetSearchTerm]);

    const filteredData = useMemo(() => {
        let currentData = selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : data;
        currentData = currentData.filter(Boolean);

        return currentData.filter(item => {
            // 1. Search term check
            if (searchTerm.trim()) {
                const lowerTerm = searchTerm.toLowerCase();
                const matchesSearch = (
                    String(item.Nombre || '').toLowerCase().includes(lowerTerm) ||
                    String(item.CODIGO_SIG || '').toLowerCase().includes(lowerTerm) ||
                    String(item.ID_Producto || '').toLowerCase().includes(lowerTerm) ||
                    String(item.Lote || '').toLowerCase().includes(lowerTerm) ||
                    String(item.DESC_ALM || '').toLowerCase().includes(lowerTerm) ||
                    String(item.Reg_Sanitario || '').toLowerCase().includes(lowerTerm)
                );
                if (!matchesSearch) return false;
            }

            // 2. Tipsum filter (dynamic match)
            if (dataFilterTipsum !== 'all') {
                const tipsum = String(item.TIPSUM || '').toUpperCase().trim();
                if (tipsum !== dataFilterTipsum.toUpperCase().trim()) return false;
            }

            // 3. FFinan filter (dynamic match)
            if (dataFilterFFinan !== 'all') {
                const ffinan = String(item.FFINAN || '').toUpperCase().trim();
                if (ffinan !== dataFilterFFinan.toUpperCase().trim()) return false;
            }

            // 4. Stock filter (with_stock: >0, no_stock: <=0)
            if (dataFilterStock !== 'all') {
                const stockVal = parseFloat(String(item.Saldo || '0').replace(/,/g, ''));
                if (dataFilterStock === 'with_stock' && stockVal <= 0) return false;
                if (dataFilterStock === 'no_stock' && stockVal > 0) return false;
            }

            // 5. Expiration filter
            if (dataFilterExpiration !== 'all') {
                const { expiredCount, expiringThisMonthCount } = getExpirationStats([item]);
                if (dataFilterExpiration === 'expired' && expiredCount === 0) return false;
                if (dataFilterExpiration === 'expiring' && expiringThisMonthCount === 0) return false;
                if (dataFilterExpiration === 'ok' && (expiredCount > 0 || expiringThisMonthCount > 0)) return false;
            }

            // 6. Custom Expiration Month / Year Filter
            if (dataFilterExpMonth !== 'all' || dataFilterExpYear !== 'all') {
                const exp = getItemExpiration(item);
                if (!exp) return false;
                if (dataFilterExpMonth !== 'all' && exp.month !== parseInt(dataFilterExpMonth, 10)) return false;
                if (dataFilterExpYear !== 'all' && String(exp.year) !== dataFilterExpYear) return false;
            }

            return true;
        });
    }, [data, searchTerm, selectedSourceId, dataFilterTipsum, dataFilterFFinan, dataFilterStock, dataFilterExpiration, dataFilterExpMonth, dataFilterExpYear]);

    const modalStockData = useMemo(() => {
        if (!stockModalSourceId) return [];
        let currentData = data.filter(item => item && item.sourceId === stockModalSourceId);
        
        if (!stockModalSearchTerm.trim()) return currentData;
        const lowerTerm = stockModalSearchTerm.toLowerCase();
        
        return currentData.filter(item => {
            if (!item) return false;
            return (
                String(item.Nombre || '').toLowerCase().includes(lowerTerm) ||
                String(item.CODIGO_SIG || '').toLowerCase().includes(lowerTerm) ||
                String(item.ID_Producto || '').toLowerCase().includes(lowerTerm) ||
                String(item.Lote || '').toLowerCase().includes(lowerTerm) ||
                String(item.DESC_ALM || '').toLowerCase().includes(lowerTerm)
            );
        });
    }, [data, stockModalSearchTerm, stockModalSourceId]);

    const activeSheetData = useMemo(() => selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : [], [data, selectedSourceId]);
    const activeSheetExpirationInfo = useMemo(() => getExpirationStats(activeSheetData), [activeSheetData]);
    const filteredDataExpirationInfo = useMemo(() => getExpirationStats(filteredData), [filteredData]);

    const availableTipsums = useMemo(() => {
        const currentData = selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : data;
        const set = new Set<string>();
        currentData.forEach(item => {
            if (item && item.TIPSUM) {
                const val = item.TIPSUM.toString().trim();
                if (val) set.add(val);
            }
        });
        return Array.from(set).sort();
    }, [data, selectedSourceId]);

    const availableFFinans = useMemo(() => {
        const currentData = selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : data;
        const set = new Set<string>();
        currentData.forEach(item => {
            if (item && item.FFINAN) {
                const val = item.FFINAN.toString().trim();
                if (val) set.add(val);
            }
        });
        return Array.from(set).sort();
    }, [data, selectedSourceId]);

    const availableYears = useMemo(() => {
        const currentData = selectedSourceId ? data.filter(item => item && item.sourceId === selectedSourceId) : data;
        const set = new Set<string>();
        currentData.forEach(item => {
            if (item) {
                const exp = getItemExpiration(item);
                if (exp && exp.year > 2000 && exp.year < 2100) {
                    set.add(String(exp.year));
                }
            }
        });
        return Array.from(set).sort();
    }, [data, selectedSourceId]);

    const allUngetSummaries = useMemo(() => {
        const summaries: Record<number, { cs: number, ps: number, alm: number, hosp: number }> = {};
        
        scriptUrls.forEach((_, urlIndex) => {
            const counts = { cs: 0, ps: 0, alm: 0, hosp: 0 };
            const ungetSources = sources.filter(s => s.urlIndex === urlIndex);
            
            ungetSources.forEach(s => {
                const name = s.name.toUpperCase();
                if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
                else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
                else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
                else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
            });
            summaries[urlIndex] = counts;
        });
        
        return summaries;
    }, [scriptUrls, sources]);

    const globalUngetSummary = useMemo(() => {
        const counts = { cs: 0, ps: 0, alm: 0, hosp: 0, total: 0, online: 0, delayed: 0, offline: 0 };
        sources.forEach(s => {
            const name = s.name.toUpperCase();
            if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
            else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
            else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
            else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
            
            counts.total++;
            const status = getUpdateStatus(s.lastUpdateTime).color;
            if (status === 'bg-emerald-500') counts.online++;
            else if (status === 'bg-amber-500') counts.delayed++;
            else counts.offline++;
        });
        return counts;
    }, [sources]);

    const filteredAndSortedSources = useMemo(() => {
        if (selectedUngetIndex === null) return [];

        const matching = sources.filter(s => {
            if (s.urlIndex !== selectedUngetIndex) return false;
            
            // Search term filter
            if (sheetSearchTerm) {
                const term = sheetSearchTerm.toLowerCase();
                const lastDash = s.name.lastIndexOf('-');
                const description = lastDash === -1 ? s.name.replace(/^FARM\s*-\s*/i, '') : s.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                const code = getAlmCodeForSheet(s.id, data);
                if (!description.toLowerCase().includes(term) && !code.toLowerCase().includes(term)) {
                    return false;
                }
            }

            // Type filter
            const typeValue = getSheetType(s.name);
            if (typeValue === 'CS' && !filter_CS) return false;
            if (typeValue === 'PS' && !filter_PS) return false;
            if (typeValue === 'ALM' && !filter_ALM) return false;
            if (typeValue === 'HOSP' && !filter_HOSP) return false;
            if (typeValue === 'OTRO' && !filter_OTRO) return false;

            // Color status Filter
            const colorValue = getUpdateStatus(s.lastUpdateTime).color;
            if (colorValue === 'bg-emerald-500' && !filter_emerald) return false;
            if (colorValue === 'bg-amber-500' && !filter_amber) return false;
            if (colorValue === 'bg-red-500' && !filter_red) return false;
            if (colorValue === 'bg-gray-400' && !filter_gray) return false;

            // Date limit filter
            if (filterDateLimit !== 'all') {
                if (!s.lastUpdateTime) return false;
                const now = new Date().getTime();
                const diffMs = now - s.lastUpdateTime;
                const diffHours = diffMs / (1000 * 60 * 60);

                if (filterDateLimit === '1h' && diffHours > 1) return false;
                if (filterDateLimit === '12h' && diffHours > 12) return false;
                if (filterDateLimit === '24h' && diffHours > 24) return false;
                if (filterDateLimit === '3d' && diffHours > 72) return false;
                if (filterDateLimit === '7d' && diffHours > 168) return false;
            }

            // Expiration filter
            if (filterHasPendingExpirations) {
                const sheetData = data.filter(r => r.sourceId === s.id);
                const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                if (expiredCount === 0 && expiringThisMonthCount === 0) return false;
            }

            return true;
        });

        // Sorting
        return [...matching].sort((s1, s2) => {
            if (filterSortOrder === 'code_asc') {
                const c1 = getAlmCodeForSheet(s1.id, data) || '';
                const c2 = getAlmCodeForSheet(s2.id, data) || '';
                return c1.localeCompare(c2);
            }
            if (filterSortOrder === 'code_desc') {
                const c1 = getAlmCodeForSheet(s1.id, data) || '';
                const c2 = getAlmCodeForSheet(s2.id, data) || '';
                return c2.localeCompare(c1);
            }
            if (filterSortOrder === 'type_asc') {
                const type1 = getSheetType(s1.name);
                const type2 = getSheetType(s2.name);
                return type1.localeCompare(type2);
            }
            if (filterSortOrder === 'type_desc') {
                const type1 = getSheetType(s1.name);
                const type2 = getSheetType(s2.name);
                return type2.localeCompare(type1);
            }
            if (filterSortOrder === 'equip_newest') {
                const t1 = s1.equipmentDateTime || 0;
                const t2 = s2.equipmentDateTime || 0;
                return t2 - t1;
            }
            if (filterSortOrder === 'equip_oldest') {
                const t1 = s1.equipmentDateTime || 0;
                const t2 = s2.equipmentDateTime || 100000000000000;
                const t1_val = t1 === 0 ? 100000000000001 : t1;
                const t2_val = t2 === 0 ? 100000000000001 : t2;
                return t1_val - t2_val;
            }
            if (filterSortOrder === 'status_green_first' || filterSortOrder === 'status_red_first') {
                const getStatusWeight = (s: typeof s1) => {
                    const color = getUpdateStatus(s.lastUpdateTime).color;
                    if (color.includes('bg-emerald-500')) return 1;
                    if (color.includes('bg-amber-500')) return 2;
                    if (color.includes('bg-red-500')) return 3;
                    return 4; // gray / sin datos
                };
                const w1 = getStatusWeight(s1);
                const w2 = getStatusWeight(s2);
                return filterSortOrder === 'status_green_first' ? w1 - w2 : w2 - w1;
            }
            if (filterSortOrder === 'name_asc') {
                return s1.name.localeCompare(s2.name);
            }
            if (filterSortOrder === 'name_desc') {
                return s2.name.localeCompare(s1.name);
            }
            if (filterSortOrder === 'date_newest') {
                const t1 = s1.lastUpdateTime || 0;
                const t2 = s2.lastUpdateTime || 0;
                return t2 - t1;
            }
            if (filterSortOrder === 'date_oldest') {
                const t1 = s1.lastUpdateTime || 0;
                const t2 = s2.lastUpdateTime || 100000000000000; // Put very old/unset at the back/bottom
                const t1_val = t1 === 0 ? 100000000000001 : t1;
                const t2_val = t2 === 0 ? 100000000000001 : t2;
                return t1_val - t2_val;
            }
            if (filterSortOrder === 'expired_highest') {
                const sheetData1 = data.filter(r => r.sourceId === s1.id);
                const stats1 = getExpirationStats(sheetData1);
                const expInd1 = stats1.expiredCount * 10 + stats1.expiringThisMonthCount;

                const sheetData2 = data.filter(r => r.sourceId === s2.id);
                const stats2 = getExpirationStats(sheetData2);
                const expInd2 = stats2.expiredCount * 10 + stats2.expiringThisMonthCount;

                if (expInd2 !== expInd1) {
                    return expInd2 - expInd1;
                }
                return s1.name.localeCompare(s2.name);
            }
            if (filterSortOrder === 'expired_lowest') {
                const sheetData1 = data.filter(r => r.sourceId === s1.id);
                const stats1 = getExpirationStats(sheetData1);
                const expInd1 = stats1.expiredCount * 10 + stats1.expiringThisMonthCount;

                const sheetData2 = data.filter(r => r.sourceId === s2.id);
                const stats2 = getExpirationStats(sheetData2);
                const expInd2 = stats2.expiredCount * 10 + stats2.expiringThisMonthCount;

                if (expInd2 !== expInd1) {
                    return expInd1 - expInd2;
                }
                return s1.name.localeCompare(s2.name);
            }
            return 0;
        });
    }, [
        sources,
        selectedUngetIndex,
        sheetSearchTerm,
        data,
        filter_CS,
        filter_PS,
        filter_ALM,
        filter_HOSP,
        filter_OTRO,
        filter_emerald,
        filter_amber,
        filter_red,
        filter_gray,
        filterSortOrder,
        filterHasPendingExpirations,
        filterDateLimit
    ]);

    const establishmentSummary = useMemo(() => {
        if (viewLevel !== 'sheets' || selectedUngetIndex === null) return null;
        
        const filteredSources = sources.filter(s => {
            if (s.urlIndex !== selectedUngetIndex) return false;
            if (!sheetSearchTerm) return true;
            
            const term = sheetSearchTerm.toLowerCase();
            const lastDash = s.name.lastIndexOf('-');
            const description = lastDash === -1 ? s.name.replace(/^FARM\s*-\s*/i, '') : s.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
            const code = getAlmCodeForSheet(s.id, data);
            
            return description.toLowerCase().includes(term) || code.toLowerCase().includes(term);
        });

        const counts = { cs: 0, ps: 0, alm: 0, hosp: 0, total: 0, online: 0, delayed: 0, offline: 0 };
        filteredSources.forEach(s => {
            const name = s.name.toUpperCase();
            if (name.includes('C.S.') || name.includes('CENTRO DE SALUD')) counts.cs++;
            else if (name.includes('P.S.') || name.includes('PUESTO DE SALUD')) counts.ps++;
            else if (name.includes('ALM') || name.includes('ALMACEN')) counts.alm++;
            else if (name.includes('HOSP') || name.includes('HOSPITAL')) counts.hosp++;
            
            counts.total++;
            const status = getUpdateStatus(s.lastUpdateTime).color;
            if (status === 'bg-emerald-500') counts.online++;
            else if (status === 'bg-amber-500') counts.delayed++;
            else counts.offline++;
        });

        return counts;
    }, [viewLevel, selectedUngetIndex, sources, sheetSearchTerm, data]);

    const sortedReportSources = useMemo(() => {
        return [...filteredAndSortedSources].sort((a, b) => {
            const orderMult = reportSort.order === 'asc' ? 1 : -1;
            if (reportSort.field === 'name') {
                return a.name.localeCompare(b.name) * orderMult;
            } else if (reportSort.field === 'date') {
                const dateA = a.lastUpdateTime || 0;
                const dateB = b.lastUpdateTime || 0;
                return (dateA - dateB) * orderMult;
            } else if (reportSort.field === 'status') {
                const statusOrder = { 'bg-emerald-500': 1, 'bg-amber-500': 2, 'bg-red-500': 3, 'bg-gray-400': 4 };
                const colorA = getUpdateStatus(a.lastUpdateTime).color;
                const colorB = getUpdateStatus(b.lastUpdateTime).color;
                const statusA = (statusOrder as any)[colorA] || 5;
                const statusB = (statusOrder as any)[colorB] || 5;
                if (statusA !== statusB) {
                    return (statusA - statusB) * orderMult;
                }
                return ((a.lastUpdateTime || 0) - (b.lastUpdateTime || 0)) * orderMult;
            }
            return 0;
        });
    }, [filteredAndSortedSources, reportSort]);

    return (
        <div className={`flex flex-col h-full transition-all duration-300 ${isAdvancedFiltersSidebarOpen && viewLevel === 'sheets' ? 'md:pr-[380px] xl:pr-[420px]' : ''}`}>
            {/* Minimalist Top Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center px-4 sm:px-10 lg:px-14 xl:px-16 py-4 sm:py-8 gap-4 sm:gap-6">
                {/* Left Side: Title & KPIs underneath */}
                <div className="w-full xl:w-auto flex flex-col gap-3 sm:gap-4 overflow-hidden">
                    {/* Title */}
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
                        <Database className="h-5 w-5 text-teal-600 shrink-0" />
                        <span className="truncate">Reporte de Stock detallado SISMED</span>
                    </h2>

                    {/* Connection KPIs (Cards) */}
                    {(() => {
                        if (viewLevel === 'data') {
                            return (
                                <div className="flex flex-row items-center gap-2 sm:gap-4 overflow-x-auto hide-scrollbar w-full justify-start pb-1 animate-in fade-in duration-200">
                                    {/* Total Productos */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                                            <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
                                        </div>
                                        <div className="flex flex-col justify-center gap-0.5 pr-2">
                                            <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{filteredData.length}</span>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-teal-600 leading-none uppercase">Lotes</span>
                                        </div>
                                    </div>

                                    {/* Por Vencer */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100/50">
                                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                                        </div>
                                        <div className="flex flex-col justify-center gap-0.5 pr-2">
                                            <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{filteredDataExpirationInfo.expiringThisMonthCount}</span>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 leading-none uppercase">Por Vencer</span>
                                        </div>
                                    </div>

                                    {/* Vencidos */}
                                    <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                        <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100/50">
                                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                                        </div>
                                        <div className="flex flex-col justify-center gap-0.5 pr-2">
                                            <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{filteredDataExpirationInfo.expiredCount}</span>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-red-500 leading-none uppercase">Vencidos</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }

                        const currentSummary = viewLevel === 'sheets' ? establishmentSummary : (viewLevel === 'ungets' ? globalUngetSummary : null);
                        if (!currentSummary) return null;
                        return (
                            <div className="flex flex-row items-center gap-2 sm:gap-4 overflow-x-auto hide-scrollbar w-full justify-start pb-1">
                                {/* En Línea */}
                                <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                                        <Wifi className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
                                    </div>
                                    <div className="flex flex-col justify-center gap-0.5 pr-2">
                                        <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{currentSummary.online}</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-teal-600 leading-none uppercase">En Línea</span>
                                    </div>
                                </div>

                                {/* Desconectados */}
                                <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-50 flex items-center justify-center shrink-0 border border-amber-100/50">
                                        <FileClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                                    </div>
                                    <div className="flex flex-col justify-center gap-0.5 pr-2">
                                        <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{currentSummary.delayed}</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-amber-600 leading-none uppercase">Desconectados</span>
                                    </div>
                                </div>

                                {/* Fuera de Línea */}
                                <div className="flex items-center gap-2 sm:gap-2.5 bg-white border border-slate-100/80 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] rounded-xl sm:rounded-2xl px-3 py-2 sm:px-3.5 sm:py-2 shrink-0">
                                    <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-red-50 flex items-center justify-center shrink-0 border border-red-100/50">
                                        <WifiOff className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                                    </div>
                                    <div className="flex flex-col justify-center gap-0.5 pr-2">
                                        <span className="text-sm sm:text-lg font-black text-slate-800 leading-none">{currentSummary.offline}</span>
                                        <span className="text-[9px] sm:text-[10px] font-bold text-red-500 leading-none uppercase">Fuera Línea</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Right Side: Navigation Breadcrumbs (top-right) + Action Buttons (bottom-right) */}
                <div className="flex flex-col gap-3 sm:gap-4 w-full xl:w-auto items-start xl:items-end justify-start overflow-hidden">
                    {/* Navigation Tabs (Breadcrumbs) aligned to the right */}
                    <div className="flex items-center text-[10px] sm:text-[12px] font-bold text-slate-500 overflow-x-auto hide-scrollbar shrink-0 uppercase tracking-widest gap-1 self-stretch xl:self-auto justify-start xl:justify-end pb-1 sm:pb-0">
                        <button 
                            onClick={() => { setViewLevel('ungets'); setSelectedUngetIndex(null); setSelectedSourceId(''); }}
                            className={`flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0 ${viewLevel === 'ungets' ? 'text-teal-600 font-black' : 'hover:text-slate-800'}`}
                        >
                            <Building2 className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${viewLevel === 'ungets' ? 'text-teal-600' : 'text-slate-400'}`} />
                            <span className={viewLevel === 'ungets' ? 'font-black text-teal-600' : ''}>PANEL REGIONAL</span>
                        </button>
                        
                        {selectedUngetIndex !== null && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-350 mx-0.5 sm:mx-1 shrink-0" />
                                <button 
                                    onClick={() => { setViewLevel('sheets'); setSelectedSourceId(''); }}
                                    className={`flex items-center gap-1.5 sm:gap-2 transition-colors shrink-0 ${viewLevel === 'sheets' ? 'text-teal-600 font-black' : 'hover:text-slate-800'}`}
                                >
                                    <FileSpreadsheet className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${viewLevel === 'sheets' ? 'text-teal-600' : 'text-slate-400'}`} />
                                    <span className={`truncate max-w-[120px] sm:max-w-[150px] md:max-w-[200px] ${viewLevel === 'sheets' ? 'font-black text-teal-600' : ''}`}>{scriptUrls[selectedUngetIndex]?.name || 'Documento'}</span>
                                </button>
                            </>
                        )}

                        {selectedSourceId && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-slate-350 mx-0.5 sm:mx-1 shrink-0" />
                                <div className="flex items-center gap-1.5 sm:gap-2 text-teal-600 shrink-0">
                                    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-500" />
                                    <span className="font-black truncate max-w-[120px] sm:max-w-[150px] md:max-w-[250px]">{(() => {
                                        const name = sources.find(s => s.id === selectedSourceId)?.name || 'Hoja';
                                        const lastDash = name.lastIndexOf('-');
                                        const desc = lastDash === -1 ? name.replace(/^FARM\s*-\s*/i, '') : name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                        const code = selectedSourceId ? getAlmCodeForSheet(selectedSourceId, data) : '';
                                        return code ? `${desc} (${code})` : desc;
                                    })()}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action Buttons underneath breadcrumbs */}
                    <div className="flex items-center gap-2 sm:gap-2.5 w-full md:w-auto overflow-x-auto pb-1 sm:pb-0 hide-scrollbar justify-start xl:justify-end shrink-0">
                        <button 
                            onClick={() => {
                                setTempUrls([...scriptUrls]);
                                setIsConfigOpen(!isConfigOpen);
                            }}
                            className="bg-white border border-slate-200 text-slate-700 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap shrink-0"
                        >
                            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" />
                            Configurar
                        </button>
                        <button 
                            id="sync-btn"
                            onClick={() => fetchData()} disabled={isLoading || isSilentSyncing}
                            className="flex-1 sm:flex-none bg-teal-600 text-white px-4 py-2 sm:py-2.5 rounded-full font-bold text-xs sm:text-sm hover:bg-teal-700 hover:shadow-md transition-all disabled:opacity-50 disabled:hover:shadow-none flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm whitespace-nowrap"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isLoading || isSilentSyncing ? 'animate-spin' : ''}`} />
                            {isLoading || isSilentSyncing ? 'Sincronizando...' : 'Sincronizar'}
                        </button>
                    </div>
                </div>
            </div>

            {isConfigOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-white/20">
                        {/* Header Modal */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                                    <Settings className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-gray-900 text-lg uppercase tracking-tight">Gestión de Orígenes UNGET</h3>
                                    <p className="text-xs text-gray-500 font-medium tracking-tight">Configure sus conexiones a Google Apps Script</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => { setIsConfigOpen(false); setEditingIndex(null); setNewUrlInput(''); setNewNameInput(''); }}
                                className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-900"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-gray-50 border border-gray-200 rounded-3xl p-6">
                                        <h4 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                                            <Plus className={`h-4 w-4 ${editingIndex !== null ? 'text-amber-500' : 'text-teal-500'}`} />
                                            {editingIndex !== null ? 'EDITAR ORÍGEN' : 'AÑADIR NUEVO ORÍGEN'}
                                        </h4>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">Nombre Identificador</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: UNGET CENTRO"
                                                    value={newNameInput}
                                                    onChange={e => setNewNameInput(e.target.value)}
                                                    className="w-full text-sm rounded-xl border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm py-2.5 px-4 font-medium"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">URL Web App (Apps Script)</label>
                                                <input
                                                    type="url"
                                                    placeholder="https://script.google.com/..."
                                                    value={newUrlInput}
                                                    onChange={e => setNewUrlInput(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleAddUrl()}
                                                    className="w-full text-sm rounded-xl border-gray-300 focus:border-teal-500 focus:ring-teal-500 shadow-sm py-2.5 px-4 font-mono text-[11px]"
                                                />
                                            </div>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={handleAddUrl}
                                                    className={`flex-1 py-2.5 rounded-xl text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 ${editingIndex !== null ? 'bg-amber-500 hover:bg-amber-600' : 'bg-teal-600 hover:bg-teal-700'}`}
                                                >
                                                    {editingIndex !== null ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                                    {editingIndex !== null ? 'Actualizar en Lista' : 'Añadir a Lista'}
                                                </button>
                                                {editingIndex !== null && (
                                                    <button 
                                                        onClick={() => { setEditingIndex(null); setNewUrlInput(''); setNewNameInput(''); }}
                                                        className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-all font-bold text-sm"
                                                    >
                                                        Cancelar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center px-1">
                                            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Lista de Conexiones ({tempUrls.length})</h4>
                                            {maxUrlsAllowed && <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">Límite: {maxUrlsAllowed}</span>}
                                        </div>
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                            {tempUrls.length > 0 ? tempUrls.map((config, idx) => (
                                                <div key={idx} className={`group flex gap-3 items-center bg-white border p-3 rounded-2xl transition-all shadow-sm ${editingIndex === idx ? 'border-amber-500 bg-amber-50/30' : 'border-gray-100 hover:border-gray-200'}`}>
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${editingIndex === idx ? 'bg-amber-100 text-amber-600' : 'bg-gray-50 text-gray-400'}`}>
                                                        <LinkIcon className="h-4 w-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-black text-gray-800 truncate uppercase">{config.name}</div>
                                                        <div className="text-[9px] text-gray-400 truncate font-mono">{config.url}</div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            onClick={(e) => handleEditUrl(idx, e)}
                                                            className={`p-1.5 rounded-lg transition-colors ${editingIndex === idx ? 'text-amber-600 bg-white' : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600'}`}
                                                            title="Editar"
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleRemoveUrl(idx)}
                                                            className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                                            title="Quitar"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                                    <LinkIcon className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-xs font-bold text-gray-400">No hay orígenes en la lista</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="space-y-4">
                                    <div className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-6 h-full flex flex-col">
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black">?</div>
                                            <h4 className="text-sm font-black text-blue-900 uppercase">¿Cómo obtener la URL?</h4>
                                        </div>
                                        <div className="flex-1 space-y-4">
                                            <div className="space-y-4 text-[11px] text-blue-800 font-medium leading-relaxed">
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">1</div>
                                                    <p>Cree un Nuevo Proyecto en <a href="https://script.google.com" target="_blank" rel="noreferrer" className="font-black underline decoration-2">script.google.com</a> con el código adjunto.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">2</div>
                                                    <p>Click en <span className="font-black">Implementar &gt; Nueva Implementación</span>.</p>
                                                </div>
                                                <div className="flex gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0 font-black">3</div>
                                                    <p>Tipo: <span className="font-black text-blue-900">Aplicación Web</span>, Acceso: <span className="bg-blue-900 text-white px-1.5 py-0.5 rounded text-[9px]">Cualquier persona</span>.</p>
                                                </div>
                                            </div>

                                            <div className="relative mt-4">
                                                <div className="absolute -top-3 left-4 bg-blue-600 text-[10px] text-white px-2 py-0.5 rounded font-black tracking-wider shadow-sm z-10">CÓDIGO RECOMENDADO</div>
                                                <div className="relative pt-2">
                                                    <pre className="text-[10px] bg-slate-900 text-slate-300 p-5 rounded-3xl overflow-hidden h-44 overflow-y-auto font-mono scrollbar-thin scrollbar-thumb-slate-700 border border-slate-800 shadow-xl">
                                                        {scriptCode}
                                                    </pre>
                                                    <button 
                                                        onClick={copyScript}
                                                        className="absolute top-5 right-5 bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white backdrop-blur-sm transition-all border border-white/5"
                                                    >
                                                        {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 sticky bottom-0 z-10">
                            <button 
                                onClick={() => { setIsConfigOpen(false); setEditingIndex(null); }}
                                className="px-6 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                Cerrar sin Guardar
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                disabled={isLoading || tempUrls.length === 0}
                                className="bg-teal-600 text-white px-8 py-2.5 rounded-2xl text-sm font-black hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                GUARDAR Y SINCRONIZAR CAMBIOS
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 sm:rounded-xl flex items-center gap-2 mb-6 mx-4 sm:mx-10 lg:mx-14 xl:mx-16">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            <div className="bg-white sm:rounded-[1.25rem] border-y sm:border border-slate-200 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[300px] overflow-hidden mx-0 sm:mx-10 lg:mx-14 xl:mx-16">
                {/* TOOLBAR */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4">
                    {/* Search & Actions */}
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between w-full">
                        <div className="relative flex-1 w-full md:max-w-[50%] group">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                                <Search className="h-4 w-4 text-slate-400 group-focus-within:text-teal-600 stroke-[2.5] transition-colors" />
                            </div>
                            {viewLevel === 'ungets' && (
                                <div className="relative w-full text-slate-800">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar UNGET..." 
                                        value={ungetSearchTerm} 
                                        onChange={(e) => setUngetSearchTerm(e.target.value)} 
                                        className="w-full pl-10 pr-12 py-2.5 bg-slate-50/85 md:bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-450 shadow-2xs font-medium text-slate-800" 
                                    />
                                    {ungetSearchTerm && (
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                                            <button 
                                                type="button"
                                                onClick={() => setUngetSearchTerm('')}
                                                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors active:scale-95 cursor-pointer"
                                                title="Limpiar"
                                            >
                                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                            {viewLevel === 'sheets' && (
                                <div className="relative w-full text-slate-800">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar establecimiento por nombre o código..." 
                                        value={sheetSearchTerm} 
                                        onChange={(e) => setSheetSearchTerm(e.target.value)} 
                                        className="w-full pl-10 pr-32 py-2.5 bg-slate-50/85 md:bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-450 shadow-2xs font-medium text-slate-800" 
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1.5">
                                        {sheetSearchTerm && (
                                            <button 
                                                type="button"
                                                onClick={() => setSheetSearchTerm('')}
                                                className="p-1 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 rounded-full transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
                                                title="Limpiar"
                                            >
                                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                            </button>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => setIsAdvancedFiltersSidebarOpen(true)} 
                                            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/80 text-xs font-black transition-all shrink-0 relative shadow-sm cursor-pointer hover:border-slate-300 active:bg-slate-100"
                                        >
                                            <Filter className="h-3.5 w-3.5 text-teal-600" /> 
                                            <span>Filtros</span>
                                            {(!filter_CS || !filter_PS || !filter_ALM || !filter_HOSP || !filter_OTRO || !filter_emerald || !filter_amber || !filter_red || !filter_gray || filterSortOrder !== 'name_asc' || filterHasPendingExpirations) && (
                                                <span className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white animate-pulse" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                            {viewLevel === 'data' && (
                                <div className="relative w-full text-slate-800">
                                    <input 
                                        type="text" 
                                        placeholder="Buscar medicamento en esta hoja..." 
                                        value={searchTerm} 
                                        onChange={(e) => setSearchTerm(e.target.value)} 
                                        className="w-full pl-10 pr-32 py-2.5 bg-slate-50/85 md:bg-slate-50 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 placeholder:text-slate-450 shadow-2xs font-medium text-slate-800" 
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center gap-1.5">
                                        {searchTerm && (
                                            <button 
                                                type="button"
                                                onClick={() => setSearchTerm('')}
                                                className="p-1 hover:bg-slate-100/80 text-slate-400 hover:text-slate-600 rounded-full transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
                                                title="Limpiar"
                                            >
                                                <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                            </button>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={() => setIsAdvancedFiltersSidebarOpen(true)} 
                                            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200/85 text-xs font-black transition-all shrink-0 relative shadow-sm cursor-pointer hover:border-slate-300 active:bg-slate-100"
                                        >
                                            <Filter className="h-3.5 w-3.5 text-teal-600" /> 
                                            <span>Filtros</span>
                                            {(dataFilterTipsum !== 'all' || dataFilterFFinan !== 'all' || dataFilterStock !== 'all' || dataFilterExpiration !== 'all') && (
                                                <span className="absolute top-0 right-0 -mr-1 -mt-1 w-2.5 h-2.5 bg-teal-500 rounded-full border-2 border-white animate-pulse" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto md:overflow-visible hide-scrollbar shrink-0 pt-1 md:pt-0 md:ml-auto pb-1 relative z-30">
                            {viewLevel === 'data' && (
                                <>
                                    {activeSheetExpirationInfo.expiredCount > 0 && (
                                        <button onClick={() => { setExpirationModalType('expired'); setIsExpirationModalOpen(true); }} className="flex items-center gap-1.5 bg-white hover:bg-red-50 text-red-600 px-3 py-2 rounded-lg border border-red-100 text-xs font-bold transition-all shrink-0 whitespace-nowrap">
                                            <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
                                            <span>{activeSheetExpirationInfo.expiredCount} Vencidos</span>
                                        </button>
                                    )}
                                    {activeSheetExpirationInfo.expiringThisMonthCount > 0 && (
                                        <button onClick={() => { setExpirationModalType('expiring'); setIsExpirationModalOpen(true); }} className="flex items-center gap-1.5 bg-white hover:bg-amber-50 text-amber-600 px-3 py-2 rounded-lg border border-amber-100 text-xs font-bold transition-all shrink-0 whitespace-nowrap">
                                            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                            <span>{activeSheetExpirationInfo.expiringThisMonthCount} Por vencer</span>
                                        </button>
                                    )}
                                    <button onClick={exportCurrentSheetToExcel} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold transition-all shrink-0 whitespace-nowrap">
                                        <Download className="h-4 w-4 text-emerald-600 shrink-0" /> Exportar Stock
                                    </button>
                                </>
                            )}
                            
                            {viewLevel === 'sheets' && (
                                <div className="relative z-30">
                                    <button 
                                        onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                                        className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold transition-all shrink-0 shadow-sm whitespace-nowrap group cursor-pointer"
                                    >
                                        <Download className="h-4 w-4 text-emerald-600 shrink-0 transition-transform group-hover:translate-y-0.5" />
                                        <span>Exportar Reportes</span>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExportDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    
                                    {isExportDropdownOpen && (
                                        <>
                                            {/* Overlay screen to close dropdown on click outside */}
                                            <div className="fixed inset-0 z-40" onClick={() => setIsExportDropdownOpen(false)} />
                                            {/* Dropdown Card */}
                                            <div className="absolute right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.05)] z-50 overflow-hidden w-64 divide-y divide-slate-100 py-1 animate-in fade-in slide-in-from-top-2 duration-150 text-left">
                                                <button 
                                                    onClick={() => {
                                                        setIsExportDropdownOpen(false);
                                                        exportAllEstablishmentsToExcel();
                                                    }}
                                                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-all text-slate-705 group cursor-pointer"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                                                        <Download className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 leading-tight">Exportar Stock</span>
                                                        <span className="text-[10px] text-slate-400 font-medium leading-normal">Saldos de todos los establecimientos</span>
                                                    </div>
                                                </button>

                                                <button 
                                                    onClick={() => {
                                                        setIsExportDropdownOpen(false);
                                                        exportReportToExcel();
                                                    }}
                                                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-all text-slate-705 group cursor-pointer"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                                        <FileSpreadsheet className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 leading-tight">Reporte Actualización</span>
                                                        <span className="text-[10px] text-slate-400 font-medium leading-normal">Estado y fecha de sincronizaciones</span>
                                                    </div>
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {viewLevel === 'ungets' && globalUngetSummary && sources.length > 0 && (
                                <button onClick={exportAllUngetsToExcel} className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 px-3 sm:px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold transition-all shrink-0 whitespace-nowrap shadow-sm">
                                    <Download className="h-4 w-4 text-emerald-600 shrink-0" /> Exportar Stock
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`flex-1 bg-gray-50/30 scrollbar-thin ${viewLevel === 'data' ? 'overflow-visible' : 'overflow-auto'}`}>
                    {isConfigLoading && scriptUrls.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-teal-600 gap-3 py-20">
                            <RefreshCw className="h-10 w-10 animate-spin" />
                            <span className="font-bold text-lg">Cargando configuración...</span>
                        </div>
                    ) : isLoading && data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-teal-600 gap-3 py-20">
                            <RefreshCw className="h-10 w-10 animate-spin" />
                            <span className="font-bold text-lg">Sincronizando información...</span>
                        </div>
                    ) : error && data.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto py-20">
                            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
                            <h3 className="text-lg font-black text-gray-900 mb-2">Error de conexión</h3>
                            <p className="text-sm text-gray-500 mb-6">{error}</p>
                            <button onClick={() => fetchData()} className="bg-teal-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-teal-700 transition-colors">
                                Reintentar Sincronización
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 sm:p-6 pb-32 sm:pb-6 flex flex-col gap-6">
                            {/* LEVEL 1: UNGET CARDS */}
                            {viewLevel === 'ungets' && (
                                <div className="animate-in fade-in zoom-in-95 duration-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                                        {filteredUngets.length > 0 ? filteredUngets.map((config, idx) => {
                                            // Encontrar el índice original en scriptUrls para las funciones de edición/borrado
                                            const originalIdx = scriptUrls.findIndex(u => u.url === config.url && u.name === config.name);
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handleSelectUnget(originalIdx)}
                                                    className="group bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 h-full cursor-pointer relative overflow-hidden"
                                                >
                                                    {/* Botones de acción rápidos */}
                                                    <div className="absolute top-4 right-4 flex items-center gap-2 opacity-100 sm:opacity-40 group-hover:opacity-100 transition-opacity z-10">
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDirectEdit(originalIdx, e);
                                                            }}
                                                            className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-200 transition-all"
                                                            title="Editar conexión"
                                                        >
                                                            <Settings className="h-4 w-4" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDirectDelete(originalIdx, e);
                                                            }}
                                                            className="p-1.5 sm:p-2 bg-white/90 backdrop-blur-sm shadow-sm border border-gray-100 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-200 transition-all"
                                                            title="Eliminar conexión"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>

                                                    <div className="w-12 h-12 shrink-0 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center sm:mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                                        <Building2 className="h-6 w-6" />
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0 pr-16 sm:pr-0">
                                                        <h3 className="text-sm sm:text-lg font-black text-gray-900 sm:mb-2 group-hover:text-teal-700 transition-colors uppercase tracking-tight truncate sm:whitespace-normal">{config.name}</h3>
                                                        
                                                        <div className="sm:hidden text-[10px] sm:text-xs font-bold text-gray-500 mt-0.5 mb-1.5">
                                                            {sources.filter(s => s.urlIndex === originalIdx).length} Estab.
                                                        </div>

                                                        {/* Resumen de establecimientos por tipo */}
                                                        {allUngetSummaries[originalIdx] && (
                                                            <div className="flex flex-wrap gap-1 mb-2 sm:mb-4">
                                                                {allUngetSummaries[originalIdx].cs > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 uppercase" title="Centros de Salud">
                                                                        C.S: {allUngetSummaries[originalIdx].cs}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].ps > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100 uppercase" title="Puestos de Salud">
                                                                        P.S: {allUngetSummaries[originalIdx].ps}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].alm > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-100 uppercase" title="Almacenes">
                                                                        ALM: {allUngetSummaries[originalIdx].alm}
                                                                    </span>
                                                                )}
                                                                {allUngetSummaries[originalIdx].hosp > 0 && (
                                                                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-100 uppercase" title="Hospitales">
                                                                        HOSP: {allUngetSummaries[originalIdx].hosp}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex items-center gap-1.5 text-[9px] sm:text-xs text-gray-400 mt-auto">
                                                            <LinkIcon className="h-3 w-3 shrink-0" />
                                                            <span className="truncate max-w-[120px] sm:max-w-[150px]">{config.url}</span>
                                                        </div>
                                                    </div>

                                                    <div className="hidden sm:flex items-center justify-between w-full mt-4 pt-4 border-t border-gray-50">
                                                        <span className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">
                                                            {sources.filter(s => s.urlIndex === originalIdx).length} Establecimientos
                                                        </span>
                                                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="col-span-full py-20 text-center">
                                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Settings className="h-8 w-8 text-gray-400" />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-800">No hay UNGETs que coincidan</h3>
                                                <p className="text-gray-500 mt-2">Intente con otro término de búsqueda.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* LEVEL 2: SHEET CARDS */}
                            {viewLevel === 'sheets' && (
                                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                    <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-gray-200/50 pb-3 mb-4 sm:mb-6 gap-4">
                                        <div className="flex flex-col gap-2.5">
                                            {/* Title and Counter Pill */}
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1 h-5 bg-teal-500 rounded-full"></span>
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest break-words flex-1">
                                                        Establecimientos de Salud
                                                    </h3>
                                                </div>
                                                {filteredAndSortedSources.length > 0 && (
                                                    <span className="text-[10px] whitespace-nowrap font-black bg-teal-50 text-teal-850 px-2.5 py-0.5 rounded-full border border-teal-100/70 shadow-xs uppercase tracking-wide">
                                                        {filteredAndSortedSources.length} {filteredAndSortedSources.length === 1 ? 'establecimiento' : 'establecimientos'}
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {/* Beautiful Premium Type KPIs */}
                                            {establishmentSummary && (
                                                <div className="flex flex-wrap gap-2 pt-0.5">
                                                    <div className="flex items-center gap-1.5 bg-sky-50/70 border border-sky-100/50 text-sky-800 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-xs" title="Centros de Salud">
                                                        <span className="w-1.5 h-1.5 bg-sky-500 rounded-full"></span>
                                                        <span className="text-slate-500 font-medium">C.S.:</span>
                                                        <span className="font-extrabold">{establishmentSummary.cs}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-amber-50/70 border border-amber-100/50 text-amber-800 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-xs" title="Puestos de Salud">
                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                        <span className="text-slate-500 font-medium">P.S.:</span>
                                                        <span className="font-extrabold">{establishmentSummary.ps}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-indigo-50/70 border border-indigo-100/50 text-indigo-800 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-xs" title="Almacenes">
                                                        <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                                        <span className="text-slate-500 font-medium">ALM:</span>
                                                        <span className="font-extrabold">{establishmentSummary.alm}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-violet-50/70 border border-violet-100/50 text-violet-800 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-xs" title="Hospitales">
                                                        <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                                                        <span className="text-slate-500 font-medium">HOSP:</span>
                                                        <span className="font-extrabold">{establishmentSummary.hosp}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {/* Selector de tipo de Visualización */}
                                        <div className="flex flex-wrap items-center gap-2 shrink-0 overflow-x-auto pb-1 -mb-1 max-w-full no-scrollbar">
                                            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.02)] shrink-0 pr-1 lg:pr-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setSheetsViewMode('grid')}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    sheetsViewMode === 'grid'
                                                        ? 'bg-white text-teal-950 shadow-xs border border-slate-200/30'
                                                        : 'text-slate-400 hover:text-slate-700'
                                                }`}
                                                title="Vista Cuadrícula"
                                            >
                                                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                                                <span className="hidden xs:inline">Cuadrícula</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSheetsViewMode('list')}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    sheetsViewMode === 'list'
                                                        ? 'bg-white text-teal-950 shadow-xs border border-slate-200/30'
                                                        : 'text-slate-400 hover:text-slate-700'
                                                }`}
                                                title="Vista Lista"
                                            >
                                                <List className="h-3.5 w-3.5 shrink-0" />
                                                <span className="hidden xs:inline">Lista</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSheetsViewMode('compact')}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    sheetsViewMode === 'compact'
                                                        ? 'bg-white text-teal-950 shadow-xs border border-slate-200/30'
                                                        : 'text-slate-400 hover:text-slate-700'
                                                }`}
                                                title="Vista Compacta"
                                            >
                                                <Grid className="h-3.5 w-3.5 shrink-0" />
                                                <span className="hidden xs:inline">Compacto</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSheetsViewMode('table')}
                                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                    sheetsViewMode === 'table'
                                                        ? 'bg-white text-teal-950 shadow-xs border border-slate-200/30'
                                                        : 'text-slate-400 hover:text-slate-700'
                                                }`}
                                                title="Vista Tabla"
                                            >
                                                <Table2 className="h-3.5 w-3.5 shrink-0" />
                                                <span className="hidden xs:inline">Tabla</span>
                                            </button>
                                            </div>

                                            {true && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleTableFullscreen(!isTableFullscreen)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs border ${
                                                        isTableFullscreen
                                                            ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700'
                                                            : 'bg-teal-50 border-teal-100 text-teal-850 hover:bg-teal-100 hover:text-teal-900 hover:border-teal-200'
                                                    }`}
                                                    title="Pantalla Completa"
                                                >
                                                    {isTableFullscreen ? <Minimize2 className="h-3.5 w-3.5 shrink-0" /> : <Maximize2 className="h-3.5 w-3.5 shrink-0" />}
                                                    <span className="hidden xs:inline">{isTableFullscreen ? 'Salir F11' : 'Pantalla Completa'}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {(() => {
                                        const viewContent = filteredAndSortedSources.length === 0 ? (
                                        <div className="py-16 text-center bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
                                            <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Filter className="h-8 w-8 text-teal-500 animate-pulse" />
                                            </div>
                                            <h3 className="text-base font-bold text-gray-900">No hay establecimientos con estos filtros</h3>
                                            <p className="text-gray-500 mt-1 max-w-sm mx-auto text-xs font-medium">Pruebe cambiando o limpiando los filtros avanzados para encontrar su establecimiento.</p>
                                            <button
                                                onClick={() => {
                                                    setFilter_CS(true);
                                                    setFilter_PS(true);
                                                    setFilter_ALM(true);
                                                    setFilter_HOSP(true);
                                                    setFilter_OTRO(true);
                                                    setFilter_emerald(true);
                                                    setFilter_amber(true);
                                                    setFilter_red(true);
                                                    setFilter_gray(true);
                                                    setFilterSortOrder('name_asc');
                                                    setFilterHasPendingExpirations(false);
                                                    setFilterDateLimit('all');
                                                }}
                                                className="mt-4 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm"
                                            >
                                                Limpiar todos los filtros
                                            </button>
                                        </div>
                                    ) : (
                                            <>
                                                {/* 1) GRID LAYOUT */}
                                            {sheetsViewMode === 'grid' && (
                                                <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 sm:gap-6 animate-in fade-in duration-200">
                                                    {filteredAndSortedSources.map((sheet) => {
                                                        const sheetData = data.filter(r => r.sourceId === sheet.id);
                                                        const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                                                        const statusObj = getUpdateStatus(sheet.lastUpdateTime);

                                                        return (
                                                            <button
                                                                key={sheet.id}
                                                                onClick={() => handleSelectSheet(sheet.id)}
                                                                className="group relative bg-white border border-gray-200 p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-0 h-full cursor-pointer"
                                                            >
                                                                <div className="hidden sm:flex absolute top-4 right-4 sm:top-6 sm:right-6 flex-col gap-1.5 items-end z-10 p-1">
                                                                    {renderSyncStatusPill(sheet.lastUpdateTime)}
                                                                    {expiredCount > 0 && (
                                                                        <div className="flex items-center gap-1.5 bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-rose-200/60 shadow-3xs" title="Vencido en stock">
                                                                            <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                                                                            <span>{expiredCount} vencido{expiredCount !== 1 ? 's' : ''}</span>
                                                                        </div>
                                                                    )}
                                                                    {expiringThisMonthCount > 0 && (
                                                                        <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-black border border-amber-200/60 shadow-3xs" title="Vence este mes">
                                                                            <Clock className="h-3 w-3 text-amber-505 shrink-0" />
                                                                            <span>{expiringThisMonthCount} por vencer</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center sm:mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors relative">
                                                                    <Hospital className="h-6 w-6" />
                                                                    <div className="absolute -top-1 -right-1 flex h-4 w-4" title={getUpdateStatus(sheet.lastUpdateTime).label}>
                                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getUpdateStatus(sheet.lastUpdateTime).color}`} />
                                                                        <span className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white ${getUpdateStatus(sheet.lastUpdateTime).color}`} />
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 sm:mb-4 min-w-0">
                                                                    {(() => {
                                                                        const lastDash = sheet.name.lastIndexOf('-');
                                                                        const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                                        const code = getAlmCodeForSheet(sheet.id, data);
                                                                        
                                                                        return (
                                                                            <>
                                                                                {code && <p className="text-[9px] sm:text-[10px] font-bold text-teal-600 mb-0.5">{code}</p>}
                                                                                <h3 className="text-sm sm:text-[15px] md:text-lg font-black text-gray-900 leading-tight mb-1 truncate sm:whitespace-normal" title={description}>{description}</h3>
                                                                            </>
                                                                        );
                                                                    })()}

                                                                    {/* Mobile alerts right below the title */}
                                                                    <div className="sm:hidden flex items-center gap-1.5 mt-1 sm:mt-1.5 flex-wrap">
                                                                        <div className="flex items-center gap-1 bg-slate-105 text-slate-700 px-1.5 py-0.5 rounded-md text-[8.5px] font-black border border-slate-200" title="Total de ítems">
                                                                            <Package className="h-3 w-3 text-slate-400" />
                                                                            <span>{sheetData.length} ítems</span>
                                                                        </div>
                                                                        {expiredCount > 0 && (
                                                                            <div className="flex items-center gap-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold" title="Vencido en stock">
                                                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                                                <span>{expiredCount}</span>
                                                                            </div>
                                                                        )}
                                                                        {expiringThisMonthCount > 0 && (
                                                                            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold" title="Vence este mes">
                                                                                <Clock className="h-2.5 w-2.5" />
                                                                                <span>{expiringThisMonthCount}</span>
                                                                            </div>
                                                                        )}
                                                                        {sheet.lastUpdateTime && (
                                                                            <div className="flex flex-col gap-0.5 w-full mt-1">
                                                                                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold text-gray-500 flex-wrap">
                                                                                    <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                                    <span>Act: {formatFullDate(sheet.lastUpdateTime)}</span>
                                                                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[7px] font-extrabold ${statusObj.color.includes('bg-emerald-500') ? 'bg-emerald-50 text-emerald-700' : statusObj.color.includes('bg-amber-500') ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                                                                                        {statusObj.label}
                                                                                    </span>
                                                                                </div>
                                                                                {sheet.equipmentDateTime && (
                                                                                    <div className={`flex items-center gap-1 text-[8px] sm:text-[9px] font-bold ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500' : 'text-slate-400'}`}>
                                                                                        <Monitor className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                                                                        <span>Eq: {formatFullDate(sheet.equipmentDateTime)}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Desktop last updated */}
                                                                    {sheet.lastUpdateTime && (
                                                                        <div className="hidden sm:flex flex-col gap-0.5 mt-2">
                                                                            <div className="flex items-center gap-1.5 text-[10.5px] font-medium text-gray-400 flex-wrap">
                                                                                <RefreshCw className="h-3 w-3 text-slate-400 shrink-0" />
                                                                                <span>Act: <span className="font-extrabold text-slate-600">{formatFullDate(sheet.lastUpdateTime)}</span></span>
                                                                            </div>
                                                                            {sheet.equipmentDateTime && (
                                                                                <div className={`flex items-center gap-1.5 text-[10px] font-medium ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500' : 'text-slate-400'}`}>
                                                                                    <Monitor className="h-3 w-3 shrink-0" />
                                                                                    <span>Equipo: <span className={`font-extrabold ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500 font-black' : 'text-slate-500'}`}>{formatFullDate(sheet.equipmentDateTime)}</span></span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="hidden sm:flex items-center justify-between w-full mt-auto pt-4 border-t border-gray-50">
                                                                    <span className="text-[10.5px] font-black text-teal-600 uppercase tracking-wider">Consultar Stock</span>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md" title="Total de ítems en este establecimiento">
                                                                            <Package className="h-3 w-3 text-slate-400" />
                                                                            <span>{sheetData.length} items</span>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="sm:hidden ml-auto flex items-center gap-1.5">
                                                                    <span className="text-[10px] font-extrabold text-slate-400">({sheetData.length} ítems)</span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* 2) LIST LAYOUT */}
                                            {sheetsViewMode === 'list' && (
                                                <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
                                                    {filteredAndSortedSources.map((sheet) => {
                                                        const sheetData = data.filter(r => r.sourceId === sheet.id);
                                                        const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                                                        const lastDash = sheet.name.lastIndexOf('-');
                                                        const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                        const code = getAlmCodeForSheet(sheet.id, data);
                                                        const statusObj = getUpdateStatus(sheet.lastUpdateTime);

                                                        return (
                                                            <button
                                                                key={sheet.id}
                                                                onClick={() => handleSelectSheet(sheet.id)}
                                                                className="group relative bg-white border border-gray-200 p-4 sm:p-5 rounded-xl sm:rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.012)] hover:shadow-md hover:border-teal-500 transition-all text-left w-full cursor-pointer overflow-hidden"
                                                            >
                                                                <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-4 w-full">
                                                                    
                                                                    {/* Column 1: Hospital Info & Status (Flexible width) */}
                                                                    <div className="flex items-center gap-3 md:gap-4 flex-[1_1_240px] min-w-[200px]">
                                                                        <div className="w-9 h-9 md:w-11 md:h-11 shrink-0 bg-blue-50 text-blue-600 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors relative shadow-2xs">
                                                                            <Hospital className="h-5 w-5 md:h-6 md:w-6" />
                                                                            <div className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5" title={statusObj.label}>
                                                                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusObj.color}`} />
                                                                                <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-white ${statusObj.color}`} />
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="flex items-center gap-1.5 mb-0.5 md:mb-1 flex-wrap">
                                                                                {code && (
                                                                                    <span className="text-[9px] md:text-[10px] font-black tracking-wider text-teal-600 bg-teal-50/80 px-1.5 py-0.5 rounded-md border border-teal-100 shrink-0">
                                                                                        {code}
                                                                                    </span>
                                                                                )}
                                                                                {/* Mobile sync state badge */}
                                                                                <span className="lg:hidden inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8.5px] font-extrabold bg-slate-50 border border-slate-200 shrink-0 whitespace-nowrap">
                                                                                    <span className="relative flex h-1.5 w-1.5 mr-0.5 shrink-0">
                                                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusObj.color}`} />
                                                                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusObj.color}`} />
                                                                                    </span>
                                                                                    <span className="text-slate-650 truncate max-w-[100px]">{statusObj.label}</span>
                                                                                </span>
                                                                            </div>
                                                                            <h3 className="text-[13px] sm:text-sm md:text-base font-black text-slate-800 leading-tight group-hover:text-slate-950 truncate" title={description}>
                                                                                {description}
                                                                            </h3>
                                                                            {/* Mobile items info */}
                                                                            <div className="lg:hidden flex items-center gap-1 mt-0.5 md:mt-1 text-[9px] md:text-[10px] text-slate-500 font-extrabold bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-md w-fit">
                                                                                <Package className="h-3 w-3 md:h-3.5 md:w-3.5 text-slate-400 shrink-0" />
                                                                                <span>{sheetData.length} ítems</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 2: Inventory Stats (LG+) */}
                                                                    <div className="hidden lg:flex flex-col gap-0.5 flex-[1_1_100px] max-w-[140px] min-w-[90px] shrink-0">
                                                                        <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Inventario</span>
                                                                        <div className="inline-flex items-center gap-1 text-[11px] font-black text-slate-705 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg w-fit">
                                                                            <Package className="h-3 w-3 text-slate-400 shrink-0" />
                                                                            <span>{sheetData.length} ítems</span>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 3: Sincronización Logs & Devices (LG+) */}
                                                                    <div className="hidden lg:flex flex-col gap-0.5 flex-[1_1_140px] max-w-[200px] min-w-[130px] shrink-0">
                                                                        <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">Última Conexión</span>
                                                                        <div className="flex flex-col gap-0.5 text-[9px] 2xl:text-[10px] font-extrabold text-slate-600">
                                                                            {sheet.lastUpdateTime && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <RefreshCw className="h-3 w-3 text-slate-450 shrink-0" />
                                                                                    <span className="truncate">Act: <span className="text-slate-850 font-black">{formatFullDate(sheet.lastUpdateTime)}</span></span>
                                                                                </div>
                                                                            )}
                                                                            {sheet.equipmentDateTime && (
                                                                                <div className="flex items-center gap-1">
                                                                                    <Monitor className="h-3 w-3 text-slate-450 shrink-0" />
                                                                                    <span className="truncate flex-1 min-w-0">Equipo: <span className={`font-black ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-rose-500 font-extrabold' : 'text-slate-600'}`}>{formatFullDate(sheet.equipmentDateTime)}</span></span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 4: Warning Badges & Actions */}
                                                                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 sm:gap-2.5 flex-[1_1_300px] min-w-[200px] ml-auto">
                                                                        {/* Sync status pill on desktop layout */}
                                                                        <div className="hidden lg:flex shrink-0 scale-[0.85] xl:scale-95 origin-right">
                                                                            {renderSyncStatusPill(sheet.lastUpdateTime)}
                                                                        </div>

                                                                        {/* Expirations badges */}
                                                                        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5 shrink-0 ml-auto">
                                                                            {expiredCount > 0 && (
                                                                                <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-0.5 sm:px-2.5 sm:py-1 md:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black border border-red-100/80 shadow-3xs whitespace-nowrap" title="Vencidos en stock">
                                                                                    <AlertTriangle className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-550 shrink-0" />
                                                                                    <span>{expiredCount} vencido{expiredCount !== 1 ? 's' : ''}</span>

                                                                                </div>
                                                                            )}
                                                                            {expiringThisMonthCount > 0 && (
                                                                                <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 sm:px-2.5 sm:py-1 md:py-1.5 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-black border border-amber-100/80 shadow-3xs whitespace-nowrap" title="Vencimiento cercano">
                                                                                    <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-550 shrink-0" />
                                                                                    <span>{expiringThisMonthCount} por vencer</span>

                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {/* Consult button / indicator */}
                                                                        <div className="flex items-center gap-1 pl-2 border-l border-slate-150 h-5 sm:h-7 shrink-0 ml-2">
                                                                            <span className="text-[9px] sm:text-[10.5px] font-black text-teal-600 uppercase tracking-wider group-hover:text-teal-755 whitespace-nowrap">Ver Stock</span>

                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* 3) COMPACT LAYOUT */}
                                            {sheetsViewMode === 'compact' && (
                                                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5 animate-in fade-in duration-200">
                                                    {filteredAndSortedSources.map((sheet) => {
                                                        const sheetData = data.filter(r => r.sourceId === sheet.id);
                                                        const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                                                        const lastDash = sheet.name.lastIndexOf('-');
                                                        const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                        const code = getAlmCodeForSheet(sheet.id, data);

                                                        return (
                                                            <button
                                                                key={sheet.id}
                                                                onClick={() => handleSelectSheet(sheet.id)}
                                                                className="group relative bg-white border border-gray-200 p-4 rounded-xl sm:rounded-2xl shadow-[0_1px_4px_rgba(0,0,0,0.012)] hover:shadow-md hover:border-teal-500 transition-all text-left flex flex-col justify-between h-full min-h-[175px] cursor-pointer"
                                                            >
                                                                <div className="w-full">
                                                                    {/* Compact Top Row: SISMED code with Establishment style icon, and stats/status dot on the right */}
                                                                    <div className="flex items-center justify-between mb-3.5">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="w-6.5 h-6.5 shrink-0 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                                <Hospital className="h-3.5 w-3.5" />
                                                                            </div>
                                                                            {code && <span className="text-[10.5px] font-black text-cyan-600 tracking-wide">{code}</span>}
                                                                        </div>

                                                                        <div className="flex items-center gap-1.5">
                                                                            {expiredCount > 0 && (
                                                                                <div className="bg-red-50 text-red-600 text-[10px] font-black px-1.5 py-0.5 rounded-md border border-red-200/50 shadow-3xs" title="Vencido">
                                                                                    {expiredCount}v
                                                                                </div>
                                                                            )}
                                                                            {expiringThisMonthCount > 0 && (
                                                                                <div className="bg-amber-50 text-amber-600 text-[10px] font-black px-1.5 py-0.5 rounded-md border border-amber-200/50 shadow-3xs" title="Por vencer">
                                                                                    {expiringThisMonthCount}pv
                                                                                </div>
                                                                            )}
                                                                            <div className="flex items-center" title={getUpdateStatus(sheet.lastUpdateTime).label}>
                                                                                <span className="relative flex h-3 w-3">
                                                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${getUpdateStatus(sheet.lastUpdateTime).color}`} />
                                                                                    <span className={`relative inline-flex rounded-full h-3 w-3 border border-white shadow-3xs ${getUpdateStatus(sheet.lastUpdateTime).color}`} />
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Description: Tighter text */}
                                                                    <h3 className="text-[13px] font-black text-slate-800 leading-snug tracking-tight mb-2 group-hover:text-teal-900 transition-colors line-clamp-1" title={description}>
                                                                        {description}
                                                                    </h3>

                                                                    {sheet.lastUpdateTime && (
                                                                        <div className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1.5" title="Última actualización">
                                                                            <RefreshCw className="h-3 w-3 text-slate-400/85 shrink-0" />
                                                                            <span>Act: <span className="font-extrabold text-slate-500">{formatFullDate(sheet.lastUpdateTime)}</span></span>
                                                                        </div>
                                                                    )}
                                                                    {sheet.equipmentDateTime && (
                                                                        <div className={`text-[10px] font-bold mt-0.5 flex items-center gap-1.5 ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500' : 'text-slate-400'}`} title="Fecha y hora del equipo">
                                                                            <Monitor className="h-3 w-3 text-slate-400/85 shrink-0" />
                                                                            <span>Equipo: <span className={`font-extrabold ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500 font-black' : 'text-slate-500'}`}>{formatFullDate(sheet.equipmentDateTime)}</span></span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Expirations and Ver Stock mini row */}
                                                                <div className="flex flex-wrap items-center justify-between mt-4 pt-3 border-t border-slate-100 w-full gap-2">
                                                                    {renderSyncStatusPill(sheet.lastUpdateTime)}
                                                                    
                                                                    <div className="flex items-center text-[9px] font-black text-teal-600 uppercase tracking-wider group-hover:text-teal-700 transition-colors shrink-0 ml-auto">
                                                                        <span>VER STOCK ({sheetData.length})</span>
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* 4) TABLE LAYOUT */}
                                            {sheetsViewMode === 'table' && (
                                                <div className={`bg-white rounded-2xl border border-slate-200/50 relative overflow-hidden ${isTableFullscreen ? 'shadow-lg border-slate-200/60 m-1 sm:m-2' : 'shadow-sm animate-in fade-in duration-200'}`}>
                                                    <div className="overflow-auto scrollbar-thin">
                                                    <table className="min-w-full divide-y divide-slate-100 text-left font-sans">
                                                        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider shadow-[0_1px_0_0_rgba(226,232,240,0.8)]">
                                                            <tr>
                                                                <th scope="col" className="px-5 py-3 font-black sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'code_asc' ? 'code_desc' : 'code_asc')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left uppercase tracking-wider font-black"
                                                                    >
                                                                        <span>Cód. SISMED</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'code_asc' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'code_desc' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'code_asc' && filterSortOrder !== 'code_desc' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'name_asc' ? 'name_desc' : 'name_asc')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left uppercase tracking-wider font-black"
                                                                    >
                                                                        <span>Establecimiento de Salud</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'name_asc' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'name_desc' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'name_asc' && filterSortOrder !== 'name_desc' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black text-center sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'type_asc' ? 'type_desc' : 'type_asc')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors uppercase tracking-wider font-black mx-auto justify-center"
                                                                    >
                                                                        <span>Tipo</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'type_asc' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'type_desc' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'type_asc' && filterSortOrder !== 'type_desc' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'date_newest' ? 'date_oldest' : 'date_newest')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left uppercase tracking-wider font-black"
                                                                    >
                                                                        <span>Última Sincronización</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'date_newest' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'date_oldest' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'date_newest' && filterSortOrder !== 'date_oldest' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'equip_newest' ? 'equip_oldest' : 'equip_newest')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors text-left uppercase tracking-wider font-black"
                                                                    >
                                                                        <span>Act. de Equipo</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'equip_newest' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'equip_oldest' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'equip_newest' && filterSortOrder !== 'equip_oldest' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black text-center sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'status_green_first' ? 'status_red_first' : 'status_green_first')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors uppercase tracking-wider font-black mx-auto justify-center"
                                                                    >
                                                                        <span>Estado</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'status_green_first' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'status_red_first' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'status_green_first' && filterSortOrder !== 'status_red_first' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black text-center sticky top-0 bg-slate-50 z-10">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={() => setFilterSortOrder(filterSortOrder === 'expired_highest' ? 'expired_lowest' : 'expired_highest')}
                                                                        className="group inline-flex items-center gap-1.5 hover:text-slate-800 transition-colors uppercase tracking-wider font-black mx-auto justify-center"
                                                                    >
                                                                        <span>Expiraciones</span>
                                                                        <span className="shrink-0">
                                                                            {filterSortOrder === 'expired_highest' && <ArrowDown className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder === 'expired_lowest' && <ArrowUp className="h-3.5 w-3.5 text-teal-600" />}
                                                                            {filterSortOrder !== 'expired_highest' && filterSortOrder !== 'expired_lowest' && (
                                                                                <ArrowUpDown className="h-3.5 w-3.5 text-slate-300 opacity-40 group-hover:opacity-100 transition-opacity" />
                                                                            )}
                                                                        </span>
                                                                    </button>
                                                                </th>
                                                                <th scope="col" className="px-5 py-3 font-black text-right pr-6 sticky top-0 bg-slate-50 z-10 uppercase tracking-wider">Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 bg-white">
                                                            {filteredAndSortedSources.map((sheet) => {
                                                                const sheetData = data.filter(r => r.sourceId === sheet.id);
                                                                const { expiredCount, expiringThisMonthCount } = getExpirationStats(sheetData);
                                                                const lastDash = sheet.name.lastIndexOf('-');
                                                                const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                                const code = getAlmCodeForSheet(sheet.id, data);
                                                                const type = getSheetType(sheet.name);
                                                                
                                                                let typeBadge = (
                                                                    <span className="inline-flex items-center justify-center bg-slate-50 text-slate-500 px-2 py-0.5 rounded text-[8.5px] font-bold border border-slate-100/80 min-w-[50px]">
                                                                        OTRO
                                                                    </span>
                                                                );
                                                                if (type === 'CS') {
                                                                    typeBadge = (
                                                                        <span className="inline-flex items-center justify-center bg-sky-50 text-sky-700 px-2 py-0.5 rounded text-[8.5px] font-bold border border-sky-100/70 min-w-[50px]">
                                                                            C.S.
                                                                        </span>
                                                                    );
                                                                } else if (type === 'PS') {
                                                                    typeBadge = (
                                                                        <span className="inline-flex items-center justify-center bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[8.5px] font-bold border border-amber-100/70 min-w-[50px]">
                                                                            P.S.
                                                                        </span>
                                                                    );
                                                                } else if (type === 'ALM') {
                                                                    typeBadge = (
                                                                        <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[8.5px] font-bold border border-indigo-100/70 min-w-[50px]">
                                                                            ALM
                                                                        </span>
                                                                    );
                                                                } else if (type === 'HOSP') {
                                                                    typeBadge = (
                                                                        <span className="inline-flex items-center justify-center bg-violet-50 text-violet-700 px-2 py-0.5 rounded text-[8.5px] font-bold border border-violet-100/75 min-w-[50px]">
                                                                            HOSP
                                                                        </span>
                                                                    );
                                                                }

                                                                const statusObj = getUpdateStatus(sheet.lastUpdateTime);

                                                                return (
                                                                    <tr 
                                                                        key={sheet.id}
                                                                        onClick={() => handleSelectSheet(sheet.id)}
                                                                        className="hover:bg-teal-50/20 transition-all cursor-pointer group"
                                                                    >
                                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                                            {code ? (
                                                                                <span className="text-[10px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                                                                                    {code}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[10px] text-slate-400 font-bold">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3">
                                                                            <h3 className="text-xs font-black text-slate-800 leading-snug truncate max-w-[240px] group-hover:text-teal-905 transition-colors" title={description}>
                                                                                {description}
                                                                            </h3>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center whitespace-nowrap">
                                                                            {typeBadge}
                                                                        </td>
                                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                                            {sheet.lastUpdateTime ? (
                                                                                <div className={`flex items-center gap-1.5 text-[10.5px] font-bold ${statusObj.color.includes('bg-emerald-500') ? 'text-slate-600' : 'text-slate-400'}`}>
                                                                                    <Wifi className={`h-3.5 w-3.5 shrink-0 ${statusObj.color.replace('bg-', 'text-')}`} />
                                                                                    <span>{formatFullDate(sheet.lastUpdateTime)}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-bold">
                                                                                    <Wifi className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                                                    <span>Sin datos</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                                            {sheet.equipmentDateTime ? (
                                                                                <div className={`flex items-center gap-1.5 text-[10.5px] font-bold ${statusObj.color.includes('bg-emerald-500') ? 'text-slate-600' : 'text-slate-400'}`}>
                                                                                    <Monitor className={`h-3.5 w-3.5 shrink-0 ${statusObj.color.includes('bg-emerald-500') ? 'text-indigo-500' : 'text-slate-400'}`} />
                                                                                    <span>{formatFullDate(sheet.equipmentDateTime)}</span>
                                                                                </div>
                                                                            ) : (
                                                                                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-400 font-bold">
                                                                                    <Monitor className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                                                                    <span>Sin datos</span>
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center whitespace-nowrap">
                                                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold border ${statusObj.color.includes('bg-emerald-500') ? 'bg-emerald-50 text-emerald-800 border-emerald-100' : statusObj.color.includes('bg-amber-500') ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-rose-50 text-rose-800 border-rose-100'}`}>
                                                                                <span className="relative flex h-1.5 w-1.5">
                                                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusObj.color}`} />
                                                                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusObj.color}`} />
                                                                                </span>
                                                                                {statusObj.label}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-center whitespace-nowrap">
                                                                            <div className="flex items-center justify-center gap-1.5">
                                                                                {expiredCount === 0 && expiringThisMonthCount === 0 ? (
                                                                                    <span className="inline-flex items-center gap-0.5 bg-green-50 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold border border-green-100">
                                                                                        <Check className="h-2.5 w-2.5 text-green-500" /> Al día
                                                                                    </span>
                                                                                ) : (
                                                                                    <>
                                                                                        {expiredCount > 0 && (
                                                                                            <span className="inline-flex items-center gap-0.5 bg-red-50 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-black border border-red-100" title="Vencido">
                                                                                                <AlertTriangle className="h-2.5 w-2.5 text-red-500" />
                                                                                                {expiredCount}v
                                                                                            </span>
                                                                                        )}
                                                                                        {expiringThisMonthCount > 0 && (
                                                                                            <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded text-[9px] font-black border border-amber-100" title="Por vencer">
                                                                                                <Clock className="h-2.5 w-2.5 text-amber-500" />
                                                                                                {expiringThisMonthCount}pv
                                                                                            </span>
                                                                                        )}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-5 py-3 text-right pr-6 whitespace-nowrap">
                                                                            <div className="inline-flex items-center gap-1 text-[10px] font-black text-teal-600 uppercase tracking-wider group-hover:text-teal-700 transition-all">
                                                                                <span>Ver stock</span>

                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                        );

                                        if (isTableFullscreen) {
                                            return (
                                                <div className="fixed inset-0 z-[105000] bg-slate-100 flex flex-col h-screen w-screen animate-in fade-in duration-200">
                                                    {/* Fullscreen Header */}
                                                    <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shadow-md shrink-0 border-b border-slate-800">
                                                        <div className="flex flex-wrap items-center gap-4 sm:gap-6 flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                                                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-widest text-slate-100 flex items-center gap-2 shrink-0">
                                                                    Establecimientos de Salud
                                                                    <span className="text-[10px] bg-slate-800 text-teal-400 px-2 py-0.5 rounded-full border border-slate-755 w-auto font-bold uppercase tracking-wider">
                                                                        {filteredAndSortedSources.length} ITEMS
                                                                    </span>
                                                                </h3>
                                                            </div>
                                                            {establishmentSummary && (
                                                                <div className="hidden lg:flex flex-wrap items-center gap-2 animate-in fade-in duration-300">
                                                                    <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-800/40 text-emerald-400 px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow-sm" title="Establecimientos En Línea (Actualizados recientemente o hace menos de 1 h)">
                                                                        <Wifi className="h-4 w-4 text-emerald-400 animate-pulse stroke-[2.5]" />
                                                                        <span className="text-slate-300 font-medium normal-case">En línea:</span>
                                                                        <span className="font-black text-xs sm:text-sm text-emerald-300">{establishmentSummary.online}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 bg-amber-950/50 border border-amber-800/40 text-amber-450 px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow-sm" title="Establecimientos Desactualizados (Actualizados entre 1 y 24 h)">
                                                                        <Clock className="h-4 w-4 text-amber-450 stroke-[2.5]" />
                                                                        <span className="text-slate-300 font-medium normal-case">Desactualizados:</span>
                                                                        <span className="font-black text-xs sm:text-sm text-amber-300">{establishmentSummary.delayed}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 bg-red-950/50 border border-red-800/40 text-red-500 px-3 py-1 rounded-xl text-[11px] sm:text-xs font-bold uppercase tracking-wide shadow-sm" title="Establecimientos Fuera de Línea (Actualizados hace más de 24 h)">
                                                                        <WifiOff className="h-4 w-4 text-red-400 stroke-[2.5]" />
                                                                        <span className="text-slate-300 font-medium normal-case">Fuera de línea:</span>
                                                                        <span className="font-black text-xs sm:text-sm text-red-400">{establishmentSummary.offline}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
                                                            {/* Fullscreen Search Input */}
                                                            <div className="relative group w-32 xs:w-40 sm:w-48 md:w-56">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="Buscar..." 
                                                                    value={sheetSearchTerm} 
                                                                    onChange={(e) => setSheetSearchTerm(e.target.value)} 
                                                                    className="w-full pl-8 pr-3 py-1.5 bg-slate-800/90 text-white placeholder-slate-400 border border-slate-700/80 hover:bg-slate-750 focus:bg-slate-900 focus:border-teal-500 rounded-xl text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-teal-500/30" 
                                                                />
                                                                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                                                                    <Search className="h-3 w-3 text-slate-500 group-focus-within:text-teal-400 transition-colors" />
                                                                </div>
                                                            </div>

                                                            {/* Advanced Filters Trigger */}
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsAdvancedFiltersSidebarOpen(true)}
                                                                className="relative flex items-center justify-center p-2 rounded-xl bg-slate-800 border border-slate-700/80 hover:bg-slate-750 text-slate-300 hover:text-teal-400 transition-all cursor-pointer shadow-sm shrink-0"
                                                                title="Filtros Avanzados"
                                                            >
                                                                <Filter className="h-3.5 w-3.5" />
                                                                {(!filter_CS || !filter_PS || !filter_ALM || !filter_HOSP || !filter_OTRO || !filter_emerald || !filter_amber || !filter_red || !filter_gray || filterSortOrder !== 'name_asc' || filterHasPendingExpirations) && (
                                                                    <span className="absolute top-1 right-1 w-2 h-2 bg-teal-400 rounded-full border border-slate-900 animate-pulse" />
                                                                )}
                                                            </button>

                                                            {/* View Switcher inside Fullscreen Header */}
                                                            <div className="flex items-center gap-0.5 bg-slate-800 border border-slate-700/60 p-0.5 rounded-xl">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSheetsViewMode('grid')}
                                                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                                        sheetsViewMode === 'grid'
                                                                            ? "bg-slate-700 text-teal-400 font-bold"
                                                                            : "text-slate-400 hover:text-slate-300"
                                                                    }`}
                                                                    title="Vista Cuadrícula"
                                                                >
                                                                    <LayoutGrid className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSheetsViewMode('list')}
                                                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                                        sheetsViewMode === 'list'
                                                                            ? "bg-slate-700 text-teal-400 font-bold"
                                                                            : "text-slate-400 hover:text-slate-300"
                                                                    }`}
                                                                    title="Vista Lista"
                                                                >
                                                                    <List className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSheetsViewMode('compact')}
                                                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                                        sheetsViewMode === 'compact'
                                                                            ? "bg-slate-700 text-teal-400 font-bold"
                                                                            : "text-slate-400 hover:text-slate-300"
                                                                    }`}
                                                                    title="Vista Compacta"
                                                                >
                                                                    <Grid className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSheetsViewMode('table')}
                                                                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                                                        sheetsViewMode === 'table'
                                                                            ? "bg-slate-700 text-teal-400 font-bold"
                                                                            : "text-slate-400 hover:text-slate-300"
                                                                    }`}
                                                                    title="Vista Tabla"
                                                                >
                                                                    <Table2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>

                                                            {/* Exit fullscreen - ICON ONLY */}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleTableFullscreen(false)}
                                                                className="flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-755 text-slate-300 hover:text-teal-400 rounded-xl border border-slate-700/80 shadow-sm cursor-pointer transition-all active:scale-95 shrink-0"
                                                                title="Salir de Pantalla Completa"
                                                            >
                                                                <Minimize2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Fullscreen Scrollable Body Container */}
                                                    <div className="flex-1 overflow-auto p-4 sm:p-6 scrollbar-thin bg-slate-100">
                                                        {viewContent}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return viewContent;
                                    })()}
                                </div>
                            )}

                            {/* LEVEL 3: DATA TABLE */}
                            {viewLevel === 'data' && (
                                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 -mx-4 md:-mx-6 -mt-4 md:-mt-6 font-sans">
                                    <div className="bg-transparent sm:bg-white sm:border-t border-gray-100 overflow-y-auto overflow-x-auto min-h-[500px] md:min-h-[650px] max-h-[600px] md:max-h-[750px] lg:max-h-[850px] custom-scrollbar pb-6 px-4 sm:px-0 pt-4 sm:pt-0 relative block">
                                        <table className="min-w-full block sm:table">
                                            <thead className="hidden sm:table-header-group sticky top-0 z-30 shadow-xs border-b border-slate-200">
                                                <tr className="bg-slate-50">
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">Cód. SISMED / SIGA</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider min-w-[250px] bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">Descripción del Producto</th>
                                                    <th scope="col" className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">Saldo</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">Lote / Venc.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">Tipo Sum.</th>
                                                    <th scope="col" className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase tracking-wider whitespace-nowrap bg-slate-50 sticky top-0 z-30 border-b border-slate-200/80 shadow-2xs">F. Finan.</th>
                                                </tr>
                                            </thead>
                                            <tbody className="block sm:table-row-group bg-transparent sm:bg-white">
                                                {filteredData.length > 0 ? filteredData.map((row, i) => (
                                                    <tr 
                                                        key={i} 
                                                        onClick={() => setSelectedRecord(row)}
                                                        className="block sm:table-row bg-white rounded-xl sm:rounded-none shadow-sm sm:shadow-none border border-gray-200 sm:border-0 border-b-gray-100 p-4 sm:p-0 hover:bg-teal-50/50 transition-colors cursor-pointer group mb-3 sm:mb-0 relative"
                                                    >
                                                        {/* Mobile Card Layout */}
                                                        <td className="block sm:hidden">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded w-fit mb-1 border border-teal-100">{row.ID_Producto || '-'}</span>
                                                                    <span className="text-[10px] text-gray-400 font-bold">{row.CODIGO_SIG || '-'}</span>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="text-[10px] text-gray-400 font-black uppercase block mb-0.5">Saldo</span>
                                                                    <span className="text-xl font-black text-teal-600 leading-none">{(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-sm font-bold text-gray-900 mb-2 leading-snug">
                                                                {row.Nombre || '-'}
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <div className="flex flex-col gap-0.5 w-full">
                                                                    <span className="text-gray-500 font-mono"><span className="font-bold text-gray-400">Lote:</span> {row.Lote || '-'}</span>
                                                                    <div className="flex justify-between items-center">
                                                                        <span className="text-gray-500 font-mono"><span className="font-bold text-gray-400">Vence:</span> {formatDate(row.Fec_Vencim) || '-'}</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 font-bold uppercase truncate max-w-[80px]" title={row.TIPSUM}>{row.TIPSUM || '-'}</span>
                                                                            <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-100 font-bold uppercase truncate max-w-[80px]" title={row.FFINAN}>{row.FFINAN || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        
                                                        {/* Desktop Table Cells */}
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono group-hover:text-teal-700">
                                                            <div className="font-bold">{row.ID_Producto || '-'}</div>
                                                            <div className="text-[10px] text-gray-400 mt-0.5">{row.CODIGO_SIG || '-'}</div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 text-sm text-gray-900 font-medium">
                                                            {row.Nombre || '-'}
                                                            <div className="text-[10px] text-gray-400 font-normal mt-0.5 max-w-sm truncate" title={row.Reg_Sanitario}>
                                                                RS: {row.Reg_Sanitario || 'S/N'}
                                                            </div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                                                            {(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                                            <span className="font-mono text-gray-700">{row.Lote || '-'}</span>
                                                            <div className="text-[10px] mt-0.5">Vence: {formatDate(row.Fec_Vencim) || '-'}</div>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase" title={row.DESC_TIPSUM}>
                                                                {row.TIPSUM || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap text-sm">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 uppercase" title={row.DESC_FFINAN}>
                                                                {row.FFINAN || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr className="block sm:table-row">
                                                        <td colSpan={6} className="block sm:table-cell px-4 py-12 text-center text-sm text-gray-500">
                                                            No se encontraron coincidencias para su búsqueda.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Stock en Fullscreen */}
            {isTableFullscreen && stockModalSourceId && (
                <div className="fixed inset-0 z-[106000] flex items-center justify-center p-2 sm:p-5 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => { setStockModalSourceId(null); setStockModalSearchTerm(''); }}>
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-6xl overflow-hidden flex flex-col h-full max-h-[90vh] animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Dark Header inside Modal */}
                        {(() => {
                            const sheetInfo = sources.find(s => s.id === stockModalSourceId);
                            const code = getAlmCodeForSheet(stockModalSourceId || '', data);
                            const statusObj = sheetInfo ? getUpdateStatus(sheetInfo.lastUpdateTime) : null;
                            const description = sheetInfo ? (sheetInfo.name.lastIndexOf('-') === -1 ? sheetInfo.name.replace(/^FARM\s*-\s*/i, '') : sheetInfo.name.substring(0, sheetInfo.name.lastIndexOf('-')).trim().replace(/^FARM\s*-\s*/i, '')) : '';
                            
                            return sheetInfo && (
                                <div className="px-4 sm:px-5 py-3.5 bg-slate-900 flex justify-between items-center text-white shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-teal-500/20 text-teal-400 rounded-xl flex items-center justify-center shadow-inner">
                                            <Hospital className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col text-left">
                                            <div className="flex items-center gap-2">
                                                {code && <span className="text-xs font-black text-teal-400 font-mono tracking-wider">{code}</span>}
                                                <span className="text-sm font-bold truncate max-w-[200px] sm:max-w-md">{description}</span>
                                            </div>
                                            {statusObj && (
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className={`relative flex h-1.5 w-1.5 shrink-0`}>
                                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusObj.color}`} />
                                                        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${statusObj.color}`} />
                                                    </span>
                                                    <span className="text-[10.5px] text-slate-400 font-medium">Act: {statusObj.fullLabel}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="hidden sm:flex items-center gap-4">
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Items encontrados</span>
                                            <span className="text-xl font-black text-slate-100 leading-none">{modalStockData.length}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                        
                        {/* Header Filters & Actions */}
                        <div className="px-4 sm:px-5 pt-4 pb-2 sm:pt-5 sm:pb-3 shrink-0 flex flex-col sm:flex-row gap-4 items-center justify-between">
                            <div className="relative w-full sm:max-w-xl group">
                                <input 
                                    type="text" 
                                    placeholder="Buscar medicamento en esta hoja..." 
                                    value={stockModalSearchTerm} 
                                    onChange={(e) => setStockModalSearchTerm(e.target.value)} 
                                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50/85 text-slate-800 placeholder-slate-450 border border-slate-200 hover:border-slate-300 focus:bg-white focus:border-teal-500 rounded-xl text-sm transition-all focus:outline-none focus:ring-4 focus:ring-teal-500/10 font-semibold shadow-2xs" 
                                />
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-slate-400 group-focus-within:text-teal-600 stroke-[2.5] transition-colors" />
                                </div>
                                {stockModalSearchTerm && (
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center z-10">
                                        <button 
                                            type="button"
                                            onClick={() => setStockModalSearchTerm('')}
                                            className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors active:scale-95 cursor-pointer flex items-center justify-center"
                                            title="Limpiar"
                                        >
                                            <X className="h-3.5 w-3.5 stroke-[2.5]" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-end">
                                {(() => {
                                    const modalDataStats = getExpirationStats(modalStockData);
                                    return (
                                        <>
                                            {modalDataStats.expiredCount > 0 && (
                                                <button onClick={() => { setSelectedSourceId(stockModalSourceId || ''); setExpirationModalType('expired'); setIsExpirationModalOpen(true); }} className="flex items-center gap-1.5 bg-white hover:bg-rose-50 text-rose-600 px-4 py-2.5 rounded-xl border border-rose-200 text-sm font-bold transition-all shrink-0 shadow-sm cursor-pointer">
                                                    <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                                                    <span>{modalDataStats.expiredCount} Vencidos</span>
                                                </button>
                                            )}
                                            {modalDataStats.expiringThisMonthCount > 0 && (
                                                <button onClick={() => { setSelectedSourceId(stockModalSourceId || ''); setExpirationModalType('expiring'); setIsExpirationModalOpen(true); }} className="flex items-center gap-1.5 bg-white hover:bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl border border-amber-200 text-sm font-bold transition-all shrink-0 shadow-sm cursor-pointer">
                                                    <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                                                    <span>{modalDataStats.expiringThisMonthCount} Por vencer</span>
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                                <button onClick={exportModalStockToExcel} className="flex items-center gap-1.5 bg-white hover:bg-teal-50 text-teal-700 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold transition-all shrink-0 shadow-sm">
                                    <Download className="h-4 w-4 shrink-0" />
                                    Exportar Stock
                                </button>
                                <button onClick={() => { setStockModalSourceId(null); setStockModalSearchTerm(''); }} className="ml-2 bg-white text-gray-400 hover:text-gray-700 p-2 rounded-xl transition-colors border border-transparent hover:border-gray-200 hover:bg-gray-50 shadow-sm">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Desktop Header */}
                        <div className="hidden sm:flex flex-row items-center py-3 px-4 sm:px-8 bg-slate-100/80 border-b border-gray-200 gap-6 shrink-0 font-bold text-xs text-slate-500 uppercase tracking-wider">
                            <div className="shrink-0 w-32">SISMED/SIGA</div>
                            <div className="flex-1 min-w-0 text-left">Descripción del Producto</div>
                            <div className="shrink-0 w-24 text-right">Saldo</div>
                            <div className="shrink-0 w-36 text-left">Lote / Venc.</div>
                            <div className="shrink-0 w-28 text-right">Tipos</div>
                        </div>

                        {/* List Body */}
                        <div className="flex-1 overflow-auto bg-white p-0 sm:p-2 custom-scrollbar">
                            <div className="flex flex-col">
                                {modalStockData.length > 0 ? modalStockData.map((row, i) => (
                                    <div 
                                        key={`m-${i}`} 
                                        onClick={() => setSelectedRecord(row)}
                                        className="flex flex-col sm:flex-row sm:items-center py-4 px-4 sm:px-6 border-b border-gray-100 hover:bg-slate-50 transition-colors cursor-pointer gap-4 sm:gap-6"
                                    >
                                        {/* Col 1: IDs */}
                                        <div className="flex flex-col shrink-0 sm:w-32">
                                            <span className="font-bold text-gray-800 text-sm">{row.ID_Producto || row.CODIGO_ANTERIOR || '-'}</span>
                                            <span className="text-[10px] text-gray-400 font-medium mt-0.5">{row.CODIGO_SIG || '-'}</span>
                                        </div>

                                        {/* Col 2: Name */}
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <span className="text-sm font-bold text-gray-900 leading-snug">{row.Nombre || '-'}</span>
                                            <span className="text-[10px] text-gray-400 font-medium mt-1">RS: {row.Reg_Sanitario || 'S/N'}</span>
                                        </div>

                                        {/* Col 3: Saldo (Stock) */}
                                        <div className="flex items-center justify-end shrink-0 sm:w-24">
                                            <span className="text-xl font-black text-gray-900">
                                                {(!isNaN(parseInt(String(row.Saldo), 10))) ? parseInt(String(row.Saldo), 10) : 0}
                                            </span>
                                        </div>

                                        {/* Col 4: Lote & Vence */}
                                        <div className="flex flex-col shrink-0 sm:w-36">
                                            <span className="text-sm text-gray-700">{row.Lote || '-'}</span>
                                            <span className="text-[10px] text-gray-400 mt-1">Vence: {formatDate(row.Fec_Vencim) || '-'}</span>
                                        </div>

                                        {/* Col 5: Badges */}
                                        <div className="flex items-center justify-end gap-2 shrink-0 sm:w-28">
                                            {row.TIPSUM && (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase border border-indigo-100/50">
                                                    {row.TIPSUM}
                                                </span>
                                            )}
                                            {row.FFINAN && (
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase border border-amber-100/50">
                                                    {row.FFINAN}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )) : (
                                    <div className="py-16 text-center">
                                        <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
                                        <p className="text-sm text-gray-500">No se encontraron productos en este establecimiento.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalle */}
            {selectedRecord && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedRecord(null)}>
                    <div 
                        className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header Minimalista y Elegante */}
                        <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-5 sm:pb-6 bg-gradient-to-b from-teal-50/50 to-white flex justify-between items-start relative border-b border-gray-100">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-blue-500"></div>
                            <div className="pr-10 sm:pr-12 w-full">
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                    <span className="inline-flex items-center justify-center h-7 sm:h-8 px-3 rounded-full text-[10px] sm:text-xs font-black bg-teal-100 text-teal-800 shadow-sm border border-teal-200/50 whitespace-nowrap">
                                        COD: {selectedRecord.ID_Producto || 'S/ID'}
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                                        SIGA: {selectedRecord.CODIGO_SIG || '-'}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight tracking-tight break-words">
                                    {selectedRecord.Nombre || 'Sin Descripción'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="absolute top-4 sm:top-6 right-4 sm:right-6 text-gray-400 hover:text-gray-900 hover:bg-gray-100 p-2 sm:p-2.5 rounded-full transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        
                        <div className="px-5 sm:px-8 pb-5 sm:pb-8 overflow-y-auto max-h-[70vh] custom-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 mt-5 sm:mt-6">
                                {/* Estado y Ubicación - Destacado */}
                                <div className="col-span-full bg-gray-50/80 rounded-2xl p-4 sm:p-5 border border-gray-100/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                                    <div className="w-full sm:w-auto">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black mb-1">Establecimiento</p>
                                        <p className="text-sm border-b border-gray-100/50 pb-2 sm:border-0 sm:pb-0 font-bold text-gray-900 leading-snug">{(selectedRecord.DESC_ALM || '-').replace(/^FARM\s*-\s*/i, '')} <span className="text-gray-400 font-medium whitespace-nowrap">({formatAlmCode(selectedRecord.ALMCOD)})</span></p>
                                    </div>
                                    <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto bg-white sm:bg-transparent p-3 sm:p-0 rounded-xl sm:rounded-none border sm:border-0 border-gray-100 mt-2 sm:mt-0">
                                        <p className="text-[10px] sm:text-[10px] text-gray-500 uppercase tracking-widest font-black mb-0 sm:mb-1">Saldo Actual</p>
                                        <p className={`text-2xl sm:text-3xl font-black leading-none ${parseFloat(String(selectedRecord.Saldo || '0').replace(/,/g, '')) <= 0 ? 'text-red-500' : 'text-teal-600'}`}>
                                            {(!isNaN(parseInt(String(selectedRecord.Saldo), 10))) ? parseInt(String(selectedRecord.Saldo), 10) : 0}
                                        </p>
                                    </div>
                                </div>

                                {/* Bloque de Datos Lote/Vencimiento */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Control de Calidad</h4>
                                    </div>
                                    <div className="bg-white space-y-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Lote</p>
                                            <p className="text-sm font-mono font-bold text-gray-800">{selectedRecord.Lote || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Fecha de Vencimiento</p>
                                            <p className={`text-sm font-black ${
                                                (() => {
                                                    if (!selectedRecord.Fec_Vencim) return 'text-gray-800';
                                                    const today = new Date(); today.setHours(0,0,0,0);
                                                    const parts = selectedRecord.Fec_Vencim.split(/[\/\-]/);
                                                    if (parts.length === 3) {
                                                        const m = parseInt(parts[1],10)-1; const y = parseInt(parts[2],10); const d = parseInt(parts[0],10);
                                                        const fy = y < 100 ? y + 2000 : y;
                                                        const exp = new Date(fy, m, d);
                                                        if (exp < today) return 'text-red-600';
                                                        if (m === today.getMonth() && fy === today.getFullYear()) return 'text-amber-600';
                                                    }
                                                    return 'text-gray-800';
                                                })()
                                            }`}>
                                                {formatDate(selectedRecord.Fec_Vencim) || '-'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Registro Sanitario</p>
                                            <p className="text-sm font-medium text-gray-800 uppercase">{selectedRecord.Reg_Sanitario || '-'}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Última Actualización</p>
                                            <p className="text-xs font-medium text-gray-500">{formatDate(selectedRecord.Ultima_Actualizacion) || '-'}</p>
                                        </div>
                                        {selectedRecord.FECHA_DEL_EQUIPO && (
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Fecha del Equipo</p>
                                                <p className={`text-xs font-medium ${selectedRecord.FECHA_DEL_EQUIPO !== selectedRecord.Ultima_Actualizacion ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {formatDate(selectedRecord.FECHA_DEL_EQUIPO)}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Bloque de Clasificación y Financiamiento */}
                                <div className="space-y-5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Database className="w-4 h-4 text-gray-400" />
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider">Clasificación</h4>
                                    </div>
                                    <div className="bg-white space-y-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Tipo de Suministro</p>
                                            <p className="text-sm font-medium text-gray-800">{selectedRecord.DESC_TIPSUM || '-'} <span className="text-gray-400 font-bold text-[10px] uppercase ml-1 px-1.5 py-0.5 bg-gray-100 rounded">{selectedRecord.TIPSUM || '-'}</span></p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">F. Financiamiento</p>
                                            <p className="text-sm font-medium text-gray-800">{selectedRecord.DESC_FFINAN || '-'} <span className="text-gray-400 font-bold text-[10px] uppercase ml-1 px-1.5 py-0.5 bg-gray-100 rounded">{selectedRecord.FFINAN || '-'}</span></p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Precio Compra</p>
                                                <p className="text-sm font-black text-gray-900">S/ {selectedRecord.Precio_Det || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mb-1">Precio Referencial</p>
                                                <p className="text-sm font-bold text-gray-500">S/ {selectedRecord.Precio_Cab || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-8 py-5 bg-gray-50/80 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => setSelectedRecord(null)}
                                className="bg-white border border-gray-200 text-gray-700 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Expiración */}
            {isExpirationModalOpen && expirationModalType && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsExpirationModalOpen(false)}>
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200 max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`p-4 sm:p-6 border-b border-gray-100 flex items-start justify-between ${expirationModalType === 'expired' ? 'bg-red-50' : 'bg-amber-50'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${expirationModalType === 'expired' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {expirationModalType === 'expired' ? <AlertTriangle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-gray-900">
                                        {expirationModalType === 'expired' ? `Productos Vencidos (al ${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()})` : 'Productos por Vencer (Este Mes)'}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        {expirationModalType === 'expired' ? 'Atención urgente requerida' : 'Asegure la rotación de estos inventarios'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsExpirationModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors shrink-0">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-auto bg-gray-50/30 p-0">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50/80 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider whitespace-nowrap">Cód. SISMED / SIGA</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Descripción del Producto</th>
                                        <th scope="col" className="px-4 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Saldo</th>
                                        <th scope="col" className="px-4 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Lote / Venc.</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {(expirationModalType === 'expired' ? activeSheetExpirationInfo.expired : activeSheetExpirationInfo.expiringThisMonth).map((row, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => { setIsExpirationModalOpen(false); setSelectedRecord(row); }}>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded w-fit mb-1">{row.ID_Producto || '-'}</span>
                                                    <span className="text-[10px] text-gray-400 font-bold">{row.CODIGO_SIG}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="text-sm font-bold text-gray-900 break-words line-clamp-2" title={row.Nombre}>{row.Nombre || '-'}</div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 break-words line-clamp-1 truncate" title={row.Reg_Sanitario}>RS: {row.Reg_Sanitario || 'S/N'}</div>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right">
                                                <span className={`text-base font-black ${row.Saldo?.toString() === '0' ? 'text-red-500' : 'text-gray-900'} bg-gray-50 px-2 py-1 rounded inline-block`}>{row.Saldo || '0'}</span>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900 uppercase">{row.Lote || '-'}</div>
                                                <div className={`text-[10px] font-bold mt-0.5 ${expirationModalType === 'expired' ? 'text-red-600' : 'text-amber-600'}`}>Vence: {row.Fec_Vencim || '-'}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {((expirationModalType === 'expired' ? activeSheetExpirationInfo.expired : activeSheetExpirationInfo.expiringThisMonth).length === 0) && (
                                <div className="text-center py-12 text-gray-500">
                                    No hay registros para mostrar.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SIDEBAR DE FILTROS AVANZADOS (DERECHA) */}
            {isAdvancedFiltersSidebarOpen && (
                <div className="fixed inset-0 z-[110000] flex justify-end pointer-events-none">
                    {/* Backdrop Click Dismiss (Solo en móvil para no bloquear interacción de fondo en escritorio) */}
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-xs pointer-events-auto md:hidden" onClick={() => setIsAdvancedFiltersSidebarOpen(false)} />
                    
                    {/* Sidebar Container */}
                    <div className="relative w-full max-w-sm sm:max-w-md md:w-[380px] xl:w-[420px] md:max-w-none bg-slate-50 h-full shadow-[-12px_0_40px_rgba(0,0,0,0.1),-1px_0_4px_rgba(0,0,0,0.02)] border-l border-slate-200 pointer-events-auto animate-in slide-in-from-right duration-350 flex flex-col overflow-y-auto custom-scrollbar">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] z-20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 shadow-sm border border-teal-100/50">
                                    <Filter className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base tracking-tight uppercase">Filtros Avanzados</h3>
                                    <p className="text-[10px] text-teal-600 font-extrabold tracking-widest uppercase">
                                        {viewLevel === 'data' ? 'Filtros del Medicamento' : 'Establecimientos de Salud'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAdvancedFiltersSidebarOpen(false)}
                                className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl transition-all text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 hover:border-slate-200 bg-white"
                                title="Cerrar filtros"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6 space-y-6">
                            {viewLevel === 'data' ? (
                                <div className="space-y-6">
                                    {/* Estado de Vencimiento */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado de Vencimiento</h4>
                                            </div>
                                            {dataFilterExpiration !== 'all' && (
                                                <button
                                                    onClick={() => setDataFilterExpiration('all')}
                                                    className="text-[10px] text-teal-600 hover:text-teal-700 font-extrabold uppercase hover:underline cursor-pointer"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'all', label: 'Todos', desc: 'Sin restricciones' },
                                                { value: 'expired', label: 'Vencidos', desc: 'Atención urgente' },
                                                { value: 'expiring', label: 'Por vencer', desc: 'Este mes' },
                                                { value: 'ok', label: 'Vigentes', desc: 'Buen estado' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDataFilterExpiration(opt.value)}
                                                    className={`group p-3 rounded-2xl cursor-pointer transition-all border text-left select-none ${
                                                        dataFilterExpiration === opt.value
                                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-950 shadow-sm'
                                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                            dataFilterExpiration === opt.value
                                                                ? 'bg-teal-600 border-teal-600 text-white scale-100'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                                        }`}>
                                                            <Check className="h-3 w-3 stroke-[3]" />
                                                        </div>
                                                        <span className={`text-[11px] font-bold tracking-tight uppercase ${dataFilterExpiration === opt.value ? 'text-teal-950 font-black' : 'text-slate-705'}`}>{opt.label}</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-400 ml-6 leading-none mt-1">{opt.desc}</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Vencimiento Avanzado: Mes y Año */}
                                    {(() => {
                                        const monthsList = [
                                            { value: 'all', label: 'TODOS LOS MESES' },
                                            { value: '1', label: 'ENERO (01)' },
                                            { value: '2', label: 'FEBRERO (02)' },
                                            { value: '3', label: 'MARZO (03)' },
                                            { value: '4', label: 'ABRIL (04)' },
                                            { value: '5', label: 'MAYO (05)' },
                                            { value: '6', label: 'JUNIO (06)' },
                                            { value: '7', label: 'JULIO (07)' },
                                            { value: '8', label: 'AGOSTO (08)' },
                                            { value: '9', label: 'SEPTIEMBRE (09)' },
                                            { value: '10', label: 'OCTUBRE (10)' },
                                            { value: '11', label: 'NOVIEMBRE (11)' },
                                            { value: '12', label: 'DICIEMBRE (12)' }
                                        ];
                                        return (
                                            <div className="space-y-3 bg-slate-50/70 border border-slate-200/60 rounded-2xl p-4">
                                                <div className="flex items-center justify-between w-full border-b border-slate-200/40 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="w-4 h-4 text-teal-600" />
                                                        <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-wider">Mes / Año de Vencimiento</h4>
                                                    </div>
                                                    {(dataFilterExpMonth !== 'all' || dataFilterExpYear !== 'all') && (
                                                        <button
                                                            onClick={() => {
                                                                setDataFilterExpMonth('all');
                                                                setDataFilterExpYear('all');
                                                            }}
                                                            className="text-[10px] text-teal-600 hover:text-teal-700 font-extrabold uppercase hover:underline cursor-pointer"
                                                        >
                                                            Limpiar
                                                        </button>
                                                    )}
                                                </div>

                                                <p className="text-[10px] text-slate-400 leading-normal">
                                                    Ver productos que vencen únicamente en el período de mes y año seleccionado.
                                                </p>

                                                <div className="grid grid-cols-2 gap-3 pt-1">
                                                    {/* Mes */}
                                                    <div className="space-y-1.5 relative">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Mes de Vencimiento</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsMonthDropdownOpen(!isMonthDropdownOpen);
                                                                setIsYearDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center justify-between pl-3 pr-3 py-2 bg-white border rounded-xl text-[10px] sm:text-[11px] font-bold text-slate-800 uppercase tracking-wide shadow-sm transition-all text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500/50 ${
                                                                isMonthDropdownOpen ? 'border-teal-500 ring-1 ring-teal-500/30' : 'border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <span className="truncate">
                                                                {dataFilterExpMonth === 'all' ? 'TODOS LOS MESES' : (
                                                                    monthsList.find(m => m.value === dataFilterExpMonth)?.label || dataFilterExpMonth
                                                                )}
                                                            </span>
                                                            <ChevronDown className={`h-3 w-3 text-slate-400 stroke-[3] transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {isMonthDropdownOpen && (
                                                            <>
                                                                {/* Click-away backdrop */}
                                                                <div className="fixed inset-0 z-40" onClick={() => setIsMonthDropdownOpen(false)} />
                                                                {/* Options list */}
                                                                <div className="absolute left-0 right-0 z-50 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar divide-y divide-slate-100/50 py-1 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
                                                                    {monthsList.map(m => (
                                                                        <button
                                                                            key={m.value}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setDataFilterExpMonth(m.value);
                                                                                setIsMonthDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-[10.5px] font-bold tracking-tight uppercase transition-all flex items-center justify-between hover:bg-teal-50/50 cursor-pointer ${
                                                                                dataFilterExpMonth === m.value ? 'text-teal-905 bg-teal-50/30' : 'text-slate-600 hover:text-slate-900'
                                                                            }`}
                                                                        >
                                                                            <span>{m.label}</span>
                                                                            {dataFilterExpMonth === m.value && <Check className="h-3 w-3 text-teal-600 stroke-[3]" />}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>

                                                    {/* Año */}
                                                    <div className="space-y-1.5 relative">
                                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Año de Vencimiento</label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setIsYearDropdownOpen(!isYearDropdownOpen);
                                                                setIsMonthDropdownOpen(false);
                                                            }}
                                                            className={`w-full flex items-center justify-between pl-3 pr-3 py-2 bg-white border rounded-xl text-[10px] sm:text-[11px] font-bold text-slate-800 uppercase tracking-wide shadow-sm transition-all text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-teal-500/50 ${
                                                                isYearDropdownOpen ? 'border-teal-500 ring-1 ring-teal-500/30' : 'border-slate-200 hover:border-slate-300'
                                                            }`}
                                                        >
                                                            <span className="truncate">
                                                                {dataFilterExpYear === 'all' ? 'TODOS LOS AÑOS' : dataFilterExpYear}
                                                            </span>
                                                            <ChevronDown className={`h-3 w-3 text-slate-400 stroke-[3] transition-transform duration-200 ${isYearDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </button>

                                                        {isYearDropdownOpen && (
                                                            <>
                                                                {/* Click-away backdrop */}
                                                                <div className="fixed inset-0 z-40" onClick={() => setIsYearDropdownOpen(false)} />
                                                                {/* Options list */}
                                                                <div className="absolute left-0 right-0 z-50 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-xl max-h-52 overflow-y-auto custom-scrollbar divide-y divide-slate-100/50 py-1 transition-all animate-in fade-in slide-in-from-top-2 duration-200">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setDataFilterExpYear('all');
                                                                            setIsYearDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-[10.5px] font-bold tracking-tight uppercase transition-all flex items-center justify-between hover:bg-teal-50/50 cursor-pointer ${
                                                                            dataFilterExpYear === 'all' ? 'text-teal-905 bg-teal-50/30' : 'text-slate-600 hover:text-slate-900'
                                                                        }`}
                                                                    >
                                                                        <span>TODOS LOS AÑOS</span>
                                                                        {dataFilterExpYear === 'all' && <Check className="h-3 w-3 text-teal-600 stroke-[3]" />}
                                                                    </button>
                                                                    {availableYears.map(yr => (
                                                                        <button
                                                                            key={yr}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setDataFilterExpYear(yr);
                                                                                setIsYearDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2 text-[10.5px] font-bold tracking-tight uppercase transition-all flex items-center justify-between hover:bg-teal-50/50 cursor-pointer ${
                                                                                dataFilterExpYear === yr ? 'text-teal-905 bg-teal-50/30' : 'text-slate-600 hover:text-slate-900'
                                                                            }`}
                                                                        >
                                                                            <span>{yr}</span>
                                                                            {dataFilterExpYear === yr && <Check className="h-3 w-3 text-teal-600 stroke-[3]" />}
                                                                        </button>
                                                                    ))}
                                                                    {dataFilterExpYear !== 'all' && !availableYears.includes(dataFilterExpYear) && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setDataFilterExpYear(dataFilterExpYear);
                                                                                setIsYearDropdownOpen(false);
                                                                            }}
                                                                            className="w-full text-left px-3 py-2 text-[10.5px] font-black tracking-tight uppercase bg-teal-50/20 text-teal-905 flex items-center justify-between"
                                                                        >
                                                                            <span>{dataFilterExpYear}</span>
                                                                            <Check className="h-3 w-3 text-teal-600 stroke-[3]" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Manual Input field next to it for advanced typed search or if year isn't in database list */}
                                                <div className="pt-2 border-t border-slate-200/40 flex items-center gap-2">
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="Año de 4 dígitos manualmente..."
                                                            value={dataFilterExpYear === 'all' ? '' : dataFilterExpYear}
                                                            onChange={(e) => {
                                                                const cleanVal = e.target.value.replace(/\D/g, '').slice(0, 4);
                                                                setDataFilterExpYear(cleanVal || 'all');
                                                            }}
                                                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-[10px] font-medium text-slate-700 placeholder-slate-450 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 shadow-sm transition-all text-center"
                                                        />
                                                    </div>
                                                    {dataFilterExpYear !== 'all' && (
                                                        <span className="text-[9px] bg-teal-50 border border-teal-200/50 text-teal-700 px-2 py-1 rounded-lg font-black uppercase tracking-wider shrink-0">
                                                            Año: {dataFilterExpYear}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Disponibilidad de Stock */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Disponibilidad de Stock</h4>
                                            </div>
                                            {dataFilterStock !== 'all' && (
                                                <button
                                                    onClick={() => setDataFilterStock('all')}
                                                    className="text-[10px] text-teal-600 hover:text-teal-700 font-extrabold uppercase hover:underline cursor-pointer"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-2.5">
                                            {[
                                                { value: 'all', label: 'Todos los productos', countText: 'Sin límite' },
                                                { value: 'with_stock', label: 'Con Stock actual', countText: 'Saldo > 0' },
                                                { value: 'no_stock', label: 'Sin Stock (Agotados)', countText: 'Saldo = 0' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDataFilterStock(opt.value)}
                                                    className={`group w-full flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                                        dataFilterStock === opt.value
                                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-950 shadow-sm'
                                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-305'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                            dataFilterStock === opt.value
                                                                ? 'bg-teal-600 border-teal-600 text-white scale-100'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                                        }`}>
                                                            <Check className="h-3 w-3 stroke-[3]" />
                                                        </div>
                                                        <span className={`text-[11px] font-bold tracking-tight uppercase ${dataFilterStock === opt.value ? 'text-teal-950 font-black' : 'text-slate-700'}`}>{opt.label}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-455 font-extrabold px-2 py-0.5 rounded-lg bg-slate-100/75 border border-slate-200/40">{opt.countText}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tipo de Suministro */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Suministro</h4>
                                            </div>
                                            {dataFilterTipsum !== 'all' && (
                                                <button
                                                    onClick={() => setDataFilterTipsum('all')}
                                                    className="text-[10px] text-teal-600 hover:text-teal-700 font-extrabold uppercase hover:underline cursor-pointer"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'all', label: 'Todos' },
                                                ...availableTipsums.map(val => ({ value: val, label: val }))
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDataFilterTipsum(opt.value)}
                                                    className={`group p-3 rounded-2xl cursor-pointer transition-all border text-left select-none ${
                                                        dataFilterTipsum === opt.value
                                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-950 shadow-sm'
                                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                            dataFilterTipsum === opt.value
                                                                ? 'bg-teal-600 border-teal-600 text-white scale-100'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                                        }`}>
                                                            <Check className="h-3 w-3 stroke-[3]" />
                                                        </div>
                                                        <span className={`text-[11px] font-bold tracking-tight uppercase ${dataFilterTipsum === opt.value ? 'text-teal-950 font-black' : 'text-slate-700'}`}>{opt.label}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Fuente de Financiamiento */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Fuente de Financiamiento</h4>
                                            </div>
                                            {dataFilterFFinan !== 'all' && (
                                                <button
                                                    onClick={() => setDataFilterFFinan('all')}
                                                    className="text-[10px] text-teal-600 hover:text-teal-700 font-extrabold uppercase hover:underline cursor-pointer"
                                                >
                                                    Todos
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { value: 'all', label: 'Todos' },
                                                ...availableFFinans.map(val => ({ value: val, label: val }))
                                            ].map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => setDataFilterFFinan(opt.value)}
                                                    className={`group p-3 rounded-2xl cursor-pointer transition-all border text-left select-none ${
                                                        dataFilterFFinan === opt.value
                                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-950 shadow-sm'
                                                            : 'bg-white border-slate-200/60 text-slate-605 hover:bg-slate-50 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                            dataFilterFFinan === opt.value
                                                                ? 'bg-teal-600 border-teal-600 text-white scale-100'
                                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                                        }`}>
                                                            <Check className="h-3 w-3 stroke-[3]" />
                                                        </div>
                                                        <span className={`text-[11px] font-bold tracking-tight uppercase ${dataFilterFFinan === opt.value ? 'text-teal-950 font-black' : 'text-slate-700'}`}>{opt.label}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Filter Section: Type */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Establecimiento</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_CS(true);
                                                setFilter_PS(true);
                                                setFilter_ALM(true);
                                                setFilter_HOSP(true);
                                                setFilter_OTRO(true);
                                            }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_CS(false);
                                                setFilter_PS(false);
                                                setFilter_ALM(false);
                                                setFilter_HOSP(false);
                                                setFilter_OTRO(false);
                                            }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {/* C.S. */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_CS 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_CS}
                                            onChange={(e) => setFilter_CS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_CS 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_CS ? 'text-teal-950 font-extrabold' : 'text-slate-700 font-semibold'}`}>Centro de Salud (C.S.)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_CS 
                                                    ? 'bg-teal-50 text-teal-850 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                C.S. {establishmentSummary?.cs ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* P.S. */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_PS 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_PS}
                                            onChange={(e) => setFilter_PS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_PS 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_PS ? 'text-teal-950 font-extrabold' : 'text-slate-700 font-semibold'}`}>Puesto de Salud (P.S.)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_PS 
                                                    ? 'bg-teal-50 text-teal-850 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                P.S. {establishmentSummary?.ps ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* ALM */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_ALM 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_ALM}
                                            onChange={(e) => setFilter_ALM(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_ALM 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_ALM ? 'text-teal-950 font-extrabold' : 'text-slate-700 font-semibold'}`}>Almacén (ALM)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_ALM 
                                                    ? 'bg-teal-50 text-teal-850 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                ALM {establishmentSummary?.alm ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* HOSP */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_HOSP 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_HOSP}
                                            onChange={(e) => setFilter_HOSP(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_HOSP 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_HOSP ? 'text-teal-950 font-extrabold' : 'text-slate-700 font-semibold'}`}>Hospital (HOSP)</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_HOSP 
                                                    ? 'bg-teal-50 text-teal-850 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                HOSP {establishmentSummary?.hosp ?? 0}
                                            </span>
                                        </div>
                                    </label>

                                    {/* Otros */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_OTRO 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_OTRO}
                                            onChange={(e) => setFilter_OTRO(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_OTRO 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex justify-between items-center w-full">
                                            <span className={`text-xs font-extrabold transition-colors ${filter_OTRO ? 'text-teal-950 font-extrabold' : 'text-slate-700 font-semibold'}`}>Otros</span>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-lg border transition-all ${
                                                filter_OTRO 
                                                    ? 'bg-teal-50 text-teal-855 border-teal-200/55 shadow-xs' 
                                                    : 'bg-slate-50 text-slate-500 border-slate-200/50'
                                            }`}>
                                                Otro {
                                                    sources && selectedUngetIndex !== null ? (
                                                        sources.filter(s => s.urlIndex === selectedUngetIndex).length 
                                                        - ((establishmentSummary?.cs ?? 0) + (establishmentSummary?.ps ?? 0) + (establishmentSummary?.alm ?? 0) + (establishmentSummary?.hosp ?? 0))
                                                    ) : 0
                                                }
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Filter Section: Last Update Status (Color) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between items-center w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado de Actualización</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_emerald(true);
                                                setFilter_amber(true);
                                                setFilter_red(true);
                                                setFilter_gray(true);
                                            }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFilter_emerald(false);
                                                setFilter_amber(false);
                                                setFilter_red(false);
                                                setFilter_gray(false);
                                            }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {/* Al día */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_emerald 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_emerald}
                                            onChange={(e) => setFilter_emerald(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_emerald 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white shrink-0 shadow-sm animate-pulse" />
                                                <span className={`text-xs font-bold transition-colors ${filter_emerald ? 'text-slate-900 font-black' : 'text-slate-700 font-semibold'}`}>En Línea</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&lt;1 hora sin actualizar</span>
                                        </div>
                                    </label>

                                    {/* Desconectados */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_amber 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_amber}
                                            onChange={(e) => setFilter_amber(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_amber 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white shrink-0 shadow-sm" />
                                                <span className={`text-xs font-bold transition-colors ${filter_amber ? 'text-slate-900 font-black' : 'text-slate-700 font-semibold'}`}>Desactualizados</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&gt;1 y &lt;24 horas</span>
                                        </div>
                                    </label>

                                    {/* Crítico */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_red 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_red}
                                            onChange={(e) => setFilter_red(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_red 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white shrink-0 shadow-sm" />
                                                <span className={`text-xs font-bold transition-colors ${filter_red ? 'text-slate-900 font-black' : 'text-slate-700 font-semibold'}`}>Fuera de Línea</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-bold">&gt;24 horas</span>
                                        </div>
                                    </label>

                                    {/* Sin Datos / Desconectado */}
                                    <label className={`group flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border select-none ${
                                        filter_gray 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={filter_gray}
                                            onChange={(e) => setFilter_gray(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            filter_gray 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shrink-0 shadow-sm" />
                                            <span className={`text-xs font-bold transition-colors ${filter_gray ? 'text-slate-905 font-black' : 'text-slate-700 font-semibold'}`}>Sin Datos / Desconectado</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Filter Section: Update Date Limit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Antigüedad de Sincronización</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsDateLimitDropdownOpen(!isDateLimitDropdownOpen);
                                            setIsSortOrderDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {filterDateLimit === 'all' && 'Sincronizados en cualquier fecha (Todos)'}
                                                {filterDateLimit === '1h' && 'Sincronizado hace menos de 1 hora'}
                                                {filterDateLimit === '12h' && 'Sincronizado en las últimas 12 horas'}
                                                {filterDateLimit === '24h' && 'Sincronizado en las últimas 24 horas (Hoy)'}
                                                {filterDateLimit === '3d' && 'Sincronizado en los últimos 3 días'}
                                                {filterDateLimit === '7d' && 'Sincronizado en los últimos 7 días'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isDateLimitDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isDateLimitDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsDateLimitDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'all', label: 'Sincronizados en cualquier fecha (Todos)' },
                                                    { value: '1h', label: 'Sincronizado hace menos de 1 hora' },
                                                    { value: '12h', label: 'Sincronizado en las últimas 12 horas' },
                                                    { value: '24h', label: 'Sincronizado en las últimas 24 horas (Hoy)' },
                                                    { value: '3d', label: 'Sincronizado en los últimos 3 días' },
                                                    { value: '7d', label: 'Sincronizado en los últimos 7 días' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterDateLimit(option.value as any);
                                                            setIsDateLimitDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            filterDateLimit === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {filterDateLimit === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Filter Section: Sorting */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Ordenamiento</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsSortOrderDropdownOpen(!isSortOrderDropdownOpen);
                                            setIsDateLimitDropdownOpen(false);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Settings className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {filterSortOrder === 'name_asc' && 'Nombre del Establecimiento (A-Z)'}
                                                {filterSortOrder === 'name_desc' && 'Nombre del Establecimiento (Z-A)'}
                                                {filterSortOrder === 'date_newest' && 'Sincronización más reciente primero'}
                                                {filterSortOrder === 'date_oldest' && 'Sincronización más antigua primero'}
                                                {filterSortOrder === 'expired_highest' && 'Mayor número de productos vencidos'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isSortOrderDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isSortOrderDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsSortOrderDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'name_asc', label: 'Nombre del Establecimiento (A-Z)' },
                                                    { value: 'name_desc', label: 'Nombre del Establecimiento (Z-A)' },
                                                    { value: 'date_newest', label: 'Sincronización más reciente primero' },
                                                    { value: 'date_oldest', label: 'Sincronización más antigua primero' },
                                                    { value: 'expired_highest', label: 'Mayor número de productos vencidos' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setFilterSortOrder(option.value as any);
                                                            setIsSortOrderDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            filterSortOrder === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {filterSortOrder === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Filter Section: Expirations */}
                            <div className="space-y-3 pb-8">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Alertas y Vencimientos</h4>
                                </div>
                                <label className={`group flex items-center gap-3.5 p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                    filterHasPendingExpirations 
                                        ? 'bg-red-50/25 border-red-200 text-slate-900 shadow-sm' 
                                        : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-red-200/50 shadow-xs'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={filterHasPendingExpirations}
                                        onChange={(e) => setFilterHasPendingExpirations(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                        filterHasPendingExpirations 
                                            ? 'bg-red-600 border-red-600 text-white scale-100' 
                                            : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                    }`}>
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${filterHasPendingExpirations ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
                                        <span className={`text-xs font-bold leading-tight ${filterHasPendingExpirations ? 'text-red-950 font-extrabold' : 'text-slate-705 group-hover:text-red-700'}`}>
                                            Mostrar sólo establecimientos con productos por vencer / vencidos
                                        </span>
                                    </div>
                                </label>
                            </div>
                                </>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="px-6 py-5 border-t border-slate-100 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 sticky bottom-0 z-20 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                            <button
                                onClick={() => {
                                    if (viewLevel === 'data') {
                                        setDataFilterTipsum('all');
                                        setDataFilterFFinan('all');
                                        setDataFilterStock('all');
                                        setDataFilterExpiration('all');
                                        setDataFilterExpMonth('all');
                                        setDataFilterExpYear('all');
                                    } else {
                                        setFilter_CS(true);
                                        setFilter_PS(true);
                                        setFilter_ALM(true);
                                        setFilter_HOSP(true);
                                        setFilter_OTRO(true);
                                        setFilter_emerald(true);
                                        setFilter_amber(true);
                                        setFilter_red(true);
                                        setFilter_gray(true);
                                        setFilterSortOrder('name_asc');
                                        setFilterHasPendingExpirations(false);
                                        setFilterDateLimit('all');
                                    }
                                }}
                                className="px-4 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 font-extrabold text-[11px] uppercase tracking-wider rounded-xl border border-slate-200 shadow-sm transition-all shrink-0 active:scale-95"
                            >
                                Reestablecer
                            </button>
                            <button
                                onClick={() => setIsAdvancedFiltersSidebarOpen(false)}
                                className="flex-1 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg shadow-teal-600/15 hover:shadow-teal-600/25 transition-all text-center active:scale-95"
                            >
                                {viewLevel === 'data' ? (
                                    `Aplicar (${filteredData.length} Prod.)`
                                ) : (
                                    `Aplicar (${filteredAndSortedSources.length} Est.)`
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE OPCIONES DE EXPORTACIÓN (CENTRADITO) */}
            {isExportOptionsModalOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200 p-4">
                    {/* Backdrop Click Dismiss */}
                    <div className="absolute inset-0" onClick={() => setIsExportOptionsModalOpen(false)} />
                    
                    {/* Modal Card */}
                    <div className="relative w-full max-w-lg bg-slate-50 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col border border-slate-200 overflow-hidden">
                        {/* Header */}
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 border border-teal-100 shadow-[0_4px_12px_rgba(13,148,136,0.08)]">
                                    <FileSpreadsheet className="h-5.5 w-5.5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-900 text-base tracking-tight uppercase">Exportación de Stock Detallado</h3>
                                    <p className="text-[10px] text-teal-600 font-extrabold tracking-widest uppercase">
                                        Consolidado: {exportScope === 'single' && selectedUngetIndex !== null ? scriptUrls[selectedUngetIndex]?.name : 'TODAS LAS UNGETs (REGIONAL)'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsExportOptionsModalOpen(false)}
                                className="p-2 hover:bg-slate-100 active:scale-95 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-slate-100 hover:border-slate-200 bg-white shadow-sm"
                            >
                                <X className="h-4.5 w-4.5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[65vh]">
                            
                            {/* Section: Establishment Type */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo de Establecimiento</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button 
                                            type="button"
                                            onClick={() => { setExportCS(true); setExportPS(true); setExportALM(true); setExportHOSP(true); setExportOTRO(true); }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button 
                                            type="button"
                                            onClick={() => { setExportCS(false); setExportPS(false); setExportALM(false); setExportHOSP(false); setExportOTRO(false); }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* C.S. */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportCS 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportCS}
                                            onChange={(e) => setExportCS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportCS ? 'text-teal-950 font-extrabold' : 'text-slate-705 font-semibold'}`}>Centro de Salud (C.S.)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportCS 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                    
                                    {/* P.S. */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportPS 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportPS}
                                            onChange={(e) => setExportPS(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportPS ? 'text-teal-950 font-extrabold' : 'text-slate-705 font-semibold'}`}>Puesto de Salud (P.S.)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportPS 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* ALM */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportALM 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportALM}
                                            onChange={(e) => setExportALM(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportALM ? 'text-teal-950 font-extrabold' : 'text-slate-705 font-semibold'}`}>Almacén (ALM)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportALM 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* HOSP */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportHOSP 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportHOSP}
                                            onChange={(e) => setExportHOSP(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportHOSP ? 'text-teal-950 font-extrabold' : 'text-slate-705 font-semibold'}`}>Hospital (HOSP)</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportHOSP 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* OTRO */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer col-span-2 transition-all border select-none ${
                                        exportOTRO 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportOTRO}
                                            onChange={(e) => setExportOTRO(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <span className={`text-xs font-extrabold transition-colors ${exportOTRO ? 'text-teal-950 font-extrabold' : 'text-slate-705 font-semibold'}`}>Otros / Sin Clasificar</span>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportOTRO 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Section: Status Update (Color) */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                        <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Estado de Actualización</h4>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                        <button 
                                            type="button"
                                            onClick={() => { setExportEmerald(true); setExportAmber(true); setExportRed(true); setExportGray(true); }}
                                            className="text-teal-600 hover:text-teal-700 font-black hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-slate-300 select-none">|</span>
                                        <button 
                                            type="button"
                                            onClick={() => { setExportEmerald(false); setExportAmber(false); setExportRed(false); setExportGray(false); }}
                                            className="text-slate-500 hover:text-slate-700 hover:underline cursor-pointer active:scale-95 transition-all"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* Emerald */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportEmerald 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportEmerald}
                                            onChange={(e) => setExportEmerald(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                            <span className={exportEmerald ? 'text-slate-900 font-extrabold' : 'text-slate-700 font-semibold'}>En Línea (&lt;1h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportEmerald 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Amber */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportAmber 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportAmber}
                                            onChange={(e) => setExportAmber(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                            <span className={exportAmber ? 'text-slate-900 font-extrabold' : 'text-slate-700 font-semibold'}>Desactualizados (&gt;1h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportAmber 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Red */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportRed 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportRed}
                                            onChange={(e) => setExportRed(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                                            <span className={exportRed ? 'text-slate-900 font-extrabold' : 'text-slate-700 font-semibold'}>Fuera Línea (&gt;24h)</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportRed 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>

                                    {/* Gray */}
                                    <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                        exportGray 
                                            ? 'bg-teal-50/25 border-teal-500/35 text-slate-900 shadow-sm' 
                                            : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}>
                                        <input
                                            type="checkbox"
                                            checked={exportGray}
                                            onChange={(e) => setExportGray(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className="flex items-center gap-2 font-extrabold text-xs">
                                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                                            <span className={exportGray ? 'text-slate-900 font-extrabold' : 'text-slate-700 font-semibold'}>Sin Datos</span>
                                        </div>
                                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                            exportGray 
                                                ? 'bg-teal-600 border-teal-600 text-white scale-100' 
                                                : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                        }`}>
                                            <Check className="h-3 w-3 stroke-[3]" />
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Section: Update Date Limit */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Antigüedad de Sincronización</h4>
                                </div>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsExportDateLimitDropdownOpen(!isExportDateLimitDropdownOpen);
                                        }}
                                        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-slate-200 hover:border-slate-300 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/15"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                                            <span className="text-xs font-extrabold text-slate-700">
                                                {exportDateLimit === 'all' && 'Sincronizados en cualquier fecha (Todos)'}
                                                {exportDateLimit === '1h' && 'Sincronizado hace menos de 1 hora'}
                                                {exportDateLimit === '12h' && 'Sincronizado en las últimas 12 horas'}
                                                {exportDateLimit === '24h' && 'Sincronizado en las últimas 24 horas (Hoy)'}
                                                {exportDateLimit === '3d' && 'Sincronizado en los últimos 3 días'}
                                                {exportDateLimit === '7d' && 'Sincronizado en los últimos 7 días'}
                                            </span>
                                        </div>
                                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-250 ${isExportDateLimitDropdownOpen ? 'rotate-180 text-teal-600' : ''}`} />
                                    </button>

                                    {isExportDateLimitDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-30" onClick={() => setIsExportDateLimitDropdownOpen(false)} />
                                            <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-[0_-12px_30px_rgba(0,0,0,0.08)] z-40 overflow-hidden divide-y divide-slate-50 py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                {[
                                                    { value: 'all', label: 'Sincronizados en cualquier fecha (Todos)' },
                                                    { value: '1h', label: 'Sincronizado hace menos de 1 hora' },
                                                    { value: '12h', label: 'Sincronizado en las últimas 12 horas' },
                                                    { value: '24h', label: 'Sincronizado en las últimas 24 horas (Hoy)' },
                                                    { value: '3d', label: 'Sincronizado en los últimos 3 días' },
                                                    { value: '7d', label: 'Sincronizado en los últimos 7 días' },
                                                ].map((option) => (
                                                    <button
                                                        key={option.value}
                                                        type="button"
                                                        onClick={() => {
                                                            setExportDateLimit(option.value as any);
                                                            setIsExportDateLimitDropdownOpen(false);
                                                        }}
                                                        className={`flex items-center justify-between w-full px-4 py-3 text-left text-xs font-extrabold transition-all cursor-pointer ${
                                                            exportDateLimit === option.value
                                                                ? 'bg-teal-50/65 text-teal-950 font-black'
                                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                        }`}
                                                    >
                                                        <span>{option.label}</span>
                                                        {exportDateLimit === option.value && (
                                                            <Check className="h-3.5 w-3.5 text-teal-600 stroke-[3]" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Section: Expirations filter */}
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-3 bg-teal-500 rounded-full" />
                                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Medicamentos y Filtros adicionales</h4>
                                </div>
                                <label className={`group flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all border select-none ${
                                    exportHasPendingExpirations 
                                        ? 'bg-red-50/25 border-red-200 text-slate-900 shadow-sm' 
                                        : 'bg-white border-slate-200/60 text-slate-600 hover:bg-slate-50 hover:border-red-200/50 shadow-xs'
                                }`}>
                                    <input
                                        type="checkbox"
                                        checked={exportHasPendingExpirations}
                                        onChange={(e) => setExportHasPendingExpirations(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className="flex items-center gap-2.5">
                                        <AlertTriangle className={`h-4.5 w-4.5 shrink-0 ${exportHasPendingExpirations ? 'text-red-650 animate-pulse' : 'text-slate-400'}`} />
                                        <span className={`text-xs font-bold leading-tight ${exportHasPendingExpirations ? 'text-red-950 font-extrabold' : 'text-slate-705 group-hover:text-red-700'}`}>
                                            Exportar únicamente medicamentos vencidos o por vencer
                                        </span>
                                    </div>
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                        exportHasPendingExpirations 
                                            ? 'bg-red-600 border-red-600 text-white scale-100' 
                                            : 'border-slate-300 bg-white text-transparent group-hover:border-slate-400'
                                    }`}>
                                        <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* Footer Details & Buttons */}
                        <div className="px-6 py-5 border-t border-slate-100 bg-white/95 backdrop-blur-md flex flex-col sm:flex-row items-center sm:justify-between gap-4 sticky bottom-0 z-10 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
                            <div className="text-center sm:text-left">
                                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest leading-none">Total Seleccionado</p>
                                <p className="text-sm font-black text-teal-950 mt-1">
                                    {filteredExportSourcesCount} {filteredExportSourcesCount === 1 ? 'establecimiento' : 'establecimientos'}
                                </p>
                            </div>

                            <div className="w-full sm:w-auto">
                                <button
                                    onClick={executeExportAllEstablishmentsToExcel}
                                    disabled={filteredExportSourcesCount === 0}
                                    className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 text-white font-black text-[11px] uppercase tracking-widest rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer ${
                                        filteredExportSourcesCount === 0 
                                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border border-slate-200' 
                                        : 'bg-teal-600 hover:bg-teal-700 shadow-teal-600/15 hover:shadow-teal-600/25 border border-teal-600/10'
                                    }`}
                                    type="button"
                                >
                                    <Download className="h-4.5 w-4.5 shrink-0" />
                                    <span>Exportar Excel</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE REPORTE GENERAL */}
            {isReportModalOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/45 backdrop-blur-xs animate-in fade-in duration-200 p-4">
                    <div className="absolute inset-0" onClick={() => setIsReportModalOpen(false)} />
                    <div className="bg-slate-50 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] relative flex flex-col border border-white overflow-hidden">
                        
                        <div className="px-6 py-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-teal-950 bg-white sticky top-0 z-10 gap-4">
                            <div className="flex flex-col gap-1">
                                <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                                    Reporte General de Actualización
                                </h2>
                                <p className="text-[11px] font-bold text-slate-400">
                                    Panel de control y estado de sincronización por establecimiento.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <button
                                    onClick={exportReportToExcel}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider border border-green-200 transition-colors cursor-pointer shrink-0"
                                    title="Descargar Excel"
                                >
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    <span>Exportar a Excel</span>
                                </button>
                                <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                <button
                                    onClick={() => setIsReportModalOpen(false)}
                                    className="p-2 hover:bg-slate-100 rounded-full transition-colors group cursor-pointer border border-transparent hover:border-slate-200 shrink-0"
                                    title="Cerrar Reporte"
                                >
                                    <X className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 sm:p-6 overscroll-contain">
                            <div ref={reportTableRef} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
                                <div className="w-full overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200">
                                        <thead className="bg-slate-50/80 select-none">
                                            <tr>
                                                <th 
                                                    scope="col" 
                                                    className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-wider w-[40%] cursor-pointer hover:bg-slate-100/50 transition-colors"
                                                    onClick={() => setReportSort({ field: 'name', order: reportSort.field === 'name' && reportSort.order === 'asc' ? 'desc' : 'asc' })}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        Establecimiento
                                                        {reportSort.field === 'name' ? (
                                                            reportSort.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                                                    </div>
                                                </th>
                                                <th 
                                                    scope="col" 
                                                    className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider w-[20%] hidden sm:table-cell cursor-pointer hover:bg-slate-100/50 transition-colors"
                                                    onClick={() => setReportSort({ field: 'status', order: reportSort.field === 'status' && reportSort.order === 'asc' ? 'desc' : 'asc' })}
                                                >
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        Estado
                                                        {reportSort.field === 'status' ? (
                                                            reportSort.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                                                    </div>
                                                </th>
                                                <th 
                                                    scope="col" 
                                                    className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-wider w-[20%] hidden sm:table-cell"
                                                >
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        Equipo
                                                    </div>
                                                </th>
                                                <th 
                                                    scope="col" 
                                                    className="px-4 py-3 text-right text-[10px] font-black text-slate-500 uppercase tracking-wider w-[20%] cursor-pointer hover:bg-slate-100/50 transition-colors"
                                                    onClick={() => setReportSort({ field: 'date', order: reportSort.field === 'date' && reportSort.order === 'desc' ? 'asc' : 'desc' })}
                                                >
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        Sincronización
                                                        {reportSort.field === 'date' ? (
                                                            reportSort.order === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                        ) : <ArrowUpDown className="w-3 h-3 text-slate-300" />}
                                                    </div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-100">
                                            {sortedReportSources.map((sheet) => {
                                                const lastDash = sheet.name.lastIndexOf('-');
                                                const description = lastDash === -1 ? sheet.name.replace(/^FARM\s*-\s*/i, '') : sheet.name.substring(0, lastDash).trim().replace(/^FARM\s*-\s*/i, '');
                                                const code = getAlmCodeForSheet(sheet.id, data);
                                                const status = getUpdateStatus(sheet.lastUpdateTime);
                                                const dateStr = sheet.lastUpdateTime ? formatFullDate(sheet.lastUpdateTime) : 'No sincronizado';
                                                const equipoDateStr = sheet.equipmentDateTime ? formatFullDate(sheet.equipmentDateTime) : 'Sin fecha';
                                                
                                                return (
                                                    <tr key={sheet.id} className="hover:bg-slate-50/60 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-[10px] font-extrabold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-md shrink-0 border border-teal-100">{code || 'N/A'}</span>
                                                                <span className="text-[11px] sm:text-xs font-black text-slate-800 line-clamp-2">{description}</span>
                                                            </div>
                                                            {/* Mobile status indicator */}
                                                            <div className="sm:hidden mt-1.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-100 inline-flex">
                                                                <span className="relative flex h-1.5 w-1.5">
                                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.color}`} />
                                                                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${status.color}`} />
                                                                </span>
                                                                <span className="text-[9px] font-bold text-slate-600">{status.label}</span>
                                                            </div>
                                                            <div className="md:hidden mt-1.5 flex flex-col gap-0.5 w-full">
                                                                <span className="text-[9px] font-bold text-slate-500">
                                                                    Actualizado: {dateStr}
                                                                </span>
                                                                {sheet.equipmentDateTime && (
                                                                    <span className={`text-[9px] font-bold ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500' : 'text-slate-500'}`}>
                                                                        Equipo: {equipoDateStr}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                                                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200">
                                                                <span className="relative flex h-2 w-2">
                                                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${status.color}`} />
                                                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${status.color}`} />
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-600 whitespace-nowrap">{status.label}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center hidden sm:table-cell">
                                                            <div className={`inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold whitespace-nowrap ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-500' : 'text-slate-500'}`}>
                                                                <Monitor className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${!datesMatch(sheet.lastUpdateTime, sheet.equipmentDateTime) ? 'text-red-400' : 'text-slate-400'}`} />
                                                                {equipoDateStr}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 text-[10px] sm:text-xs font-bold text-slate-500 whitespace-nowrap">
                                                                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400" />
                                                                {dateStr}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {sortedReportSources.length === 0 && (
                                        <div className="py-12 text-center text-slate-500 text-xs font-bold">
                                            No hay establecimientos para mostrar según los filtros actuales.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
