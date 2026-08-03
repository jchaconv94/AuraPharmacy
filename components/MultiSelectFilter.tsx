import React, { useState, useEffect } from 'react';
import { Filter, Check, Search } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface MultiSelectFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
  portalTarget?: HTMLElement | null;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ options, selected, onChange, label, portalTarget }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [tempSelected, setTempSelected] = useState<string[]>(selected);
  
  const { triggerRef, menuStyles } = useDropdownPosition(isOpen);

  useEffect(() => {
    setTempSelected(selected);
  }, [selected]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAllSelected = filteredOptions.length > 0 && filteredOptions.every(option => tempSelected.includes(option));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setTempSelected(prev => prev.filter(s => !filteredOptions.includes(s)));
    } else {
      setTempSelected(prev => Array.from(new Set([...prev, ...filteredOptions])));
    }
  };

  const toggleOption = (option: string) => {
    setTempSelected(prev =>
      prev.includes(option) ? prev.filter(s => s !== option) : [...prev, option]
    );
  };

  const handleAccept = () => {
    onChange(tempSelected);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempSelected(selected);
    setIsOpen(false);
  };

  const dropdownContent = isOpen && (
    <div 
      className="bg-white border border-gray-200 rounded-lg shadow-lg z-[120000] w-64 p-3 flex flex-col gap-2 fixed"
      style={menuStyles}
    >
      <div className="text-xs font-bold">{label}</div>
      <div className="relative">
        <Search className="absolute left-2 top-1.5 h-3 w-3 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar..."
          className="w-full pl-7 pr-2 py-1 text-xs border border-gray-300 rounded"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <button
        onClick={toggleSelectAll}
        className="flex items-center gap-2 w-full text-left text-xs p-1 hover:bg-gray-100 rounded"
      >
        <div className={`w-3 h-3 border rounded flex items-center justify-center ${isAllSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
          {isAllSelected && <Check className="h-2 w-2 text-white" />}
        </div>
        Seleccionar todo
      </button>
      <div className="max-h-60 overflow-y-auto border-t border-gray-100 pt-1">
        {filteredOptions.map(option => (
          <button
            key={option}
            onClick={() => toggleOption(option)}
            className="flex items-center gap-2 w-full text-left text-xs p-1 hover:bg-gray-100 rounded"
          >
            <div className={`w-3 h-3 border rounded flex items-center justify-center ${tempSelected.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
              {tempSelected.includes(option) && <Check className="h-2 w-2 text-white" />}
            </div>
            {option}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <button onClick={handleCancel} className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
        <button onClick={handleAccept} className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700">Aceptar</button>
      </div>
    </div>
  );

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1 hover:bg-gray-200 rounded ${selected.length !== options.length ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <Filter className="h-4 w-4" />
      </button>
      {createPortal(dropdownContent, portalTarget || document.body)}
    </div>
  );
};
