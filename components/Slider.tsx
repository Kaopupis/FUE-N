
import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  minLabel: string;
  maxLabel: string;
  icon: string;
}

export const Slider: React.FC<SliderProps> = ({ label, value, onChange, minLabel, maxLabel, icon }) => {
  return (
    <div className="space-y-3 mb-6">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
          <span>{icon}</span> {label}
        </label>
        <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
          {value}/10
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
      <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
};
