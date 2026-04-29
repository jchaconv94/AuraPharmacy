import React from 'react';
import { 
  BarChart2, 
  ArrowRightLeft, 
  Settings, 
  ShieldCheck, 
  ChevronLeft, 
  ChevronRight,
  UserCircle,
  LogOut,
  Layers,
  Database
} from 'lucide-react';
import { AppModule, User } from '../types';

interface SidebarProps {
  currentView: AppModule;
  setCurrentView: (view: AppModule) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  user: User | null;
  logout: () => void;
  hasPermission: (module: AppModule) => boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  isCollapsed,
  setIsCollapsed,
  user,
  logout,
  hasPermission
}) => {
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  return (
    <div 
      className={`relative flex flex-col bg-gray-950 border-r border-white/5 transition-all duration-300 z-[100002] ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Branding Header */}
      <div className={`flex items-center h-16 border-b border-white/5 mx-1 mt-2 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-between px-3'}`}>
        <div className="flex items-center gap-2 overflow-hidden shrink-0">
          <div className="relative shrink-0 flex items-center justify-center">
            <Layers className="h-7 w-7 text-cyan-400" strokeWidth={2.5} />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col whitespace-nowrap justify-center mt-0.5 animate-in fade-in duration-300">
              <div className="flex items-center gap-1 mt-0.5">
                <h1 className="text-[16px] font-black text-white tracking-tight leading-none flex items-baseline">
                  ToolKit <span className="font-bold text-gray-400 ml-1">SISMED</span>
                </h1>
                <span className="text-[8px] font-bold text-cyan-400 px-1 py-0.5 bg-cyan-500/10 rounded border border-cyan-500/20 leading-none self-center ml-0.5 shrink-0">WEB</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Toggle Button */}
        {!isCollapsed ? (
          <button 
            onClick={toggleCollapse}
            className="flex items-center justify-center rounded-lg p-1.5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
      </div>
      
      {/* Absolute toggle button when collapsed */}
      {isCollapsed && (
        <button 
          onClick={toggleCollapse}
          className="absolute -right-3 top-7 flex items-center justify-center w-6 h-6 bg-gray-800 border border-gray-700 rounded-full hover:bg-gray-700 text-gray-400 hover:text-white transition-colors z-50 shadow-md"
        >
          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
        </button>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-2">
        {hasPermission('DASHBOARD') && (
          <button
            onClick={() => setCurrentView('DASHBOARD')}
            className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-300 group ${
              currentView === 'DASHBOARD'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
            title={isCollapsed ? "Análisis" : ""}
          >
            <BarChart2 className={`h-5 w-5 shrink-0 ${currentView === 'DASHBOARD' ? 'text-teal-400' : 'group-hover:text-teal-400 transition-colors'}`} />
            {!isCollapsed && <span className="font-semibold text-sm">Análisis</span>}
          </button>
        )}

        {hasPermission('REDISTRIBUTION') && (
          <button
            onClick={() => setCurrentView('REDISTRIBUTION')}
            className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-300 group ${
              currentView === 'REDISTRIBUTION'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
            title={isCollapsed ? "Redistribución" : ""}
          >
            <ArrowRightLeft className={`h-5 w-5 shrink-0 ${currentView === 'REDISTRIBUTION' ? 'text-teal-400' : 'group-hover:text-teal-400 transition-colors'}`} />
            {!isCollapsed && <span className="font-semibold text-sm">Redistribución</span>}
          </button>
        )}

        {hasPermission('SIG_SEARCH') && (
          <button
            onClick={() => setCurrentView('SIG_SEARCH')}
            className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-300 group ${
              currentView === 'SIG_SEARCH'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
            title={isCollapsed ? "Consulta Stock" : ""}
          >
            <Database className={`h-5 w-5 shrink-0 ${currentView === 'SIG_SEARCH' ? 'text-teal-400' : 'group-hover:text-teal-400 transition-colors'}`} />
            {!isCollapsed && <span className="font-semibold text-sm">Consulta Stock</span>}
          </button>
        )}

        {(hasPermission('ADMIN_USERS') || hasPermission('ADMIN_ROLES')) && (
          <button
            onClick={() => setCurrentView('ADMIN_USERS')}
            className={`w-full flex items-center gap-3 py-3 rounded-xl transition-all duration-300 group ${
              currentView.startsWith('ADMIN')
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
            } ${isCollapsed ? 'justify-center px-0' : 'px-3'}`}
             title={isCollapsed ? "Admin" : ""}
          >
            <Settings className={`h-5 w-5 shrink-0 ${currentView.startsWith('ADMIN') ? 'text-teal-400' : 'group-hover:text-teal-400 transition-colors'}`} />
            {!isCollapsed && <span className="font-semibold text-sm">Admin</span>}
          </button>
        )}
      </div>

      {/* User Footer */}
      <div className="p-3 mt-auto border-t border-white/5">
        <div className={`flex items-center ${isCollapsed ? 'justify-center flex-col gap-3' : 'justify-between'} bg-gray-900/50 rounded-xl p-2 border border-white/5`}>
          <button 
             onClick={() => setCurrentView('PROFILE')}
             className={`flex items-center gap-3 group hover:bg-white/5 p-1.5 rounded-lg transition-all flex-1 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}
             title={isCollapsed ? "Perfil" : ""}
          >
            <div className="bg-gradient-to-br from-teal-500 to-emerald-600 p-[2px] rounded-full shrink-0">
              <div className="bg-gray-900 rounded-full p-0.5">
                  <UserCircle className="h-6 w-6 text-gray-200" />
              </div>
            </div>
            {!isCollapsed && (
              <div className="flex flex-col text-left overflow-hidden">
                <span className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors truncate">
                    {user?.personnelData?.firstName || user?.username}
                </span>
                <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate">
                    {user?.role}
                </span>
              </div>
            )}
          </button>
          
          <button 
             onClick={logout} 
             className={`p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 ${isCollapsed ? 'w-full flex justify-center' : ''}`}
             title="Cerrar Sesión"
          >
             <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
