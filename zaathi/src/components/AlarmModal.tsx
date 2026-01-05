
import React, { useState } from 'react';
import { Alert, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface AlarmModalProps {
  alert: Alert | null;
  lang: Language;
  onClose: () => void;
  onTaken: (alert: Alert) => void;
  onSnooze: (alert: Alert) => void;
  onReschedule: (alert: Alert, time: string) => void;
}

const AlarmModal: React.FC<AlarmModalProps> = ({ alert, lang, onClose, onTaken, onSnooze, onReschedule }) => {
  const [showReschedule, setShowReschedule] = useState(false);
  const [newTime, setNewTime] = useState('');

  if (!alert) return null;
  const t = TRANSLATIONS[lang];

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTime) {
      onReschedule(alert, newTime);
      setShowReschedule(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={onClose}>
      <div className={`w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl p-8 border-t-[12px] transition-all duration-300 ${alert.type === 'critical' ? 'border-rose-500' : 'border-indigo-500'}`} onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-6 ${alert.type === 'critical' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'}`}>
            {alert.type === 'critical' ? '⚠️' : '🔔'}
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mb-2 leading-tight">{alert.title}</h2>
          <p className="text-slate-600 font-medium mb-8 text-lg leading-relaxed">{alert.message}</p>
          
          <div className="w-full space-y-3">
            {/* Main Action Group */}
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => onTaken(alert)}
                className="py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold shadow-lg shadow-emerald-100 active:scale-95 transition"
              >
                ✅ {t.forms.taken}
              </button>
              <button 
                onClick={() => onSnooze(alert)}
                className="py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-extrabold shadow-lg shadow-amber-100 active:scale-95 transition"
              >
                💤 {t.forms.snooze}
              </button>
            </div>

            {/* Secondary Actions */}
            {!showReschedule ? (
              <button 
                onClick={() => setShowReschedule(true)}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition"
              >
                ⏰ {t.forms.remindLater}
              </button>
            ) : (
              <form onSubmit={handleRescheduleSubmit} className="flex gap-2 animate-fadeIn">
                <input 
                  type="time" 
                  required 
                  value={newTime}
                  onChange={e => setNewTime(e.target.value)}
                  className="flex-1 px-4 py-2 border rounded-xl font-bold outline-none focus:border-indigo-500"
                />
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold">
                  {t.forms.reschedule}
                </button>
              </form>
            )}

            <button 
              onClick={onClose}
              className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest mt-4"
            >
              {t.forms.acknowledge}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlarmModal;
