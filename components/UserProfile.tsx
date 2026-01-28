
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  User as UserIcon, 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  Loader2, 
  Fingerprint, 
  Lock, 
  UserCircle, 
  Save, 
  Pencil,
  X,
  Briefcase,
  MapPin,
  ShieldCheck,
  KeyRound,
  Shield
} from 'lucide-react';
import { api } from '../services/api';

export const UserProfile: React.FC = () => {
  const { user, updateUserContext } = useAuth();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
      firstName: '',
      lastName: '',
      dni: '',
      phone: '',
      email: '',
      birthDate: '',
      username: '',
      newPassword: '',
      confirmPassword: ''
  });

  // Load data into form when modal opens
  useEffect(() => {
    if (isEditModalOpen && user?.personnelData) {
        setFormData({
            firstName: user.personnelData.firstName,
            lastName: user.personnelData.lastName,
            dni: user.personnelData.dni,
            phone: user.personnelData.phone || '',
            email: user.personnelData.email || '',
            birthDate: user.personnelData.birthDate || '',
            username: user.username,
            newPassword: '',
            confirmPassword: ''
        });
        setError(null);
    }
  }, [isEditModalOpen, user]);

  if (!user || !user.personnelData) return null;

  const handleSave = async () => {
      setError(null);

      // Basic Validations
      if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.dni.trim() || !formData.username.trim()) {
          setError("Los campos Nombre, Apellido, DNI y Usuario son obligatorios.");
          return;
      }

      // Password Validation
      if (formData.newPassword || formData.confirmPassword) {
          if (formData.newPassword !== formData.confirmPassword) {
              setError("Las nuevas contraseñas no coinciden.");
              return;
          }
          if (formData.newPassword.length < 4) {
              setError("La contraseña es muy corta.");
              return;
          }
      }

      setIsSaving(true);
      
      const payload: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          dni: formData.dni,
          phone: formData.phone,
          email: formData.email,
          birthDate: formData.birthDate,
          username: formData.username
      };

      if (formData.newPassword) {
          payload.password = formData.newPassword;
      }

      const response = await api.updateProfile(user.personnelId, payload);
      
      if (response.success) {
          // Update local context
          updateUserContext({
              username: formData.username,
              personnelData: {
                  ...user.personnelData!,
                  firstName: formData.firstName,
                  lastName: formData.lastName,
                  dni: formData.dni,
                  phone: formData.phone,
                  email: formData.email,
                  birthDate: formData.birthDate
              }
          });
          setIsEditModalOpen(false);
      } else {
          setError(response.message || "Error al guardar los cambios.");
      }

      setIsSaving(false);
  };

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 py-6 2xl:py-8 animate-in fade-in slide-in-from-bottom-4">
        
        {/* Header Section Container */}
        <div className="relative mb-6 2xl:mb-8">
            
            {/* Banner Background */}
            <div className="h-32 2xl:h-48 rounded-t-2xl 2xl:rounded-t-3xl bg-gradient-to-r from-gray-900 via-teal-900 to-gray-900 relative overflow-hidden">
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                 <div className="absolute bottom-4 right-6 text-white/10 font-black text-4xl 2xl:text-6xl select-none hidden sm:block">AURA</div>
            </div>
            
            {/* Profile Info Bar (Matching Gradient Card Overlapping Banner) */}
            <div className="bg-gradient-to-r from-gray-900 via-teal-900 to-gray-900 rounded-b-2xl 2xl:rounded-b-3xl shadow-xl border-x border-b border-gray-800 px-6 pb-4 2xl:pb-6 pt-0 relative z-10">
                <div className="flex flex-col sm:flex-row items-center sm:items-end -mt-12 sm:-mt-16 2xl:-mt-20 gap-4 2xl:gap-6">
                    
                    {/* Avatar */}
                    <div className="relative group shrink-0">
                        <div className="h-24 w-24 sm:h-32 sm:w-32 2xl:h-40 2xl:w-40 bg-gray-900 rounded-full p-2 shadow-xl border border-gray-800">
                            <div className="h-full w-full bg-gray-800 rounded-full flex items-center justify-center overflow-hidden border border-gray-700">
                                 <UserIcon className="h-12 w-12 2xl:h-16 2xl:w-16 text-gray-500" />
                            </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-green-500 h-4 w-4 2xl:h-6 2xl:w-6 rounded-full border-4 border-gray-900 shadow-sm" title="Activo"></div>
                    </div>
                    
                    {/* Info & Actions */}
                    <div className="flex-1 w-full flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-center sm:text-left pb-2">
                        <div>
                            <h1 className="text-2xl 2xl:text-3xl font-black text-white flex items-center justify-center sm:justify-start gap-2 drop-shadow-sm">
                                {user.personnelData.firstName} {user.personnelData.lastName}
                                <ShieldCheck className="h-5 w-5 2xl:h-6 2xl:w-6 text-teal-400" />
                            </h1>
                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-2 gap-x-4 mt-2 text-gray-300">
                                <span className="bg-black/30 text-teal-300 px-2 py-0.5 2xl:px-3 2xl:py-1 rounded-full text-[10px] 2xl:text-xs font-bold uppercase tracking-wider border border-white/10 shadow-sm backdrop-blur-sm">
                                    {user.role}
                                </span>
                                <span className="flex items-center gap-1 text-xs 2xl:text-sm font-medium">
                                    <Fingerprint className="h-3 w-3 2xl:h-4 2xl:w-4 text-teal-400/80" />
                                    <span className="font-mono text-gray-200">{user.personnelData.dni}</span>
                                </span>
                                <span className="hidden sm:inline text-gray-600">|</span>
                                <span className="flex items-center gap-1 text-xs 2xl:text-sm font-medium text-gray-300">
                                    <UserCircle className="h-3 w-3 2xl:h-4 2xl:w-4 text-teal-400/80" />
                                    {user.username}
                                </span>
                            </div>
                        </div>

                        <div className="shrink-0">
                            <button 
                                onClick={() => setIsEditModalOpen(true)}
                                className="flex items-center justify-center gap-2 bg-white text-gray-900 px-4 py-2 2xl:px-6 2xl:py-3 rounded-xl font-bold shadow-lg transition-all hover:bg-gray-100 hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto text-xs 2xl:text-sm border border-gray-200"
                            >
                                <Pencil className="h-3 w-3 2xl:h-4 2xl:w-4" />
                                <span>Editar Perfil</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            
            {/* Left Column: Work Info */}
            <div className="space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 2xl:p-6 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5">
                        <Building2 className="h-20 w-20 2xl:h-24 2xl:w-24" />
                    </div>
                    <h3 className="text-[10px] 2xl:text-xs font-bold text-teal-600 uppercase tracking-widest mb-3 2xl:mb-4 flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                        Información Laboral
                    </h3>
                    
                    <div className="space-y-3 2xl:space-y-4 relative z-10">
                        <div>
                            <label className="text-[10px] 2xl:text-xs text-gray-400 font-bold uppercase">Establecimiento</label>
                            <p className="text-base 2xl:text-lg font-bold text-gray-900 leading-tight mt-0.5">
                                {user.facilityData?.name || 'No Asignado'}
                            </p>
                        </div>
                        
                        <div className="flex gap-4">
                            <div>
                                <label className="text-[10px] 2xl:text-xs text-gray-400 font-bold uppercase">Código IPRESS</label>
                                <p className="text-xs 2xl:text-sm font-mono font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded w-fit mt-0.5">
                                    {user.facilityData?.code || '---'}
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] 2xl:text-xs text-gray-400 font-bold uppercase">Categoría</label>
                                <p className="text-xs 2xl:text-sm font-medium text-gray-700 bg-gray-50 px-2 py-1 rounded w-fit mt-0.5">
                                    {user.facilityData?.category || '---'}
                                </p>
                            </div>
                        </div>

                        <div className="pt-3 2xl:pt-4 mt-2 border-t border-gray-100">
                             <div className="flex items-center gap-2 text-xs text-gray-500">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>Red de Salud Bellavista</span>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-sm border border-gray-200 p-5 2xl:p-6">
                    <h3 className="text-[10px] 2xl:text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 2xl:mb-4 flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                        Seguridad
                    </h3>
                    <div className="flex items-center gap-3">
                        <div className="bg-gray-200 p-2 rounded-full">
                            <UserCircle className="h-4 w-4 2xl:h-5 2xl:w-5 text-gray-600" />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-400 font-bold uppercase">Usuario de Sistema</label>
                            <p className="text-xs 2xl:text-sm font-mono font-bold text-gray-900">{user.username}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Middle & Right Column merged for Contact Info */}
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 2xl:p-8 h-full">
                    <h3 className="text-[10px] 2xl:text-xs font-bold text-teal-600 uppercase tracking-widest mb-4 2xl:mb-6 flex items-center gap-2">
                        <UserIcon className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                        Detalles de Contacto
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 2xl:gap-y-8 gap-x-12">
                        <div className="flex gap-4 items-start">
                            <div className="bg-blue-50 p-2 2xl:p-2.5 rounded-xl text-blue-600 shrink-0">
                                <Phone className="h-4 w-4 2xl:h-5 2xl:w-5" />
                            </div>
                            <div>
                                <label className="block text-[10px] 2xl:text-xs font-bold text-gray-400 uppercase mb-1">Teléfono Celular</label>
                                <p className="text-sm 2xl:text-base font-medium text-gray-900">
                                    {user.personnelData.phone || <span className="text-gray-400 italic">No registrado</span>}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="bg-purple-50 p-2 2xl:p-2.5 rounded-xl text-purple-600 shrink-0">
                                <Mail className="h-4 w-4 2xl:h-5 2xl:w-5" />
                            </div>
                            <div>
                                <label className="block text-[10px] 2xl:text-xs font-bold text-gray-400 uppercase mb-1">Correo Electrónico</label>
                                <p className="text-sm 2xl:text-base font-medium text-gray-900 break-all">
                                    {user.personnelData.email || <span className="text-gray-400 italic">No registrado</span>}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="bg-orange-50 p-2 2xl:p-2.5 rounded-xl text-orange-600 shrink-0">
                                <Calendar className="h-4 w-4 2xl:h-5 2xl:w-5" />
                            </div>
                            <div>
                                <label className="block text-[10px] 2xl:text-xs font-bold text-gray-400 uppercase mb-1">Fecha de Nacimiento</label>
                                <p className="text-sm 2xl:text-base font-medium text-gray-900">
                                    {user.personnelData.birthDate ? (
                                        // Convert YYYY-MM-DD to DD/MM/YYYY
                                        user.personnelData.birthDate.split('-').reverse().join('/')
                                    ) : (
                                        <span className="text-gray-400 italic">No registrado</span>
                                    )}
                                </p>
                            </div>
                        </div>
                        
                    </div>
                </div>
            </div>
        </div>
    </div>

    {/* EDIT MODAL */}
    {isEditModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                
                {/* Modal Header */}
                <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-teal-500/20 p-2 rounded-lg">
                            <UserIcon className="h-5 w-5 text-teal-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Editar Perfil</h3>
                            <p className="text-xs text-gray-400">Actualice sus datos personales y credenciales.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors hover:bg-white/10 p-1 rounded-full"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    
                    {error && (
                        <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded text-red-700 text-sm font-medium flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-6">
                        
                        {/* Section 1: Personal Data */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Fingerprint className="h-4 w-4" /> Datos Personales
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombres <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                                        value={formData.firstName}
                                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Apellidos <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                                        value={formData.lastName}
                                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">DNI <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        maxLength={8}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none font-mono bg-white text-gray-900"
                                        value={formData.dni}
                                        onChange={(e) => setFormData({...formData, dni: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Contact */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                            <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Contacto
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                                    <input 
                                        type="tel" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        placeholder="999 999 999"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Nacimiento</label>
                                    <input 
                                        type="date" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                                        value={formData.birthDate}
                                        onChange={(e) => setFormData({...formData, birthDate: e.target.value})}
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                                    <input 
                                        type="email" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 outline-none bg-white text-gray-900"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        placeholder="usuario@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Security */}
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
                            <h4 className="text-xs font-bold text-yellow-700 uppercase mb-4 flex items-center gap-2">
                                <KeyRound className="h-4 w-4" /> Seguridad de Cuenta
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre de Usuario <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 outline-none bg-white text-gray-900 font-mono"
                                        value={formData.username}
                                        onChange={(e) => setFormData({...formData, username: e.target.value})}
                                    />
                                </div>
                                
                                <div className="pt-2 border-t border-yellow-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="col-span-2 text-[10px] text-gray-500 font-medium">
                                        Deje los campos de contraseña vacíos si no desea cambiarla.
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Nueva Contraseña</label>
                                        <input 
                                            type="password" 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 outline-none bg-white text-gray-900"
                                            value={formData.newPassword}
                                            onChange={(e) => setFormData({...formData, newPassword: e.target.value})}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Confirmar</label>
                                        <input 
                                            type="password" 
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 outline-none bg-white text-gray-900"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                                            autoComplete="new-password"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                    <button 
                        onClick={() => setIsEditModalOpen(false)}
                        className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                        disabled={isSaving}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-gray-900 text-white font-bold py-2.5 px-6 rounded-lg shadow-md hover:bg-black transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar Cambios
                    </button>
                </div>

            </div>
        </div>
    )}
    </>
  );
};
