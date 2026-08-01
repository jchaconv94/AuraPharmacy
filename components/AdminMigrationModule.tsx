import React, { useState } from 'react';
import { api } from '../services/api';
import { supabase } from '../services/supabaseClient';
import { Database, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import bcrypt from 'bcryptjs';
import { toast } from 'sonner';

export const AdminMigrationModule: React.FC = () => {
    const [isMigrating, setIsMigrating] = useState(false);
    const [progress, setProgress] = useState({ state: '', detail: '', percent: 0 });
    const [stats, setStats] = useState<{
        roles: number, ungets: number, facilities: number, personnel: number, users: number, ungetConfigs: number
    } | null>(null);

    const checkExistingData = async () => {
        if (!supabase) throw new Error("Supabase is not configured.");
        try {
            // Columna explícita: `*` incluiría `password_hash`, cuya lectura está revocada.
            const { count, error } = await supabase.from('users').select('username', { count: 'exact', head: true });
            if (error) throw error;
            if ((count || 0) > 0) {
                return true; // Already data
            }
            return false;
        } catch (e) {
            console.error("Error comprobando bd:", e);
            return false;
        }
    };

    const runMigration = async () => {
        setIsMigrating(true);
        if (!supabase) {
            toast.error("Supabase is not configured.");
            setIsMigrating(false);
            return;
        }
        try {
            // Check
            const hasData = await checkExistingData();
            if (hasData) {
                toast("¿Continuar migración con datos?", {
                    description: "La base de datos de Supabase ya tiene usuarios. Ejecutar la migración puede duplicar o fallar.",
                    action: {
                        label: "Continuar",
                        onClick: () => executeActualMigration()
                    }
                });
                setIsMigrating(false);
                return;
            }

            await executeActualMigration();
        } catch (error: any) {
            console.error("Error de MIGRACION:", error);
            toast.error("Ocurrió un error en la migración: " + error.message);
            setProgress({ state: 'Error', detail: error.message, percent: 100 });
            setIsMigrating(false);
        }
    };

    const executeActualMigration = async () => {
        if (!supabase) return;
        setIsMigrating(true);
        try {
            setProgress({ state: 'Extrayendo', detail: 'Descargando datos desde Google Sheets...', percent: 10 });
            
            // 1. Fetch data from Google Sheets API
            const users = await api.getUsers(true);
            const facilities = await api.getFacilities();
            const rolesConf = await api.getRolesConfig();
            
            // If API didn't return personnel structure explicitly (as it's merged), let's extract them from Users
            const personnelMap = new Map();
            users.forEach((u: any) => {
                 if(u.personnel) {
                     personnelMap.set(u.personnel.id, u.personnel);
                 }
            });
            const personnelList = Array.from(personnelMap.values());

            setProgress({ state: 'Preparando', detail: `Datos obtenidos. Migrando ${rolesConf.length} roles, ${facilities.length} establecimientos, ${personnelList.length} personal, ${users.length} usuarios.`, percent: 30 });

            // 2. Insert Roles
            setProgress({ state: 'Procesando Roles', detail: 'Insertando configuración de roles...', percent: 40 });
            for (const r of rolesConf) {
                const { error } = await supabase.from('roles_config').upsert({
                    role: r.role,
                    label: r.label,
                    allowed_modules: r.allowedModules,
                    max_urls_allowed: r.maxUrlsAllowed
                });
                if (error) throw error;
            }

            // 3. Create dummy UNGET for facilities since we don't have UNGETs in the old model natively
            setProgress({ state: 'Procesando UNGETs', detail: 'Creando UNGETs genéricas...', percent: 50 });
            const { data: defaultUnget, error: ungetErr } = await supabase.from('ungets').upsert({
                name: 'UNGET_MIGRACION',
                region: 'San Martin' // Default
            }).select().single();
            if (ungetErr) throw ungetErr;

            // 4. Insert Facilities
            setProgress({ state: 'Procesando Establecimientos', detail: 'Insertando IPRESS...', percent: 60 });
            for (const f of facilities) {
                const { error } = await supabase.from('facilities').upsert({
                    code: f.code,
                    name: f.name,
                    category: f.category,
                    unget_id: defaultUnget.id
                });
                if (error) throw error;
            }

            // 5. Insert Personnel
            setProgress({ state: 'Procesando Personal', detail: 'Insertando datos del personal...', percent: 75 });
            for (const p of personnelList) {
                const { error } = await supabase.from('personnel').upsert({
                    id: p.id,
                    first_name: p.firstName,
                    last_name: p.lastName,
                    dni: p.dni,
                    phone: p.phone || null,
                    email: p.email || null,
                    facility_code: p.facilityCode
                });
                if (error) throw error; // Some facilityCodes might be missing or invalid. Need to handle
            }

            // 6. Insert Users
            setProgress({ state: 'Procesando Usuarios', detail: 'Encriptando contraseñas e insertando cuentas...', percent: 85 });
            let userCount = 0;
            for (const u of users) {
                // Encriptar password
                // api.ts in old script mock has 'password' or maybe u.password
                const plainPassword = String(u.password || 'Temporal2026*'); // Asegurar de que siempre sea un string
                const salt = bcrypt.genSaltSync(10);
                const hashedPassword = bcrypt.hashSync(plainPassword, salt);

                const { error } = await supabase.from('users').upsert({
                    username: u.username,
                    password_hash: hashedPassword,
                    role: u.role,
                    personnel_id: u.personnelId,
                    is_active: u.isActive
                });
                if (error) {
                    console.error("Error insertando user", u.username, error);
                } else {
                    userCount++;
                }
            }

            // 7. Insert UNGET Configs (Sheets URLs)
            setProgress({ state: 'Procesando UNGET Configs', detail: 'Sincronizando URLs de acceso de hojas...', percent: 95 });
            let ungetConfigCount = 0;
            for (const u of users) {
                try {
                    const cfgs = await api.getUngetConfigs(u.username);
                    for (const cfg of cfgs) {
                        const { error } = await supabase.from('unget_configs').insert({
                            username: u.username,
                            unget_name: cfg.name,
                            url: cfg.url
                        });
                        if (error) {
                            console.error("Error migrating unget_config", error);
                        } else {
                            ungetConfigCount++;
                        }
                    }
                } catch (e) {
                    console.error("Error getting configs for user", u.username, e);
                }
            }

            setProgress({ state: 'Finalizado', detail: '¡Migración completada exitosamente!', percent: 100 });
            setStats({
                roles: rolesConf.length,
                ungets: 1,
                facilities: facilities.length,
                personnel: personnelList.length,
                users: userCount,
                ungetConfigs: ungetConfigCount
            });
            toast.success("Migración a Supabase finalizada.");

        } catch (error: any) {
            console.error("Error de MIGRACION:", error);
            toast.error("Ocurrió un error en la migración: " + error.message);
            setProgress({ state: 'Error', detail: error.message, percent: 100 });
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="p-6 md:p-8 animate-in fade-in space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex gap-4 text-amber-800">
                <AlertTriangle className="h-6 w-6 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-black text-lg">Migración Hacia Supabase</h3>
                    <p className="text-sm font-medium mt-1 text-amber-700/80 leading-relaxed">
                        Esta herramienta moverá todos los usuarios, establecimientos y roles desde la actual versión basada en Google Sheets hacia la nueva infraestructura PostgreSQL en Supabase.
                        Durante la migración, las contraseñas actuales serán encriptadas (Bcrypt) localmente antes de sincronizarse por seguridad.
                    </p>
                </div>
            </div>

            <div className="bg-white border text-center border-slate-200 shadow-sm rounded-2xl p-8 flex flex-col items-center justify-center">
                <Database className="h-16 w-16 text-teal-600 mb-4" />
                <h4 className="text-xl font-bold text-slate-800">Ejecutar Migración Maestro</h4>
                <p className="text-sm text-slate-500 max-w-md mt-2 mb-8">
                    La transferencia tomará unos segundos dependiendo del volumen. Asegúrate de haber ejecutado los scripts de creación de tablas en Supabase previamente.
                </p>
                
                {isMigrating ? (
                    <div className="w-full max-w-md space-y-3">
                        <div className="flex justify-between text-sm font-bold w-full text-slate-700">
                            <span>{progress.state}</span>
                            <span>{progress.percent}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                            <div 
                                className="bg-teal-600 h-3 rounded-full transition-all duration-300"
                                style={{ width: `${progress.percent}%` }}
                            ></div>
                        </div>
                        <div className="text-xs text-slate-500 font-medium">{progress.detail}</div>
                    </div>
                ) : (
                    <button 
                        onClick={runMigration}
                        disabled={isMigrating || progress.percent === 100}
                        className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-full shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {progress.percent === 100 ? (
                            <><CheckCircle className="h-5 w-5" /> Migración Completada</>
                        ) : (
                            <><Database className="h-5 w-5" /> Iniciar Traspaso de Data</>
                        )}
                    </button>
                )}
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-slate-800">{stats.roles}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Roles Configs</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-slate-800">{stats.ungets}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Ungets Dummy</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-slate-800">{stats.facilities}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">IPRESS/Establec.</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-slate-800">{stats.personnel}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Personal</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
                        <div className="text-2xl font-black text-slate-800">{stats.users}</div>
                        <div className="text-[10px] uppercase font-bold text-slate-500">Usuarios</div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 text-center border-b-4 border-b-amber-500">
                        <div className="text-2xl font-black text-amber-600">{stats.ungetConfigs}</div>
                        <div className="text-[10px] uppercase font-bold text-amber-600">Configs Sheets</div>
                    </div>
                </div>
            )}
        </div>
    );
};
