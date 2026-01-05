
import React from 'react';
// Fix: TRANSLATIONS is not exported from types.ts, it is in constants.tsx
import { Language, Page } from '../types';
import { TRANSLATIONS } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  lang: Language;
  onLangChange: (l: Language) => void;
  onLogoClick: () => void;
  onAssistantClick: () => void;
  activePage: Page;
}

const Layout: React.FC<LayoutProps> = ({ children, lang, onLangChange, onLogoClick, onAssistantClick, activePage }) => {
  const t = TRANSLATIONS[lang];

  return (
    <div className="min-h-screen p-4 md:p-10 transition-all duration-300 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 p-5 rounded-3xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={onLogoClick}>
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-xl shadow-indigo-100 group-hover:scale-105 transition-transform">Z</div>
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-none">{t.title}</h1>
              <p className="text-indigo-600 font-semibold text-xs tracking-widest uppercase mt-1">{t.subtitle}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={onAssistantClick}
              className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100 group"
            >
              <span className="text-xl group-hover:rotate-12 transition-transform">🤖</span>
              <span className="hidden sm:inline">Zaathi AI</span>
            </button>
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex flex-wrap gap-2 justify-center">
              {(['en', 'ml', 'hi', 'ta', 'kn'] as Language[]).map(l => (
                <button 
                  key={l} 
                  onClick={() => onLangChange(l)} 
                  className={`px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 ${lang === l ? 'bg-slate-900 text-white shadow-lg scale-105' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {l === 'en' ? 'EN' : l === 'ml' ? 'മല' : l === 'hi' ? 'हिन्दी' : l === 'ta' ? 'தமிழ்' : 'ಕನ್ನಡ'}
                </button>
              ))}
            </div>
          </div>
        </header>
        <main className="animate-fadeIn">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
