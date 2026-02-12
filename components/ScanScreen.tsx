
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { dbService } from '../services/database';
import { performLocalOCR, ROIRect } from '../services/ocrService';
import { Dispatch, ScanRecord, ScanStatus, PartSummary, DispatchStatus } from '../types';
import { generateExports } from '../services/exportService';

interface Props {
  dispatch: Dispatch;
  onBack: () => void;
  onComplete: (dispatchId: string) => void;
}

const ScanScreen: React.FC<Props> = ({ dispatch, onBack, onComplete }) => {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [summaries, setSummaries] = useState<PartSummary[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [lastScan, setLastScan] = useState<ScanRecord | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [debugUrl, setDebugUrl] = useState<string | null>(null);
  const [screenHeight, setScreenHeight] = useState(window.innerHeight);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async () => {
    const data = await dbService.getScansForDispatch(dispatch.dispatch_id);
    setScans(data);
    updateSummaries(data);
  }, [dispatch.dispatch_id]);

  useEffect(() => {
    const handleResize = () => setScreenHeight(window.innerHeight);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowExitConfirm(true);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    loadData();
    startCamera();
    return stopCamera;
  }, [loadData]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Camera error:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const updateSummaries = (data: ScanRecord[]) => {
    const groups = data.reduce((acc, scan) => {
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
    setSummaries(Object.values(groups));
  };

  /**
   * Calculates the ROI rectangle relative to the camera sensor.
   * Implementation Requirement A: ROI-ONLY OCR INPUT
   */
  const calculateROI = (): ROIRect => {
    if (!videoRef.current || !viewportRef.current) return { x: 0.2, y: 0.3, w: 0.6, h: 0.4 };

    const video = videoRef.current;
    const viewport = viewportRef.current;
    const rect = viewport.getBoundingClientRect();
    const container = video.parentElement!.getBoundingClientRect();

    // Map screen pixel coords to percentages of the camera container
    return {
      x: (rect.left - container.left) / container.width,
      y: (rect.top - container.top) / container.height,
      w: rect.width / container.width,
      h: rect.height / container.height
    };
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || isProcessing || isFinalizing) return;
    setIsProcessing(true);
    setErrorMsg(null);
    const context = canvasRef.current.getContext('2d');
    if (!context) return;
    
    // 1. Snapshot full sensor frame
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.9).split(',')[1];

    // 2. Calculate ROI strictly based on on-screen guide
    const roi = calculateROI();

    try {
      // 3. Process OCR on ROI crop
      const ocrResult = await performLocalOCR(base64, roi);
      setDebugUrl(ocrResult.debugUrl || null);
      
      const newScan: ScanRecord = {
        id: crypto.randomUUID(),
        dispatch_id: dispatch.dispatch_id,
        timestamp: new Date().toISOString(),
        part_no: ocrResult.partNo,
        part_name: ocrResult.partName,
        qty_nos: ocrResult.qty,
        status: ScanStatus.ACCEPTED,
        ocr_text_raw: ocrResult.rawText,
        ocr_confidence: ocrResult.confidence,
        ocr_text_hash: btoa(ocrResult.rawText).slice(0, 10),
        image_phash: 'ROI_CROP_SOURCE',
      };
      
      await saveScan(newScan);
      
      if (ocrResult.confidence < 0.9) {
        setToast("Verification needed: Low confidence");
      } else {
        setToast(`Accepted: ${ocrResult.partNo}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "ROI processing failed.");
      if (err.message === "Image blurry — retake") {
        setToast("Image blurry — retake");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const saveScan = async (scan: ScanRecord) => {
    await dbService.addScan(scan);
    setLastScan(scan);
    loadData();
    setTimeout(() => setLastScan(null), 3000);
  };

  const executeFinalize = async () => {
    if (scans.length === 0) return;
    setIsFinalizing(true);
    setErrorMsg(null);
    setIsDrawerOpen(false);

    try {
      const latestScans = await dbService.getScansForDispatch(dispatch.dispatch_id);
      const groups = latestScans.reduce((acc, scan) => {
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
      const finalSummaries = Object.values(groups);
      
      const updatedDispatch: Dispatch = {
        ...dispatch,
        status: DispatchStatus.COMPLETED,
        end_time: new Date().toISOString(),
        total_boxes_cached: latestScans.length,
        total_qty_cached: finalSummaries.reduce((a, b) => a + b.total_qty, 0),
        parts_count_cached: finalSummaries.length,
      };

      const exports = await generateExports(updatedDispatch, latestScans, finalSummaries);
      updatedDispatch.pdf_path = exports.pdf.simulatedPath;
      updatedDispatch.excel_path = exports.excel.simulatedPath;
      updatedDispatch.generated_at = new Date().toISOString();

      await dbService.updateDispatch(updatedDispatch);
      onComplete(dispatch.dispatch_id);
    } catch (err: any) {
      setErrorMsg(err.message || "Finalization failed.");
      setIsFinalizing(false);
    }
  };

  const handleDiscard = async () => {
    await dbService.discardDispatch(dispatch.dispatch_id);
    onBack(); 
  };

  const handleTouchStart = () => {
    longPressTimerRef.current = window.setTimeout(() => setShowExitConfirm(true), 2000);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div 
      className="flex-1 flex flex-col bg-slate-900 relative select-none overflow-hidden"
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. TOP: VIEWFINDER */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className="w-full h-full object-cover opacity-80"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* OCR Viewport Guide (The ROI) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
           <div 
              ref={viewportRef}
              className="w-64 h-32 border-2 border-blue-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] rounded-xl relative"
            >
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>
              
              {/* Scanline Animation */}
              {isProcessing && (
                <div className="absolute inset-x-0 top-0 h-0.5 bg-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.8)] animate-bounce opacity-50"></div>
              )}
           </div>
        </div>

        {/* Debug Preview (Corner) */}
        {debugUrl && (
          <div className="absolute top-24 left-6 z-30 border border-white/20 rounded-lg overflow-hidden bg-black w-24 shadow-2xl animate-in fade-in">
            <p className="text-[7px] text-white bg-blue-600 px-1 py-0.5 font-bold uppercase">ROI Crop</p>
            <img src={debugUrl} className="w-full" alt="ROI Debug" />
          </div>
        )}

        {/* Header Controls */}
        <div className="absolute top-6 left-6 flex gap-4 z-20">
          <button 
            onClick={() => setShowExitConfirm(true)}
            className="p-3 bg-black/40 backdrop-blur-md text-white rounded-2xl active:scale-90 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="absolute top-6 right-6 z-20">
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="p-3 bg-black/40 backdrop-blur-md text-white rounded-2xl active:scale-90 transition-all"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" /></svg>
          </button>
        </div>

        {/* Stats */}
        <div className="absolute bottom-6 right-6 z-20">
            <div className="bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right">
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Total Scanned</p>
                <p className="text-xl font-mono font-bold text-white leading-none">{scans.length}</p>
            </div>
        </div>
      </div>

      {/* 2. BOTTOM: CONTROLS */}
      <div className="bg-slate-900 p-8 pt-4 pb-12 flex flex-col items-center shrink-0">
        {lastScan && (
          <div className="mb-6 bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-blue-500/20 animate-in slide-in-from-bottom-2">
             <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-0.5">Last Record</p>
             <p className="font-bold text-lg leading-tight">{lastScan.part_no} • {lastScan.qty_nos} NOS</p>
          </div>
        )}

        <div className="flex items-center gap-12">
            <button 
                onClick={captureAndScan}
                disabled={isProcessing || isFinalizing}
                className={`w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all ${
                    isProcessing ? 'border-slate-700 bg-slate-800' : 'border-white bg-blue-600 shadow-2xl shadow-blue-500/40 active:scale-90'
                }`}
            >
                {isProcessing ? (
                   <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                )}
            </button>
        </div>

        <button 
            onClick={executeFinalize}
            disabled={scans.length === 0 || isFinalizing}
            className="mt-10 w-full py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl border border-slate-700 active:bg-slate-700 transition-all uppercase tracking-[0.3em] text-[10px]"
        >
            {isFinalizing ? 'Finalizing Batch...' : 'Finalize Dispatch Batch'}
        </button>
        
        {errorMsg && <p className="text-red-500 text-[10px] mt-2 font-bold uppercase">{errorMsg}</p>}
      </div>

      {/* Drawer */}
      {isDrawerOpen && (
        <>
            <div className="fixed inset-0 bg-black/60 z-[100] backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
            <div className="fixed inset-x-0 bottom-0 z-[110] bg-white rounded-t-[2.5rem] shadow-2xl p-6 pt-4 flex flex-col max-h-[70vh]">
                <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 shrink-0"></div>
                <h2 className="text-lg font-bold text-slate-900 mb-6 px-2">Dispatch Controls</h2>
                <div className="overflow-y-auto space-y-2 pb-10">
                    <button onClick={() => { setIsDrawerOpen(false); executeFinalize(); }} className="w-full flex items-center gap-4 p-5 bg-green-50 text-green-700 rounded-2xl text-left active:scale-[0.98] transition-all">
                        <div className="bg-green-600 text-white p-2 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                        <div className="flex-1"><p className="font-bold">End Dispatch</p><p className="text-[10px] opacity-60 uppercase font-bold">Calculate and Finalize</p></div>
                    </button>
                    <button onClick={() => { setIsDrawerOpen(false); setShowDiscardConfirm(true); }} className="w-full flex items-center gap-4 p-5 bg-red-50 text-red-700 rounded-2xl text-left active:scale-[0.98] transition-all">
                        <div className="bg-red-600 text-white p-2 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
                        <div className="flex-1"><p className="font-bold text-red-700">Exit without saving</p><p className="text-[10px] opacity-60 uppercase font-bold">Discard session data</p></div>
                    </button>
                </div>
            </div>
        </>
      )}

      {/* Discard Confirm */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-8">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Discard Dispatch?</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">This will permanently delete the current session and all recorded scans.</p>
                <div className="space-y-3">
                    <button onClick={handleDiscard} className="w-full py-4 bg-red-600 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">DISCARD SESSION</button>
                    <button onClick={() => setShowDiscardConfirm(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">CANCEL</button>
                </div>
            </div>
        </div>
      )}

      {/* Exit Confirm */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-8">
            <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Save and Exit?</h3>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed">Current scans are cached. You can resume this session later from your history.</p>
                <div className="space-y-3">
                    <button onClick={onBack} className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl active:scale-95 transition-all uppercase tracking-widest text-xs">SAVE PROGRESS</button>
                    <button onClick={() => setShowExitConfirm(false)} className="w-full py-4 text-slate-400 font-bold uppercase tracking-widest text-xs">BACK TO SCANNER</button>
                </div>
            </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[300] animate-in slide-in-from-bottom-4">
            <div className="bg-slate-900/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
                {toast}
            </div>
        </div>
      )}
    </div>
  );
};

export default ScanScreen;
