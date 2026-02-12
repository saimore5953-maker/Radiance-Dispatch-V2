import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from './services/database';
import { AuthState, Dispatch, DispatchStatus, ScanRecord, PartSummary } from './types';
import LoginScreen from './components/LoginScreen';
import HomeScreen from './components/HomeScreen';
import ScanScreen from './components/ScanScreen';
import HistoryScreen from './components/HistoryScreen';
import DispatchDetailScreen from './components/DispatchDetailScreen';

const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>({ operatorId: null, isLoggedIn: false });
  const [currentView, setCurrentView] = useState<'LOGIN' | 'HOME' | 'SCAN' | 'HISTORY' | 'DETAIL' | 'SUMMARY'>('LOGIN');
  const [activeDispatch, setActiveDispatch] = useState<Dispatch | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    dbService.init().then(() => setIsDbReady(true));
  }, []);

  const handleLogin = (id: string) => {
    setAuth({ operatorId: id, isLoggedIn: true });
    setCurrentView('HOME');
  };

  const handleLogout = () => {
    setAuth({ operatorId: null, isLoggedIn: false });
    setCurrentView('LOGIN');
  };

  const startNewDispatch = async () => {
    const nextNo = await dbService.getNextDispatchNo();
    const date = new Date();
    const dateKey = date.toISOString().slice(0, 10).replace(/-/g, '');
    const dailySeq = await dbService.getDailySeq(dateKey);
    const dateStr = date.toISOString().slice(2, 10).replace(/-/g, '');
    
    const newDispatch: Dispatch = {
      id: crypto.randomUUID(),
      dispatch_no: nextNo,
      dispatch_id: `DSP-${dateStr}-${String(dailySeq).padStart(2, '0')}`,
      operator_id: auth.operatorId || 'UNKNOWN',
      start_time: new Date().toISOString(),
      status: DispatchStatus.DRAFT,
      total_boxes_cached: 0,
      total_qty_cached: 0,
      parts_count_cached: 0,
    };

    await dbService.createDispatch(newDispatch);
    setActiveDispatch(newDispatch);
    setCurrentView('SCAN');
  };

  const resumeDispatch = (dispatch: Dispatch) => {
    setActiveDispatch(dispatch);
    setCurrentView('SCAN');
  };

  const viewHistory = () => setCurrentView('HISTORY');
  
  const viewDetail = (id: string) => {
    setSelectedDispatchId(id);
    setCurrentView('DETAIL');
  };

  const viewSummary = (id: string) => {
    setSelectedDispatchId(id);
    setCurrentView('SUMMARY');
  };

  if (!isDbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium uppercase tracking-widest">RADIANCE DISPATCH</p>
          <p className="text-slate-400 text-xs mt-2 italic">Loading Secure Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-white shadow-2xl overflow-hidden flex flex-col relative">
      {currentView === 'LOGIN' && <LoginScreen onLogin={handleLogin} />}
      
      {currentView === 'HOME' && (
        <HomeScreen 
          operatorId={auth.operatorId!} 
          onStart={startNewDispatch} 
          onHistory={viewHistory}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'SCAN' && activeDispatch && (
        <ScanScreen 
          dispatch={activeDispatch} 
          onBack={() => setCurrentView('HOME')}
          onComplete={(id) => viewSummary(id)}
        />
      )}

      {currentView === 'HISTORY' && (
        <HistoryScreen 
          operatorId={auth.operatorId!}
          onBack={() => setCurrentView('HOME')}
          onSelect={viewDetail}
          onResume={resumeDispatch}
        />
      )}

      {(currentView === 'DETAIL' || currentView === 'SUMMARY') && selectedDispatchId && (
        <DispatchDetailScreen 
          dispatchId={selectedDispatchId} 
          isFinalizedView={currentView === 'SUMMARY'}
          onBack={() => currentView === 'SUMMARY' ? setCurrentView('HOME') : setCurrentView('HISTORY')}
          onNewDispatch={startNewDispatch}
        />
      )}
    </div>
  );
};

export default App;