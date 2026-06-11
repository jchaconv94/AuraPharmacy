import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/api';
import { HealthFacility, Unget, Diresa, Ogess, Microred } from '../types';
import { Building2, Plus, Edit, Trash2, MapPin, Search, ChevronLeft, ChevronRight, Save, X, Network, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { CustomSelect } from './ui/CustomSelect';

export const AdminOrganizationModule: React.FC = () => {
    const { user } = useAuth();
    const [diresas, setDiresas] = useState<Diresa[]>([]);
    const [ogess, setOgess] = useState<Ogess[]>([]);
    const [ungets, setUngets] = useState<Unget[]>([]);
    const [microredes, setMicroredes] = useState<Microred[]>([]);
    const [facilities, setFacilities] = useState<HealthFacility[]>([]);
    
    const [isLoading, setIsLoading] = useState(true);
    const userRole = user?.role || '';
    
    const availableTabs = useMemo(() => {
        if (userRole === 'ADMIN') return ['DIRESA', 'OGESS', 'UNGET', 'MICRORED', 'IPRESS'];
        if (userRole === 'DIRESA') return ['DIRESA', 'OGESS', 'UNGET', 'MICRORED', 'IPRESS'];
        if (userRole === 'OGESS') return ['OGESS', 'UNGET', 'MICRORED', 'IPRESS'];
        if (userRole === 'UNGET') return ['UNGET', 'MICRORED', 'IPRESS'];
        return [];
    }, [userRole]);

    const [activeTab, setActiveTab] = useState<'DIRESA' | 'OGESS' | 'UNGET' | 'MICRORED' | 'IPRESS'>(
        availableTabs.length > 0 ? (availableTabs[0] as any) : 'DIRESA'
    );

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0] as any);
        }
    }, [availableTabs, activeTab]);

    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [isDiresaModalOpen, setIsDiresaModalOpen] = useState(false);
    const [isOgessModalOpen, setIsOgessModalOpen] = useState(false);
    const [isUngetModalOpen, setIsUngetModalOpen] = useState(false);
    const [isMicroredModalOpen, setIsMicroredModalOpen] = useState(false);
    const [isFacilityModalOpen, setIsFacilityModalOpen] = useState(false);
    const [facilityModalStep, setFacilityModalStep] = useState(1);

    // Multi-step States
    const [diresaModalStep, setDiresaModalStep] = useState(1);
    const [ogessModalStep, setOgessModalStep] = useState(1);
    const [ungetModalStep, setUngetModalStep] = useState(1);

    // Form States
    const [diresaForm, setDiresaForm] = useState<Partial<Diresa>>({});
    const [ogessForm, setOgessForm] = useState<Partial<Ogess>>({});
    const [ungetForm, setUngetForm] = useState<Partial<Unget>>({});
    const [microredForm, setMicroredForm] = useState<Partial<Microred>>({});
    const [facilityForm, setFacilityForm] = useState<Partial<HealthFacility>>({});

    // DIRESA step validations
    const isDiresaStep1Valid = useMemo(() => {
        return !!diresaForm.name?.trim() && 
               !!diresaForm.ruc?.trim();
    }, [diresaForm.name, diresaForm.ruc]);

    const isDiresaStep2Valid = useMemo(() => {
        return !!diresaForm.district?.trim() && 
               !!diresaForm.province?.trim() && 
               !!diresaForm.department?.trim();
    }, [diresaForm.district, diresaForm.province, diresaForm.department]);

    // OGESS step validations
    const isOgessStep1Valid = useMemo(() => {
        return !!ogessForm.name?.trim() && 
               !!ogessForm.diresaId && 
               !!ogessForm.code?.trim();
    }, [ogessForm.name, ogessForm.diresaId, ogessForm.code]);

    const isOgessStep2Valid = useMemo(() => {
        return !!ogessForm.district?.trim() && 
               !!ogessForm.province?.trim();
    }, [ogessForm.district, ogessForm.province]);

    // UNGET step validations
    const isUngetStep1Valid = useMemo(() => {
        return !!ungetForm.name?.trim() && 
               (!!ungetForm.ogessId || !!ungetForm.diresaId);
    }, [ungetForm.name, ungetForm.ogessId, ungetForm.diresaId]);

    const isUngetStep2Valid = useMemo(() => {
        return !!ungetForm.district?.trim() && 
               !!ungetForm.province?.trim();
    }, [ungetForm.district, ungetForm.province]);

    // Facility step validations
    const isFacilityStep1Valid = useMemo(() => {
        return !!facilityForm.code?.trim() && 
               !!facilityForm.name?.trim() && 
               !!facilityForm.category?.trim() && 
               !!facilityForm.type;
    }, [facilityForm.code, facilityForm.name, facilityForm.category, facilityForm.type]);

    const isFacilityStep2Valid = useMemo(() => {
        return !!facilityForm.microredId || 
               !!facilityForm.ungetId || 
               !!facilityForm.ogessId || 
               !!facilityForm.diresaId;
    }, [facilityForm.microredId, facilityForm.ungetId, facilityForm.ogessId, facilityForm.diresaId]);

    const isFacilityStep3Valid = useMemo(() => {
        return !!facilityForm.district?.trim() && 
               !!facilityForm.province?.trim();
    }, [facilityForm.district, facilityForm.province]);

    // Hierarchy Locks for non-ADMIN users
    const isSuperAdmin = user?.role === 'ADMIN';

    const userFacilityCode = user?.personnelData?.facilityCode || user?.facilityData?.code || (user as any)?.facilityCode;

    const userUngetId = useMemo(() => {
        const uUnget = user?.personnelData?.ungetId || user?.facilityData?.ungetId || (user as any)?.ungetId;
        if (uUnget) return uUnget;
        if (userFacilityCode) {
            const fac = facilities.find(f => f.code === userFacilityCode);
            if (fac?.ungetId) return fac.ungetId;
        }
        const uMicro = user?.personnelData?.microredId || user?.facilityData?.microredId || (user as any)?.microredId;
        if (uMicro) {
            const mic = microredes.find(m => m.id === uMicro);
            if (mic?.ungetId) return mic.ungetId;
        }
        return '';
    }, [user, userFacilityCode, facilities, microredes]);

    const userOgessId = useMemo(() => {
        const uOgess = user?.personnelData?.ogessId || user?.facilityData?.ogessId || (user as any)?.ogessId;
        if (uOgess) return uOgess;
        if (userUngetId) {
            const ung = ungets.find(u => u.id === userUngetId);
            if (ung?.ogessId) return ung.ogessId;
        }
        if (userFacilityCode) {
            const fac = facilities.find(f => f.code === userFacilityCode);
            if (fac?.ogessId) return fac.ogessId;
        }
        return '';
    }, [user, userUngetId, userFacilityCode, ungets, facilities]);

    const userDiresaId = useMemo(() => {
        const uDiresa = user?.personnelData?.diresaId || user?.facilityData?.diresaId || (user as any)?.diresaId;
        if (uDiresa) return uDiresa;
        if (userOgessId) {
            const og = ogess.find(o => o.id === userOgessId);
            if (og?.diresaId) return og.diresaId;
        }
        if (userUngetId) {
            const ung = ungets.find(u => u.id === userUngetId);
            if (ung?.diresaId) return ung.diresaId;
        }
        if (userFacilityCode) {
            const fac = facilities.find(f => f.code === userFacilityCode);
            if (fac?.diresaId) return fac.diresaId;
        }
        return '';
    }, [user, userOgessId, userUngetId, userFacilityCode, ogess, ungets, facilities]);

    const userMicroredId = useMemo(() => {
        return user?.personnelData?.microredId || user?.facilityData?.microredId || (user as any)?.microredId || '';
    }, [user]);

    const canAddActiveTab = useMemo(() => {
        if (isSuperAdmin) return true;
        if (activeTab === 'DIRESA') return false;
        if (activeTab === 'OGESS') return userRole === 'DIRESA';
        if (activeTab === 'UNGET') return ['DIRESA', 'OGESS'].includes(userRole);
        if (activeTab === 'MICRORED') return ['DIRESA', 'OGESS', 'UNGET'].includes(userRole);
        if (activeTab === 'IPRESS') return ['DIRESA', 'OGESS', 'UNGET'].includes(userRole);
        return false;
    }, [activeTab, isSuperAdmin, userRole]);

    // Filtered lists shown in tables
    const visibleDiresas = useMemo(() => {
        if (isSuperAdmin) return diresas;
        if (userDiresaId) return diresas.filter(d => d.id === userDiresaId);
        return diresas;
    }, [diresas, isSuperAdmin, userDiresaId]);

    const visibleOgess = useMemo(() => {
        if (isSuperAdmin) return ogess;
        if (userOgessId) return ogess.filter(o => o.id === userOgessId);
        if (userDiresaId) return ogess.filter(o => o.diresaId === userDiresaId);
        return ogess;
    }, [ogess, isSuperAdmin, userOgessId, userDiresaId]);

    const visibleUngets = useMemo(() => {
        if (isSuperAdmin) return ungets;
        if (userUngetId) return ungets.filter(u => u.id === userUngetId);
        if (userOgessId) return ungets.filter(u => u.ogessId === userOgessId);
        if (userDiresaId) {
            return ungets.filter(u => {
                if (u.diresaId === userDiresaId) return true;
                if (u.ogessId) {
                    const parentOgess = ogess.find(o => o.id === u.ogessId);
                    return parentOgess?.diresaId === userDiresaId;
                }
                return false;
            });
        }
        return ungets;
    }, [ungets, ogess, isSuperAdmin, userUngetId, userOgessId, userDiresaId]);

    const visibleMicroredes = useMemo(() => {
        if (isSuperAdmin) return microredes;
        if (userUngetId) return microredes.filter(m => m.ungetId === userUngetId);
        if (userOgessId) {
            return microredes.filter(m => {
                const parentUnget = ungets.find(u => u.id === m.ungetId);
                return parentUnget?.ogessId === userOgessId;
            });
        }
        if (userDiresaId) {
            return microredes.filter(m => {
                const parentUnget = ungets.find(u => u.id === m.ungetId);
                if (!parentUnget) return false;
                if (parentUnget.diresaId === userDiresaId) return true;
                if (parentUnget.ogessId) {
                    const parentOgess = ogess.find(o => o.id === parentUnget.ogessId);
                    return parentOgess?.diresaId === userDiresaId;
                }
                return false;
            });
        }
        return microredes;
    }, [microredes, ungets, ogess, isSuperAdmin, userUngetId, userOgessId, userDiresaId]);

    const visibleFacilities = useMemo(() => {
        if (isSuperAdmin) return facilities;
        return facilities.filter(f => {
            if (userUngetId && f.ungetId !== userUngetId) return false;
            if (userOgessId && f.ogessId !== userOgessId) return false;
            if (userDiresaId && f.diresaId !== userDiresaId) return false;
            return true;
        });
    }, [facilities, isSuperAdmin, userUngetId, userOgessId, userDiresaId]);

    // Dynamic Select lists reactive to form state and locks
    const ogessOptions = useMemo(() => {
        let list = visibleOgess;
        if (facilityForm.diresaId) {
            list = list.filter(o => o.diresaId === facilityForm.diresaId);
        }
        return list;
    }, [visibleOgess, facilityForm.diresaId]);

    const ungetOptions = useMemo(() => {
        let list = visibleUngets;
        if (facilityForm.ogessId) {
            list = list.filter(u => u.ogessId === facilityForm.ogessId);
        } else if (facilityForm.diresaId) {
            list = list.filter(u => {
                if (u.diresaId === facilityForm.diresaId) return true;
                if (u.ogessId) {
                    const parentOgess = ogess.find(o => o.id === u.ogessId);
                    return parentOgess?.diresaId === facilityForm.diresaId;
                }
                return false;
            });
        }
        return list;
    }, [visibleUngets, facilityForm.ogessId, facilityForm.diresaId, ogess]);

    const microredOptions = useMemo(() => {
        let list = visibleMicroredes;
        if (facilityForm.ungetId) {
            list = list.filter(m => m.ungetId === facilityForm.ungetId);
        }
        return list;
    }, [visibleMicroredes, facilityForm.ungetId]);

    const fetchData = async () => {
        setIsLoading(true);
        const [dir, ogs, ung, mic, facs] = await Promise.all([
            api.getDiresas(),
            api.getOgess(),
            api.getUngets(),
            api.getMicroredes(),
            api.getFacilities()
        ]);
        setDiresas(dir);
        setOgess(ogs);
        setUngets(ung);
        setMicroredes(mic);
        setFacilities(facs);
        setIsLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- DIRESA CRUD --- //
    const handleSaveDiresa = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const res = await api.saveDiresa(diresaForm);
        if (res.success) { toast.success('Guardado correctamente'); setIsDiresaModalOpen(false); fetchData(); }
        else toast.error(res.message);
    };
    const handleDeleteDiresa = async (id: string) => {
        const item = diresas.find(d => d.id === id);
        const name = item ? item.name : id;
        toast(`¿Eliminar DIRESA "${name}"?`, {
            description: "Esta acción eliminará toda la estructura y establecimientos dependientes.",
            action: {
                label: "Eliminar",
                onClick: async () => {
                    const res = await api.deleteDiresa(id);
                    if (res.success) { toast.success('DIRESA eliminada'); fetchData(); }
                    else toast.error(res.message);
                }
            }
        });
    };

    // --- OGESS CRUD --- //
    const handleSaveOgess = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const res = await api.saveOgess(ogessForm);
        if (res.success) { toast.success('Guardado correctamente'); setIsOgessModalOpen(false); fetchData(); }
        else toast.error(res.message);
    };
    const handleDeleteOgess = async (id: string) => {
        const item = ogess.find(o => o.id === id);
        const name = item ? item.name : id;
        toast(`¿Eliminar OGESS "${name}"?`, {
            description: "Esta acción eliminará toda la estructura y establecimientos dependientes.",
            action: {
                label: "Eliminar",
                onClick: async () => {
                    const res = await api.deleteOgess(id);
                    if (res.success) { toast.success('OGESS eliminada'); fetchData(); }
                    else toast.error(res.message);
                }
            }
        });
    };

    // --- UNGET CRUD --- //
    const handleSaveUnget = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const res = await api.saveUnget(ungetForm);
        if (res.success) { toast.success('Guardado correctamente'); setIsUngetModalOpen(false); fetchData(); }
        else toast.error(res.message);
    };
    const handleDeleteUnget = async (id: string) => {
        const item = ungets.find(u => u.id === id);
        const name = item ? item.name : id;
        toast(`¿Eliminar UNGET "${name}"?`, {
            description: "Esta acción eliminará toda la estructura y establecimientos dependientes.",
            action: {
                label: "Eliminar",
                onClick: async () => {
                    const res = await api.deleteUnget(id);
                    if (res.success) { toast.success('UNGET eliminada'); fetchData(); }
                    else toast.error(res.message);
                }
            }
        });
    };

    // --- MICRORED CRUD --- //
    const handleSaveMicrored = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const res = await api.saveMicrored(microredForm);
        if (res.success) { toast.success('Guardado correctamente'); setIsMicroredModalOpen(false); fetchData(); }
        else toast.error(res.message);
    };
    const handleDeleteMicrored = async (id: string) => {
        const item = microredes.find(m => m.id === id);
        const name = item ? item.name : id;
        toast(`¿Eliminar MICRORED "${name}"?`, {
            description: "Esta acción eliminará referencias a ella en establecimientos.",
            action: {
                label: "Eliminar",
                onClick: async () => {
                    const res = await api.deleteMicrored(id);
                    if (res.success) { toast.success('MICRORED eliminada'); fetchData(); }
                    else toast.error(res.message);
                }
            }
        });
    };

    // --- IPRESS CRUD --- //
    const handleMicroredChange = (microredId: string) => {
        let updatedForm = { 
            ...facilityForm, 
            microredId,
            ungetId: '',
            ogessId: '',
            diresaId: '',
            department: ''
        };
        
        if (microredId) {
            const selectedMicrored = microredes.find(m => m.id === microredId);
            if (selectedMicrored && selectedMicrored.ungetId) {
                updatedForm.ungetId = selectedMicrored.ungetId;
                
                const selectedUnget = ungets.find(u => u.id === selectedMicrored.ungetId);
                if (selectedUnget) {
                    let diresaIdToUse = selectedUnget.diresaId;
                    if (selectedUnget.ogessId) {
                        updatedForm.ogessId = selectedUnget.ogessId;
                        
                        const selectedOgess = ogess.find(o => o.id === selectedUnget.ogessId);
                        if (selectedOgess) {
                            updatedForm.diresaId = selectedOgess.diresaId;
                            diresaIdToUse = selectedOgess.diresaId;
                        }
                    } else if (selectedUnget.diresaId) {
                        updatedForm.diresaId = selectedUnget.diresaId;
                    }
                    
                    if (diresaIdToUse) {
                        const selectedDiresa = diresas.find(d => d.id === diresaIdToUse);
                        if (selectedDiresa) {
                            updatedForm.department = selectedDiresa.department || '';
                        }
                    }
                }
            }
        }
        
        setFacilityForm(updatedForm);
    };

    const handleUngetChange = (ungetId: string) => {
        let updatedForm = { 
            ...facilityForm, 
            ungetId,
            ogessId: '',
            diresaId: '',
            department: ''
        };

        if (ungetId) {
            const selectedUnget = ungets.find(u => u.id === ungetId);
            if (selectedUnget) {
                let diresaIdToUse = selectedUnget.diresaId;
                if (selectedUnget.ogessId) {
                    updatedForm.ogessId = selectedUnget.ogessId;
                    const selectedOgess = ogess.find(o => o.id === selectedUnget.ogessId);
                    if (selectedOgess) {
                        updatedForm.diresaId = selectedOgess.diresaId;
                        diresaIdToUse = selectedOgess.diresaId;
                    }
                } else if (selectedUnget.diresaId) {
                    updatedForm.diresaId = selectedUnget.diresaId;
                }

                if (diresaIdToUse) {
                    const selectedDiresa = diresas.find(d => d.id === diresaIdToUse);
                    if (selectedDiresa) {
                        updatedForm.department = selectedDiresa.department || '';
                    }
                }
            }
        }

        setFacilityForm(updatedForm);
    };

    const handleDiresaChange = (diresaId: string) => {
        let updatedForm = { 
            ...facilityForm, 
            diresaId,
            department: ''
        };

        if (diresaId) {
            const selectedDiresa = diresas.find(d => d.id === diresaId);
            if (selectedDiresa) {
                updatedForm.department = selectedDiresa.department || '';
            }
        }
        setFacilityForm(updatedForm);
    };

    const handleOgessChange = (ogessId: string) => {
        let updatedForm = { 
            ...facilityForm, 
            ogessId,
            diresaId: '',
            department: ''
        };

        if (ogessId) {
            const selectedOgess = ogess.find(o => o.id === ogessId);
            if (selectedOgess) {
                updatedForm.diresaId = selectedOgess.diresaId;
                if (selectedOgess.diresaId) {
                    const selectedDiresa = diresas.find(d => d.id === selectedOgess.diresaId);
                    if (selectedDiresa) {
                        updatedForm.department = selectedDiresa.department || '';
                    }
                }
            }
        }
        setFacilityForm(updatedForm);
    };

    const handleSaveFacility = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const res = await api.saveFacility(facilityForm as HealthFacility);
        if (res.success) { toast.success('Guardado correctamente'); setIsFacilityModalOpen(false); fetchData(); }
        else toast.error(res.message);
    };
    const handleDeleteFacility = async (code: string) => {
        const item = facilities.find(f => f.code === code);
        const name = item ? item.name : code;
        toast(`¿Eliminar IPRESS "${name}" (${code})?`, {
            description: "Esta acción no se puede deshacer.",
            action: {
                label: "Eliminar",
                onClick: async () => {
                    const res = await api.deleteFacility(code);
                    if (res.success) { toast.success('IPRESS eliminada'); fetchData(); }
                    else toast.error(res.message);
                }
            }
        });
    };

    const getDiresaName = (id?: string) => diresas.find(d => d.id === id)?.name || id || '-';
    const getOgessName = (id?: string) => ogess.find(o => o.id === id)?.name || id || '-';
    const getUngetName = (id?: string) => ungets.find(u => u.id === id)?.name || id || '-';
    const getMicroredName = (id?: string) => microredes.find(m => m.id === id)?.name || id || '-';

    return (
        <div className="space-y-6 animate-in fade-in">
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                <div className="flex gap-2 flex-wrap">
                    {availableTabs.length === 0 ? (
                        <div className="text-sm font-bold text-gray-500 py-2 px-4">No tiene accesos asignados a esta sección.</div>
                     ) : availableTabs.map(tab => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${activeTab === tab ? 'bg-white shadow text-teal-700' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {availableTabs.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center flex-wrap gap-4">
                        <div className="relative">
                            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input 
                                type="text"
                                placeholder={`Buscar en ${activeTab}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none w-64"
                            />
                        </div>
                        {canAddActiveTab && (
                        <button 
                            onClick={() => {
                            if (activeTab === 'DIRESA') { 
                                setDiresaForm({}); 
                                setDiresaModalStep(1);
                                setIsDiresaModalOpen(true); 
                            }
                            if (activeTab === 'OGESS') { 
                                const initialOgess: Partial<Ogess> = {};
                                if (!isSuperAdmin && userDiresaId) {
                                    initialOgess.diresaId = userDiresaId;
                                    const sDiresa = diresas.find(d => d.id === userDiresaId);
                                    if (sDiresa) initialOgess.department = sDiresa.department || '';
                                }
                                setOgessForm(initialOgess); 
                                setOgessModalStep(1);
                                setIsOgessModalOpen(true); 
                            }
                            if (activeTab === 'UNGET') { 
                                const initialUnget: Partial<Unget> = {};
                                if (!isSuperAdmin) {
                                    if (userOgessId) {
                                        initialUnget.ogessId = userOgessId;
                                        const sOgess = ogess.find(o => o.id === userOgessId);
                                        if (sOgess) {
                                            initialUnget.diresaId = sOgess.diresaId;
                                            const sDiresa = diresas.find(d => d.id === sOgess.diresaId);
                                            if (sDiresa) initialUnget.department = sDiresa.department || '';
                                        }
                                    } else if (userDiresaId) {
                                        initialUnget.diresaId = userDiresaId;
                                        const sDiresa = diresas.find(d => d.id === userDiresaId);
                                        if (sDiresa) initialUnget.department = sDiresa.department || '';
                                    }
                                }
                                setUngetForm(initialUnget); 
                                setUngetModalStep(1);
                                setIsUngetModalOpen(true); 
                            }
                            if (activeTab === 'MICRORED') { 
                                const initialMicrored: Partial<Microred> = {};
                                if (!isSuperAdmin && userUngetId) {
                                    initialMicrored.ungetId = userUngetId;
                                }
                                setMicroredForm(initialMicrored); 
                                setIsMicroredModalOpen(true); 
                            }
                            if (activeTab === 'IPRESS') { 
                                const initialFacility: Partial<HealthFacility> = {};
                                if (!isSuperAdmin) {
                                    if (userUngetId) {
                                        initialFacility.ungetId = userUngetId;
                                        const selectedUnget = ungets.find(u => u.id === userUngetId);
                                        if (selectedUnget) {
                                            let diresaIdToUse = selectedUnget.diresaId;
                                            if (selectedUnget.ogessId) {
                                                initialFacility.ogessId = selectedUnget.ogessId;
                                                const selectedOgess = ogess.find(o => o.id === selectedUnget.ogessId);
                                                if (selectedOgess) {
                                                    initialFacility.diresaId = selectedOgess.diresaId;
                                                    diresaIdToUse = selectedOgess.diresaId;
                                                }
                                            } else if (selectedUnget.diresaId) {
                                                initialFacility.diresaId = selectedUnget.diresaId;
                                            }
                                            if (diresaIdToUse) {
                                                const selectedDiresa = diresas.find(d => d.id === diresaIdToUse);
                                                if (selectedDiresa) {
                                                    initialFacility.department = selectedDiresa.department || '';
                                                }
                                            }
                                        }
                                    } else if (userOgessId) {
                                        initialFacility.ogessId = userOgessId;
                                        const selectedOgess = ogess.find(o => o.id === userOgessId);
                                        if (selectedOgess) {
                                            initialFacility.diresaId = selectedOgess.diresaId;
                                            if (selectedOgess.diresaId) {
                                                const selectedDiresa = diresas.find(d => d.id === selectedOgess.diresaId);
                                                if (selectedDiresa) {
                                                    initialFacility.department = selectedDiresa.department || '';
                                                }
                                            }
                                        }
                                    } else if (userDiresaId) {
                                        initialFacility.diresaId = userDiresaId;
                                        const selectedDiresa = diresas.find(d => d.id === userDiresaId);
                                        if (selectedDiresa) {
                                            initialFacility.department = selectedDiresa.department || '';
                                        }
                                    }
                                }
                                setFacilityForm(initialFacility); 
                                setFacilityModalStep(1);
                                setIsFacilityModalOpen(true); 
                            }
                        }}
                        className="flex items-center gap-2 bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-teal-700 transition"
                    >
                        <Plus className="h-4 w-4" /> Agregar Registro
                    </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    {activeTab === 'DIRESA' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Nombre DIRESA</th>
                                    <th className="p-4">RUC</th>
                                    <th className="p-4">Distrito</th>
                                    <th className="p-4">Provincia</th>
                                    <th className="p-4">Departamento</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleDiresas.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase())).map(d => (
                                    <tr key={d.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{d.name}</td>
                                        <td className="p-4 font-mono">{d.ruc || '-'}</td>
                                        <td className="p-4 text-gray-600">{d.district || '-'}</td>
                                        <td className="p-4 text-gray-600">{d.province || '-'}</td>
                                        <td className="p-4 text-gray-600">{d.department || '-'}</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            <button onClick={() => { setDiresaForm(d); setDiresaModalStep(1); setIsDiresaModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-600 border rounded shadow-sm"><Edit className="h-4 w-4" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => handleDeleteDiresa(d.id)} className="p-2 text-gray-400 hover:text-red-600 border rounded shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    
                    {activeTab === 'OGESS' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Nombre OGESS</th>
                                    <th className="p-4">Código / RUC</th>
                                    <th className="p-4">Distrito</th>
                                    <th className="p-4">Provincia</th>
                                    <th className="p-4">DIRESA</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleOgess.filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase())).map(o => (
                                    <tr key={o.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{o.name}</td>
                                        <td className="p-4 font-mono">{o.code || '-'} / {o.ruc || '-'}</td>
                                        <td className="p-4 text-gray-600">{o.district || '-'}</td>
                                        <td className="p-4 text-gray-600">{o.province || '-'}</td>
                                        <td className="p-4">{getDiresaName(o.diresaId)}</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            <button onClick={() => { setOgessForm(o); setOgessModalStep(1); setIsOgessModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-600 border rounded shadow-sm"><Edit className="h-4 w-4" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => handleDeleteOgess(o.id)} className="p-2 text-gray-400 hover:text-red-600 border rounded shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'UNGET' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Nombre UNGET</th>
                                    <th className="p-4">Distrito</th>
                                    <th className="p-4">Provincia</th>
                                    <th className="p-4">OGESS</th>
                                    <th className="p-4">DIRESA</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleUngets.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{u.name}</td>
                                        <td className="p-4 text-gray-600">{u.district || '-'}</td>
                                        <td className="p-4 text-gray-600">{u.province || '-'}</td>
                                        <td className="p-4">{getOgessName(u.ogessId)}</td>
                                        <td className="p-4">{getDiresaName(u.diresaId)}</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            <button onClick={() => { setUngetForm(u); setUngetModalStep(1); setIsUngetModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-600 border rounded shadow-sm"><Edit className="h-4 w-4" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => handleDeleteUnget(u.id)} className="p-2 text-gray-400 hover:text-red-600 border rounded shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'MICRORED' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Nombre MICRORED</th>
                                    <th className="p-4">UNGET Asignada</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleMicroredes.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase())).map(m => (
                                    <tr key={m.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{m.name}</td>
                                        <td className="p-4">{getUngetName(m.ungetId)}</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            <button onClick={() => { setMicroredForm(m); setIsMicroredModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-600 border rounded shadow-sm"><Edit className="h-4 w-4" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => handleDeleteMicrored(m.id)} className="p-2 text-gray-400 hover:text-red-600 border rounded shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'IPRESS' && (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4">Código</th>
                                    <th className="p-4">Establecimiento</th>
                                    <th className="p-4">Categoría</th>
                                    <th className="p-4">Microred</th>
                                    <th className="p-4">UNGET</th>
                                    <th className="p-4">OGESS</th>
                                    <th className="p-4 text-right">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {visibleFacilities.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.code.includes(searchQuery)).map(f => (
                                    <tr key={f.code} className="hover:bg-gray-50">
                                        <td className="p-4 font-mono">{f.code}</td>
                                        <td className="p-4 font-medium text-gray-900">{f.name}</td>
                                        <td className="p-4">
                                            <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">{f.category || '-'}</span>
                                        </td>
                                        <td className="p-4 text-gray-600">{getMicroredName(f.microredId)}</td>
                                        <td className="p-4 text-gray-600">{getUngetName(f.ungetId)}</td>
                                        <td className="p-4 text-gray-600">{getOgessName(f.ogessId)}</td>
                                        <td className="p-4 flex gap-2 justify-end">
                                            <button onClick={() => { setFacilityForm(f); setFacilityModalStep(1); setIsFacilityModalOpen(true); }} className="p-2 text-gray-400 hover:text-teal-600 border rounded shadow-sm"><Edit className="h-4 w-4" /></button>
                                            {isSuperAdmin && (
                                                <button onClick={() => handleDeleteFacility(f.code)} className="p-2 text-gray-400 hover:text-red-600 border rounded shadow-sm"><Trash2 className="h-4 w-4" /></button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            )}

               {/* Modals for Editing */}
            {isDiresaModalOpen && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-teal-600" />
                                    Mantenimiento de DIRESA
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Configure los datos de identificación, geografía y contacto de la Dirección Regional de Salud.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsDiresaModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-xl transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Premium Stepper Progress */}
                        <div className="px-6 py-5 border-b border-gray-50 bg-white relative flex items-center justify-between shrink-0">
                            <div className="absolute left-6 top-8 right-6 h-0.5 bg-gray-100 -z-10">
                                <div 
                                    className="h-full bg-teal-600 transition-all duration-300" 
                                    style={{ width: diresaModalStep === 1 ? '0%' : diresaModalStep === 2 ? '50%' : '100%' }}
                                />
                            </div>
                            {[
                                { step: 1, label: 'Identificación', desc: 'Nombre y RUC', icon: Building2 },
                                { step: 2, label: 'Ubicación', desc: 'Datos Geográficos', icon: Network },
                                { step: 3, label: 'Contacto', desc: 'Canales y Dirección', icon: Globe }
                            ].map(s => (
                                <button
                                    key={s.step}
                                    type="button"
                                    disabled={
                                        (s.step === 2 && !isDiresaStep1Valid) ||
                                        (s.step === 3 && (!isDiresaStep1Valid || !isDiresaStep2Valid))
                                    }
                                    onClick={() => setDiresaModalStep(s.step)}
                                    className="flex items-center gap-3 bg-white px-3 disabled:opacity-50 disabled:cursor-not-allowed group text-left outline-none"
                                >
                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${diresaModalStep === s.step ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100' : 'bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300'}`}>
                                        <s.icon className="h-4 w-4" />
                                    </div>
                                    <div className="hidden sm:block">
                                        <span className={`block text-[11px] font-bold uppercase tracking-wider ${diresaModalStep === s.step ? 'text-teal-700' : 'text-gray-400'}`}>{s.label}</span>
                                        <span className="block text-[10px] text-gray-400 font-medium">{s.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Form */}
                        <form 
                            onSubmit={(e) => e.preventDefault()} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {/* STEP 1: IDENTIFICACIÓN */}
                                {diresaModalStep === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Identificación Institucional
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la DIRESA *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Nombre (Ej. DIRESA SAN MARTIN)" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.name || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, name: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">RUC *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="RUC de la DIRESA (11 dígitos)" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.ruc || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, ruc: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: UBICACIÓN GEOGRÁFICA */}
                                {diresaModalStep === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Ubicación Geográfica
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Distrito / Ciudad *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Distrito o Ciudad de origen" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.district || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, district: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Provincia *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Provincia" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.province || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, province: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Departamento *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Departamento" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.department || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, department: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: DATOS DE CONTACTO */}
                                {diresaModalStep === 3 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Datos de Contacto (Opcional)
                                            </h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección Legal</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Dirección física legal" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={diresaForm.legalAddress || ''} 
                                                        onChange={e => setDiresaForm({...diresaForm, legalAddress: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Número de contacto institucional" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={diresaForm.phone || ''} 
                                                            onChange={e => setDiresaForm({...diresaForm, phone: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                                                        <input 
                                                            type="email" 
                                                            placeholder="ejemplo@minsa.gob.pe" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={diresaForm.email || ''} 
                                                            onChange={e => setDiresaForm({...diresaForm, email: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Sitio Web</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="https://..." 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={diresaForm.website || ''} 
                                                            onChange={e => setDiresaForm({...diresaForm, website: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Redes Sociales</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Enlaces oficiales" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={diresaForm.socialMedia || ''} 
                                                            onChange={e => setDiresaForm({...diresaForm, socialMedia: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                                {diresaModalStep > 1 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setDiresaModalStep(step => step - 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Atrás
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsDiresaModalOpen(false)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}

                                {diresaModalStep < 3 ? (
                                    <button 
                                        type="button" 
                                        disabled={diresaModalStep === 1 ? !isDiresaStep1Valid : !isDiresaStep2Valid}
                                        onClick={() => setDiresaModalStep(step => step + 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1 text-center"
                                    >
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => handleSaveDiresa()}
                                        className="px-6 py-2.5 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-teal-100"
                                    >
                                        <Save className="h-4 w-4" /> Guardar DIRESA
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {isOgessModalOpen && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-teal-600" />
                                    Mantenimiento de OGESS
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Configure los datos de identificación, jurisdicción regional y contacto de la OGESS.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsOgessModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-xl transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Progress Stepper */}
                        <div className="px-6 py-5 border-b border-gray-50 bg-white relative flex items-center justify-between shrink-0">
                            <div className="absolute left-6 top-8 right-6 h-0.5 bg-gray-100 -z-10">
                                <div 
                                    className="h-full bg-teal-600 transition-all duration-300" 
                                    style={{ width: ogessModalStep === 1 ? '0%' : ogessModalStep === 2 ? '50%' : '100%' }}
                                />
                            </div>
                            {[
                                { step: 1, label: 'Identificación', desc: 'Nombre, DIRESA y Código', icon: Building2 },
                                { step: 2, label: 'Ubicación', desc: 'Datos Geográficos', icon: Network },
                                { step: 3, label: 'Contacto', desc: 'Canales y Dirección', icon: Globe }
                            ].map(s => (
                                <button
                                    key={s.step}
                                    type="button"
                                    disabled={
                                        (s.step === 2 && !isOgessStep1Valid) ||
                                        (s.step === 3 && (!isOgessStep1Valid || !isOgessStep2Valid))
                                    }
                                    onClick={() => setOgessModalStep(s.step)}
                                    className="flex items-center gap-3 bg-white px-3 disabled:opacity-50 disabled:cursor-not-allowed group text-left outline-none"
                                >
                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${ogessModalStep === s.step ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100' : 'bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300'}`}>
                                        <s.icon className="h-4 w-4" />
                                    </div>
                                    <div className="hidden sm:block">
                                        <span className={`block text-[11px] font-bold uppercase tracking-wider ${ogessModalStep === s.step ? 'text-teal-700' : 'text-gray-400'}`}>{s.label}</span>
                                        <span className="block text-[10px] text-gray-400 font-medium">{s.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Form */}
                        <form 
                            onSubmit={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {/* STEP 1 */}
                                {ogessModalStep === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Identificación Institucional
                                            </h4>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la OGESS *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Ej. OGESS BAJO MAYO" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.name || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, name: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">DIRESA de Dependencia *</label>
                                                    <CustomSelect
                                                        disabled={!isSuperAdmin && !!userDiresaId}
                                                        value={ogessForm.diresaId || ''}
                                                        onChange={val => {
                                                            const dId = val;
                                                            const sDiresa = diresas.find(d => d.id === dId);
                                                            setOgessForm({
                                                                ...ogessForm,
                                                                diresaId: dId,
                                                                department: sDiresa ? sDiresa.department : ''
                                                            });
                                                        }}
                                                        placeholder="Selecciona DIRESA..."
                                                        options={[
                                                            { value: '', label: 'Selecciona DIRESA...' },
                                                            ...visibleDiresas.map(d => ({ value: d.id, label: d.name }))
                                                        ]}
                                                        className="w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Código Único OGESS *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Ingrese el código único" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.code || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, code: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">RUC</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Número de RUC (Opcional)" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.ruc || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, ruc: e.target.value})} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2 */}
                                {ogessModalStep === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Ubicación Geográfica
                                            </h4>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Distrito / Ciudad *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Distrito o Ciudad" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.district || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, district: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Provincia *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Provincia" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.province || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, province: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Departamento (Heredado)</label>
                                                    <input 
                                                        disabled 
                                                        type="text" 
                                                        placeholder="Automático de DIRESA" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-gray-100 text-gray-650 font-medium cursor-not-allowed outline-none" 
                                                        value={ogessForm.department || ''} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3 */}
                                {ogessModalStep === 3 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Datos de Contacto (Opcional)
                                            </h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección Legal</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Dirección legal" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ogessForm.legalAddress || ''} 
                                                        onChange={e => setOgessForm({...ogessForm, legalAddress: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Teléfono institucional" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ogessForm.phone || ''} 
                                                            onChange={e => setOgessForm({...ogessForm, phone: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                                                        <input 
                                                            type="email" 
                                                            placeholder="ejemplo@minsa.gob.pe" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ogessForm.email || ''} 
                                                            onChange={e => setOgessForm({...ogessForm, email: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Sitio Web</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="https://..." 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ogessForm.website || ''} 
                                                            onChange={e => setOgessForm({...ogessForm, website: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Redes Sociales</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Enlaces oficiales" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ogessForm.socialMedia || ''} 
                                                            onChange={e => setOgessForm({...ogessForm, socialMedia: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                                {ogessModalStep > 1 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setOgessModalStep(step => step - 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Atrás
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsOgessModalOpen(false)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}

                                {ogessModalStep < 3 ? (
                                    <button 
                                        type="button" 
                                        disabled={ogessModalStep === 1 ? !isOgessStep1Valid : !isOgessStep2Valid}
                                        onClick={() => setOgessModalStep(step => step + 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1 text-center"
                                    >
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => handleSaveOgess()}
                                        className="px-6 py-2.5 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-teal-100"
                                    >
                                        <Save className="h-4 w-4" /> Guardar OGESS
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {isUngetModalOpen && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-teal-600" />
                                    Mantenimiento de UNGET
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Configure los datos de la Unidad de Gestión Territorial (UNGET), su OGESS y canales de contacto.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsUngetModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-xl transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Progress Stepper */}
                        <div className="px-6 py-5 border-b border-gray-50 bg-white relative flex items-center justify-between shrink-0">
                            <div className="absolute left-6 top-8 right-6 h-0.5 bg-gray-100 -z-10">
                                <div 
                                    className="h-full bg-teal-600 transition-all duration-300" 
                                    style={{ width: ungetModalStep === 1 ? '0%' : ungetModalStep === 2 ? '50%' : '100%' }}
                                />
                            </div>
                            {[
                                { step: 1, label: 'Identificación', desc: 'Nombre, OGESS y DIRESA', icon: Building2 },
                                { step: 2, label: 'Ubicación', desc: 'Ubicación Geográfica', icon: Network },
                                { step: 3, label: 'Contacto', desc: 'Canales y Dirección', icon: Globe }
                            ].map(s => (
                                <button
                                    key={s.step}
                                    type="button"
                                    disabled={
                                        (s.step === 2 && !isUngetStep1Valid) ||
                                        (s.step === 3 && (!isUngetStep1Valid || !isUngetStep2Valid))
                                    }
                                    onClick={() => setUngetModalStep(s.step)}
                                    className="flex items-center gap-3 bg-white px-3 disabled:opacity-50 disabled:cursor-not-allowed group text-left outline-none"
                                >
                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${ungetModalStep === s.step ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100' : 'bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300'}`}>
                                        <s.icon className="h-4 w-4" />
                                    </div>
                                    <div className="hidden sm:block">
                                        <span className={`block text-[11px] font-bold uppercase tracking-wider ${ungetModalStep === s.step ? 'text-teal-700' : 'text-gray-400'}`}>{s.label}</span>
                                        <span className="block text-[10px] text-gray-400 font-medium">{s.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Form */}
                        <form 
                            onSubmit={(e) => e.preventDefault()}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {/* STEP 1 */}
                                {ungetModalStep === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Identificación Institucional
                                            </h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la UNGET *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Nombre de la UNGET (Ej. UNGET LAMAS)" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ungetForm.name || ''} 
                                                        onChange={e => setUngetForm({...ungetForm, name: e.target.value})} 
                                                    />
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">OGESS *</label>
                                                        <CustomSelect
                                                            disabled={!isSuperAdmin && !!userOgessId}
                                                            value={ungetForm.ogessId || ''}
                                                            onChange={val => {
                                                                const oId = val;
                                                                const sOgess = ogess.find(o => o.id === oId);
                                                                let dept = ungetForm.department || '';
                                                                let dId = ungetForm.diresaId;
                                                                if (sOgess) {
                                                                    dId = sOgess.diresaId;
                                                                    const sDiresa = diresas.find(d => d.id === sOgess.diresaId);
                                                                    if (sDiresa) dept = sDiresa.department || '';
                                                                } else {
                                                                    dId = '';
                                                                    dept = '';
                                                                }
                                                                setUngetForm({
                                                                    ...ungetForm,
                                                                    ogessId: oId,
                                                                    diresaId: dId,
                                                                    department: dept
                                                                });
                                                            }}
                                                            placeholder="Seleccione OGESS..."
                                                            options={[
                                                                { value: '', label: 'Seleccione OGESS...' },
                                                                ...visibleOgess.map(o => ({ value: o.id, label: o.name }))
                                                            ]}
                                                            className="w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 disabled:bg-gray-100 disabled:text-gray-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 mb-1">DIRESA</label>
                                                        <CustomSelect
                                                            disabled={!!ungetForm.ogessId || (!isSuperAdmin && !!userDiresaId)}
                                                            value={ungetForm.diresaId || ''}
                                                            onChange={val => {
                                                                const dId = val;
                                                                const sDiresa = diresas.find(d => d.id === dId);
                                                                setUngetForm({
                                                                    ...ungetForm,
                                                                    diresaId: dId,
                                                                    department: sDiresa ? sDiresa.department : ungetForm.department || ''
                                                                });
                                                            }}
                                                            placeholder="Selecciona DIRESA"
                                                            options={[
                                                                { value: '', label: 'Selecciona DIRESA' },
                                                                ...visibleDiresas.map(d => ({ value: d.id, label: d.name }))
                                                            ]}
                                                            className={`w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 ${(!!ungetForm.ogessId || (!isSuperAdmin && !!userDiresaId)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2 */}
                                {ungetModalStep === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Ubicación Geográfica
                                            </h4>

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Distrito / Ciudad *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Distrito o Ciudad" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ungetForm.district || ''} 
                                                        onChange={e => setUngetForm({...ungetForm, district: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Provincia *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Provincia" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ungetForm.province || ''} 
                                                        onChange={e => setUngetForm({...ungetForm, province: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Departamento (Heredado)</label>
                                                    <input 
                                                        disabled 
                                                        type="text" 
                                                        placeholder="Departamento automático" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-gray-100 text-gray-650 font-medium cursor-not-allowed outline-none" 
                                                        value={ungetForm.department || ''} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3 */}
                                {ungetModalStep === 3 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Datos de Contacto (Opcional)
                                            </h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección Legal</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Dirección legal" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={ungetForm.legalAddress || ''} 
                                                        onChange={e => setUngetForm({...ungetForm, legalAddress: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Teléfono institucional" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ungetForm.phone || ''} 
                                                            onChange={e => setUngetForm({...ungetForm, phone: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                                                        <input 
                                                            type="email" 
                                                            placeholder="ejemplo@minsa.gob.pe" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ungetForm.email || ''} 
                                                            onChange={e => setUngetForm({...ungetForm, email: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Sitio Web</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="https://..." 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ungetForm.website || ''} 
                                                            onChange={e => setUngetForm({...ungetForm, website: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Redes Sociales</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Enlaces oficiales" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={ungetForm.socialMedia || ''} 
                                                            onChange={e => setUngetForm({...ungetForm, socialMedia: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                                {ungetModalStep > 1 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setUngetModalStep(step => step - 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Atrás
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsUngetModalOpen(false)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}

                                {ungetModalStep < 3 ? (
                                    <button 
                                        type="button" 
                                        disabled={ungetModalStep === 1 ? !isUngetStep1Valid : !isUngetStep2Valid}
                                        onClick={() => setUngetModalStep(step => step + 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1 text-center"
                                    >
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => handleSaveUnget()}
                                        className="px-6 py-2.5 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-teal-100"
                                    >
                                        <Save className="h-4 w-4" /> Guardar UNGET
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {isMicroredModalOpen && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col border border-gray-100 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-teal-600" />
                                    Mantenimiento de MICRORED
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Configure los datos de la Microred de salud.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsMicroredModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-xl transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={(e) => e.preventDefault()} className="p-6 space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Nombre de la Microred *</label>
                                    <input 
                                        required 
                                        type="text" 
                                        placeholder="Nombre Microred (Ej. Microred Banda de Shilcayo)" 
                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                        value={microredForm.name || ''} 
                                        onChange={e => setMicroredForm({...microredForm, name: e.target.value})} 
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">UNGET Asociada *</label>
                                    <CustomSelect
                                        disabled={!isSuperAdmin && !!userUngetId}
                                        value={microredForm.ungetId || ''}
                                        onChange={val => {
                                            setMicroredForm({
                                                ...microredForm,
                                                ungetId: val
                                            });
                                        }}
                                        placeholder="Selecciona UNGET..."
                                        options={[
                                            { value: '', label: 'Selecciona UNGET...' },
                                            ...visibleUngets.map(u => ({ value: u.id, label: u.name }))
                                        ]}
                                        className="w-full border border-gray-250 rounded-lg text-sm bg-white text-gray-805 disabled:bg-gray-100 disabled:text-gray-500"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-104 mt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsMicroredModalOpen(false)} 
                                    className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 transition rounded-xl text-sm font-bold"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => handleSaveMicrored()}
                                    className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white transition rounded-xl text-sm font-bold shadow-md hover:shadow-teal-100"
                                >
                                    Guardar Microred
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {isFacilityModalOpen && createPortal(
                <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[92vh] overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-xl text-gray-900 tracking-tight flex items-center gap-2">
                                    <Building2 className="h-5 w-5 text-teal-600" />
                                    Mantenimiento de IPRESS
                                </h3>
                                <p className="text-xs text-gray-500 mt-1">Configure los datos de identificación, jurisdicción y canales de contacto de la IPRESS.</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsFacilityModalOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 rounded-xl transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Premium Stepper Progress */}
                        <div className="px-6 py-5 border-b border-gray-50 bg-white relative flex items-center justify-between shrink-0">
                            <div className="absolute left-6 top-8 right-6 h-0.5 bg-gray-100 -z-10">
                                <div 
                                    className="h-full bg-teal-600 transition-all duration-300" 
                                    style={{ width: facilityModalStep === 1 ? '0%' : facilityModalStep === 2 ? '50%' : '100%' }}
                                />
                            </div>
                            {[
                                { step: 1, label: 'Identificación', desc: 'Códigos y Categoría', icon: Building2 },
                                { step: 2, label: 'Jurisdicción', desc: 'Asociaciones y UNGET', icon: Network },
                                { step: 3, label: 'Ubicación y Contacto', desc: 'Geografía y Canales', icon: Globe }
                            ].map(s => (
                                <button
                                    key={s.step}
                                    type="button"
                                    disabled={
                                        (s.step === 2 && !isFacilityStep1Valid) ||
                                        (s.step === 3 && (!isFacilityStep1Valid || !isFacilityStep2Valid))
                                    }
                                    onClick={() => setFacilityModalStep(s.step)}
                                    className="flex items-center gap-3 bg-white px-3 disabled:opacity-50 disabled:cursor-not-allowed group text-left outline-none"
                                >
                                    <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs border-2 transition-all duration-300 ${facilityModalStep === s.step ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-100' : 'bg-gray-50 border-gray-200 text-gray-400 group-hover:border-gray-300'}`}>
                                        <s.icon className="h-4 w-4" />
                                    </div>
                                    <div className="hidden sm:block">
                                        <span className={`block text-[11px] font-bold uppercase tracking-wider ${facilityModalStep === s.step ? 'text-teal-700' : 'text-gray-400'}`}>{s.label}</span>
                                        <span className="block text-[10px] text-gray-400 font-medium">{s.desc}</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Form */}
                        <form 
                            onSubmit={(e) => e.preventDefault()} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                }
                            }}
                            className="flex-1 flex flex-col overflow-hidden"
                        >
                            <div className="p-6 overflow-y-auto space-y-6 flex-1">
                                {/* STEP 1: IDENTIFICACIÓN Y CATEGORÍA */}
                                {facilityModalStep === 1 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Datos de Identificación
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className="sm:col-span-1">
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Código (RENIPRESS) *</label>
                                                    <input 
                                                        required 
                                                        disabled={!!facilityForm.code && facilityForm.code !== '' && !isFacilityModalOpen} 
                                                        type="text" 
                                                        placeholder="Código RENIPRESS" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white disabled:bg-slate-100 text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.code || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, code: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de la IPRESS *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Nombre completo del establecimiento" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.name || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, name: e.target.value})} 
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Categoría *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Ej. I-3, I-4, II-1" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.category || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, category: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Tipo de Establecimiento *</label>
                                                    <CustomSelect
                                                        value={facilityForm.type || ''}
                                                        onChange={val => setFacilityForm({...facilityForm, type: val})}
                                                        placeholder="Seleccione tipo..."
                                                        options={[
                                                            { value: '', label: 'Seleccione tipo...' },
                                                            { value: 'HOSPITAL', label: 'HOSPITAL' },
                                                            { value: 'CENTRO', label: 'CENTRO DE SALUD' },
                                                            { value: 'PUESTO', label: 'PUESTO DE SALUD' },
                                                            { value: 'ALM', label: 'ALMACÉN' }
                                                        ]}
                                                        className="w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 2: JURISDICCIÓN / ASOCIACIONES JERÁRQUICAS */}
                                {facilityModalStep === 2 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Red y Dependencia Jerárquica
                                            </h4>

                                            <p className="text-xs text-gray-600 leading-relaxed bg-teal-50/80 p-3.5 rounded-xl border border-teal-100 font-medium">
                                                💡 <strong>Ayuda de Asignación:</strong> Al seleccionar una <strong>Microred</strong>, todo su árbol superior (UNGET, OGESS, DIRESA y Departamento) se heredará y rellenará en cascada automáticamente. También puede asignar individualmente los niveles según disponibilidad.
                                            </p>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Microred</label>
                                                    <CustomSelect
                                                        disabled={!isSuperAdmin && !!userMicroredId}
                                                        value={facilityForm.microredId || ''}
                                                        onChange={val => handleMicroredChange(val)}
                                                        placeholder="Selecciona MICRORED (Opcional)"
                                                        options={[
                                                            { value: '', label: 'Selecciona MICRORED (Opcional)' },
                                                            ...microredOptions.map(m => ({ value: m.id, label: m.name }))
                                                        ]}
                                                        className={`w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 ${(!isSuperAdmin && !!userMicroredId) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1" title={facilityForm.microredId ? "Asignado automáticamente de la Microred seleccionada" : "Selecciona la UNGET"}>UNGET *</label>
                                                    <CustomSelect
                                                        disabled={!!facilityForm.microredId || (!isSuperAdmin && !!userUngetId)}
                                                        value={facilityForm.ungetId || ''}
                                                        onChange={val => handleUngetChange(val)}
                                                        placeholder="Selecciona UNGET..."
                                                        options={[
                                                            { value: '', label: 'Selecciona UNGET...' },
                                                            ...ungetOptions.map(u => ({ value: u.id, label: u.name }))
                                                        ]}
                                                        className={`w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 ${(facilityForm.microredId || (!isSuperAdmin && !!userUngetId)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1" title={facilityForm.microredId || facilityForm.ungetId ? "Asignado automáticamente de la jerarquía seleccionada" : "Selecciona la OGESS"}>OGESS *</label>
                                                    <CustomSelect
                                                        disabled={!!facilityForm.microredId || !!facilityForm.ungetId || (!isSuperAdmin && !!userOgessId)}
                                                        value={facilityForm.ogessId || ''}
                                                        onChange={val => handleOgessChange(val)}
                                                        placeholder="Selecciona OGESS..."
                                                        options={[
                                                            { value: '', label: 'Selecciona OGESS...' },
                                                            ...ogessOptions.map(o => ({ value: o.id, label: o.name }))
                                                        ]}
                                                        className={`w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 ${(facilityForm.microredId || facilityForm.ungetId || (!isSuperAdmin && !!userOgessId)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1" title={facilityForm.microredId || facilityForm.ungetId || facilityForm.ogessId ? "Asignado de la jerarquía seleccionada" : "Selecciona la DIRESA"}>DIRESA *</label>
                                                    <CustomSelect
                                                        disabled={!!facilityForm.microredId || !!facilityForm.ungetId || !!facilityForm.ogessId || (!isSuperAdmin && !!userDiresaId)}
                                                        value={facilityForm.diresaId || ''}
                                                        onChange={val => handleDiresaChange(val)}
                                                        placeholder="Selecciona DIRESA..."
                                                        options={[
                                                            { value: '', label: 'Selecciona DIRESA...' },
                                                            ...visibleDiresas.map(d => ({ value: d.id, label: d.name }))
                                                        ]}
                                                        className={`w-full border border-gray-200 rounded-lg text-sm bg-white text-gray-800 ${(facilityForm.microredId || facilityForm.ungetId || facilityForm.ogessId || (!isSuperAdmin && !!userDiresaId)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* STEP 3: UBICACIÓN Y CONTACTO */}
                                {facilityModalStep === 3 && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-200">
                                        {/* Ubicación Geográfica */}
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Ubicación Geográfica
                                            </h4>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Distrito / Ciudad *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Distrito o Ciudad" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.district || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, district: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Provincia *</label>
                                                    <input 
                                                        required 
                                                        type="text" 
                                                        placeholder="Provincia" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.province || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, province: e.target.value})} 
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Departamento</label>
                                                    <input 
                                                        disabled 
                                                        type="text" 
                                                        placeholder="Derivado automáticamente" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-slate-100 text-gray-500 cursor-not-allowed font-medium" 
                                                        value={facilityForm.department || ''} 
                                                        title="Heredado automáticamente de la jerarquía seleccionada" 
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Datos de Contacto */}
                                        <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-100/80 space-y-4">
                                            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 flex items-center gap-1.5">
                                                <div className="w-1.5 h-3 bg-teal-500 rounded-sm" /> Datos de Contacto (Opcional)
                                            </h4>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-gray-700 mb-1">Dirección Legal</label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="Dirección física legal" 
                                                        className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                        value={facilityForm.legalAddress || ''} 
                                                        onChange={e => setFacilityForm({...facilityForm, legalAddress: e.target.value})} 
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Número telefónico" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={facilityForm.phone || ''} 
                                                            onChange={e => setFacilityForm({...facilityForm, phone: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                                                        <input 
                                                            type="email" 
                                                            placeholder="ejemplo@minsa.gob.pe" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={facilityForm.email || ''} 
                                                            onChange={e => setFacilityForm({...facilityForm, email: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Sitio Web</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="https://..." 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={facilityForm.website || ''} 
                                                            onChange={e => setFacilityForm({...facilityForm, website: e.target.value})} 
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-700 mb-1">Redes Sociales</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Enlaces a Facebook / Twitter" 
                                                            className="w-full border border-gray-200 p-2.5 rounded-lg text-sm bg-white text-gray-800 focus:ring-2 focus:ring-teal-500 outline-none" 
                                                            value={facilityForm.socialMedia || ''} 
                                                            onChange={e => setFacilityForm({...facilityForm, socialMedia: e.target.value})} 
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer Buttons */}
                            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                                {facilityModalStep > 1 ? (
                                    <button 
                                        type="button" 
                                        onClick={() => setFacilityModalStep(step => step - 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl transition-all flex items-center gap-1"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Atrás
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsFacilityModalOpen(false)} 
                                        className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-all"
                                    >
                                        Cancelar
                                    </button>
                                )}

                                {facilityModalStep < 3 ? (
                                    <button 
                                        type="button" 
                                        disabled={facilityModalStep === 1 ? !isFacilityStep1Valid : !isFacilityStep2Valid}
                                        onClick={() => setFacilityModalStep(step => step + 1)} 
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-1 text-center"
                                    >
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <button 
                                        type="button" 
                                        disabled={!isFacilityStep3Valid}
                                        onClick={() => handleSaveFacility()}
                                        className="px-6 py-2.5 text-sm font-black text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all flex items-center gap-2 shadow-lg hover:shadow-teal-100"
                                    >
                                        <Save className="h-4 w-4" /> Guardar IPRESS
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
