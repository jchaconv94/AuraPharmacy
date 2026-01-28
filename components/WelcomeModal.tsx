
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { Sparkles, ArrowRight, ShieldCheck, Building2, Calendar, Activity } from 'lucide-react';

interface WelcomeModalProps {
  user: User;
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ user, onClose }) => {
  const [greeting, setGreeting] = useState('');
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    setShow(true);

    // Calculate time-based greeting
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Buenos días');
    else if (hour < 18) setGreeting('Buenas tardes');
    else setGreeting('Buenas noches');
  }, []);

  const handleStart = () => {
      setShow(false);
      setTimeout(onClose, 300); // Wait for exit animation
  };

  if (!user || !user.personnelData) return null;

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 transition-all duration-700 ${show ? 'bg-gray-950/80 backdrop-blur-md' : 'bg-transparent pointer-events-none'}`}>
        
        <div className={`w-full max-w-[500px] rounded-3xl overflow-hidden relative transition-all duration-700 transform shadow-2xl ${show ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-90 translate-y-8'}`}>
            
            {/* --- UPPER DARK SECTION --- */}
            <div className="relative bg-gradient-to-br from-gray-900 via-teal-950 to-gray-900 pb-12">
                {/* Texture Overlay */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
                
                {/* Abstract Glows */}
                <div className="absolute top-[-100px] right-[-50px] w-64 h-64 bg-teal-500/20 rounded-full blur-[80px]"></div>
                <div className="absolute top-[20%] left-[-50px] w-48 h-48 bg-emerald-500/10 rounded-full blur-[60px]"></div>

                <div className="relative z-10 flex flex-col items-center pt-16 px-8 text-center">
                    
                    {/* Icon Container - Increased spacing from top */}
                    <div className="relative mb-8">
                        <div className="absolute inset-0 bg-teal-400 rounded-3xl blur-xl opacity-20 animate-pulse"></div>
                        <div className="bg-gradient-to-b from-gray-800 to-gray-900 p-5 rounded-3xl shadow-2xl border border-white/10 relative z-10 ring-1 ring-white/5">
                            <Activity className="h-10 w-10 text-teal-400 drop-shadow-[0_0_10px_rgba(45,212,191,0.5)]" />
                        </div>
                        <div className="absolute -bottom-1.5 -right-1.5 bg-green-500 border-4 border-gray-900 h-6 w-6 rounded-full z-20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                        </div>
                    </div>

                    {/* Status Badge - Light text for readability */}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/20 text-teal-200 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md mb-6 shadow-lg">
                        <Sparkles className="h-3 w-3 text-teal-300" />
                        Sistema Aura Pro Conectado
                    </div>

                    {/* Greeting - White Text */}
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 drop-shadow-md">
                        {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-200 to-teal-400">
                            {user.personnelData.firstName}
                        </span>
                    </h2>
                    
                    <p className="text-teal-100/70 text-sm font-medium">
                        Su sesión ha sido iniciada correctamente.
                    </p>
                </div>
            </div>

            {/* --- LOWER WHITE CARD SECTION --- */}
            {/* Se eliminó 'rounded-t-[2.5rem]' para esquinas rectas arriba */}
            <div className="bg-white relative z-20 -mt-6 px-8 pb-8 pt-8 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.3)]">
                
                {/* Info Grid */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 shadow-inner mb-6">
                    <div className="flex items-center gap-4 pb-4 border-b border-gray-200/60">
                        <div className="bg-white p-2.5 rounded-xl shadow-sm shrink-0 border border-gray-100">
                            <Building2 className="h-5 w-5 text-gray-700" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase text-gray-400 font-bold tracking-wide">Establecimiento Activo</p>
                            <p className="text-sm font-bold text-gray-900 truncate">
                                {user.facilityData?.name || 'Red de Salud'}
                            </p>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="flex items-center gap-3">
                            <div className="bg-teal-50 p-1.5 rounded-lg">
                                <ShieldCheck className="h-4 w-4 text-teal-600" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase text-gray-400 font-bold">Rol</p>
                                <p className="text-xs font-bold text-gray-800 truncate">{user.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="bg-teal-50 p-1.5 rounded-lg">
                                <Calendar className="h-4 w-4 text-teal-600" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase text-gray-400 font-bold">Fecha</p>
                                <p className="text-xs font-bold text-gray-800">
                                    {new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Action Button */}
                <button 
                    onClick={handleStart}
                    className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl shadow-xl hover:bg-black hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                >
                    <span className="relative z-10 flex items-center gap-2 text-sm sm:text-base">
                        Comenzar Gestión
                        <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                </button>
                
                <div className="mt-6 flex justify-center">
                     <p className="text-[10px] text-gray-300 font-medium bg-gray-50 px-3 py-1 rounded-full">
                        v2.6 &bull; Red de Salud Bellavista
                    </p>
                </div>
            </div>

        </div>
    </div>
  );
};
