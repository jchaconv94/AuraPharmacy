
import { User, UserRole, Personnel, HealthFacility, RoleConfig, SystemConfig } from "../types";

// URL DE ARRANQUE (BOOTSTRAP)
// Esta URL se usa SOLO para la primera conexión y pedir la configuración.
// Si cambias el script, puedes actualizar la URL nueva en el Panel de Admin (BD) y la app la usará.
const BOOTSTRAP_URL = "https://script.google.com/macros/s/AKfycbzxolzhHYg1U2geauXStygZ5ITD8zkOY17MM_4Ylzy6yPvsaXFWCdM4IWTjJUelEee8/exec"; 

// Variable mutable para almacenar la URL activa
let activeApiUrl = BOOTSTRAP_URL;

// --- CACHÉ EN MEMORIA ---
// Esto evita llamadas repetitivas a Google Apps Script
let usersCache: any[] | null = null;

// --- MOCK DATA (Respaldo en caso de error de conexión) ---
const MOCK_DB = {
    users: [
        { username: 'admin', password: '123', role: 'ADMIN', personnelId: 'P001', isActive: true },
        { username: 'farmacia', password: '123', role: 'FARMACIA', personnelId: 'P002', isActive: true },
    ],
    personnel: [
        { id: 'P001', firstName: 'Aura', lastName: 'Admin', dni: '00000001', facilityCode: '00001', email: 'admin@aura.pe' },
        { id: 'P002', firstName: 'Juan', lastName: 'Perez', dni: '12345678', facilityCode: '00002', email: 'juan@redsalud.pe' },
    ],
    facilities: [
        { code: '00001', name: 'DIRESA SEDE CENTRAL', category: 'ADM' },
        { code: '00002', name: 'C.S. MIRAFLORES', category: 'I-3' },
    ],
    roles: [
        { role: 'ADMIN', label: 'Administrador Total', allowedModules: ['DASHBOARD', 'ANALYSIS', 'ADMIN_USERS', 'ADMIN_ROLES', 'PROFILE'] },
        { role: 'FARMACIA', label: 'Responsable Farmacia', allowedModules: ['DASHBOARD', 'ANALYSIS', 'PROFILE'] }
    ],
    // Default System Config (Solo si falla la red totalmente)
    defaultConfig: {
        verificationDelaySeconds: 5,
        apiUrl: BOOTSTRAP_URL
    } as SystemConfig
};

// --- HELPER PARA CONEXIÓN A GOOGLE APPS SCRIPT ---
const sendRequest = async (action: string, payload: any = {}) => {
    // Usamos la URL activa (puede ser la de bootstrap o la que vino de la BD)
    const targetUrl = activeApiUrl || BOOTSTRAP_URL;

    // Usamos POST con cuerpo JSON string.
    const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action, ...payload })
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    const json = await response.json();
    return json;
};

