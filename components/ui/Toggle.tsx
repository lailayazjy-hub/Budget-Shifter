import React from 'react';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColor?: string;
}

export const Toggle: React.FC<ToggleProps> = ({ label, checked, onChange, activeColor = '#2563eb' }) => {
  return (
    <label className="flex items-center cursor-pointer space-x-2 select-none group">
      <div className="relative">
        <input 
          type="checkbox" 
          className="sr-only" 
          checked={checked} 
          onChange={(e) => onChange(e.target.checked)} 
        />
        <div 
          className={`block w-10 h-6 rounded-full transition-colors`}
          style={{ backgroundColor: checked ? activeColor : '#cbd5e1' }}
        ></div>
        <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}></div>
      </div>
      <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{label}</span>
    </label>
  );
};
