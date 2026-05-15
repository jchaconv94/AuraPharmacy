import React from 'react';
import { BarChart2, ArrowRightLeft, Database, Settings, UserCircle } from 'lucide-react';
import { AppModule, User } from '../types';

interface MobileNavProps {
  currentView: AppModule;
  setCurrentView: (view: AppModule) => void;
  hasPermission: (module: AppModule) => boolean;
}

export const MobileNav: React.FC<MobileNavProps> = ({ currentView, setCurrentView, hasPermission }) => {
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
