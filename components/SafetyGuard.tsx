
import React from 'react';
import { translations, Language } from '../translations';

interface SafetyGuardProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const SafetyGuard: React.FC<SafetyGuardProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl border-t-4 border-rose-500 animate-in fade-in zoom-in duration-300">
        <div className="text-rose-500 mb-4">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">{t.safety_title}</h2>
        <p className="text-slate-600 mb-6 leading-relaxed">
          {t.safety_desc}
        </p>
        
        <div className="space-y-3 mb-8">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{t.safety_global}</h3>
            <p className="text-xs text-slate-500">{t.safety_global_desc}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">{t.safety_helpline}</h3>
            <p className="text-xs text-slate-500">{t.safety_helpline_desc} <a href="https://www.findahelpline.com" target="_blank" className="underline text-emerald-600">findahelpline.com</a></p>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
        >
          {t.safety_btn}
        </button>
      </div>
    </div>
  );
};