export const api = {
    
    login: async (username: string, password: string): Promise<{ success: boolean; user?: User; message?: string }> => {
        try {
            const result = await sendRequest('login', { username, password });
            return result;
        } catch (e) {
            console.warn("Error conectando al backend, intentando modo offline...", e);
            
            // MOCK LOGIC UPDATE
            const authUser = MOCK_DB.users.find(u => u.username.toLowerCase() === username.toLowerCase());
            
            if (authUser) {
                // Check Password
                if (authUser.password === password) {
                    // Check Active
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
                            message: "Modo Offline / Demo" 
                        };
                    } else {
                        return { success: false, message: "Su cuenta ha sido desactivada. Contacte al administrador." };
                    }
                } else {
                    return { success: false, message: "Usuario o contraseña incorrectos." };
                }
            }
            
            // If user not found in mock or connection failed completely
            return { success: false, message: "Error de conexión. Verifique su internet o la URL del script." };
        }
    },

    refreshSession: async (username: string): Promise<{ success: boolean; user?: User; message?: string }> => {
        try {
            const result = await sendRequest('refreshUser', { username });
            return result;
        } catch (e) {
            console.warn("Error refrescando sesión, usando caché local...", e);
            
            // MOCK Fallback for refresh
            const authUser = MOCK_DB.users.find(u => u.username === username);
            if (authUser) {
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
                    }
                 };
            }

            return { success: false, message: "No se pudo actualizar sesión" };
        }
    },

    updateProfile: async (personnelId: string, data: any) => {
        try {
            // Invalidamos caché para forzar recarga la próxima vez si editamos un usuario
            usersCache = null; 
            return await sendRequest('updateProfile', { personnelId, data });
        } catch (e) {
            console.error(e);
            return { success: false, message: "Error al guardar en la nube." };
        }
    },

    getUsers: async (forceRefresh = false) => {
        // 1. Si tenemos datos en memoria y no forzamos refresco, retornamos INSTANTÁNEAMENTE
        if (usersCache && !forceRefresh) {
            return usersCache;
        }

        try {
            const result = await sendRequest('getUsers');
            if (result.success) {
                // NORMALIZACIÓN DE DATOS (CRÍTICO)
                // Asegura que isActive sea siempre un booleano real, no el string "TRUE"/"FALSE" de Google Sheets
                const normalizedUsers = result.data.map((u: any) => ({
                    ...u,
                    isActive: u.isActive === true || String(u.isActive).toLowerCase() === 'true'
                }));
                
                usersCache = normalizedUsers; // Guardamos en memoria normalizado
                return normalizedUsers;
            }
            return [];
        } catch (e) {
            console.error(e);
             return MOCK_DB.users.map(u => ({
                ...u,
                personnel: MOCK_DB.personnel.find(p => p.id === u.personnelId)
            }));
        }
    },

    // --- NEW ADMIN METHODS ---

    adminSaveUser: async (userData: any): Promise<{ success: boolean; message?: string }> => {
        try {
            usersCache = null; // Invalidate Cache
            const result = await sendRequest('adminSaveUser', { userData });
            return result;
        } catch (e) {
            console.error("Error admin save user:", e);
            // Mock Implementation for offline test
            if (userData.isNew) {
                const newId = 'P' + Date.now();
                MOCK_DB.personnel.push({
                    id: newId,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    dni: userData.dni,
                    email: userData.email,
                    facilityCode: userData.facilityCode
                } as any);
                MOCK_DB.users.push({
                    username: userData.username,
                    password: userData.password,
                    role: userData.role,
                    personnelId: newId,
                    isActive: true
                });
            }
            return { success: true, message: "Guardado en modo Offline (Mock)" };
        }
    },

    toggleUserStatus: async (username: string, status: boolean): Promise<{ success: boolean; message?: string }> => {
        try {
            usersCache = null; // Invalidate Cache
            const result = await sendRequest('toggleUserStatus', { username, status });
            return result;
        } catch (e) {
            console.error("Error toggle status:", e);
            // Mock Implementation
            const u = MOCK_DB.users.find(user => user.username === username);
            if (u) u.isActive = status;
            return { success: true, message: "Estado actualizado en Offline" };
        }
    },

    // --- FACILITIES ---
    getFacilities: async (): Promise<HealthFacility[]> => {
        try {
            const result = await sendRequest('getFacilities');
            if (result.success) return result.data;
            return [];
        } catch (e) {
            console.error("Error fetching facilities:", e);
            return MOCK_DB.facilities;
        }
    },

    getRolesConfig: async (): Promise<RoleConfig[]> => {
        return MOCK_DB.roles as RoleConfig[];
    },

    // --- SYSTEM CONFIG METHODS ---
    
    getSystemConfig: async (): Promise<SystemConfig> => {
        try {
            const result = await sendRequest('getSystemConfig');
            
            if (result.success && result.data) {
                const config = {
                    verificationDelaySeconds: Number(result.data.verificationDelaySeconds) || 5,
                    apiUrl: result.data.apiUrl || BOOTSTRAP_URL
                };

                // CRITICAL: Update the active URL immediately if one is found in the DB
                if (config.apiUrl && config.apiUrl.startsWith('http')) {
                    activeApiUrl = config.apiUrl;
                    console.log("Aura API URL updated from Remote Config:", activeApiUrl);
                }

                return config;
            }
            
            return MOCK_DB.defaultConfig;
        } catch (e) {
            console.error("Error obteniendo configuración global:", e);
            return MOCK_DB.defaultConfig;
        }
    },

    updateSystemConfig: async (newConfig: SystemConfig): Promise<{ success: boolean; message?: string }> => {
        try {
             // Si el usuario está actualizando la URL, actualizamos la variable local inmediatamente también
             if (newConfig.apiUrl && newConfig.apiUrl.startsWith('http')) {
                 activeApiUrl = newConfig.apiUrl;
             }

             const result = await sendRequest('updateSystemConfig', { config: newConfig });
             return result;
        } catch (e) {
            console.error("Error guardando configuración global:", e);
            return { success: false, message: "Error de conexión: No se pudo guardar la configuración global." };
        }
    }
};
