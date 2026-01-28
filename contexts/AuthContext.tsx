
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthState, AppModule, SystemConfig } from '../types';
import { api } from '../services/api';

interface AuthContextType extends AuthState {
  login: (u: string, p: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasPermission: (module: AppModule) => boolean;
  updateUserContext: (data: Partial<User>) => void;
  updateSystemConfigContext: (config: SystemConfig) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    systemConfig: { verificationDelaySeconds: 5 } // Default initial value
  });

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
                const user = JSON.parse(savedUser);
                setState(prev => ({ ...prev, user, isAuthenticated: true, isLoading: false }));
            } catch {
                setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
            }
        } else {
            setState(prev => ({ ...prev, user: null, isAuthenticated: false, isLoading: false }));
        }
    };

    initAuth();
  }, []);

  const login = async (u: string, p: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    const result = await api.login(u, p);
    
    if (result.success && result.user) {
        localStorage.setItem('aura_auth_user', JSON.stringify(result.user));
        // Casteamos explícitamente a User para evitar error de 'undefined' vs 'null'
        const authenticatedUser = result.user as User;
        setState(prev => ({ ...prev, user: authenticatedUser, isAuthenticated: true, isLoading: false }));
    } else {
        setState(prev => ({ ...prev, isLoading: false }));
    }
    
    return result;
  };

  const logout = () => {
    localStorage.removeItem('aura_auth_user');
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
    <AuthContext.Provider value={{ ...state, login, logout, hasPermission, updateUserContext, updateSystemConfigContext }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
