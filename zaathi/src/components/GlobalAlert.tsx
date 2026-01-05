
import React from 'react';
import { Alert } from '../types';

interface GlobalAlertProps {
  alerts: Alert[];
}

const GlobalAlert: React.FC<GlobalAlertProps> = ({ alerts }) => {
  if (alerts.length === 0) return null;

  const latest = alerts[0];

  return (
    <div className="fixed top-24 right-4 z-[90] pointer-events-none space-y-2 max-w-xs w-full animate-slideIn">
      <div className={`p-4 rounded-2xl shadow-lg border-l-4 pointer-events-auto bg-white ${latest.type === 'critical' ? 'border-rose-500 shadow-rose-100' : 'border-indigo-500 shadow-indigo-100'}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl">{latest.type === 'critical' ? '⚠️' : '🔔'}</span>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">{latest.title}</h4>
            <p className="text-slate-500 text-xs line-clamp-2">{latest.message}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalAlert;
