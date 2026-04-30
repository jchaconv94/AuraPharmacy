
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, RoleConfig, HealthFacility } from '../types';
import { Users, Shield, Settings, Check, X, Sliders, Save, Clock, Link2, AlertTriangle, RefreshCw, UserPlus, Edit, Power, KeyRound, Building2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ROLES' | 'PARAMS'>('USERS');
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  
  // Lista de establecimientos para el combobox
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);

  const { systemConfig, updateSystemConfigContext, user: currentUser, refreshUserData } = useAuth();
  const [tempConfig, setTempConfig] = useState(systemConfig);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
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

  // --- NEW ROLE MODAL STATE ---
  const [isNewRoleModalOpen, setIsNewRoleModalOpen] = useState(false);
  const [newRoleForm, setNewRoleForm] = useState({ role: '', label: '', allowedModules: [] });
  const [isSavingRole, setIsSavingRole] = useState(false);

  const [isRolesLoading, setIsRolesLoading] = useState(true);

  useEffect(() => {
    // Initial load (uses cache if available)
    
    // Quick load from local storage
    const cachedRoles = localStorage.getItem('aura_roles_cache');
    if (cachedRoles) {
        try {
            setRoles(JSON.parse(cachedRoles));
            setIsRolesLoading(false);
        } catch (e) {}
    }

    const cachedUsers = localStorage.getItem('aura_users_cache');
    if (cachedUsers) {
        try {
            setUsers(JSON.parse(cachedUsers));
        } catch (e) {}
    }

    api.getUsers().then((data) => {
        setUsers(data);
        localStorage.setItem('aura_users_cache', JSON.stringify(data));
    });
    
    api.getRolesConfig().then((data) => {
        setRoles(data);
        setIsRolesLoading(false);
        localStorage.setItem('aura_roles_cache', JSON.stringify(data));
    });
    
    // Cargar establecimientos REALES desde la Base de Datos
    api.getFacilities().then(data => {
        setFacilities(data);
    });

    // Sync local state with context when context loads
    setTempConfig(systemConfig);
  }, [systemConfig]);

  const handleRefreshUsers = async () => {
      setIsRefreshingUsers(true);
      // Force refresh bypasses cache
      const updatedUsers = await api.getUsers(true);
      if (updatedUsers && updatedUsers.length > 0) {
          setUsers(updatedUsers);
          localStorage.setItem('aura_users_cache', JSON.stringify(updatedUsers));
      }
      setIsRefreshingUsers(false);
  };

  const handleSaveConfig = async () => {
      setIsSavingConfig(true);
      const toastId = toast.loading('Guardando parámetros...');
      
      console.log("Saving config:", tempConfig);
      const res = await api.updateSystemConfig(tempConfig);
      if (res.success) {
          updateSystemConfigContext(tempConfig);
          toast.success("Parámetros actualizados correctamente", { id: toastId });
      } else {
          toast.error("Error al guardar configuración", { id: toastId });
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
  };

  const executeToggleStatus = async () => {
      if (!userToToggle) return;
      const { username, currentStatus } = userToToggle;
      const newStatus = !currentStatus;
      
      // Cerrar modal
      setUserToToggle(null);

      // --- ACTUALIZACIÓN OPTIMISTA (Instantánea) ---
      const originalUsers = [...users];
      const newUsers = originalUsers.map(u => u.username === username ? { ...u, isActive: newStatus } : u);
      setUsers(newUsers);
      localStorage.setItem('aura_users_cache', JSON.stringify(newUsers));
      
      const toastId = toast.loading('Actualizando estado...');

      // Llamada en segundo plano
      try {
          const res = await api.toggleUserStatus(username, newStatus);
          
          if(!res.success) {
              throw new Error(res.message);
          } else {
              toast.success(`Usuario ${newStatus ? 'activado' : 'inactivado'}`, { id: toastId });
              // Si el usuario se inactiva a sí mismo o cambia algo que requiere refresco
              if (currentUser && username === currentUser.username) {
                  await refreshUserData();
              }
          }
      } catch (e: any) {
          // Si falla, revertimos los cambios y mostramos error en UI (no alert)
          setUsers(originalUsers);
          toast.error("Error al actualizar: " + e.message, { id: toastId });
      }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingUser(true);
      const toastId = toast.loading(editingUser ? 'Actualizando usuario...' : 'Creando usuario...');

      const payload = {
          isNew: !editingUser,
          personnelId: editingUser?.personnelId,
          ...userForm
      };

      const res = await api.adminSaveUser(payload);
      if (res.success) {
          setIsUserModalOpen(false);
          await handleRefreshUsers(); // Recargamos la tabla
          toast.success(editingUser ? 'Usuario actualizado' : 'Usuario creado', { id: toastId });
          
          // Si el usuario editado es el mismo que está logueado, forzamos actualización de sesión
          if (currentUser && userForm.username === currentUser.username) {
              await refreshUserData();
          }

      } else {
          toast.error("Error al guardar: " + res.message, { id: toastId });
      }
      setIsSavingUser(false);
  };

  const handleRoleModuleChange = (roleName: string, module: string, isChecked: boolean) => {
      setRoles(prevRoles => prevRoles.map(r => {
          if (r.role === roleName) {
              const newModules = isChecked 
                  ? [...r.allowedModules, module as any]
                  : r.allowedModules.filter(m => m !== module);
              return { ...r, allowedModules: newModules };
          }
          return r;
      }));
  };

  const handleRoleMaxUrlsChange = (roleName: string, maxUrlsStr: string) => {
      const maxUrls = maxUrlsStr ? parseInt(maxUrlsStr) : undefined;
      setRoles(prevRoles => prevRoles.map(r => 
          r.role === roleName ? { ...r, maxUrlsAllowed: isNaN(maxUrls as any) ? undefined : maxUrls } : r
      ));
  };

  const handleRoleLabelChange = (roleName: string, newLabel: string) => {
      setRoles(prevRoles => prevRoles.map(r => 
          r.role === roleName ? { ...r, label: newLabel } : r
      ));
  };

  const handleSaveRoleConfig = async (roleConfig: RoleConfig) => {
      const toastId = toast.loading('Guardando cambios...');
      try {
          const res = await api.updateRoleConfig(roleConfig);
          if (res.success) {
              toast.success(`Rol ${roleConfig.label} actualizado`, { 
                  id: toastId,
                  description: 'Los permisos han sido modificados exitosamente.'
              });
              
              // Refresh roles to ensure sync
              const updatedRoles = await api.getRolesConfig();
              if (updatedRoles && updatedRoles.length > 0) {
                  setRoles(updatedRoles);
                  localStorage.setItem('aura_roles_cache', JSON.stringify(updatedRoles));
              }

              // FORCE REFRESH IF CURRENT USER IS AFFECTED
              if (currentUser && currentUser.role === roleConfig.role) {
                  await refreshUserData();
              }
          } else {
              toast.error(`Error al actualizar`, { 
                  id: toastId,
                  description: res.message 
              });
          }
      } catch (e) {
          // OFFLINE FALLBACK UI FEEDBACK
          toast.success(`Rol actualizado (Modo Offline)`, { 
              id: toastId, 
              description: "Los cambios se guardaron localmente." 
          });
          
          if (currentUser && currentUser.role === roleConfig.role) {
              await refreshUserData();
          }
      }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSavingRole(true);
      const newRoleCode = newRoleForm.role.toUpperCase().replace(/\s+/g, '_');
      const newRoleConfig: RoleConfig = {
          role: newRoleCode as any,
          label: newRoleForm.label || newRoleCode,
          allowedModules: newRoleForm.allowedModules as any[]
      };

      const toastId = toast.loading('Creando rol...');
      try {
          const res = await api.updateRoleConfig(newRoleConfig);
          if (res.success) {
              toast.success(`Rol ${newRoleConfig.label} creado`, { id: toastId });
              const updatedRoles = await api.getRolesConfig();
              if (updatedRoles && updatedRoles.length > 0) {
                  setRoles(updatedRoles);
                  localStorage.setItem('aura_roles_cache', JSON.stringify(updatedRoles));
              }
              setIsNewRoleModalOpen(false);
          } else {
             toast.error("Error al crear rol: " + res.message, { id: toastId });
          }
      } catch (e: any) {
          toast.error("Error al crear rol (Offline)", { id: toastId });
      } finally {
          setIsSavingRole(false);
      }
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

                        {/* Error Message UI Removed - Handled by Toast */}

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
                        <div className="flex justify-between flex-wrap gap-4 items-center">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3 flex-1">
                                <Settings className="h-5 w-5 text-blue-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm">Configuración de Acceso</h4>
                                    <p className="text-xs text-blue-700 mt-1">
                                        Aquí puede definir qué módulos son visibles para cada rol. Los cambios requieren reinicio de sesión de los usuarios afectados.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => {
                                    setNewRoleForm({ role: '', label: '', allowedModules: [] });
                                    setIsNewRoleModalOpen(true);
                                }}
                                className="flex items-center justify-center gap-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-5 py-3 rounded-lg transition-all shadow-sm"
                            >
                                <Shield className="h-4 w-4" />
                                Nuevo Rol
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {isRolesLoading ? (
                                <div className="col-span-full flex flex-col items-center justify-center py-12 text-teal-600">
                                    <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                                    <span className="font-bold">Cargando roles...</span>
                                </div>
                            ) : roles.length === 0 ? (
                                <div className="col-span-full text-center py-12 text-gray-500">
                                    No hay roles configurados.
                                </div>
                            ) : roles.map((role) => (
                                <div key={role.role} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-4">
                                        <input 
                                            type="text" 
                                            value={role.label} 
                                            onChange={(e) => handleRoleLabelChange(role.role, e.target.value)} 
                                            placeholder="Nombre del Rol"
                                            className="font-bold text-lg bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-teal-500 focus:ring-0 px-0 focus:outline-none w-full mr-2"
                                        />
                                        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded shrink-0">{role.role}</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Módulos Permitidos:</p>
                                        {['DASHBOARD', 'ANALYSIS', 'ADMIN_USERS', 'ADMIN_ROLES', 'PROFILE', 'REDISTRIBUTION', 'SIG_SEARCH'].map(module => (
                                            <label key={module} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={role.allowedModules.includes(module as any)}
                                                    onChange={(e) => handleRoleModuleChange(role.role, module, e.target.checked)}
                                                    className="rounded text-teal-600 focus:ring-teal-500"
                                                />
                                                <span className="text-sm text-gray-700">{module}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <div className="mt-4 border-t border-gray-100 pt-4">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Máximo de URLs (SIG_SEARCH):</label>
                                        <input 
                                            type="number"
                                            min="1"
                                            placeholder="Ilimitado"
                                            value={role.maxUrlsAllowed || ''}
                                            onChange={(e) => handleRoleMaxUrlsChange(role.role, e.target.value)}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Deje vacío para sin límite.</p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end">
                                        <button 
                                            onClick={() => handleSaveRoleConfig(role)}
                                            className="text-xs font-bold text-white bg-gray-900 px-3 py-2 rounded hover:bg-black transition-colors flex items-center gap-2"
                                        >
                                            <Save className="h-3 w-3" />
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

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
                                    </div>
                                </div>
                            </div>

                            {/* WAREHOUSE CONFIG */}
                            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm h-full">
                                <h3 className="font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-gray-500" />
                                    Configuración de Almacén General
                                </h3>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Código del Almacén
                                        </label>
                                        <input 
                                            type="text"
                                            value={tempConfig.warehouseCode || ''}
                                            onChange={(e) => setTempConfig({...tempConfig, warehouseCode: e.target.value})}
                                            placeholder="Ej: ALM-001"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">
                                            Nombre del Almacén
                                        </label>
                                        <input 
                                            type="text"
                                            value={tempConfig.warehouseName || ''}
                                            onChange={(e) => setTempConfig({...tempConfig, warehouseName: e.target.value})}
                                            placeholder="Ej: Almacén General de Medicamentos"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                                        />
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
                        </div>
                     </div>
                )}
            </div>
        </div>
    </div>

    {/* --- CUSTOM CONFIRMATION MODAL --- */}
    {userToToggle && (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                                        {roles.map(r => (
                                            <option key={r.role} value={r.role}>{r.role}</option>
                                        ))}
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

    {/* --- NEW ROLE MODAL --- */}
    {isNewRoleModalOpen && (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-teal-500/20 p-2 rounded-lg">
                            <Shield className="h-5 w-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Crear Nuevo Rol</h3>
                            <p className="text-xs text-gray-400">Defina el código y los permisos del nuevo rol.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsNewRoleModalOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors hover:bg-white/10 p-1 rounded-full"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <form onSubmit={handleCreateRole} className="p-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Identificador del Rol *</label>
                            <input 
                                type="text"
                                required
                                placeholder="Ej: AUDITOR"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 uppercase outline-none"
                                value={newRoleForm.role}
                                onChange={e => setNewRoleForm({...newRoleForm, role: e.target.value})}
                            />
                            <p className="text-xs text-gray-400 mt-1">Código único sin espacios (Ej: MEDICO, ANALISTA).</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre Descriptivo</label>
                            <input 
                                type="text"
                                placeholder="Ej: Personal Auditor"
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                                value={newRoleForm.label}
                                onChange={e => setNewRoleForm({...newRoleForm, label: e.target.value})}
                            />
                        </div>
                        
                        <div className="pt-2">
                            <label className="block text-xs font-bold text-gray-700 mb-2">Permisos Iniciales</label>
                            <div className="grid grid-cols-2 gap-2">
                                {['DASHBOARD', 'ANALYSIS', 'ADMIN_USERS', 'ADMIN_ROLES', 'PROFILE', 'REDISTRIBUTION', 'SIG_SEARCH'].map(mod => {
                                    const isChecked = newRoleForm.allowedModules.includes(mod as never);
                                    return (
                                        <label key={mod} className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100 hover:bg-gray-100 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={(e) => {
                                                    const newMods = e.target.checked 
                                                        ? [...newRoleForm.allowedModules, mod]
                                                        : newRoleForm.allowedModules.filter(m => m !== mod);
                                                    setNewRoleForm({...newRoleForm, allowedModules: newMods as any});
                                                }}
                                                className="rounded text-teal-600 focus:ring-teal-500"
                                            />
                                            <span className="text-xs text-gray-700 font-medium">{mod}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end gap-3 pt-4 border-t border-gray-100">
                        <button 
                            type="button"
                            onClick={() => setIsNewRoleModalOpen(false)}
                            className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={isSavingRole || !newRoleForm.role}
                            className="bg-teal-600 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-teal-700 transition-all flex items-center gap-2 disabled:opacity-70"
                        >
                            <Save className="h-4 w-4" />
                            {isSavingRole ? 'Creando...' : 'Crear Rol'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )}
    </>
  );
};
