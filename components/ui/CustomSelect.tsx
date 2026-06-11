import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDropdownPosition } from '../../hooks/useDropdownPosition';

export interface Option {
    value: string;
    label: string | React.ReactNode;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: Option[];
    placeholder?: string;
    disabled?: boolean;
    className?: string; // Optional class for the trigger button
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
    value, onChange, options, placeholder = "Seleccionar...", disabled = false, className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const { triggerRef, menuStyles } = useDropdownPosition(isOpen, { align: 'left' });
    const menuRef = useRef<HTMLDivElement>(null);

    // Ajustes dinamicos para que el menú tenga el mismo ancho que el trigger
    const [dynamicStyles, setDynamicStyles] = useState<React.CSSProperties>({});

    useEffect(() => {
        if (isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setDynamicStyles({
                ...menuStyles,
                width: rect.width // Igualar el ancho del select
            });
        }
    }, [menuStyles, isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                menuRef.current && !menuRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selectedOption = options.find(o => String(o.value) === String(value));

    const dropdownContent = isOpen && !disabled && (
        <div 
            ref={menuRef}
            className="bg-white border border-gray-200 rounded-xl shadow-xl z-[200000] py-1 flex flex-col fixed overflow-hidden"
            style={dynamicStyles}
        >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {options.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 italic text-center">Sin opciones</div>
                ) : (
                    options.map(option => {
                        const isSelected = String(option.value) === String(value);
                        return (
                            <button
                                key={option.value}
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className={`flex items-center justify-between w-full text-left px-4 py-2.5 text-sm transition-colors ${
                                    isSelected ? 'bg-teal-50 text-teal-700 font-bold' : 'text-gray-700 hover:bg-gray-50 hover:text-teal-600 font-medium'
                                }`}
                            >
                                <span className="truncate">{option.label}</span>
                                {isSelected && <Check className="h-4 w-4 shrink-0 text-teal-600" />}
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );

    return (
        <div className="relative" ref={triggerRef}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-teal-500 outline-none transition-all shadow-sm ${
                    disabled 
                        ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' 
                        : isOpen 
                            ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 text-gray-900' 
                            : 'bg-white border-gray-300 text-gray-900 hover:bg-gray-50'
                } ${className}`}
            >
                <span className="truncate mr-2 font-medium">
                    {selectedOption ? selectedOption.label : <span className="text-gray-400 font-normal">{placeholder}</span>}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-600' : 'text-gray-400'}`} />
            </button>
            {createPortal(dropdownContent, document.body)}
        </div>
    );
};
