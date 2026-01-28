
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, AppModule, SystemConfig } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
  login: (u: string, p: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (module: AppModule) => boolean;
  updateUserContext: (data: Partial<User>) => void;
  updateSystemConfigContext: (config: SystemConfig) => void;
  refreshUserData: () => Promise<void>; // Nueva función expuesta
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    systemConfig: { verificationDelaySeconds: 5 } // Default initial value
  });

  // Función centralizada para refrescar datos desde el servidor
  const refreshUserData = async () => {
      if (!state.user) return;
      try {
          // Forzamos la llamada al backend
          const freshData = await api.refreshSession(state.user.username);
          if (freshData.success && freshData.user) {
              const updatedUser = freshData.user as User;
              localStorage.setItem('aura_auth_user', JSON.stringify(updatedUser));
              setState(prev => ({ ...prev, user: updatedUser }));
              console.log("Datos de usuario sincronizados con BD");
          }
      } catch (e) {
          console.error("Error refreshing user data:", e);
      }
  };

  useEffect(() => {
    const initAuth = async () => {
        // 1. Load System Config
        try {
            const config = await api.getSystemConfig();
            setState(prev => ({ ...prev, systemConfig: config }));
        } catch (e) {
            console.error("Failed to load system config", e);
        }

        // 2. Check local storage for persisted session
        const savedUser = localStorage.getItem('aura_auth_user');
        
        if (savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser) as User;
                
                // 2a. Optimistic UI: Set state immediately
                setState(prev => ({ ...prev, user: parsedUser, isAuthenticated: true, isLoading: false }));
                
                // 2b. Silent Refresh: Check with DB immediately
                try {
                    const freshData = await api.refreshSession(parsedUser.username);
                    
                    if (freshData.success && freshData.user) {
                        localStorage.setItem('aura_auth_user', JSON.stringify(freshData.user));
                        setState(prev => ({ ...prev, user: freshData.user as User }));
                    } else if (freshData.message === 'Usuario no encontrado o eliminado') {
                         localStorage.removeItem('aura_auth_user');
                         setState(prev => ({ ...prev, user: null, isAuthenticated: false }));
                    }
                } catch (refreshError) {
                    console.warn("Could not refresh session (Offline?), using cached data.", refreshError);
                }

            } catch {
                localStorage.removeItem('aura_auth_user');
                setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
            }
        } else {
            setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
        }
    };

    initAuth();
  }, []);

  // --- PRE-FETCHING / CACHE WARMING ---
  useEffect(() => {
      if (state.isAuthenticated && state.user?.role === 'ADMIN') {
          api.getUsers().catch(err => console.warn("Background fetch failed", err));
      }
  }, [state.isAuthenticated, state.user?.role]); // Fix dependency

  const login = async (u: string, p: string) => {
    // NOTA IMPORTANTE: No establecemos isLoading: true aquí.
    // Si lo hacemos, App.tsx desmontará LoginScreen para mostrar el spinner global,
    // lo que provocará que se pierda el estado local del error (mensaje) cuando falle el login.
    // LoginScreen ya maneja su propio estado de carga (isSubmitting).
    
    const result = await api.login(u, p);
    
    if (result.success && result.user) {
        localStorage.setItem('aura_auth_user', JSON.stringify(result.user));
        // Reset welcome flag on new login
        sessionStorage.removeItem('aura_welcome_shown_session');
        
        const userToSet = result.user as User;
        setState(prev => ({ ...prev, user: userToSet, isAuthenticated: true, isLoading: false }));
    } 
    // Si falla, no cambiamos el estado global, simplemente devolvemos el resultado
    // para que LoginScreen muestre el error.
    
    return result;
  };

  const logout = () => {
    localStorage.removeItem('aura_auth_user');
    sessionStorage.removeItem('aura_welcome_shown_session');
    setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
  };

  const hasPermission = (module: AppModule): boolean => {
      if (!state.user) return false;
      return state.user.permissions.includes(module);
  };

  const updateUserContext = (data: Partial<User>) => {
      if (!state.user) return;
      const newUser = { ...state.user, ...data };
      localStorage.setItem('aura_auth_user', JSON.stringify(newUser));
      setState(prev => ({ ...prev, user: newUser }));
  };

  const updateSystemConfigContext = (config: SystemConfig) => {
      setState(prev => ({ ...prev, systemConfig: config }));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, updateUserContext, updateSystemConfigContext, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
