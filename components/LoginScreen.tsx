
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Lock, User, ArrowRight, Phone } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsSubmitting(true);
      
      const result = await login(username, password);
      
      if (!result.success) {
          setError(result.message || 'Error al iniciar sesión');
      }
      setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-teal-900 to-gray-900 flex items-center justify-center p-4">
        {/* Adjusted max-width for compact screens (max-w-3xl) and large screens (2xl:max-w-5xl) */}
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl 2xl:max-w-5xl overflow-hidden flex flex-col md:flex-row transition-all duration-300">
            
            {/* Left Side: Brand */}
            <div className="bg-teal-600 p-8 2xl:p-12 md:w-1/2 flex flex-col justify-center items-center text-center text-white hidden md:flex relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/medical-icons.png')] opacity-10"></div>
                <div className="bg-white/20 p-3 2xl:p-4 rounded-2xl mb-4 2xl:mb-6 backdrop-blur-sm shadow-inner">
                    <Activity className="h-12 w-12 2xl:h-16 2xl:w-16 text-white" />
                </div>
                <h1 className="text-3xl 2xl:text-4xl font-black mb-2 tracking-tight">AURA</h1>
                <p className="text-teal-100 font-medium text-sm 2xl:text-lg px-4 leading-relaxed">Inteligencia Artificial para<br/>para la Gestión Farmacéutica</p>
                <div className="mt-6 2xl:mt-8 text-xs 2xl:text-sm text-teal-200 opacity-80 font-mono">
                    <p>Oficina de Gestión de Medicamentos</p>
                    <p> Red de Salud Bellavista © {new Date().getFullYear()}</p>
                </div>
            </div>

            {/* Right Side: Form - Reduced padding for 1366x768 */}
            <div className="p-6 md:p-8 2xl:p-12 md:w-1/2 w-full bg-white flex flex-col justify-center">
                
                <div className="md:hidden flex items-center gap-2 mb-6 justify-center">
                    <div className="bg-teal-100 p-2 rounded-lg">
                        <Activity className="h-6 w-6 text-teal-600" />
                    </div>
                    <span className="text-2xl font-black text-gray-900">AURA</span>
                </div>

                <div className="mb-6 2xl:mb-8">
                    <h2 className="text-xl 2xl:text-2xl font-bold text-gray-900 mb-1 2xl:mb-2">Iniciar Sesión</h2>
                    <p className="text-gray-500 text-xs 2xl:text-sm">Ingrese sus credenciales para acceder.</p>
                </div>

                {error && (
                    <div className="mb-4 2xl:mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                        <Lock className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 2xl:space-y-5">
                    <div>
                        <label className="block text-[10px] 2xl:text-xs font-bold text-gray-700 uppercase mb-1 2xl:mb-1.5">Usuario</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 2xl:h-5 2xl:w-5 text-gray-400 z-10" />
                            <input 
                                type="text"
                                className="w-full pl-9 2xl:pl-10 pr-4 py-2 2xl:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white text-gray-900 font-medium text-sm"
                                placeholder="Ej. jperez"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div>
                        <label className="block text-[10px] 2xl:text-xs font-bold text-gray-700 uppercase mb-1 2xl:mb-1.5">Contraseña</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 2xl:h-5 2xl:w-5 text-gray-400 z-10" />
                            <input 
                                type="password"
                                className="w-full pl-9 2xl:pl-10 pr-4 py-2 2xl:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none transition-all bg-white text-gray-900 font-medium text-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button 
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gray-900 text-white font-bold py-2.5 2xl:py-3 rounded-lg hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed group mt-2 text-xs 2xl:text-sm"
                    >
                        {isSubmitting ? 'Verificando...' : 'Ingresar al Sistema'}
                        {!isSubmitting && <ArrowRight className="h-3 w-3 2xl:h-4 2xl:w-4 group-hover:translate-x-1 transition-transform" />}
                    </button>
                </form>

                <div className="mt-6 2xl:mt-8 text-center flex flex-col items-center gap-3 2xl:gap-4 border-t border-gray-50 pt-4 2xl:pt-6">
                    <button className="text-xs text-teal-600 hover:text-teal-800 font-bold transition-colors">
                        ¿Olvidó su contraseña?
                    </button>
                    
                    <div className="text-[10px] text-gray-400">
                        <p>Contacte al soporte de TI de la Red de Salud Bellavista:</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1.5 bg-gray-50 py-1.5 px-3 rounded-full border border-gray-100">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span className="font-bold text-gray-600">956606972 - Ing. Jordan Chacon Villacis</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};
