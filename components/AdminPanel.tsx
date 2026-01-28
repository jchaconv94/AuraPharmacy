
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, RoleConfig } from '../types';
import { Users, Shield, Settings, Check, X, Sliders, Save, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES' | 'PARAMS'>('USERS');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  
  const { systemConfig, updateSystemConfigContext } = useAuth();
  const [tempConfig, setTempConfig] = useState(systemConfig);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);

  useEffect(() => {
    // Load mock data
    api.getUsers().then(setUsers);
    api.getRolesConfig().then(setRoles);
    // Sync local state with context when context loads
    setTempConfig(systemConfig);
  }, [systemConfig]);

  const handleSaveConfig = async () => {
      setIsSavingConfig(true);
      setConfigMessage(null);
      
      const res = await api.updateSystemConfig(tempConfig);
      if (res.success) {
          updateSystemConfigContext(tempConfig);
          setConfigMessage("Parámetros actualizados correctamente.");
          setTimeout(() => setConfigMessage(null), 3000);
      } else {
          setConfigMessage("Error al guardar configuración.");
      }
      setIsSavingConfig(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4">
        <div className="mb-8">
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Panel de Administración</h2>
            <p className="text-gray-500 mt-2">Gestione el acceso de usuarios, roles y parámetros del sistema.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('USERS')}
                    className={`flex-1 min-w-[150px] py-4 text-sm font-bold text-center flex items-center justify-center gap-2 transition-colors ${activeTab === 'USERS' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Users className="h-4 w-4" />
                    Gestión de Usuarios
                </button>
                <button 
                    onClick={() => setActiveTab('ROLES')}
                    className={`flex-1 min-w-[150px] py-4 text-sm font-bold text-center flex items-center justify-center gap-2 transition-colors ${activeTab === 'ROLES' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Shield className="h-4 w-4" />
                    Configuración de Roles
                </button>
                <button 
                    onClick={() => setActiveTab('PARAMS')}
                    className={`flex-1 min-w-[150px] py-4 text-sm font-bold text-center flex items-center justify-center gap-2 transition-colors ${activeTab === 'PARAMS' ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                >
                    <Sliders className="h-4 w-4" />
                    Parámetros Sistema
                </button>
            </div>

            <div className="p-6">
                {activeTab === 'USERS' && (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Personal</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rol</th>
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {users.map((u, idx) => (
                                    <tr key={idx}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {u.personnel ? `${u.personnel.firstName} ${u.personnel.lastName}` : '-'}
                                            <div className="text-xs text-gray-400">{u.personnel?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {u.isActive ? (
                                                <span className="flex items-center gap-1 text-teal-600 text-xs font-bold"><Check className="h-3 w-3" /> Activo</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-red-600 text-xs font-bold"><X className="h-3 w-3" /> Inactivo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button className="text-teal-600 hover:text-teal-900">Editar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'ROLES' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3">
                             <Settings className="h-5 w-5 text-blue-600 shrink-0" />
                             <div>
                                 <h4 className="font-bold text-blue-900 text-sm">Configuración de Acceso</h4>
                                 <p className="text-xs text-blue-700 mt-1">
                                     Aquí puede definir qué módulos son visibles para cada rol. Los cambios requieren reinicio de sesión de los usuarios afectados.
                                 </p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {roles.map((role) => (
                                <div key={role.role} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-lg">{role.label}</h3>
                                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">{role.role}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Módulos Permitidos:</p>
                                        {['DASHBOARD', 'ANALYSIS', 'ADMIN_USERS', 'ADMIN_ROLES', 'PROFILE'].map(module => (
                                            <label key={module} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={role.allowedModules.includes(module as any)}
                                                    readOnly // Read only for demo
                                                    className="rounded text-teal-600 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-gray-700">{module}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                        <button className="text-xs font-bold text-white bg-gray-900 px-3 py-2 rounded hover:bg-black">
                                            Guardar Cambios
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'PARAMS' && (
                     <div className="space-y-6 max-w-2xl">
                         <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-3">
                             <Sliders className="h-5 w-5 text-amber-600 shrink-0" />
                             <div>
                                 <h4 className="font-bold text-amber-900 text-sm">Parámetros Globales</h4>
                                 <p className="text-xs text-amber-700 mt-1">
                                     Estos ajustes afectan el comportamiento de la aplicación para todos los usuarios.
                                 </p>
                             </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                             <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                 <Clock className="h-5 w-5 text-gray-500" />
                                 Tiempos y Temporizadores
                             </h3>
                             
                             <div className="space-y-4">
                                 <div>
                                     <label className="block text-sm font-bold text-gray-700 mb-2">
                                         Tiempo de Espera - Botón Validar (Segundos)
                                     </label>
                                     <div className="flex items-center gap-3">
                                         <input 
                                            type="number"
                                            min="0"
                                            max="60"
                                            value={tempConfig.verificationDelaySeconds}
                                            onChange={(e) => setTempConfig({...tempConfig, verificationDelaySeconds: Number(e.target.value)})}
                                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center font-bold text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                                         />
                                         <span className="text-sm text-gray-500">segundos</span>
                                     </div>
                                     <p className="text-xs text-gray-400 mt-1">
                                         Tiempo que el usuario debe esperar en el modal de detalle antes de poder hacer clic en "Validar". (0 = Sin espera)
                                     </p>
                                 </div>
                             </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <button 
                                onClick={handleSaveConfig}
                                disabled={isSavingConfig}
                                className="px-6 py-2.5 bg-gray-900 text-white font-bold rounded-lg shadow hover:bg-black transition-all flex items-center gap-2 disabled:opacity-70"
                            >
                                <Save className="h-4 w-4" />
                                {isSavingConfig ? 'Guardando...' : 'Guardar Parámetros'}
                            </button>
                            
                            {configMessage && (
                                <span className={`text-sm font-bold animate-in fade-in ${configMessage.includes('Error') ? 'text-red-600' : 'text-teal-600'}`}>
                                    {configMessage}
                                </span>
                            )}
                        </div>
                     </div>
                )}
            </div>
        </div>
    </div>
  );
};
