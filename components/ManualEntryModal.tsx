
import React, { useState } from 'react';
import { X, Plus, Trash2, ShoppingCart, StickyNote, Tag, Beaker } from 'lucide-react';
import { AdditionalItem } from '../types';

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: AdditionalItem[];
  onAdd: (item: AdditionalItem) => void;
  onRemove: (id: string) => void;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  isOpen,
  onClose,
  items,
  onAdd,
  onRemove
}) => {
  const [sismedCode, setSismedCode] = useState('');
  const [name, setName] = useState('');
  const [ff, setFf] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [observation, setObservation] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !quantity || Number(quantity) <= 0) return;

    const newItem: AdditionalItem = {
      id: Date.now().toString(),
      name: name.trim(),
      quantity: Number(quantity),
      observation: observation.trim(),
      sismedCode: sismedCode.trim(),
      ff: ff.trim()
    };

    onAdd(newItem);
    
    // Reset form
    setSismedCode('');
    setName('');
    setFf('');
    setQuantity('');
    setObservation('');
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <div className="bg-purple-500/20 p-1.5 rounded-lg">
                <ShoppingCart className="h-5 w-5 text-purple-400" />
            </div>
            <div>
                <h3 className="text-lg font-bold">Requerimientos Adicionales</h3>
                <p className="text-xs text-gray-400 font-normal">Agregue ítems fuera de la matriz (Ej. Mascarillas, Alcohol, etc.)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
            
            {/* Input Form */}
            <form onSubmit={handleSubmit} className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-6">
                
                {/* Row 1: Code & Name */}
                <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-4 mb-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                            <Tag className="h-3 w-3 text-gray-400" /> Cód. SISMED
                            <span className="text-[10px] text-gray-400 font-normal normal-case ml-auto">(Opc)</span>
                        </label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono"
                            placeholder="Ej. 12345"
                            value={sismedCode}
                            onChange={(e) => setSismedCode(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Descripción del Ítem <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            placeholder="Ej. Alcohol Etílico 70°"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                {/* Row 2: FF & Quantity */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-4 mb-3">
                     <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                            <Beaker className="h-3 w-3 text-gray-400" /> Forma Farm.
                            <span className="text-[10px] text-gray-400 font-normal normal-case ml-auto">(Opc)</span>
                        </label>
                        <input 
                            type="text" 
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                            placeholder="Ej. FRASCO x 1L"
                            value={ff}
                            onChange={(e) => setFf(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase mb-1">Cantidad <span className="text-red-500">*</span></label>
                        <input 
                            type="number" 
                            min="1"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm font-bold text-center"
                            placeholder="0"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>
                </div>
                
                {/* Row 3: Obs */}
                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-1 flex items-center gap-1">
                        <StickyNote className="h-3 w-3 text-gray-400" /> Observación
                        <span className="text-[10px] text-gray-400 font-normal normal-case ml-auto">(Opc)</span>
                    </label>
                    <input 
                        type="text" 
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                        placeholder="Ej. Para campaña de vacunación"
                        value={observation}
                        onChange={(e) => setObservation(e.target.value)}
                    />
                </div>

                <button 
                    type="submit"
                    disabled={!name.trim() || !quantity}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Agregar a la Lista
                </button>
            </form>

            {/* List */}
            <div>
                <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    Lista de Adicionales ({items.length})
                </h4>
                
                {items.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                        No hay ítems adicionales agregados.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.id} className="flex items-center justify-between bg-white border border-gray-200 p-3 rounded-lg shadow-sm group">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        {item.sismedCode && (
                                            <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 rounded border border-gray-200">
                                                {item.sismedCode}
                                            </span>
                                        )}
                                        <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        {item.ff && (
                                            <span className="bg-purple-50 text-purple-700 px-1.5 rounded border border-purple-100">
                                                {item.ff}
                                            </span>
                                        )}
                                        {item.observation && (
                                            <span className="flex items-center gap-1">
                                                <StickyNote className="h-3 w-3" /> {item.observation}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-mono font-bold text-lg text-purple-700 bg-purple-50 px-2 rounded">
                                        {item.quantity.toLocaleString()}
                                    </span>
                                    <button 
                                        onClick={() => onRemove(item.id)}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
           <button 
             onClick={onClose}
             className="px-6 py-2 text-sm font-bold text-white bg-gray-900 rounded-lg hover:bg-black transition-colors"
           >
             Guardar y Cerrar
           </button>
        </div>

      </div>
    </div>
  );
};
