import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { HealthFacility, RoleConfig } from '../types';
import { 
  Plus, 
  Trash2, 
  RefreshCw, 
  Search, 
  X, 
  Copy, 
  KeyRound, 
  Monitor, 
  Activity, 
  AlertTriangle, 
  CornerDownRight, 
  CheckCircle2, 
  History,
  ToggleLeft,
  ToggleRight,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';

export const AdminSyncDevicesModule: React.FC = () => {
  const { user: currentUser } = useAuth();
  
  // Tabs: 'DEVICES' | 'RUNS'
  const [activeSubTab, setActiveSubTab] = useState<'DEVICES' | 'RUNS'>('DEVICES');
  
  const [installations, setInstallations] = useState<any[]>([]);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<HealthFacility[]>([]);
  const [roles, setRoles] = useState<RoleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState('ALL');
  
  // Registration Dialog/Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    pcName: '',
    facilityCode: '',
    sismedPath: '',
    isActive: true,
    allowedAlmcodsStr: '' // Comma separated ALMCODs (optional restriction)
  });

  // Success Modal (displayed only once after registration or regeneration)
  const [successData, setSuccessData] = useState<{
    pcName: string;
    facilityName: string;
    facilityCode: string;
    rawToken: string;
    apiUrl: string;
  } | null>(null);

  // Load essential data
  const loadData = async () => {
    try {
      setLoading(true);
      const [allInstallations, allRuns, allFacilities, allRoles] = await Promise.all([
        api.getSyncInstallations(),
        api.getSyncRuns(),
        api.getFacilities(),
        api.getRolesConfig()
      ]);
      setInstallations(allInstallations);
      setSyncRuns(allRuns);
      setFacilities(allFacilities);
      setRoles(allRoles);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar la información de dispositivos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success('Información actualizada');
  };

  // Organizational context matching the role's jurisdiction level
  const userDiresaId = currentUser?.personnelData?.diresaId || currentUser?.facilityData?.diresaId || (currentUser as any)?.diresaId;
  const userOgessId = currentUser?.personnelData?.ogessId || currentUser?.facilityData?.ogessId || (currentUser as any)?.ogessId;
  const userUngetId = currentUser?.personnelData?.ungetId || currentUser?.facilityData?.ungetId || (currentUser as any)?.ungetId;
  const userMicroredId = currentUser?.personnelData?.microredId || currentUser?.facilityData?.microredId || (currentUser as any)?.microredId;
  const userFacilityCode = currentUser?.personnelData?.facilityCode || currentUser?.facilityData?.code || (currentUser as any)?.facilityCode;

  const getJurisdictionLevel = (): string => {
    if (!currentUser) return '';
    const userRole = currentUser.role;
    const config = roles.find(r => r.role === userRole);
    if (config?.jurisdictionLevel) {
      return config.jurisdictionLevel;
    }
    const r = (userRole || '').toUpperCase();
    if (r === 'ADMIN' || r === 'GLOBAL' || r.includes('SUPER') || r.includes('GENERAL') || r === 'ADMINISTRADOR') return 'GLOBAL';
    if (r.includes('DIRESA')) return 'DIRESA';
    if (r.includes('OGESS')) return 'OGESS';
    if (r.includes('UNGET')) return 'UNGET';
    if (r.includes('MICRORED')) return 'MICRORED';
    if (r.includes('FARMACIA') || r.includes('IPRESS') || r.includes('PERSONAL')) return 'IPRESS';
    return '';
  };

  const level = getJurisdictionLevel();

  // Filter facilities available to register based on user jurisdiction
  const allowedFacilities = useMemo(() => {
    return facilities.filter(f => {
      if (level === 'GLOBAL') return true;
      if (level === 'MICRORED' && userMicroredId) return f.microredId === userMicroredId;
      if (level === 'UNGET' && userUngetId) return f.ungetId === userUngetId;
      if (level === 'OGESS' && userOgessId) return f.ogessId === userOgessId;
      if (level === 'DIRESA' && userDiresaId) return f.diresaId === userDiresaId;
      if (level === 'IPRESS' && userFacilityCode) return f.code === userFacilityCode;

      // Fallbacks
      if (userMicroredId) return f.microredId === userMicroredId;
      if (userUngetId) return f.ungetId === userUngetId;
      if (userOgessId) return f.ogessId === userOgessId;
      if (userDiresaId) return f.diresaId === userDiresaId;
      if (userFacilityCode) return f.code === userFacilityCode;

      return false;
    });
  }, [facilities, level, userDiresaId, userOgessId, userUngetId, userMicroredId, userFacilityCode]);

  // Filter registered installations by user jurisdiction and search/filters
  const filteredInstallations = useMemo(() => {
    return installations.filter(inst => {
      // Find matching facility to apply jurisdiction check
      const f = facilities.find(fac => fac.code === inst.facility_code);
      if (!f) return false;

      // Jurisdiction filter
      if (level !== 'GLOBAL') {
        if (level === 'MICRORED' && userMicroredId && f.microredId !== userMicroredId) return false;
        if (level === 'UNGET' && userUngetId && f.ungetId !== userUngetId) return false;
        if (level === 'OGESS' && userOgessId && f.ogessId !== userOgessId) return false;
        if (level === 'DIRESA' && userDiresaId && f.diresaId !== userDiresaId) return false;
        if (level === 'IPRESS' && userFacilityCode && f.code !== userFacilityCode) return false;
      }

      // Facility option filter in UI
      if (selectedFacilityFilter !== 'ALL' && inst.facility_code !== selectedFacilityFilter) return false;

      // Search matches (PC Name, Facility Code, Facility Name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const pcMatches = (inst.pc_name || '').toLowerCase().includes(query);
        const codeMatches = (inst.facility_code || '').toLowerCase().includes(query);
        const nameMatches = (f.name || '').toLowerCase().includes(query);
        const sismedPathMatches = (inst.sismed_path || '').toLowerCase().includes(query);
        return pcMatches || codeMatches || nameMatches || sismedPathMatches;
      }

      return true;
    });
  }, [installations, facilities, level, selectedFacilityFilter, searchQuery, userDiresaId, userOgessId, userUngetId, userMicroredId, userFacilityCode]);

  // Filter sync runs by jurisdiction
  const filteredRuns = useMemo(() => {
    return syncRuns.filter(run => {
      const f = facilities.find(fac => fac.code === run.facility_code);
      if (!f) return false;

      if (level !== 'GLOBAL') {
        if (level === 'MICRORED' && userMicroredId && f.microredId !== userMicroredId) return false;
        if (level === 'UNGET' && userUngetId && f.ungetId !== userUngetId) return false;
        if (level === 'OGESS' && userOgessId && f.ogessId !== userOgessId) return false;
        if (level === 'DIRESA' && userDiresaId && f.diresaId !== userDiresaId) return false;
        if (level === 'IPRESS' && userFacilityCode && f.code !== userFacilityCode) return false;
      }
      return true;
    });
  }, [syncRuns, facilities, level, userDiresaId, userOgessId, userUngetId, userMicroredId, userFacilityCode]);

  // Register device handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.facilityCode || !formData.pcName) {
      toast.error('Complete los campos obligatorios (*)');
      return;
    }

    setSaving(true);
    try {
      const allowedAlmcods = formData.allowedAlmcodsStr
        ? formData.allowedAlmcodsStr.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : undefined;

      const result = await api.createSyncInstallation({
        facilityCode: formData.facilityCode,
        pcName: formData.pcName,
        sismedPath: formData.sismedPath,
        isActive: formData.isActive,
        allowedAlmcods
      });

      if (result.success && result.rawToken) {
        toast.success('Dispositivo registrado correctamente');
        setIsCreateModalOpen(false);
        
        // Find facility name for display
        const fac = facilities.find(f => f.code === formData.facilityCode);
        
        // Show credentials modal
        setSuccessData({
          pcName: formData.pcName,
          facilityName: fac?.name || 'Establecimiento Autorizado',
          facilityCode: formData.facilityCode,
          rawToken: result.rawToken,
          apiUrl: 'https://ujknopysvgqqvkmgrfhp.supabase.co/functions/v1/sync-stock'
        });

        // Reset form
        setFormData({
          pcName: '',
          facilityCode: '',
          sismedPath: '',
          isActive: true,
          allowedAlmcodsStr: ''
        });

        // Reload lists
        loadData();
      } else {
        toast.error(result.message || 'No se pudo crear el dispositivo');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error durante la transacción');
    } finally {
      setSaving(false);
    }
  };

  // Toggle activation status
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await api.updateSyncInstallationStatus(id, !currentStatus);
      if (res.success) {
        toast.success(`Dispositivo ${!currentStatus ? 'activado' : 'inactivado'} correctamente`);
        // Update local state smoothly
        setInstallations(prev => prev.map(inst => inst.id === id ? { ...inst, is_active: !currentStatus } : inst));
      } else {
        toast.error(res.message || 'Error al cambiar estado');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error de conexión');
    }
  };

  // Regenerate Token Key
  const handleRegenerateKey = async (id: string, pcName: string, facilityCode: string) => {
    if (!window.confirm(`¿Está seguro de regenerar la clave de acceso de "${pcName}"? Esto invalidará la clave de conexión anterior de manera inmediata.`)) {
      return;
    }

    try {
      const res = await api.regenerateSyncInstallationKey(id);
      if (res.success && res.rawToken) {
        toast.success('Clave de conexión regenerada con éxito');
        
        const fac = facilities.find(f => f.code === facilityCode);

        // Show successor modal with the new token
        setSuccessData({
          pcName,
          facilityName: fac?.name || 'Establecimiento Autorizado',
          facilityCode,
          rawToken: res.rawToken,
          apiUrl: 'https://ujknopysvgqqvkmgrfhp.supabase.co/functions/v1/sync-stock'
        });

        loadData();
      } else {
        toast.error(res.message || 'No se pudo regenerar la clave');
      }
    } catch (err: any) {
      toast.error('Error de red al regenerar clave');
    }
  };

  // Delete installation
  const handleDeleteInstallation = async (id: string, pcName: string) => {
    if (!window.confirm(`¿Desea ELIMINAR permanentemente la autorización del dispositivo "${pcName}"? Se perderán los registros de auditoría de conexión.`)) {
      return;
    }

    try {
      const res = await api.deleteSyncInstallation(id);
      if (res.success) {
        toast.success('Dispositivo eliminado con éxito');
        setInstallations(prev => prev.filter(i => i.id !== id));
      } else {
        toast.error(res.message || 'Error al eliminar');
      }
    } catch (err: any) {
      toast.error('No se pudo conectar para eliminar');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado al portapapeles`);
  };

  // Format Helper for timestamps
  const formatTimestamp = (tsStr: string | null) => {
    if (!tsStr) return 'Sin fecha';
    const d = new Date(tsStr);
    return d.toLocaleString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300" id="módulo-sync-sismed-web">
      
      {/* Tab Selector */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveSubTab('DEVICES')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'DEVICES' 
              ? 'border-teal-600 text-teal-600 bg-teal-50/20' 
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <Monitor className="h-4 w-4" />
          Dispositivos Autorizados ({filteredInstallations.length})
        </button>
        <button
          onClick={() => setActiveSubTab('RUNS')}
          className={`px-5 py-3 font-semibold text-sm transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'RUNS' 
              ? 'border-teal-600 text-teal-600 bg-teal-50/20' 
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <History className="h-4 w-4" />
          Historial de Envío ({filteredRuns.length})
        </button>
      </div>

      {activeSubTab === 'DEVICES' && (
        <div className="space-y-4">
          
          {/* Controls Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex flex-1 flex-col md:flex-row gap-3 items-stretch">
              
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por PC, código IPRESS, dirección de base..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* Establishment / IPRESS Select Filter */}
              <div className="w-full md:w-64">
                <select
                  value={selectedFacilityFilter}
                  onChange={e => setSelectedFacilityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                >
                  <option value="ALL">-- Todos los Establecimientos --</option>
                  {allowedFacilities.map(f => (
                    <option key={f.code} value={f.code}>{f.name} ({f.code})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing || loading}
                className="p-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-55"
                title="Sincronizar Panel"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
              </button>

              {/* Only roles with jurisdiction capabilities are allowed to establish new connections */}
              {level !== 'IPRESS' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-lg flex items-center gap-2 shadow hover:shadow-md transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Autorizar Dispositivo
                </button>
              )}
            </div>
          </div>

          {/* Installations Table/Cards */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <RefreshCw className="h-8 w-8 text-teal-600 animate-spin mb-3" />
              <p className="text-gray-500 text-sm font-medium">Buscando listado de autorizaciones...</p>
            </div>
          ) : filteredInstallations.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
              <Monitor className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700">Sin dispositivos registrados</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-sm">No se encontraron autorizaciones activas para la jurisdicción asignada. Cree una nueva para comenzar a sincronizar.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Dispositivo / PC</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Establecimiento IPRESS</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Carpeta Local (Auditoría)</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Última Sincro</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 transition-colors">
                    {filteredInstallations.map(inst => {
                      const fac = facilities.find(f => f.code === inst.facility_code);
                      const isPathWarning = inst.last_sismed_path && inst.sismed_path && inst.last_sismed_path.toLowerCase() !== inst.sismed_path.toLowerCase();
                      
                      // Find last run for this installation
                      const lastRun = syncRuns.find(r => r.installation_id === inst.id);

                      return (
                        <tr key={inst.id} className="hover:bg-slate-50/55 transition-colors">
                          
                          {/* PC name & ID */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                                <Monitor className="h-4.5 w-4.5" />
                              </div>
                              <div>
                                <span className="font-bold text-gray-800 text-sm">{inst.pc_name}</span>
                                <div className="text-[10px] text-gray-400 font-mono mt-0.5" title="id">ID: {inst.id.substring(0, 8)}...</div>
                              </div>
                            </div>
                          </td>

                          {/* Facility context */}
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-bold text-slate-700 text-xs block truncate max-w-[240px]">{fac?.name || 'Cargando...'}</span>
                              <span className="text-[11px] text-slate-500 font-mono mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block">CÓDIGO: {inst.facility_code}</span>
                            </div>
                          </td>

                          {/* Active / Inactive Toggle (Strict UI state control) */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleActive(inst.id, inst.is_active)}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all shadow-sm ${
                                inst.is_active 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200/80 border border-green-200' 
                                  : 'bg-red-100 text-red-700 hover:bg-red-200/80 border border-red-200'
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${inst.is_active ? 'bg-green-500 animate-[pulse_2s_ease-in-out_infinite]' : 'bg-red-500'}`}></span>
                              {inst.is_active ? 'Activo' : 'Inactivo'}
                            </button>
                          </td>

                          {/* Path reported check */}
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {inst.sismed_path ? (
                                <div className="text-xs text-gray-600 truncate max-w-[200px]" title="Configurado estructuralmente">
                                  <strong>Config:</strong> <span className="font-mono bg-slate-55 px-1 py-0.5 border rounded break-all text-[10px]">{inst.sismed_path}</span>
                                </div>
                              ) : (
                                <span className="text-gray-400 font-medium text-[11px] italic">Sin ruta auditoría</span>
                              )}
                              
                              {inst.last_sismed_path && (
                                <div className="text-xs text-gray-600 truncate max-w-[200px]" title="Reportado por el Desktop Toolkit">
                                  <strong>Último:</strong> <span className="font-mono bg-slate-55 px-1 py-0.5 border rounded break-all text-[10px]">{inst.last_sismed_path}</span>
                                </div>
                              )}

                              {isPathWarning && (
                                <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[10px] px-1.5 py-0.5 rounded-md border border-amber-200 animate-pulse font-medium">
                                  <AlertTriangle className="h-3 w-3" /> Cambio de Ruta
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Last run indicator */}
                          <td className="px-6 py-4 whitespace-nowrap text-left">
                            {lastRun ? (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-700 block font-medium">{formatTimestamp(lastRun.started_at)}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                    lastRun.status === 'success' 
                                      ? 'bg-green-100 text-green-700 border border-green-200' 
                                      : lastRun.status === 'warning' 
                                        ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                                        : 'bg-red-100 text-red-700 border border-red-200'
                                  }`}>
                                    {lastRun.records_count} reg.
                                  </span>
                                  {inst.last_seen_at && (
                                    <span className="text-[10px] text-gray-400 font-medium">Conex: {new Date(inst.last_seen_at).toLocaleTimeString('es-PE', { hour: 'numeric', minute: '2-digit' })}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 font-medium text-xs italic">Sin envíos</span>
                            )}
                          </td>

                          {/* Actions button group */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2 text-right">
                              
                              {/* Regenerate Access Key */}
                              <button
                                onClick={() => handleRegenerateKey(inst.id, inst.pc_name, inst.facility_code)}
                                className="p-1 px-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-cyan-600 border border-gray-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm"
                                title="Regenerar clave de acceso"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-cyan-600" />
                                Regenerar
                              </button>

                              {/* Delete Installation */}
                              <button
                                onClick={() => handleDeleteInstallation(inst.id, inst.pc_name)}
                                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                                title="Eliminar Conexión"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
        </div>
      )}

      {activeSubTab === 'RUNS' && (
        <div className="space-y-4">
          
          <div className="flex bg-white p-4 rounded-xl border border-gray-200 shadow-sm items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Monitoreo de Envíos en Tiempo Real</h3>
              <p className="text-xs text-gray-400 mt-0.5">Historial acumulado de transmisiones realizadas desde el Toolkit Desktop.</p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin text-teal-600' : ''}`} />
              Refrescar Logs
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 shadow-sm">
              <RefreshCw className="h-8 w-8 text-teal-600 animate-spin mb-3" />
              <p className="text-gray-500 text-sm font-medium">Buscando historial de sincronizaciones...</p>
            </div>
          ) : filteredRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
              <Activity className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-base font-bold text-gray-700">Sin conexiones registradas</h3>
              <p className="text-xs text-gray-400 mt-1">Nadie ha enviado información utilizando el módulo Sync SISMED 2.0.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-left">
                  <thead className="bg-gray-50/80">
                    <tr>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Fecha / Hora</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Establecimiento</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Estado de Envío</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Registros</th>
                      <th className="px-6 py-3.5 text-xs font-bold text-gray-500 uppercase tracking-wider">Detalles / Alertas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRuns.map(run => {
                      const fac = facilities.find(f => f.code === run.facility_code);
                      const inst = installations.find(i => i.id === run.installation_id);
                      
                      return (
                        <tr key={run.id} className="hover:bg-slate-50/55 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-xs font-mono font-medium text-gray-700 border-r border-slate-100">
                            {formatTimestamp(run.started_at)}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-bold text-gray-800 text-xs block">{fac?.name || 'Desconocido'}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-gray-400 font-mono">IPRESS: {run.facility_code}</span>
                                {inst && (
                                  <span className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-1 border border-teal-100 rounded-md">PC: {inst.pc_name}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm border ${
                              run.status === 'success' 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : run.status === 'warning' 
                                  ? 'bg-amber-100 text-amber-700 border-amber-200' 
                                  : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                              {run.status === 'success' && <CheckCircle2 className="h-3 w-3" />}
                              {run.status === 'warning' && <AlertTriangle className="h-3 w-3 animate-pulse" />}
                              {run.status === 'error' && <X className="h-3 w-3" />}
                              {run.status === 'success' ? 'Transmitido con éxito' : run.status === 'warning' ? 'Con Alerta' : 'Error'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-gray-700">
                            {run.records_count} items
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-gray-600 max-w-sm">
                            <div className="space-y-1">
                              {run.error_message && (
                                <p className="text-red-700 bg-red-50 border border-red-100 rounded p-1.5 break-all text-[10px] font-mono leading-relaxed">{run.error_message}</p>
                              )}
                              
                              {/* Show custom security context or status warnings */}
                              {run.status === 'warning' && (
                                <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded p-1.5 text-[10px] leading-normal font-sans">
                                  Se detectaron almacenes no autorizados o incompatibles que fueron rechazados automáticamente por seguridad. La carga final de los almacenes válidos se completó con éxito.
                                </p>
                              )}

                              {run.sismed_path_reported && (
                                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                  <CornerDownRight className="h-3 w-3 text-gray-400" />
                                  <span className="truncate">Ruta: <code className="font-mono bg-slate-55 border px-1 rounded">{run.sismed_path_reported}</code></span>
                                </div>
                              )}
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
        </div>
      )}

      {/* modal - autorizar un dispositivo */}
      {isCreateModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110000] flex items-center justify-center p-4">
          <form 
            onSubmit={handleRegister} 
            className="bg-white rounded-xl shadow-2xl border border-gray-150 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
          >
            <div className="bg-gray-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold">Autorización de Dispositivo</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {/* Estab IPRESS Select combobox */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">1. Establecimiento de Salud (IPRESS) *</label>
                <select
                  required
                  value={formData.facilityCode}
                  onChange={e => setFormData({ ...formData, facilityCode: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white font-medium text-gray-800"
                >
                  <option value="">-- Seleccionar establecimiento --</option>
                  {allowedFacilities.map(f => (
                    <option key={f.code} value={f.code}>{f.name} ({f.code})</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Solo se listan los establecimientos autorizados para su rol y jurisdicción territorial.</p>
              </div>

              {/* PC Referential Name input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">2. Nombre o IP de la PC Referencial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Farmacia-Principal / PC-Auditoria"
                  value={formData.pcName}
                  onChange={e => setFormData({ ...formData, pcName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Identificador descriptivo para auditar el origen del envío en la lista de conexiones.</p>
              </div>

              {/* Path sismed auditoria informational */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-1">3. Ruta SISMED Estimada (Opcional - Auditoría)</label>
                <input
                  type="text"
                  placeholder="Ej: C:\Sismed\dbf"
                  value={formData.sismedPath}
                  onChange={e => setFormData({ ...formData, sismedPath: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Ayuda a advertir si un usuario mueve o cambia de ubicación la carpeta local de SISMED.</p>
              </div>

              {/* Active Toggle Switch */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-250 p-3.5 rounded-lg">
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">¿Estado de Conexión?</span>
                  <span className="text-[11px] text-slate-500">¿Habilitar de inmediato la escucha remota desde este dispositivo?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className="text-slate-600 focus:outline-none"
                >
                  {formData.isActive ? (
                    <span className="text-green-600 text-[11px] font-bold flex items-center gap-1">
                      <ToggleRight className="h-8 w-8 text-green-600" />
                    </span>
                  ) : (
                    <span className="text-red-500 text-[11px] font-bold flex items-center gap-1">
                      <ToggleLeft className="h-8 w-8 text-slate-400" />
                    </span>
                  )}
                </button>
              </div>

            </div>

            <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-100 rounded-lg text-sm font-semibold text-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-55"
              >
                {saving ? 'Registrando...' : 'Autorizar y Generar Clave'}
              </button>
            </div>
          </form>
        </div>,
        document.body
      )}

      {/* success / credentials display modal - MUST BE DISPLAYED ONLY ONCE */}
      {successData && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-250 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300">
            
            {/* Header warning */}
            <div className="bg-emerald-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-7 w-7 text-white" />
                <div>
                  <h3 className="text-lg font-bold">¡Autorización Creada Exitosamente!</h3>
                  <p className="text-xs text-emerald-100 mt-0.5">Clave generada de forma altamente segura.</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Important Alert warning */}
              <div className="bg-amber-50 border border-amber-350 p-4 rounded-xl flex gap-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs space-y-1">
                  <strong>IMPORTANTE: Copie y guarde los accesos ahora mismo.</strong>
                  <p className="leading-relaxed">Por razones de seguridad estricta, la clave de conexión se cifra en nuestro servidor de inmediato con algoritmos irreversibles (SHA-256). <strong>Nunca podrá volver a visualizarla o recuperarla en esta interfaz web.</strong></p>
                </div>
              </div>

              {/* Context Summary */}
              <div className="bg-slate-50 border p-3 py-1 text-xs rounded-lg space-y-2">
                <div className="grid grid-cols-2 py-1.5 border-b gap-2 border-slate-100">
                  <span className="text-slate-500 font-medium">Establecimiento IPRESS:</span>
                  <span className="text-slate-800 font-bold text-right truncate">{successData.facilityName} ({successData.facilityCode})</span>
                </div>
                <div className="grid grid-cols-2 py-1.5 gap-2">
                  <span className="text-slate-500 font-medium">Nombre de la PC:</span>
                  <span className="text-slate-800 font-bold text-right">{successData.pcName}</span>
                </div>
              </div>

              {/* KEY FIELD WITH COPY ACTION */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">Clave de Conexión (Instalación):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={successData.rawToken}
                    className="flex-1 px-4 py-2.5 bg-gray-900 text-emerald-400 rounded-lg text-sm font-mono font-bold select-all focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(successData.rawToken, 'La Clave de Conexión')}
                    className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 hover:border-slate-400 rounded-lg text-gray-700 transition-colors flex items-center justify-center"
                    title="Copiar Clave"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Pegue esta clave exactamente en la pestaña de configuración de su "Toolkit Desktop" local.</p>
              </div>

              {/* EDGE FUNCTION ENDPOINT WEB SERVICE */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide">URL del Servidor de Sincronización (Edge Function):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={successData.apiUrl}
                    className="flex-1 px-4 py-2 bg-slate-50 text-gray-600 rounded-lg text-xs font-mono select-all focus:outline-none border border-slate-300"
                  />
                  <button
                    onClick={() => copyToClipboard(successData.apiUrl, 'La URL del Servidor')}
                    className="px-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 hover:border-slate-400 rounded-lg text-gray-700 transition-colors flex items-center justify-center"
                    title="Copiar URL"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400">Dirección de la API en la nube que gestiona de manera distribuida las colas de procesamiento de lotes.</p>
              </div>

            </div>

            <div className="bg-gray-950 px-6 py-4 flex items-center justify-end border-t border-gray-100">
              <button
                onClick={() => setSuccessData(null)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow transition-all"
              >
                He guardado mis claves y deseo cerrar
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
};
