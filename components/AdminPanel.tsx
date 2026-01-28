
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, RoleConfig, HealthFacility } from '../types';
import { Users, Shield, Settings, Check, X, Sliders, Save, Clock, Link2, AlertTriangle, RefreshCw, UserPlus, Edit, Power, KeyRound, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES' | 'PARAMS'>('USERS');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  
  // Lista de establecimientos para el combobox
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);

  const { systemConfig, updateSystemConfigContext, user: currentUser, refreshUserData } = useAuth();
  const [tempConfig, setTempConfig] = useState(systemConfig);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

  // --- USER MODAL STATE ---
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
      firstName: '',
      lastName: '',
      dni: '',
      email: '',
      username: '',
      password: '',
      role: 'FARMACIA',
      facilityCode: '00001' // Default generic code
  });

  // --- CONFIRMATION MODAL STATE ---
  const [userToToggle, setUserToToggle] = useState<{username: string, currentStatus: boolean} | null>(null);
  const [userActionError, setUserActionError] = useState<string | null>(null);

  useEffect(() => {
    // Initial load (uses cache if available)
    api.getUsers().then(setUsers);
    api.getRolesConfig().then(setRoles);
    
    // Cargar establecimientos REALES desde la Base de Datos
    api.getFacilities().then(data => {
        setFacilities(data);
    });

    // Sync local state with context when context loads
    setTempConfig(systemConfig);
  }, [systemConfig]);

  const handleRefreshUsers = async () => {
      setIsRefreshingUsers(true);
      setUserActionError(null);
      // Force refresh bypasses cache
      const updatedUsers = await api.getUsers(true);
      setUsers(updatedUsers);
      setIsRefreshingUsers(false);
  };

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

  // --- USER ACTIONS ---

  const handleAddUserClick = () => {
      setEditingUser(null);
      // Intentar usar el primer establecimiento disponible como default, sino el hardcoded
      const defaultFacility = facilities.length > 0 ? facilities[0].code : '00001';
      
      // Refrescar lista de establecimientos al abrir el modal para asegurar datos frescos
      api.getFacilities().then(setFacilities);

      setUserForm({
          firstName: '', lastName: '', dni: '', email: '', username: '', password: '', role: 'FARMACIA', facilityCode: defaultFacility
      });
      setIsUserModalOpen(true);
  };

  const handleEditUserClick = (u: any) => {
      setEditingUser(u);
      
      // Refrescar lista de establecimientos
      api.getFacilities().then(setFacilities);

      setUserForm({
          firstName: u.personnel?.firstName || '',
          lastName: u.personnel?.lastName || '',
          dni: u.personnel?.dni || '',
          email: u.personnel?.email || '',
          username: u.username,
          password: '', // Password always blank on edit
          role: u.role,
          facilityCode: u.personnel?.facilityCode || '00001'
      });
      setIsUserModalOpen(true);
  };

  const handleToggleStatus = (username: string, currentStatus: any) => {
      // Determinación robusta del estado actual (maneja booleanos y strings 'TRUE'/'FALSE')
      const isCurrentlyActive = currentStatus === true || String(currentStatus).toLowerCase() === 'true';
      setUserToToggle({ username, currentStatus: isCurrentlyActive });
      setUserActionError(null);
  };

  const executeToggleStatus = async () => {
      if (!userToToggle) return;
      const { username, currentStatus } = userToToggle;
      const newStatus = !currentStatus;
      
      // Cerrar modal
      setUserToToggle(null);

      // --- ACTUALIZACIÓN OPTIMISTA (Instantánea) ---
      const originalUsers = [...users];
      setUsers(prev => prev.map(u => u.username === username ? { ...u, isActive: newStatus } : u));

      // Llamada en segundo plano
      try {
          const res = await api.toggleUserStatus(username, newStatus);
          
          if(!res.success) {
              throw new Error(res.message);
          } else {
              // Si el usuario se inactiva a sí mismo o cambia algo que requiere refresco
              if (currentUser && username === currentUser.username) {
                  await refreshUserData();
              }
          }
      } catch (e: any) {
          // Si falla, revertimos los cambios y mostramos error en UI (no alert)
          setUsers(originalUsers);
          setUserActionError("Error al actualizar: " + e.message);
          setTimeout(() => setUserActionError(null), 5000);
      }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingUser(true);

      const payload = {
          isNew: !editingUser,
          personnelId: editingUser?.personnelId,
          ...userForm
      };

      const res = await api.adminSaveUser(payload);
      if (res.success) {
          setIsUserModalOpen(false);
          await handleRefreshUsers(); // Recargamos la tabla
          
          // Si el usuario editado es el mismo que está logueado, forzamos actualización de sesión
          if (currentUser && userForm.username === currentUser.username) {
              await refreshUserData();
          }

      } else {
          alert("Error al guardar: " + res.message);
      }
      setIsSavingUser(false);
  };

  return (
    <>
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
                    <div className="overflow-x-auto relative">
                        {/* Header Actions for Users Table */}
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-700 text-lg">Directorio de Usuarios</h3>
                            <div className="flex gap-2">
                                <button 
                                    onClick={handleAddUserClick}
                                    className="flex items-center gap-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition-all shadow-sm"
                                >
                                    <UserPlus className="h-4 w-4" />
                                    Nuevo Usuario
                                </button>
                                <button 
                                    onClick={handleRefreshUsers}
                                    className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 px-3 py-2 rounded-lg transition-all border border-gray-200"
                                    title="Actualizar lista desde el servidor"
                                >
                                    <RefreshCw className={`h-4 w-4 ${isRefreshingUsers ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Error Message UI */}
                        {userActionError && (
                            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm flex items-center gap-2 animate-in fade-in">
                                <AlertTriangle className="h-5 w-5" />
                                {userActionError}
                            </div>
                        )}

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
                                {users.length === 0 && !isRefreshingUsers && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                                            Cargando usuarios...
                                        </td>
                                    </tr>
                                )}
                                {users.map((u, idx) => {
                                    // Aseguramos que isActive se interprete correctamente para la visualización
                                    const isUserActive = u.isActive === true || String(u.isActive).toLowerCase() === 'true';
                                    
                                    return (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{u.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {u.personnel ? `${u.personnel.firstName} ${u.personnel.lastName}` : '-'}
                                            <div className="text-xs text-gray-400">{u.personnel?.email}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full uppercase ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {isUserActive ? (
                                                <span className="flex items-center gap-1 text-teal-600 text-xs font-bold bg-teal-50 px-2 py-0.5 rounded-full w-fit animate-in fade-in"><Check className="h-3 w-3" /> Activo</span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-red-600 text-xs font-bold bg-red-50 px-2 py-0.5 rounded-full w-fit animate-in fade-in"><X className="h-3 w-3" /> Inactivo</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleEditUserClick(u)}
                                                className="text-gray-400 hover:text-teal-600 bg-gray-50 hover:bg-teal-50 p-2 rounded-lg transition-colors" title="Editar"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleToggleStatus(u.username, u.isActive)}
                                                className={`p-2 rounded-lg transition-colors ${isUserActive ? 'text-gray-400 hover:text-red-600 hover:bg-red-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`} 
                                                title={isUserActive ? "Inactivar" : "Reactivar"}
                                            >
                                                <Power className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )})}
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
                     <div className="space-y-6">
                         <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg flex gap-3 max-w-4xl">
                             <Sliders className="h-5 w-5 text-amber-600 shrink-0" />
                             <div>
                                 <h4 className="font-bold text-amber-900 text-sm">Parámetros Globales</h4>
                                 <p className="text-xs text-amber-700 mt-1">
                                     Estos ajustes afectan el comportamiento de la aplicación para todos los usuarios.
                                 </p>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* TIMER CONFIG */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-full">
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

                            {/* API CONNECTION CONFIG */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-full">
                                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Link2 className="h-5 w-5 text-gray-500" />
                                    Conexión Backend (Google Apps Script)
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            URL del Web App (API Endpoint)
                                        </label>
                                        <textarea 
                                            value={tempConfig.apiUrl || ''}
                                            onChange={(e) => setTempConfig({...tempConfig, apiUrl: e.target.value})}
                                            placeholder="https://script.google.com/macros/s/..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono text-gray-600 focus:ring-2 focus:ring-teal-500 outline-none break-all h-24 resize-none"
                                        />
                                        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mt-3">
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                                <div className="text-xs text-blue-800">
                                                    <strong>Importante:</strong> Si actualiza el código de Apps Script, pegue la nueva URL aquí.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
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

    {/* --- CUSTOM CONFIRMATION MODAL --- */}
    {userToToggle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">
                <div className="p-6 text-center">
                    <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${userToToggle.currentStatus ? 'bg-red-100' : 'bg-green-100'}`}>
                        <Power className={`h-6 w-6 ${userToToggle.currentStatus ? 'text-red-600' : 'text-green-600'}`} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {userToToggle.currentStatus ? 'Inactivar Usuario' : 'Activar Usuario'}
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">
                        ¿Está seguro que desea {userToToggle.currentStatus ? 'deshabilitar' : 'habilitar'} el acceso para <strong>{userToToggle.username}</strong>?
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={() => setUserToToggle(null)}
                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={executeToggleStatus}
                            className={`px-4 py-2 text-white rounded-lg font-bold text-sm transition-colors shadow-sm ${userToToggle.currentStatus ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {userToToggle.currentStatus ? 'Sí, Inactivar' : 'Sí, Activar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )}

    {/* --- USER FORM MODAL --- */}
    {isUserModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-teal-500/20 p-2 rounded-lg">
                            <Users className="h-5 w-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                            <p className="text-xs text-gray-400">Complete los datos del personal y credenciales de acceso.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsUserModalOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors hover:bg-white/10 p-1 rounded-full"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleSaveUser} className="p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-6">
                        
                        {/* Section 1: Personal Info */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Users className="h-4 w-4" /> Datos del Personal
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombres *</label>
                                    <input 
                                        type="text" required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                        value={userForm.firstName}
                                        onChange={e => setUserForm({...userForm, firstName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Apellidos *</label>
                                    <input 
                                        type="text" required
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                        value={userForm.lastName}
                                        onChange={e => setUserForm({...userForm, lastName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">DNI *</label>
                                    <input 
                                        type="text" required maxLength={8}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                        value={userForm.dni}
                                        onChange={e => setUserForm({...userForm, dni: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                    <input 
                                        type="email"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                        value={userForm.email}
                                        onChange={e => setUserForm({...userForm, email: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Account & Access */}
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <h4 className="text-xs font-bold text-blue-800 uppercase mb-4 flex items-center gap-2">
                                <KeyRound className="h-4 w-4" /> Cuenta y Acceso
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Usuario Sistema *</label>
                                    <input 
                                        type="text" required
                                        disabled={!!editingUser}
                                        className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono ${editingUser ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white text-gray-900'}`}
                                        value={userForm.username}
                                        onChange={e => setUserForm({...userForm, username: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        {editingUser ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                                    </label>
                                    <input 
                                        type="password"
                                        required={!editingUser}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                        value={userForm.password}
                                        placeholder={editingUser ? "Sin cambios" : ""}
                                        onChange={e => setUserForm({...userForm, password: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Rol de Usuario *</label>
                                    <select 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                                        value={userForm.role}
                                        onChange={e => setUserForm({...userForm, role: e.target.value})}
                                    >
                                        <option value="FARMACIA">FARMACIA</option>
                                        <option value="ADMIN">ADMIN</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Establecimiento (IPRESS) *</label>
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-gray-400" />
                                        <select
                                            required
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                                            value={userForm.facilityCode}
                                            onChange={e => setUserForm({...userForm, facilityCode: e.target.value})}
                                        >
                                            <option value="" disabled>Seleccione...</option>
                                            {facilities.map(fac => (
                                                <option key={fac.code} value={fac.code}>
                                                    {fac.code} - {fac.name} ({fac.category})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            type="button"
                            onClick={() => setIsUserModalOpen(false)}
                            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={isSavingUser}
                            className="bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-black transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            <Save className="h-4 w-4" />
                            {isSavingUser ? 'Guardando...' : 'Guardar Usuario'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )}
    </>
  );
};
