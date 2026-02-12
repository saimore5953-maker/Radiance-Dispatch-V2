import React, { useState } from 'react';

interface Props {
  onLogin: (name: string) => void;
}

const PIN_MAP: Record<string, string> = {
  '0001': 'Prajval Kulkarni',
  '0002': 'Ravi Kumar',
  '0003': 'Sai More',
};

const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const operatorName = PIN_MAP[pin];
    if (operatorName) {
      setError(null);
      onLogin(operatorName);
    } else {
      setError('Invalid PIN');
    }
  };

  return (
    <div className="flex-1 flex flex-col p-8 justify-center bg-slate-900 text-white">
      <div className="mb-12 text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">RADIANCE DISPATCH</h1>
        <p className="text-slate-400 mt-2">Industrial Scanning System</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1 ml-1">Enter PIN</label>
          <input 
            type="password" 
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••"
            className={`w-full bg-slate-800 border-none rounded-xl px-4 py-4 text-center text-2xl focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600 tracking-[0.5em] ${error ? 'ring-2 ring-red-500' : ''}`}
            maxLength={4}
            required
            autoFocus
          />
          {error && (
            <p className="text-red-500 text-xs font-bold mt-2 text-center uppercase tracking-widest animate-pulse">
              {error}
            </p>
          )}
        </div>
        <button 
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/25 transition-all text-lg"
        >
          LOGIN
        </button>
      </form>
      
      <p className="mt-8 text-center text-xs text-slate-500 uppercase tracking-widest">
        Secure Access • v1.0 Stable
      </p>
    </div>
  );
};

export default LoginScreen;