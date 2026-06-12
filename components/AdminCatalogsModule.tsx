import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../services/api';
import { Briefcase, Plus, Trash2, Edit, Save, X, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

interface CatalogItem {
  id: string;
  name: string;
  description: string;
}

interface AdminCatalogsModuleProps {
  onChanged: () => void;
}

export const AdminCatalogsModule: React.FC<AdminCatalogsModuleProps> = ({ onChanged }) => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'ADMIN';

  // Labor Regimes state
  const [regimes, setRegimes] = useState<CatalogItem[]>([]);
  const [regimeSearch, setRegimeSearch] = useState('');
  const [regimeForm, setRegimeForm] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [isSavingRegime, setIsSavingRegime] = useState(false);

  // Professions state
  const [professions, setProfessions] = useState<CatalogItem[]>([]);
  const [professionSearch, setProfessionSearch] = useState('');
  const [professionForm, setProfessionForm] = useState<{ id?: string; name: string; description: string } | null>(null);
  const [isSavingProfession, setIsSavingProfession] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rData, pData] = await Promise.all([
        api.getLaborRegimes(),
        api.getProfessions()
      ]);
      setRegimes(rData);
      setProfessions(pData);
    } catch (e) {
      toast.error('Error al cargar catálogos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredRegimes = useMemo(() => {
    return regimes.filter(r => 
      r.name.toLowerCase().includes(regimeSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(regimeSearch.toLowerCase())
    );
  }, [regimes, regimeSearch]);

  const filteredProfessions = useMemo(() => {
    return professions.filter(p => 
      p.name.toLowerCase().includes(professionSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(professionSearch.toLowerCase())
    );
  }, [professions, professionSearch]);

  // --- REGIME ACTIONS ---
  const handleSaveRegime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regimeForm?.name.trim()) return;

    setIsSavingRegime(true);
    const tid = toast.loading('Guardando régimen...');
    try {
      const res = await api.saveLaborRegime(regimeForm);
      if (res.success) {
        toast.success('Régimen laboral guardado', { id: tid });
        setRegimeForm(null);
        await loadData();
        onChanged();
      } else {
        toast.error(res.message || 'Error al guardar', { id: tid });
      }
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsSavingRegime(false);
    }
  };

  const handleDeleteRegime = async (id: string, name: string) => {
    toast(`¿Eliminar régimen laboral "${name}"?`, {
      description: "El personal asociado quedará desvinculado.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          const tid = toast.loading('Eliminando régimen...');
          try {
            const res = await api.deleteLaborRegime(id);
            if (res.success) {
              toast.success('Régimen laboral eliminado', { id: tid });
              await loadData();
              onChanged();
            } else {
              toast.error(res.message || 'Error al eliminar', { id: tid });
            }
          } catch (err: any) {
            toast.error(err.message, { id: tid });
          }
        }
      }
    });
  };

  // --- PROFESSION ACTIONS ---
  const handleSaveProfession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professionForm?.name.trim()) return;

    setIsSavingProfession(true);
    const tid = toast.loading('Guardando profesión...');
    try {
      const res = await api.saveProfession(professionForm);
      if (res.success) {
        toast.success('Profesión guardada', { id: tid });
        setProfessionForm(null);
        await loadData();
        onChanged();
      } else {
        toast.error(res.message || 'Error al guardar', { id: tid });
      }
    } catch (err: any) {
      toast.error(err.message, { id: tid });
    } finally {
      setIsSavingProfession(false);
    }
  };

  const handleDeleteProfession = async (id: string, name: string) => {
    toast(`¿Eliminar profesión "${name}"?`, {
      description: "El personal asociado quedará desvinculado.",
      action: {
        label: "Eliminar",
        onClick: async () => {
          const tid = toast.loading('Eliminando profesión...');
          try {
            const res = await api.deleteProfession(id);
            if (res.success) {
              toast.success('Profesión eliminada', { id: tid });
              await loadData();
              onChanged();
            } else {
              toast.error(res.message || 'Error al eliminar', { id: tid });
            }
          } catch (err: any) {
            toast.error(err.message, { id: tid });
          }
        }
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <span className="text-gray-500 font-medium text-sm">Cargando catálogos del sistema...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ================= COLUMN 1: LABOR REGIMES ================= */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[580px]">
          {/* Section Header */}
          <div className="p-4 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 px-2 rounded bg-teal-100/55 text-teal-700 font-black text-xs">REG</div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Regímenes Laborales</h3>
                <p className="text-[10px] text-gray-400">D.L. 276, CAS, D.L. 1153, etc.</p>
              </div>
            </div>
            {!regimeForm && (
              <button
                onClick={() => setRegimeForm({ name: '', description: '' })}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </button>
            )}
          </div>

          {/* Form Overlay (Slide down / show inline) */}
          {regimeForm && (
            <form onSubmit={handleSaveRegime} className="p-4 bg-teal-50/30 border-b border-teal-100/80 space-y-3 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-teal-800 uppercase tracking-wider">
                  {regimeForm.id ? 'Editar Régimen Laboral' : 'Nuevo Régimen Laboral'}
                </span>
                <button
                  type="button"
                  onClick={() => setRegimeForm(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Nombre / Identificador *</label>
                  <input
                    type="text" required
                    placeholder="Ej / D.L. 1057 (CAS)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 font-semibold"
                    value={regimeForm.name}
                    onChange={e => setRegimeForm({ ...regimeForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Descripción / Notas</label>
                  <input
                    type="text"
                    placeholder="Ej / Contrato administrativo de servicios de salud"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900 font-medium"
                    value={regimeForm.description}
                    onChange={e => setRegimeForm({ ...regimeForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setRegimeForm(null)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingRegime}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingRegime ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          )}

          {/* Search bar */}
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar régimen..."
              className="w-full text-xs text-gray-800 bg-transparent outline-none font-medium"
              value={regimeSearch}
              onChange={e => setRegimeSearch(e.target.value)}
            />
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredRegimes.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No se encontraron regímenes.</div>
            ) : (
              filteredRegimes.map(r => (
                <div key={r.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-0.5 max-w-[75%]">
                    <span className="font-bold text-xs text-gray-800 block">{r.name}</span>
                    <span className="text-[10px] text-gray-400 block break-words leading-relaxed">{r.description || 'Sin descripción'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setRegimeForm(r)}
                      title="Editar"
                      className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteRegime(r.id, r.name)}
                        title="Eliminar"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: PROFESSIONS ================= */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col h-[580px]">
          {/* Section Header */}
          <div className="p-4 bg-slate-50/50 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1 px-2 rounded bg-indigo-100/55 text-indigo-700 font-black text-xs">PROF</div>
              <div>
                <h3 className="font-bold text-gray-800 text-sm">Profesiones y Ocupaciones</h3>
                <p className="text-[10px] text-gray-400">Médico, Químico Farmacéutico, Técnico, etc.</p>
              </div>
            </div>
            {!professionForm && (
              <button
                onClick={() => setProfessionForm({ name: '', description: '' })}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Nuevo
              </button>
            )}
          </div>

          {/* Form Overlay (Slide down / show inline) */}
          {professionForm && (
            <form onSubmit={handleSaveProfession} className="p-4 bg-indigo-50/30 border-b border-indigo-100/80 space-y-3 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-800 uppercase tracking-wider">
                  {professionForm.id ? 'Editar Profesión' : 'Nueva Profesión'}
                </span>
                <button
                  type="button"
                  onClick={() => setProfessionForm(null)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2.5">
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Nombre de Especialidad *</label>
                  <input
                    type="text" required
                    placeholder="Ej / Químico Farmacéutico"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900 font-semibold"
                    value={professionForm.name}
                    onChange={e => setProfessionForm({ ...professionForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-gray-600 uppercase mb-1">Descripción / Clasificación</label>
                  <input
                    type="text"
                    placeholder="Ej / Personal profesional de farmacia"
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900 font-medium"
                    value={professionForm.description}
                    onChange={e => setProfessionForm({ ...professionForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setProfessionForm(null)}
                  className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingProfession}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingProfession ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          )}

          {/* Search bar */}
          <div className="p-3 border-b border-gray-100 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar profesión..."
              className="w-full text-xs text-gray-800 bg-transparent outline-none font-medium"
              value={professionSearch}
              onChange={e => setProfessionSearch(e.target.value)}
            />
          </div>

          {/* List content */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredProfessions.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No se encontraron profesiones.</div>
            ) : (
              filteredProfessions.map(p => (
                <div key={p.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-0.5 max-w-[75%]">
                    <span className="font-bold text-xs text-gray-800 block">{p.name}</span>
                    <span className="text-[10px] text-gray-400 block break-words leading-relaxed">{p.description || 'Sin descripción'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setProfessionForm(p)}
                      title="Editar"
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteProfession(p.id, p.name)}
                        title="Eliminar"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
