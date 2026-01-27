
import React from 'react';
import { Pill, Activity } from 'lucide-react';

interface HeaderProps {
  // No props needed now
}

export const Header: React.FC<HeaderProps> = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-[95%] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <div className="bg-teal-100 p-1.5 sm:p-2 rounded-lg">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight leading-none">Aura</h1>
              <p className="text-[10px] sm:text-xs text-teal-600 font-medium leading-none mt-0.5">Logística Farmacéutica</p>
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
