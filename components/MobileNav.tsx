import React from 'react';
import { BarChart2, ArrowRightLeft, Database, FileSpreadsheet, Settings, UserCircle, Syringe } from 'lucide-react';
import { AppModule, User } from '../types';

interface MobileNavProps {
  currentView: AppModule;
  setCurrentView: (view: AppModule) => void;
  hasPermission: (module: AppModule) => boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, setCurrentView, hasPermission }) => {
  const hasImmunization = hasPermission('IMMUNIZATION_STOCK') || hasPermission('IMMUNIZATION_INCOMES') || hasPermission('IMMUNIZATION_INCOME_ORIGINS') || hasPermission('IMMUNIZATION_DISTRIBUTIONS') || hasPermission('IMMUNIZATION_CONSUMPTION') || hasPermission('IMMUNIZATION_RETURNS') || hasPermission('IMMUNIZATION_INITIAL_INVENTORY') || hasPermission('IMMUNIZATION_CATALOG') || hasPermission('IMMUNIZATION_ADJUSTMENTS') || hasPermission('IMMUNIZATION_CLOSURES') || hasPermission('IMMUNIZATION_REPORTS');
  const openImmunization = () => {
    if (hasPermission('IMMUNIZATION_STOCK')) setCurrentView('IMMUNIZATION_STOCK');
    else if (hasPermission('IMMUNIZATION_INCOMES')) setCurrentView('IMMUNIZATION_INCOMES');
    else if (hasPermission('IMMUNIZATION_INCOME_ORIGINS')) setCurrentView('IMMUNIZATION_INCOME_ORIGINS');
    else if (hasPermission('IMMUNIZATION_DISTRIBUTIONS')) setCurrentView('IMMUNIZATION_DISTRIBUTIONS');
    else if (hasPermission('IMMUNIZATION_CONSUMPTION')) setCurrentView('IMMUNIZATION_CONSUMPTION');
    else if (hasPermission('IMMUNIZATION_RETURNS')) setCurrentView('IMMUNIZATION_RETURNS');
    else if (hasPermission('IMMUNIZATION_INITIAL_INVENTORY')) setCurrentView('IMMUNIZATION_INITIAL_INVENTORY');
    else if (hasPermission('IMMUNIZATION_CATALOG')) setCurrentView('IMMUNIZATION_CATALOG');
    else if (hasPermission('IMMUNIZATION_ADJUSTMENTS')) setCurrentView('IMMUNIZATION_ADJUSTMENTS');
    else if (hasPermission('IMMUNIZATION_CLOSURES')) setCurrentView('IMMUNIZATION_CLOSURES');
    else if (hasPermission('IMMUNIZATION_REPORTS')) setCurrentView('IMMUNIZATION_REPORTS');
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 pt-2 pb-5 z-[5000] flex items-center justify-around shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.1)]">
      {hasPermission('DASHBOARD') && (
        <button
          onClick={() => setCurrentView('DASHBOARD')}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView === 'DASHBOARD' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView === 'DASHBOARD' ? 'bg-teal-50' : ''}`}>
            <BarChart2 className="h-5 w-5" strokeWidth={currentView === 'DASHBOARD' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Análisis</span>
        </button>
      )}

      {hasPermission('REDISTRIBUTION') && (
        <button
          onClick={() => setCurrentView('REDISTRIBUTION')}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView === 'REDISTRIBUTION' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView === 'REDISTRIBUTION' ? 'bg-teal-50' : ''}`}>
            <ArrowRightLeft className="h-5 w-5" strokeWidth={currentView === 'REDISTRIBUTION' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Canjes</span>
        </button>
      )}

      {hasPermission('SIG_SEARCH') && (
        <button
          onClick={() => setCurrentView('SIG_SEARCH')}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView === 'SIG_SEARCH' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView === 'SIG_SEARCH' ? 'bg-teal-50' : ''}`}>
            <Database className="h-5 w-5" strokeWidth={currentView === 'SIG_SEARCH' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Stock</span>
        </button>
      )}

      {hasPermission('IPRESS_STOCK') && (
        <button
          onClick={() => setCurrentView('IPRESS_STOCK')}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView === 'IPRESS_STOCK' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView === 'IPRESS_STOCK' ? 'bg-teal-50' : ''}`}>
            <FileSpreadsheet className="h-5 w-5" strokeWidth={currentView === 'IPRESS_STOCK' ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Stock SISMED</span>
        </button>
      )}

      {hasImmunization && (
        <button
          onClick={openImmunization}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView.startsWith('IMMUNIZATION') ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView.startsWith('IMMUNIZATION') ? 'bg-teal-50' : ''}`}>
            <Syringe className="h-5 w-5" strokeWidth={currentView.startsWith('IMMUNIZATION') ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Inmuniz.</span>
        </button>
      )}

      {(hasPermission('ADMIN_USERS') || hasPermission('ADMIN_ROLES')) && (
        <button
          onClick={() => setCurrentView('ADMIN_USERS')}
          className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
            currentView.startsWith('ADMIN') ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
          }`}
        >
          <div className={`p-1.5 rounded-xl mb-1 ${currentView.startsWith('ADMIN') ? 'bg-teal-50' : ''}`}>
            <Settings className="h-5 w-5" strokeWidth={currentView.startsWith('ADMIN') ? 2.5 : 2} />
          </div>
          <span className="text-[10px] font-medium leading-none">Admin</span>
        </button>
      )}

      <button
        onClick={() => setCurrentView('PROFILE')}
        className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all ${
          currentView === 'PROFILE' ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <div className={`p-1.5 rounded-xl mb-1 ${currentView === 'PROFILE' ? 'bg-teal-50' : ''}`}>
          <UserCircle className="h-5 w-5" strokeWidth={currentView === 'PROFILE' ? 2.5 : 2} />
        </div>
        <span className="text-[10px] font-medium leading-none">Perfil</span>
      </button>
    </div>
  );
};
