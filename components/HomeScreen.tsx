import React from 'react';

interface Props {
  operatorId: string;
  onStart: () => void;
  onHistory: () => void;
  onLogout: () => void;
}

const HomeScreen: React.FC<Props> = ({ operatorId, onStart, onHistory, onLogout }) => {
  return (
    <div className="flex-1 flex flex-col p-6 bg-slate-50">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome,</h2>
          <p className="text-blue-600 font-semibold">{operatorId}</p>
        </div>
        <button 
          onClick={onLogout}
          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 flex-1">
        <button 
          onClick={onStart}
          className="bg-blue-600 text-white p-8 rounded-3xl shadow-xl shadow-blue-500/20 flex flex-col items-center justify-center text-center group active:scale-95 transition-all"
        >
          <div className="bg-white/20 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-xl font-bold">New Dispatch</span>
          <span className="text-sm opacity-80 mt-1">Start a fresh scanning session</span>
        </button>

        <div className="grid grid-cols-1 gap-4 h-48">
          <button 
            onClick={onHistory}
            className="bg-white border-2 border-slate-100 p-6 rounded-3xl flex flex-col items-center justify-center text-center active:scale-95 transition-all"
          >
            <svg className="w-8 h-8 text-blue-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-slate-800">History</span>
          </button>
        </div>
      </div>

      <div className="mt-8 bg-blue-50 p-4 rounded-2xl flex items-center gap-4">
        <div className="bg-blue-600 h-10 w-10 rounded-full flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-sm text-blue-800">
          <span className="font-bold">Pro Tip:</span> Ensure box tags are well-lit for faster OCR recognition.
        </p>
      </div>
    </div>
  );
};

export default HomeScreen;