
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';
import { BarChart3, Package } from 'lucide-react';
import { AuraAnalysisResult, StockStatus } from '../types';

interface DashboardProps {
  result: AuraAnalysisResult;
}

const COLORS = {
  [StockStatus.DESABASTECIDO]: '#EF4444', // Red-500
  [StockStatus.SUBSTOCK]: '#F59E0B', // Amber-500
  [StockStatus.NORMOSTOCK]: '#10B981', // Emerald-500
  [StockStatus.SOBRESTOCK]: '#6366F1', // Indigo-500
  [StockStatus.SIN_ROTACION]: '#9CA3AF', // Gray-400
};

// Descriptions for Tooltip
const STATUS_DESC = {
  [StockStatus.DESABASTECIDO]: 'Stock = 0 (Crítico)',
  [StockStatus.SUBSTOCK]: 'Stock < 2 meses (Alerta)',
  [StockStatus.NORMOSTOCK]: '2 a 6 meses (Ideal)',
  [StockStatus.SOBRESTOCK]: '> 6 meses (Exceso)',
  [StockStatus.SIN_ROTACION]: 'Sin consumo (Inmovilizado)',
};

export const Dashboard: React.FC<DashboardProps> = ({ result }) => {
  const { medications, indicators } = result;
  const totalItems = medications.length;

  // --- 1. Data for Availability Bar Chart ---
  const statusData = [
    { name: 'Desabastecido', key: StockStatus.DESABASTECIDO, value: medications.filter(m => m.status === StockStatus.DESABASTECIDO).length },
    { name: 'SubStock', key: StockStatus.SUBSTOCK, value: medications.filter(m => m.status === StockStatus.SUBSTOCK).length },
    { name: 'NormoStock', key: StockStatus.NORMOSTOCK, value: medications.filter(m => m.status === StockStatus.NORMOSTOCK).length },
    { name: 'SobreStock', key: StockStatus.SOBRESTOCK, value: medications.filter(m => m.status === StockStatus.SOBRESTOCK).length },
    { name: 'Sin Rotación', key: StockStatus.SIN_ROTACION, value: medications.filter(m => m.status === StockStatus.SIN_ROTACION).length },
  ].map(item => ({
    ...item,
    percentageStr: totalItems > 0 ? ((item.value / totalItems) * 100).toFixed(1) : "0.0",
    numericPercentage: totalItems > 0 ? (item.value / totalItems) * 100 : 0
  }));

  // --- 2. Data for Distribution Chart (Meds vs Insumos) ---
  const typeStats = medications.reduce((acc, item) => {
    const rawType = (item.medtip || '').toUpperCase().trim();
    let category = 'OTROS';
    if (rawType.startsWith('M') || item.name.includes('TABLET')) category = 'MEDICAMENTOS';
    else if (rawType.startsWith('I')) category = 'INSUMOS';
    else category = 'MEDICAMENTOS'; 

    if (!acc[category]) acc[category] = { count: 0, money: 0 };
    acc[category].count += 1;
    acc[category].money += item.estimatedInvestment;
    return acc;
  }, {} as Record<string, { count: number; money: number }>);

  // Convert to array for Bar Chart
  const distributionData = [
    { name: 'MEDS', value: typeStats['MEDICAMENTOS']?.count || 0, money: typeStats['MEDICAMENTOS']?.money || 0, color: '#3B82F6' }, // Blue
    { name: 'INSUMOS', value: typeStats['INSUMOS']?.count || 0, money: typeStats['INSUMOS']?.money || 0, color: '#A855F7' }, // Purple
  ];

  // Helper for DME Style
  const getIndicatorStyle = (status: string) => {
    switch(status) {
      case 'OPTIMO': return { container: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-800', badge: 'bg-emerald-200 text-emerald-900' };
      case 'ALTO': return { container: 'bg-blue-50 border-blue-100', text: 'text-blue-800', badge: 'bg-blue-200 text-blue-900' };
      case 'REGULAR': return { container: 'bg-orange-50 border-orange-100', text: 'text-orange-800', badge: 'bg-orange-200 text-orange-900' };
      default: return { container: 'bg-red-50 border-red-100', text: 'text-red-800', badge: 'bg-red-200 text-red-900' };
    }
  };
  const indicatorStyle = getIndicatorStyle(indicators.status);

  // --- Custom Tooltips ---
  const CustomBarLabel = (props: any) => {
    const { x, y, width, index } = props;
    const item = statusData[index];
    const value = item.value; 
    const percentage = item.percentageStr;

    if (value === 0) return null;
    return (
      <g>
        <text x={x + width / 2} y={y - 24} fill="#1F2937" textAnchor="middle" dy={0} fontSize={14} fontWeight="800">
          {value}
        </text>
        <text x={x + width / 2} y={y - 10} fill="#6B7280" textAnchor="middle" dy={0} fontSize={10} fontWeight="600">
          {percentage}%
        </text>
      </g>
    );
  };

  const CustomStatusTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-xl rounded-lg text-xs z-50">
                <p className="font-bold text-sm mb-1" style={{ color: COLORS[data.key as StockStatus] }}>
                    {data.name}
                </p>
                <div className="text-gray-600 mb-1">
                    Cantidad: <span className="font-bold text-gray-900">{data.value}</span>
                </div>
                <div className="text-gray-500 mb-1">
                    Porcentaje: <span className="font-bold text-gray-900">{data.percentageStr}%</span>
                </div>
                <div className="text-[10px] text-gray-400 italic mt-1 border-t pt-1 border-gray-100">
                    {STATUS_DESC[data.key as StockStatus]}
                </div>
            </div>
        );
    }
    return null;
  };

  const CustomDistTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-md rounded text-xs z-50">
          <p className="font-bold uppercase" style={{ color: data.color }}>{data.name}</p>
          <p className="text-gray-900 font-bold">{data.value} ítems</p>
          <p className="text-gray-500">S/ {data.money.toLocaleString('es-PE', { maximumFractionDigits: 0 })}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
        
        {/* --- TOP SECTION: 3 COLUMNS --- */}
        {/* Layout: Availability | DME Indicator | Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.8fr_1.1fr] gap-6 items-stretch">
            
            {/* 1. LEFT: Availability Bar Chart */}
            <div className="bg-white p-6 sm:p-8 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[380px]">
                <div className="flex justify-between items-center mb-6">
                   <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Distribución de Disponibilidad
                   </h4>
                   {/* Button moved to Table */}
                </div>

                <div className="flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={statusData} 
                            margin={{ top: 40, right: 10, left: 0, bottom: 5 }} 
                            barSize={40}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                            <XAxis 
                                dataKey="name" 
                                axisLine={{ stroke: '#E5E7EB', strokeWidth: 1.5 }} 
                                tickLine={false} 
                                tick={{ fill: '#6B7280', fontSize: 10, fontWeight: 600 }} 
                                dy={10}
                                interval={0}
                            />
                            <YAxis 
                                axisLine={{ stroke: '#E5E7EB', strokeWidth: 1.5 }}
                                tickLine={false}
                                tick={{ fill: '#9CA3AF', fontSize: 10, fontWeight: 500 }}
                                domain={[0, 100]}
                                ticks={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
                                tickFormatter={(value) => `${value}%`}
                                width={35}
                            />
                            <Tooltip content={<CustomStatusTooltip />} cursor={{ fill: '#F9FAFB' }} />
                            <Bar dataKey="numericPercentage" radius={[6, 6, 0, 0]}>
                                {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[entry.key as StockStatus]} />
                                ))}
                                <LabelList content={<CustomBarLabel />} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 2. CENTER: DME Indicator Card */}
            <div className={`rounded-2xl p-8 border flex flex-col items-center justify-center text-center shadow-sm relative h-full min-h-[380px] ${indicatorStyle.container}`}>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">% Disponibilidad de Medicamentos</h4>
                <div className={`text-7xl font-black mb-4 ${indicatorStyle.text} tracking-tighter`}>
                    {indicators.dmeScore.toFixed(1)}%
                </div>
                <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide mb-4 ${indicatorStyle.badge}`}>
                    {indicators.status}
                </div>
                <p className="text-[10px] text-gray-500 max-w-[220px] leading-relaxed mb-6">
                    Medicamentos e insumos con stock disponible en el establecimiento .
                </p>
                <div className="absolute bottom-6 w-full px-8 flex justify-between text-[9px] font-bold uppercase text-gray-400/80">
                      <span>Meta: &gt;90%</span>
                      <span>{result.indicators.availableItems} / {result.indicators.totalItems}</span>
                </div>
            </div>

            {/* 3. RIGHT: Distribution Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col h-full min-h-[380px]">
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Package className="h-3.5 w-3.5 text-purple-500" />
                    Distribución de Ítems
                </h4>
                
                <div className="flex-1 w-full min-h-0 flex flex-col justify-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart 
                            data={distributionData} 
                            layout="vertical" 
                            margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                            barCategoryGap={15}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                            <XAxis type="number" hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                axisLine={false} 
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#6B7280' }}
                                width={60}
                            />
                            <Tooltip content={<CustomDistTooltip />} cursor={{fill: 'transparent'}} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                {distributionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                                <LabelList 
                                    dataKey="value" 
                                    position="right" 
                                    style={{ fontSize: 11, fontWeight: 'bold', fill: '#374151' }} 
                                    formatter={(val: number) => `${val} (${((val/totalItems)*100).toFixed(0)}%)`}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center px-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Total de Ítems</span>
                    <span className="text-lg font-black text-gray-800">{totalItems}</span>
                </div>
            </div>

        </div>

    </div>
  );
};
