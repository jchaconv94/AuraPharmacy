import React, { useState, useRef, useEffect } from 'react';
import { Filter, Check } from 'lucide-react';

interface MultiSelectFilterProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label: string;
}

export const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({ options, selected, onChange, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      onChange(selected.filter(s => s !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button onClick={() => setIsOpen(!isOpen)} className={`p-0 hover:bg-gray-200 rounded ${selected.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
        <Filter className="h-3 w-3" />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-48 p-2">
          <div className="text-xs font-bold mb-2">{label}</div>
          <div className="max-h-60 overflow-y-auto">
            {options.map(option => (
              <button
                key={option}
                onClick={() => toggleOption(option)}
                className="flex items-center gap-2 w-full text-left text-xs p-1 hover:bg-gray-100 rounded"
              >
                <div className={`w-3 h-3 border rounded flex items-center justify-center ${selected.includes(option) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>
                  {selected.includes(option) && <Check className="h-2 w-2 text-white" />}
                </div>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
