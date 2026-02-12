import React, { useEffect, useState } from 'react';
import { Dispatch, DispatchStatus } from '../types';
import { dbService } from '../services/database';

interface Props {
  operatorId: string;
  onBack: () => void;
  onSelect: (id: string) => void;
  onResume: (dispatch: Dispatch) => void;
}

const HistoryScreen: React.FC<Props> = ({ operatorId, onBack, onSelect, onResume }) => {
  const [dispatches, setDispatches] = useState<Dispatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbService.getAllDispatches().then(data => {
      // Filter by the logged-in operator name
      const filtered = data.filter(d => d.operator_id === operatorId);
      setDispatches(filtered.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
      setLoading(false);
    });
  }, [operatorId]);

  return (
    <div className="flex-1 flex flex-col bg-slate-50">
      <div className="p-4 bg-white border-b flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 text-slate-600">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className="text-xl font-bold">My History</h2>
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest">{operatorId}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="text-center py-10 text-slate-400 uppercase text-xs font-bold tracking-widest animate-pulse">Accessing Secure Records...</div>
        ) : dispatches.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-slate-200 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-slate-500 font-bold uppercase tracking-tighter opacity-50">No dispatch sessions for your account.</p>
          </div>
        ) : (
          dispatches.map(d => (
            <div 
              key={d.id} 
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-blue-200 transition-colors"
              onClick={() => d.status === DispatchStatus.COMPLETED ? onSelect(d.dispatch_id) : onResume(d)}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{d.dispatch_id}</p>
                  <p className="text-lg font-bold text-slate-900">Session #{String(d.dispatch_no).padStart(6, '0')}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  d.status === DispatchStatus.COMPLETED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {d.status}
                </span>
              </div>
              
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-50">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Total Qty</span>
                  <span className="font-mono font-bold text-slate-700">{d.total_qty_cached} NOS</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Date</span>
                  <span className="text-sm font-medium text-slate-600">
                    {new Date(d.start_time).toLocaleDateString()}
                  </span>
                </div>
                {d.status === DispatchStatus.DRAFT && (
                   <div className="ml-auto flex items-center gap-1 text-blue-600 font-bold text-xs uppercase">
                    RESUME <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryScreen;