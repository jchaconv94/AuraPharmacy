
import React from 'react';
import { Pill, Layers } from 'lucide-react';

interface HeaderProps {
  // No props needed now
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-[150]">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="bg-gray-900 p-1.5 sm:p-2 rounded-lg flex items-center justify-center">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6 text-cyan-400" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-gray-900 tracking-tight leading-none flex items-baseline gap-1">
                ToolKit <span className="text-gray-600">SISMED</span> <span className="text-[9px] sm:text-[10px] font-bold text-cyan-600 px-1 py-0.5 bg-cyan-50 rounded border border-cyan-200 self-center ml-1 leading-none">WEB</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-none mt-0.5 ml-0.5">Gestión Farmacéutica</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2 py-1 sm:px-3 sm:py-1 bg-gray-50 rounded-full border border-gray-200">
              <Pill className="h-3 w-3 sm:h-4 sm:w-4 text-gray-500" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-600">Ficha N° 30</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
