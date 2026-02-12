
import React, { useState, useEffect } from 'react';
import { dbService } from '../services/database';
import { Dispatch, ScanRecord, PartSummary, DispatchStatus } from '../types';
import { generateExports, triggerDownload, shareFile, ExportResult } from '../services/exportService';

interface Props {
  dispatchId: string;
  isFinalizedView?: boolean;
  onBack: () => void;
  onNewDispatch?: () => void;
}

const DispatchDetailScreen: React.FC<Props> = ({ dispatchId, isFinalizedView = false, onBack, onNewDispatch }) => {
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'LOG'>('SUMMARY');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedFile, setExportedFile] = useState<ExportResult | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  
  // Patch: Delete functionality state
  const [selectedScanForAction, setSelectedScanForAction] = useState<ScanRecord | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = async () => {
    const d = await dbService.getDispatchById(dispatchId);
    const s = await dbService.getScansForDispatch(dispatchId);
    setDispatch(d);
    setScans(s);
  };

  useEffect(() => {
    load();
  }, [dispatchId]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (!dispatch) return null;

  const summaries = scans.reduce((acc, scan) => {
    if (!acc[scan.part_no]) {
      acc[scan.part_no] = { 
        part_no: scan.part_no, 
        part_name: scan.part_name, 
        boxes: 0, 
        total_qty: 0 
      };
    }
    acc[scan.part_no].boxes += 1;
    acc[scan.part_no].total_qty += scan.qty_nos;
    return acc;
  }, {} as Record<string, PartSummary>);

  const handleExport = async (type: 'PDF' | 'EXCEL') => {
    setIsExporting(true);
    setExportError(null);
    try {
      const results = await generateExports(dispatch, scans, Object.values(summaries));
      const result = type === 'PDF' ? results.pdf : results.excel;
      
      triggerDownload(result);
      setExportedFile(result);
    } catch (err: any) {
      setExportError(err.message || "Export failed to write to device storage.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (exportedFile) {
      const success = await shareFile(exportedFile);
      if (!success) {
        alert("System share not available. File is ready in Downloads folder.");
      }
    }
  };

  // Patch 1 handlers: Removal allowed even if COMPLETED
  const onRemoveOne = async (partNo: string) => {
    await dbService.removeOneScan(dispatch.dispatch_id, partNo);
    await load();
    setToast("Removed 1 box");
    setSelectedScanForAction(null);
  };

  const onRemoveAll = async (partNo: string) => {
    await dbService.removeAllScansForPart(dispatch.dispatch_id, partNo);
    await load();
    setToast(`Removed all boxes for ${partNo}`);
    setShowDeleteAllConfirm(null);
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Patch 1: Outdated Exports Banner */}
      {dispatch.exports_outdated && (
        <div className="bg-amber-100 p-2 text-center text-[9px] font-bold text-amber-800 uppercase tracking-widest border-b border-amber-200 shrink-0">
          Edits made after finalize. Exports need regeneration.
        </div>
      )}

      {/* Header */}
      <div className="p-4 bg-white border-b flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-600 active:scale-95">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-bold">{dispatch.dispatch_id}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {isFinalizedView ? 'Final Session Summary' : `Operator: ${dispatch.operator_id}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            disabled={isExporting}
            onClick={() => handleExport('EXCEL')}
            className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 active:scale-90 transition-all disabled:opacity-50"
          >
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
          </button>
        </div>
      </div>

      {/* Content Navigation */}
      <div className="flex bg-white border-b px-4 shrink-0">
        <button 
          onClick={() => setActiveTab('SUMMARY')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'SUMMARY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
        >
          Packing Summary
        </button>
        <button 
          onClick={() => setActiveTab('LOG')}
          className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${activeTab === 'LOG' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400'}`}
        >
          Full Scan Log
        </button>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <div className="bg-slate-900 rounded-2xl p-6 text-white mb-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Global Session Totals</span>
            <span className={`text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-widest ${dispatch.exports_outdated ? 'bg-amber-500/20 text-amber-400' : 'bg-green-500/20 text-green-400'}`}>
              {dispatch.exports_outdated ? 'REGEN REQUIRED' : 'Report Ready'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Total Qty</p><p className="text-xl font-mono font-bold leading-none">{dispatch.total_qty_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">NOS</p></div>
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Total Boxes</p><p className="text-xl font-mono font-bold leading-none">{dispatch.total_boxes_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">PACKS</p></div>
            <div><p className="text-[9px] text-slate-400 uppercase font-bold mb-1">Part Types</p><p className="text-xl font-mono font-bold leading-none">{dispatch.parts_count_cached}</p><p className="text-[8px] text-slate-500 uppercase mt-1">SKUS</p></div>
          </div>
        </div>

        {activeTab === 'SUMMARY' ? (
          <div className="space-y-3">
            {Object.values(summaries).length === 0 ? (
                <p className="text-center text-slate-400 py-10 italic">No grouped data found.</p>
            ) : (Object.values(summaries) as PartSummary[]).map(s => (
              <div key={s.part_no} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center group">
                <div className="flex-1 overflow-hidden pr-2">
                  <p className="font-mono font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{s.part_no}</p>
                  <p className="text-[10px] text-slate-500 uppercase truncate">{s.part_name}</p>
                </div>
                <div className="text-right shrink-0 border-l border-slate-50 pl-4">
                  <p className="text-blue-600 font-mono font-bold text-lg">{s.total_qty}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">{s.boxes} BOXES</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {scans.length === 0 ? (
                <p className="text-center text-slate-400 py-10 italic">No scan records found.</p>
            ) : scans.map((scan, i) => (
              <div 
                key={scan.id} 
                onClick={() => setSelectedScanForAction(scan)}
                className="bg-white p-3 rounded-xl text-xs border border-slate-100 flex items-center justify-between active:bg-slate-50 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-slate-50 rounded-md flex items-center justify-center text-[10px] font-bold text-slate-400">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{scan.part_no}</p>
                    <p className="text-[9px] text-slate-500 font-mono">{new Date(scan.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <span className="bg-slate-100 px-2 py-1 rounded-md font-mono font-bold text-slate-700">{scan.qty_nos} NOS</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exit Actions */}
      {isFinalizedView && (
        <div className="absolute bottom-0 inset-x-0 p-4 bg-white border-t border-slate-100 flex gap-3 z-20 pb-8">
            <button 
                onClick={onBack}
                className="flex-1 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
                Return Home
            </button>
            <button 
                onClick={onNewDispatch}
                className="flex-[1.5] py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Batch
            </button>
        </div>
      )}

      {/* ACTION SHEET for removing boxes */}
      {selectedScanForAction && (
        <>
            <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedScanForAction(null)}></div>
            <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-[2.5rem] shadow-2xl p-6 pt-4 flex flex-col animate-in slide-in-from-bottom duration-300 pb-10">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
                <div className="mb-6 px-2">
                    <h2 className="text-lg font-bold text-slate-900">Modify Scan Record</h2>
                    <p className="text-xs text-slate-500 font-mono">{selectedScanForAction.part_no}</p>
                </div>
                <div className="space-y-3">
                    <button 
                        onClick={() => onRemoveOne(selectedScanForAction.part_no)}
                        className="w-full flex items-center gap-4 p-5 bg-amber-50 text-amber-700 rounded-2xl text-left active:scale-[0.98] transition-all font-bold"
                    >
                        <div className="bg-amber-500 text-white p-2 rounded-xl">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </div>
                        Remove 1 box
                    </button>
                    <button 
                        onClick={() => { setShowDeleteAllConfirm(selectedScanForAction.part_no); setSelectedScanForAction(null); }}
                        className="w-full flex items-center gap-4 p-5 bg-red-50 text-red-700 rounded-2xl text-left active:scale-[0.98] transition-all font-bold"
                    >
                        <div className="bg-red-500 text-white p-2 rounded-xl">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        Remove all
                    </button>
                </div>
            </div>
        </>
      )}

      {/* CONFIRMATION DIALOG for "Remove All" */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
            <div className="bg-white rounded-[2rem] p-8 w-full max-w-sm text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Are you sure?</h3>
                <p className="text-slate-500 text-sm mb-6">Remove all scans for <span className="font-mono font-bold text-slate-900">{showDeleteAllConfirm}</span>? This action cannot be undone.</p>
                <div className="space-y-3">
                    <button onClick={() => onRemoveAll(showDeleteAllConfirm)} className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl active:scale-95 transition-all">REMOVE ALL</button>
                    <button onClick={() => setShowDeleteAllConfirm(null)} className="w-full py-4 text-slate-400 font-bold">CANCEL</button>
                </div>
            </div>
        </div>
      )}

      {/* FEEDBACK TOAST */}
      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                {toast}
            </div>
        </div>
      )}

      {/* Export Loader Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex flex-col items-center justify-center text-white text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6 shadow-2xl"></div>
            <h3 className="text-xl font-bold mb-1 uppercase tracking-widest">Generating Report</h3>
            <p className="text-slate-400 text-xs">Accessing device storage to write export data...</p>
        </div>
      )}

      {/* EXPORT SUCCESS DIALOG */}
      {exportedFile && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Saved Successfully</h3>
                
                <div className="bg-slate-50 p-4 rounded-2xl mb-8 text-left border border-slate-100">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-2">File Location</p>
                    <p className="font-mono text-[10px] text-blue-600 break-all leading-relaxed bg-white p-2 rounded-lg border border-blue-50">
                        {exportedFile.simulatedPath}
                    </p>
                </div>

                <div className="space-y-3">
                    <button 
                        onClick={() => triggerDownload(exportedFile)}
                        className="w-full py-5 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all text-lg"
                    >
                        OPEN FILE
                    </button>
                    <button 
                        onClick={handleShare}
                        className="w-full py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        SHARE REPORT
                    </button>
                    <button 
                        onClick={() => setExportedFile(null)}
                        className="w-full py-3 text-slate-400 font-bold hover:text-slate-600"
                    >
                        DONE
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Error Feedback */}
      {exportError && (
        <div className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm text-center shadow-2xl border-4 border-red-500">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Export Failed</h3>
                <p className="text-slate-500 text-sm mb-6">{exportError}</p>
                <button 
                    onClick={() => setExportError(null)}
                    className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-all"
                >
                    ACKNOWLEDGE
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default DispatchDetailScreen;
