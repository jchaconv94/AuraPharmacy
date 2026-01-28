
import { User, UserRole, Personnel, HealthFacility, RoleConfig, SystemConfig } from "../types";

// URL DEL BACKEND (Google Apps Script)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzxolzhHYg1U2geauXStygZ5ITD8zkOY17MM_4Ylzy6yPvsaXFWCdM4IWTjJUelEee8/exec"; 

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
        verificationDelaySeconds: 5
    } as SystemConfig
};

// --- HELPER PARA CONEXIÓN A GOOGLE APPS SCRIPT ---
const sendRequest = async (action: string, payload: any = {}) => {
    if (!GOOGLE_SCRIPT_URL) throw new Error("URL de Backend no configurada");
    
    // Usamos POST con cuerpo JSON string.
    // IMPORTANTE: 'Content-Type': 'text/plain' evita el preflight OPTIONS CORS de Google Apps Script
    const response = await fetch(GOOGLE_SCRIPT_URL, {
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
        // 1. INTENTO DE CONEXIÓN REAL (CLOUD)
        try {
            const result = await sendRequest('login', { username, password });
            return result;
        } catch (e) {
            console.warn("Error conectando al backend, intentando modo offline...", e);
            
            // 2. FALLBACK A MOCK (OFFLINE)
            const authUser = MOCK_DB.users.find(u => u.username === username && u.password === password);
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
                    },
                    message: "Modo Offline / Demo (Sin conexión a Base de Datos)" 
                };
            }
            return { success: false, message: "Error de conexión. Verifique su internet o la URL del script." };
        }
    },

    // NUEVO MÉTODO PARA REFRESCAR DATOS AL RECARGAR PÁGINA
    refreshSession: async (username: string): Promise<{ success: boolean; user?: User; message?: string }> => {
        try {
            const result = await sendRequest('refreshUser', { username });
            return result;
        } catch (e) {
            console.warn("Error refrescando sesión, usando caché local...", e);
            // Si falla (offline), retornamos falso para que el AuthContext use lo que tiene en localStorage
            
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
            return await sendRequest('updateProfile', { personnelId, data });
        } catch (e) {
            console.error(e);
            return { success: false, message: "Error al guardar en la nube." };
        }
    },

    getUsers: async () => {
        try {
            const result = await sendRequest('getUsers');
            if (result.success) return result.data;
            return [];
        } catch (e) {
            console.error(e);
             // Fallback Mock
             return MOCK_DB.users.map(u => ({
                ...u,
                personnel: MOCK_DB.personnel.find(p => p.id === u.personnelId)
            }));
        }
    },

    getRolesConfig: async (): Promise<RoleConfig[]> => {
        return MOCK_DB.roles as RoleConfig[];
    },

    // --- SYSTEM CONFIG METHODS (GLOBAL / CLOUD ONLY) ---
    
    getSystemConfig: async (): Promise<SystemConfig> => {
        try {
            // SOLICITUD REAL AL SERVIDOR
            // Esto asegura que obtengamos la configuración que el Admin definió para TODOS.
            const result = await sendRequest('getSystemConfig');
            
            if (result.success && result.data) {
                // Convertir valores string a número si es necesario (Google Sheets a veces devuelve strings)
                return {
                    verificationDelaySeconds: Number(result.data.verificationDelaySeconds) || 5
                };
            }
            
            return MOCK_DB.defaultConfig;
        } catch (e) {
            console.error("Error obteniendo configuración global:", e);
            // Solo si no hay internet usamos el default local para que la app no rompa
            return MOCK_DB.defaultConfig;
        }
    },

    updateSystemConfig: async (newConfig: SystemConfig): Promise<{ success: boolean; message?: string }> => {
        try {
             // GUARDADO REAL EN EL SERVIDOR
             // Al guardar aquí, cualquier otro usuario que recargue la página obtendrá estos nuevos valores.
             const result = await sendRequest('updateSystemConfig', { config: newConfig });
             return result;
        } catch (e) {
            console.error("Error guardando configuración global:", e);
            return { success: false, message: "Error de conexión: No se pudo guardar la configuración global." };
        }
    }
};
