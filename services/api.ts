import { User, UserRole, Personnel, HealthFacility, RoleConfig, SystemConfig, Unget, Diresa, Ogess, Microred } from "../types";
import { supabase } from "./supabaseClient";
import bcrypt from "bcryptjs";

// MOCK DATA (Respaldo en caso de error de conexión/sin supabase)
const MOCK_DB = {
    users: [
        { username: 'admin', password: '123', role: 'ADMIN', personnelId: 'P001', isActive: true },
        { username: 'farmacia', password: '123', role: 'FARMACIA', personnelId: 'P002', isActive: true },
    ],
    personnel: [
        { id: 'P001', firstName: 'Aura', lastName: 'Admin', dni: '00000001', facilityCode: '00001', email: 'admin@aura.pe', phone: '987654321', laborRegime: 'D.L. 276', laborRegimeId: 'LR-276', professionId: 'PROF-QFAR' },
        { id: 'P002', firstName: 'Juan', lastName: 'Perez', dni: '12345678', facilityCode: '00002', email: 'juan@redsalud.pe', phone: '912345678', laborRegime: 'D.L. 1057 (CAS)', laborRegimeId: 'LR-1057', professionId: 'PROF-TECF' },
    ],
    facilities: [
        { code: '00001', name: 'DIRESA SEDE CENTRAL', category: 'ADM' },
        { code: '00002', name: 'C.S. MIRAFLORES', category: 'I-3' },
    ],
    roles: [
        { role: 'ADMIN', label: 'Administrador Total', allowedModules: ['DASHBOARD', 'ANALYSIS', 'ADMIN_USERS', 'ADMIN_ROLES', 'PROFILE', 'REDISTRIBUTION', 'SIG_SEARCH', 'ADMIN_STOCK_ASSIGN', 'IPRESS_STOCK'], maxUrlsAllowed: 10 },
        { role: 'FARMACIA', label: 'Responsable Farmacia', allowedModules: ['DASHBOARD', 'ANALYSIS', 'PROFILE', 'REDISTRIBUTION', 'IPRESS_STOCK'], maxUrlsAllowed: 1 }
    ],
    laborRegimes: [
        { id: 'LR-276', name: 'D.L. 276', description: 'Sector Público - Régimen de Carrera Administrativa' },
        { id: 'LR-1057', name: 'D.L. 1057 (CAS)', description: 'Contrato Administrativo de Servicios' },
        { id: 'LR-1153', name: 'D.L. 1153', description: 'Régimen de Personal de la Salud' },
        { id: 'LR-728', name: 'D.L. 728', description: 'Régimen de la Actividad Privada' },
        { id: 'LR-LOC', name: 'Locación de Servicios', description: 'Contratación de Terceros / Locadores' }
    ],
    professions: [
        { id: 'PROF-MED', name: 'Médico Cirujano', description: 'Profesional de la medicina' },
        { id: 'PROF-QFAR', name: 'Químico Farmacéutico', description: 'Especialista en medicamentos esenciales' },
        { id: 'PROF-ENF', name: 'Lic. Enfermería', description: 'Cuidado quirúrgico o primario' },
        { id: 'PROF-OBST', name: 'Lic. Obstetricia', description: 'Atención obstétrica' },
        { id: 'PROF-TECF', name: 'Técnico en Farmacia', description: 'Apoyo en dispensación y almacén' }
    ],
    defaultConfig: {
        verificationDelaySeconds: 5,
        apiUrl: ""
    } as SystemConfig
};

// Variable cache
let usersCache: any[] | null = null;

export const api = {
    login: async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
        try {
            if (supabase) {
                const { data: userRecord, error } = await supabase
                    .from("users")
                    .select("*, personnel:personnel_id(*, facilities:facility_code(*), labor_regimes:labor_regime_id(*), professions:profession_id(*)), roles_config:role(*)")
                    .eq("username", username)
                    .single();

                if (error || !userRecord) return { success: false, message: "Usuario o contraseña incorrectos." };

                if (!userRecord.is_active) {
                    return { success: false, message: "Su cuenta ha sido desactivada. Contacte al administrador." };
                }

                const isValid = bcrypt.compareSync(password, userRecord.password_hash);
                if (!isValid) return { success: false, message: "Usuario o contraseña incorrectos." };

                const personnelData = Array.isArray(userRecord.personnel) ? userRecord.personnel[0] : userRecord.personnel;
                const roleConfig = Array.isArray(userRecord.roles_config) ? userRecord.roles_config[0] : userRecord.roles_config;
                const facilityData = personnelData ? (Array.isArray(personnelData.facilities) ? personnelData.facilities[0] : personnelData.facilities) : null;

                return {
                    success: true,
                    user: {
                        username: userRecord.username,
                        role: userRecord.role,
                        personnelId: userRecord.personnel_id,
                        isActive: userRecord.is_active,
                        personnelData: personnelData ? {
                            id: personnelData.id,
                            firstName: personnelData.first_name,
                            lastName: personnelData.last_name,
                            dni: personnelData.dni,
                            phone: personnelData.phone,
                            email: personnelData.email,
                            laborRegime: personnelData.labor_regime,
                            laborRegimeId: personnelData.labor_regime_id,
                            professionId: personnelData.profession_id,
                            laborRegimeData: personnelData.labor_regimes ? (Array.isArray(personnelData.labor_regimes) ? personnelData.labor_regimes[0] : personnelData.labor_regimes) : undefined,
                            professionData: personnelData.professions ? (Array.isArray(personnelData.professions) ? personnelData.professions[0] : personnelData.professions) : undefined,
                            facilityCode: personnelData.facility_code,
                            diresaId: personnelData.diresa_id,
                            ogessId: personnelData.ogess_id,
                            ungetId: personnelData.unget_id,
                            microredId: personnelData.microred_id
                        } : undefined as any,
                        facilityData: facilityData ? {
                            code: facilityData.code,
                            name: facilityData.name,
                            category: facilityData.category,
                            ungetId: facilityData.unget_id,
                            diresaId: facilityData.diresa_id,
                            ogessId: facilityData.ogess_id,
                            microredId: facilityData.microred_id
                        } : undefined as any,
                        permissions: roleConfig ? roleConfig.allowed_modules : [],
                        maxUrlsAllowed: roleConfig ? roleConfig.max_urls_allowed : 0
                    }
                };
            }
            throw new Error("Supabase is missing");
        } catch (e) {
            console.warn("Offline fallback login:", e);
            const authUser = MOCK_DB.users.find(u => u.username.toLowerCase() === username.toLowerCase());
            if (authUser && authUser.password === password) {
                if (authUser.isActive) {
                    const personnel = MOCK_DB.personnel.find(p => p.id === authUser.personnelId);
                    const facility = MOCK_DB.facilities.find(f => f.code === personnel?.facilityCode);
                    const roleConfig = MOCK_DB.roles.find(r => r.role === authUser.role);
                    return {
                        success: true,
                        user: {
                            username: authUser.username,
                            role: authUser.role as UserRole,
                            personnelId: authUser.personnelId,
                            isActive: authUser.isActive,
                            personnelData: personnel as Personnel,
                            facilityData: facility as HealthFacility,
                            permissions: roleConfig ? roleConfig.allowedModules as any : []
                        },
                        message: "Modo Offline"
                    };
                }
            }
            return { success: false, message: "Error conectando al servidor." };
        }
    },

    refreshSession: async (username: string): Promise<{ success: boolean; user?: User; message?: string }> => {
        try {
            if (supabase) {
                const { data: userRecord, error } = await supabase
                    .from("users")
                    .select("*, personnel:personnel_id(*, facilities:facility_code(*), labor_regimes:labor_regime_id(*), professions:profession_id(*)), roles_config:role(*)")
                    .eq("username", username)
                    .single();

                if (error || !userRecord) return { success: false, message: "User not found" };

                const personnelData = Array.isArray(userRecord.personnel) ? userRecord.personnel[0] : userRecord.personnel;
                const roleConfig = Array.isArray(userRecord.roles_config) ? userRecord.roles_config[0] : userRecord.roles_config;
                const facilityData = personnelData ? (Array.isArray(personnelData.facilities) ? personnelData.facilities[0] : personnelData.facilities) : null;

                return {
                    success: true,
                    user: {
                        username: userRecord.username,
                        role: userRecord.role,
                        personnelId: userRecord.personnel_id,
                        isActive: userRecord.is_active,
                        personnelData: personnelData ? {
                            id: personnelData.id,
                            firstName: personnelData.first_name,
                            lastName: personnelData.last_name,
                            dni: personnelData.dni,
                            phone: personnelData.phone,
                            email: personnelData.email,
                            laborRegime: personnelData.labor_regime,
                            laborRegimeId: personnelData.labor_regime_id,
                            professionId: personnelData.profession_id,
                            laborRegimeData: personnelData.labor_regimes ? (Array.isArray(personnelData.labor_regimes) ? personnelData.labor_regimes[0] : personnelData.labor_regimes) : undefined,
                            professionData: personnelData.professions ? (Array.isArray(personnelData.professions) ? personnelData.professions[0] : personnelData.professions) : undefined,
                            facilityCode: personnelData.facility_code,
                            diresaId: personnelData.diresa_id,
                            ogessId: personnelData.ogess_id,
                            ungetId: personnelData.unget_id,
                            microredId: personnelData.microred_id
                        } : undefined as any,
                        facilityData: facilityData ? {
                            code: facilityData.code,
                            name: facilityData.name,
                            category: facilityData.category,
                            ungetId: facilityData.unget_id,
                            diresaId: facilityData.diresa_id,
                            ogessId: facilityData.ogess_id,
                            microredId: facilityData.microred_id
                        } : undefined as any,
                        permissions: roleConfig ? roleConfig.allowed_modules : [],
                        maxUrlsAllowed: roleConfig ? roleConfig.max_urls_allowed : 0
                    }
                };
            }
        } catch (e) {
            console.warn("Refresh fallback", e);
        }
        return { success: false };
    },

    updateProfile: async (personnelId: string, data: any) => {
        try {
            usersCache = null;
            if (supabase) {
                const { error: pError } = await supabase.from('personnel').update({
                    first_name: data.firstName,
                    last_name: data.lastName,
                    dni: data.dni,
                    phone: data.phone,
                    email: data.email,
                    labor_regime_id: data.laborRegimeId || null,
                    profession_id: data.professionId || null
                }).eq('id', personnelId);
                
                const userUpdateData: any = {};
                if (data.username) {
                    userUpdateData.username = data.username;
                }
                if (data.password) {
                    const salt = bcrypt.genSaltSync(10);
                    const pt = typeof data.password === 'string' ? data.password : String(data.password);
                    userUpdateData.password_hash = bcrypt.hashSync(pt, salt);
                }
                
                if (Object.keys(userUpdateData).length > 0) {
                    await supabase.from('users').update(userUpdateData).eq('personnel_id', personnelId);
                }
                
                if (!pError) return { success: true };
            }
            return { success: false, message: "Error al actualizar." };
        } catch(e) {
            return { success: false, message: "Error local." };
        }
    },

    getUsers: async (forceRefresh = false) => {
        if (usersCache && !forceRefresh) return usersCache;
        try {
            if (supabase) {
                const { data, error } = await supabase
                    .from("users")
                    .select("*, personnel:personnel_id(*, facilities:facility_code(*), labor_regimes:labor_regime_id(*), professions:profession_id(*)), roles_config:role(*)");
                if (!error && data) {
                    const normalized = data.map(u => {
                        const p = Array.isArray(u.personnel) ? u.personnel[0] : u.personnel;
                        const roleCfg = Array.isArray(u.roles_config) ? u.roles_config[0] : u.roles_config;
                        const f = p && p.facilities ? (Array.isArray(p.facilities) ? p.facilities[0] : p.facilities) : null;
                        return {
                            username: u.username,
                            role: u.role,
                            isActive: u.is_active,
                            personnelId: u.personnel_id,
                            personnel: p ? {
                                id: p.id,
                                firstName: p.first_name,
                                lastName: p.last_name,
                                dni: p.dni,
                                phone: p.phone,
                                email: p.email,
                                laborRegime: p.labor_regime || undefined,
                                laborRegimeId: p.labor_regime_id || undefined,
                                professionId: p.profession_id || undefined,
                                laborRegimeData: p.labor_regimes ? (Array.isArray(p.labor_regimes) ? p.labor_regimes[0] : p.labor_regimes) : undefined,
                                professionData: p.professions ? (Array.isArray(p.professions) ? p.professions[0] : p.professions) : undefined,
                                facilityCode: p.facility_code,
                                diresaId: p.diresa_id || undefined,
                                ogessId: p.ogess_id || undefined,
                                ungetId: p.unget_id || undefined,
                                microredId: p.microred_id || undefined
                            } : null,
                            facilityData: f ? {
                                code: f.code,
                                name: f.name,
                                category: f.category,
                                ungetId: f.unget_id,
                                type: f.type,
                                diresaId: f.diresa_id,
                                ogessId: f.ogess_id,
                                microredId: f.microred_id
                            } : null,
                            permissions: roleCfg ? roleCfg.allowed_modules : [],
                            maxUrlsAllowed: roleCfg ? roleCfg.max_urls_allowed : 0,
                            created_at: u.created_at
                        };
                    });
                    usersCache = normalized;
                    return normalized;
                }
            }
        } catch(e) {}
        return Object.values(MOCK_DB.users).map(u => ({ ...u, personnel: MOCK_DB.personnel.find(p => p.id === u.personnelId) }));
    },

    adminSaveUser: async (userData: any): Promise<{ success: boolean; message?: string }> => {
        try {
            usersCache = null;
            if (supabase) {
                const targetPersonnelId = userData.personnelId || ('P' + Date.now() + Math.floor(Math.random() * 1000));
                
                // Upsert Personnel
                const { error: pError } = await supabase.from('personnel').upsert({
                    id: targetPersonnelId,
                    first_name: userData.firstName,
                    last_name: userData.lastName,
                    dni: userData.dni,
                    phone: userData.phone || null,
                    email: userData.email,
                    labor_regime: userData.laborRegime || null,
                    labor_regime_id: userData.laborRegimeId || null,
                    profession_id: userData.professionId || null,
                    facility_code: userData.facilityCode || null,
                    diresa_id: userData.diresaId || null,
                    ogess_id: userData.ogessId || null,
                    unget_id: userData.ungetId || null,
                    microred_id: userData.microredId || null
                });

                if (pError) throw pError;

                let pwUpdate = {};
                if (userData.password) {
                    const salt = bcrypt.genSaltSync(10);
                    const pt = typeof userData.password === 'string' ? userData.password : String(userData.password);
                    pwUpdate = { password_hash: bcrypt.hashSync(pt, salt) };
                } else if (userData.isNew) {
                    const salt = bcrypt.genSaltSync(10);
                    pwUpdate = { password_hash: bcrypt.hashSync('Temporal2026*', salt) };
                }

                if (userData.isNew) {
                    const { error: uError } = await supabase.from('users').insert({
                        username: userData.username,
                        role: userData.role,
                        personnel_id: targetPersonnelId,
                        is_active: userData.isActive !== undefined ? userData.isActive : true,
                        ...pwUpdate
                    });
                    if (uError) throw uError;
                } else {
                    const { error: uError } = await supabase.from('users').update({
                        role: userData.role,
                        personnel_id: targetPersonnelId,
                        is_active: userData.isActive !== undefined ? userData.isActive : true,
                        ...pwUpdate
                    }).eq('username', userData.username);
                    if (uError) throw uError;
                }
                return { success: true };
            }
            return { success: false, message: "No Supabase connected" };
        } catch(e: any) {
            return { success: false, message: e.message || "Error saving user" };
        }
    },

    toggleUserStatus: async (username: string, status: boolean): Promise<{ success: boolean; message?: string }> => {
        try {
            usersCache = null;
            if (supabase) {
                const { error } = await supabase.from('users').update({ is_active: status }).eq('username', username);
                if (error) throw error;
                return { success: true };
            }
        } catch(e) {}
        return { success: false };
    },

    adminDeleteUser: async (username: string, personnelId: string | null): Promise<{ success: boolean; message?: string }> => {
        try {
            usersCache = null;
            if (supabase) {
                const { error: uError } = await supabase.from('users').delete().eq('username', username);
                if (uError) throw uError;
                
                if (personnelId) {
                    const { error: pError } = await supabase.from('personnel').delete().eq('id', personnelId);
                    if (pError) {
                        console.warn('Could not delete personnel, but successfully deleted user account:', pError);
                    }
                }
                return { success: true };
            }
            return { success: false, message: "No Supabase connected" };
        } catch(e: any) {
            return { success: false, message: e.message || "Error deleting user" };
        }
    },

    // --- DIRESA ---
    getDiresas: async (): Promise<Diresa[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('diresas').select('*');
                if (!error && data) {
                    return data.map(d => ({
                        id: d.id,
                        name: d.name,
                        ruc: d.ruc,
                        department: d.department,
                        province: d.province,
                        district: d.district,
                        legalAddress: d.legal_address,
                        website: d.website,
                        socialMedia: d.social_media,
                        phone: d.phone,
                        email: d.email
                    }));
                }
            }
        } catch(e){}
        return [];
    },

    saveDiresa: async (diresa: Partial<Diresa>): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('diresas').upsert({
                    id: diresa.id,
                    name: diresa.name,
                    ruc: diresa.ruc,
                    department: diresa.department,
                    province: diresa.province,
                    district: diresa.district,
                    legal_address: diresa.legalAddress,
                    website: diresa.website,
                    social_media: diresa.socialMedia,
                    phone: diresa.phone,
                    email: diresa.email
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteDiresa: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('diresas').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    // --- OGESS ---
    getOgess: async (): Promise<Ogess[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('ogess').select('*');
                if (!error && data) {
                    return data.map(o => ({
                        id: o.id,
                        name: o.name,
                        diresaId: o.diresa_id,
                        code: o.code,
                        ruc: o.ruc,
                        department: o.department,
                        province: o.province,
                        district: o.district,
                        legalAddress: o.legal_address,
                        website: o.website,
                        socialMedia: o.social_media,
                        phone: o.phone,
                        email: o.email
                    }));
                }
            }
        } catch(e){}
        return [];
    },

    saveOgess: async (ogess: Partial<Ogess>): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('ogess').upsert({
                    id: ogess.id,
                    name: ogess.name,
                    diresa_id: ogess.diresaId,
                    code: ogess.code,
                    ruc: ogess.ruc,
                    department: ogess.department,
                    province: ogess.province,
                    district: ogess.district,
                    legal_address: ogess.legalAddress,
                    website: ogess.website,
                    social_media: ogess.socialMedia,
                    phone: ogess.phone,
                    email: ogess.email
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteOgess: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('ogess').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    // --- MICROREDES ---
    getMicroredes: async (): Promise<Microred[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('microredes').select('*');
                if (!error && data) {
                    return data.map(m => ({
                        id: m.id,
                        name: m.name,
                        ungetId: m.unget_id,
                        location: m.location,
                        legalAddress: m.legal_address,
                        website: m.website,
                        socialMedia: m.social_media,
                        phone: m.phone,
                        email: m.email
                    }));
                }
            }
        } catch(e){}
        return [];
    },

    saveMicrored: async (microred: Partial<Microred>): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('microredes').upsert({
                    id: microred.id,
                    name: microred.name,
                    unget_id: microred.ungetId,
                    location: microred.location,
                    legal_address: microred.legalAddress,
                    website: microred.website,
                    social_media: microred.socialMedia,
                    phone: microred.phone,
                    email: microred.email
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteMicrored: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('microredes').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    getFacilities: async (): Promise<HealthFacility[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('facilities').select('*');
                if (!error && data) {
                    return data.map(f => ({
                        code: f.code,
                        name: f.name,
                        category: f.category,
                        type: f.type,
                        ungetId: f.unget_id,
                        microredId: f.microred_id,
                        ogessId: f.ogess_id,
                        diresaId: f.diresa_id,
                        legalAddress: f.legal_address,
                        website: f.website,
                        socialMedia: f.social_media,
                        phone: f.phone,
                        email: f.email,
                        department: f.department,
                        province: f.province,
                        district: f.district
                    }));
                }
            }
        } catch(e){}
        return MOCK_DB.facilities;
    },

    saveFacility: async (facility: HealthFacility): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('facilities').upsert({
                    code: facility.code,
                    name: facility.name,
                    category: facility.category,
                    type: facility.type || null,
                    unget_id: facility.ungetId || null,
                    microred_id: facility.microredId || null,
                    ogess_id: facility.ogessId || null,
                    diresa_id: facility.diresaId || null,
                    legal_address: facility.legalAddress || null,
                    website: facility.website || null,
                    social_media: facility.socialMedia || null,
                    phone: facility.phone || null,
                    email: facility.email || null,
                    department: facility.department || null,
                    province: facility.province || null,
                    district: facility.district || null
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteFacility: async (code: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('facilities').delete().eq('code', code);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    getUngets: async (): Promise<Unget[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('ungets').select('*');
                if (!error && data) {
                    return data.map(u => ({
                        id: u.id,
                        name: u.name,
                        region: u.region,
                        ogessId: u.ogess_id,
                        diresaId: u.diresa_id,
                        legalAddress: u.legal_address,
                        website: u.website,
                        socialMedia: u.social_media,
                        phone: u.phone,
                        email: u.email,
                        department: u.department,
                        province: u.province,
                        district: u.district
                    }));
                }
            }
        } catch(e){}
        return [];
    },

    saveUnget: async (unget: Partial<Unget>): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('ungets').upsert({
                    id: unget.id,
                    name: unget.name,
                    region: unget.region,
                    ogess_id: unget.ogessId || null,
                    diresa_id: unget.diresaId || null,
                    legal_address: unget.legalAddress || null,
                    website: unget.website || null,
                    social_media: unget.socialMedia || null,
                    phone: unget.phone || null,
                    email: unget.email || null,
                    department: unget.department || null,
                    province: unget.province || null,
                    district: unget.district || null
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteUnget: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('ungets').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    getRolesConfig: async (): Promise<RoleConfig[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('roles_config').select('*');
                if (!error && data) {
                    return data.map(r => ({
                        role: r.role,
                        label: r.label,
                        allowedModules: r.allowed_modules,
                        maxUrlsAllowed: r.max_urls_allowed,
                        jurisdictionLevel: r.jurisdiction_level
                    }));
                }
            }
        } catch(e) {}
        return MOCK_DB.roles as RoleConfig[];
    },

    updateRoleConfig: async (roleConfig: RoleConfig): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                // If the role was renamed, try to update the primary key first
                if (roleConfig.oldRole && roleConfig.oldRole !== roleConfig.role) {
                    const { error: renameError } = await supabase
                        .from('roles_config')
                        .update({ role: roleConfig.role })
                        .eq('role', roleConfig.oldRole);
                        
                    if (renameError) {
                        console.error('Error renaming role:', renameError);
                        // Optional fallback: maybe we have users attached resulting in a constraint error.
                        // We will just throw the error to be handled by the UI.
                        throw renameError;
                    }
                }

                const { error } = await supabase.from('roles_config').upsert({
                    role: roleConfig.role,
                    label: roleConfig.label,
                    allowed_modules: roleConfig.allowedModules,
                    max_urls_allowed: roleConfig.maxUrlsAllowed,
                    jurisdiction_level: roleConfig.jurisdictionLevel
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false };
    },

    getSystemConfig: async (): Promise<SystemConfig> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('system_config').select('*');
                if (!error && data) {
                    const cfg: any = {};
                    data.forEach(d => {
                        cfg[d.key] = d.value;
                    });
                    const merged = { ...MOCK_DB.defaultConfig, ...cfg };
                    return merged;
                }
            }
        } catch(e) {}
        return MOCK_DB.defaultConfig;
    },

    updateSystemConfig: async (newConfig: SystemConfig): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const keys = Object.keys(newConfig);
                for (const k of keys) {
                    await supabase.from('system_config').upsert({ key: k, value: (newConfig as any)[k] });
                }
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false };
    },

    getUngetConfigs: async (username: string): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('unget_configs').select('*').eq('username', username);
                if (!error && data) {
                    return data.map(d => ({
                        name: d.unget_name,
                        url: d.url,
                        username: d.username
                    }));
                }
            }
        } catch(e) {}
        
        const saved = localStorage.getItem(`aura_sig_ungets_${username}`);
        return saved ? JSON.parse(saved) : [];
    },

    getAllUngetConfigs: async (): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('unget_configs').select('*');
                if (!error && data) {
                    return data.map(d => ({
                        id: d.id,
                        username: d.username,
                        name: d.unget_name,
                        url: d.url
                    }));
                }
            }
        } catch(e) {}
        
        const all: any[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('aura_sig_ungets_')) {
                const username = key.replace('aura_sig_ungets_', '');
                try {
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (Array.isArray(parsed)) {
                            parsed.forEach(c => {
                                all.push({
                                    username,
                                    name: c.name,
                                    url: c.url
                                });
                            });
                        }
                    }
                } catch(e) {}
            }
        }
        return all;
    },

    saveUngetConfigs: async (username: string, configs: any[]): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                await supabase.from('unget_configs').delete().eq('username', username);
                for(const c of configs) {
                    await supabase.from('unget_configs').insert({
                        username,
                        unget_name: c.name,
                        url: c.url
                    });
                }
            }
            localStorage.setItem(`aura_sig_ungets_${username}`, JSON.stringify(configs));
            return { success: true };
        } catch(e: any) {
            return { success: false, message: e.message };
        }
    },

    saveMultipleUngetConfigs: async (configsToSave: any[], usernamesToClear: string[]): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                for (const u of usernamesToClear) {
                    await supabase.from('unget_configs').delete().eq('username', u);
                }
                for (const c of configsToSave) {
                    await supabase.from('unget_configs').insert({
                        username: c.username,
                        unget_name: c.name,
                        url: c.url
                    });
                }
            }
            // En localstorage
            for (const u of usernamesToClear) {
                localStorage.removeItem(`aura_sig_ungets_${u}`);
            }
            const grouped: Record<string, any[]> = {};
            for (const c of configsToSave) {
                const u = c.username || 'unknown';
                if (!grouped[u]) grouped[u] = [];
                grouped[u].push({ name: c.name, url: c.url, username: u });
            }
            for (const u in grouped) {
                localStorage.setItem(`aura_sig_ungets_${u}`, JSON.stringify(grouped[u]));
            }
            return { success: true };
        } catch(e: any) {
            return { success: false, message: e.message };
        }
    },

    // --- STOCK ASSIGNMENTS (ADMIN TO USER) ---
    getAllStockAssignments: async (): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('facility_stock_assignments').select('*');
                if (!error && data) {
                    return data.map(d => ({
                        id: d.id,
                        adminUsername: d.admin_username,
                        facilityCode: d.facility_code,
                        sheetName: d.sheet_name,
                        sheetUrl: d.sheet_url,
                        visibleColumns: d.visible_columns || [],
                        createdAt: d.created_at
                    }));
                }
            }
        } catch(e) {}
        return [];
    },

    getStockAssignmentsByAdmin: async (adminUsername: string): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('facility_stock_assignments').select('*').eq('admin_username', adminUsername);
                if (!error && data) {
                    return data.map(d => ({
                        id: d.id,
                        adminUsername: d.admin_username,
                        facilityCode: d.facility_code,
                        sheetName: d.sheet_name,
                        sheetUrl: d.sheet_url,
                        visibleColumns: d.visible_columns || [],
                        createdAt: d.created_at
                    }));
                }
            }
        } catch(e) {}
        return [];
    },

    getMyStockAssignments: async (facilityCode: string): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('facility_stock_assignments').select('*').eq('facility_code', facilityCode);
                if (!error && data) {
                    return data.map(d => ({
                        id: d.id,
                        adminUsername: d.admin_username,
                        facilityCode: d.facility_code,
                        sheetName: d.sheet_name,
                        sheetUrl: d.sheet_url,
                        visibleColumns: d.visible_columns || [],
                        createdAt: d.created_at
                    }));
                }
            }
        } catch(e) {}
        return [];
    },

    saveStockAssignment: async (assignment: any): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                // Validation: A health facility (establishment) cannot be assigned to two or more sheets at the same time
                const { data: existingFacility, error: errFac } = await supabase
                    .from('facility_stock_assignments')
                    .select('id, facility_code')
                    .eq('facility_code', assignment.facilityCode)
                    .maybeSingle();
                if (existingFacility) {
                    return { success: false, message: `El establecimiento solicitado ya tiene una hoja de cálculo vinculada.` };
                }

                // Validation: A single sheet (sheetUrl + sheetName) cannot be assigned to multiple facilities at the same time
                const { data: existingSheet, error: errSheet } = await supabase
                    .from('facility_stock_assignments')
                    .select('id, facility_code, sheet_name')
                    .eq('sheet_url', assignment.sheetUrl)
                    .eq('sheet_name', assignment.sheetName)
                    .maybeSingle();
                if (existingSheet) {
                    return { success: false, message: `La hoja "${assignment.sheetName}" de esa conexión ya se encuentra vinculada a otro establecimiento (Código: ${existingSheet.facility_code}).` };
                }

                const { error } = await supabase.from('facility_stock_assignments').insert({
                    admin_username: assignment.adminUsername,
                    facility_code: assignment.facilityCode,
                    sheet_name: assignment.sheetName,
                    sheet_url: assignment.sheetUrl,
                    visible_columns: assignment.visibleColumns
                });
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    updateStockAssignment: async (id: string, assignment: any): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                // Validation: A health facility (establishment) cannot be assigned to two or more sheets at the same time
                const { data: existingFacility, error: errFac } = await supabase
                    .from('facility_stock_assignments')
                    .select('id')
                    .eq('facility_code', assignment.facilityCode)
                    .neq('id', id)
                    .maybeSingle();
                if (existingFacility) {
                    return { success: false, message: `El establecimiento solicitado ya tiene otra hoja de cálculo vinculada.` };
                }

                // Validation: A single sheet (sheetUrl + sheetName) cannot be assigned to multiple facilities at the same time
                const { data: existingSheet, error: errSheet } = await supabase
                    .from('facility_stock_assignments')
                    .select('id, facility_code')
                    .eq('sheet_url', assignment.sheetUrl)
                    .eq('sheet_name', assignment.sheetName)
                    .neq('id', id)
                    .maybeSingle();
                if (existingSheet) {
                    return { success: false, message: `La hoja "${assignment.sheetName}" de esa conexión ya se encuentra vinculada a otro establecimiento (Código: ${existingSheet.facility_code}).` };
                }

                const { error } = await supabase.from('facility_stock_assignments').update({
                    facility_code: assignment.facilityCode,
                    sheet_name: assignment.sheetName,
                    sheet_url: assignment.sheetUrl,
                    visible_columns: assignment.visibleColumns
                }).eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    deleteStockAssignment: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('facility_stock_assignments').delete().eq('id', id);
                if (error) throw error;
                return { success: true };
            }
        } catch(e: any) {
            return { success: false, message: e.message };
        }
        return { success: false, message: "No Supabase connected" };
    },

    // --- DYNAMIC LABOR REGIMES (CRUD) ---
    getLaborRegimes: async (): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('labor_regimes').select('*').order('name');
                if (!error && data) {
                    return data.map(r => ({
                        id: r.id,
                        name: r.name,
                        description: r.description || ''
                    }));
                }
            }
        } catch (e) {
            console.warn("Offline fallback for labor_regimes", e);
        }

        const cached = localStorage.getItem('aura_labor_regimes');
        if (cached) return JSON.parse(cached);
        return MOCK_DB.laborRegimes;
    },

    saveLaborRegime: async (item: any): Promise<{ success: boolean; message?: string }> => {
        try {
            const targetId = item.id || ('LR-' + Date.now());
            if (supabase) {
                const { error } = await supabase.from('labor_regimes').upsert({
                    id: targetId,
                    name: item.name,
                    description: item.description || null
                });
                if (error) throw error;
            }
            
            const current = await api.getLaborRegimes();
            const exists = current.find(c => c.id === targetId);
            let updatedList;
            if (exists) {
                updatedList = current.map(c => c.id === targetId ? { ...c, name: item.name, description: item.description || '' } : c);
            } else {
                updatedList = [...current, { id: targetId, name: item.name, description: item.description || '' }];
            }
            localStorage.setItem('aura_labor_regimes', JSON.stringify(updatedList));
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    },

    deleteLaborRegime: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('labor_regimes').delete().eq('id', id);
                if (error) throw error;
            }
            const current = await api.getLaborRegimes();
            const updatedList = current.filter(c => c.id !== id);
            localStorage.setItem('aura_labor_regimes', JSON.stringify(updatedList));
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    },

    // --- DYNAMIC PROFESSIONS (CRUD) ---
    getProfessions: async (): Promise<any[]> => {
        try {
            if (supabase) {
                const { data, error } = await supabase.from('professions').select('*').order('name');
                if (!error && data) {
                    return data.map(p => ({
                        id: p.id,
                        name: p.name,
                        description: p.description || ''
                    }));
                }
            }
        } catch (e) {
            console.warn("Offline fallback for professions", e);
        }

        const cached = localStorage.getItem('aura_professions');
        if (cached) return JSON.parse(cached);
        return MOCK_DB.professions;
    },

    saveProfession: async (item: any): Promise<{ success: boolean; message?: string }> => {
        try {
            const targetId = item.id || ('PROF-' + Date.now());
            if (supabase) {
                const { error } = await supabase.from('professions').upsert({
                    id: targetId,
                    name: item.name,
                    description: item.description || null
                });
                if (error) throw error;
            }
            
            const current = await api.getProfessions();
            const exists = current.find(c => c.id === targetId);
            let updatedList;
            if (exists) {
                updatedList = current.map(c => c.id === targetId ? { ...c, name: item.name, description: item.description || '' } : c);
            } else {
                updatedList = [...current, { id: targetId, name: item.name, description: item.description || '' }];
            }
            localStorage.setItem('aura_professions', JSON.stringify(updatedList));
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    },

    deleteProfession: async (id: string): Promise<{ success: boolean; message?: string }> => {
        try {
            if (supabase) {
                const { error } = await supabase.from('professions').delete().eq('id', id);
                if (error) throw error;
            }
            const current = await api.getProfessions();
            const updatedList = current.filter(c => c.id !== id);
            localStorage.setItem('aura_professions', JSON.stringify(updatedList));
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
};
