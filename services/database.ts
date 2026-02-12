
import { Dispatch, ScanRecord, DispatchStatus } from '../types';

class DispatchDatabase {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DispatchDB', 1);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Dispatch Counter
        db.createObjectStore('counters', { keyPath: 'id' });
        
        // Dispatch Table
        const dispatchStore = db.createObjectStore('dispatches', { keyPath: 'dispatch_id' });
        dispatchStore.createIndex('dispatch_no', 'dispatch_no', { unique: true });
        dispatchStore.createIndex('status', 'status');
        
        // Scans Table
        const scanStore = db.createObjectStore('scans', { keyPath: 'id' });
        scanStore.createIndex('dispatch_id', 'dispatch_id');
        scanStore.createIndex('part_no', 'part_no');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => reject('Database error: ' + (event.target as IDBOpenDBRequest).error);
    });
  }

  async getNextDispatchNo(): Promise<number> {
    const store = this.getStore('counters', 'readwrite');
    return new Promise((resolve) => {
      const request = store.get(1);
      request.onsuccess = () => {
        const result = request.result || { id: 1, next_dispatch_no: 1 };
        const next = result.next_dispatch_no;
        store.put({ id: 1, next_dispatch_no: next + 1 });
        resolve(next);
      };
    });
  }

  async getDailySeq(dateKey: string): Promise<number> {
    const store = this.getStore('counters', 'readwrite');
    return new Promise((resolve) => {
      const request = store.get(dateKey);
      request.onsuccess = () => {
        const result = request.result || { id: dateKey, seq: 1 };
        const next = result.seq;
        store.put({ id: dateKey, seq: next + 1 });
        resolve(next);
      };
    });
  }

  async createDispatch(dispatch: Dispatch): Promise<void> {
    const store = this.getStore('dispatches', 'readwrite');
    return new Promise((resolve) => {
      store.add(dispatch).onsuccess = () => resolve();
    });
  }

  async getAllDispatches(): Promise<Dispatch[]> {
    const store = this.getStore('dispatches', 'readonly');
    return new Promise((resolve) => {
      store.getAll().onsuccess = (e) => resolve((e.target as any).result);
    });
  }

  async getDispatchById(id: string): Promise<Dispatch | null> {
    const store = this.getStore('dispatches', 'readonly');
    return new Promise((resolve) => {
      store.get(id).onsuccess = (e) => resolve((e.target as any).result);
    });
  }

  async addScan(scan: ScanRecord): Promise<void> {
    const store = this.getStore('scans', 'readwrite');
    return new Promise((resolve) => {
      store.add(scan).onsuccess = () => resolve();
    });
  }

  async getScansForDispatch(dispatchId: string): Promise<ScanRecord[]> {
    const store = this.getStore('scans', 'readonly');
    const index = store.index('dispatch_id');
    return new Promise((resolve) => {
      index.getAll(dispatchId).onsuccess = (e) => resolve((e.target as any).result);
    });
  }

  async updateDispatch(dispatch: Dispatch): Promise<void> {
    const store = this.getStore('dispatches', 'readwrite');
    return new Promise((resolve) => {
      store.put(dispatch).onsuccess = () => resolve();
    });
  }

  async removeOneScan(dispatchId: string, partNo: string): Promise<void> {
    const scans = await this.getScansForDispatch(dispatchId);
    const partScans = scans.filter(s => s.part_no === partNo);
    if (partScans.length === 0) return;
    
    const latest = partScans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    const store = this.getStore('scans', 'readwrite');
    await new Promise((resolve) => {
      const req = store.delete(latest.id);
      req.onsuccess = () => resolve(null);
    });
    
    await this.recalculateDispatchTotals(dispatchId);
  }

  async removeAllScansForPart(dispatchId: string, partNo: string): Promise<void> {
    const scans = await this.getScansForDispatch(dispatchId);
    const partScans = scans.filter(s => s.part_no === partNo);
    if (partScans.length === 0) return;
    
    const store = this.getStore('scans', 'readwrite');
    for (const scan of partScans) {
      await new Promise((resolve) => {
        store.delete(scan.id).onsuccess = () => resolve(null);
      });
    }
    
    await this.recalculateDispatchTotals(dispatchId);
  }

  async discardDispatch(dispatchId: string): Promise<void> {
    if (!this.db) return;
    const tx = this.db.transaction(['dispatches', 'scans'], 'readwrite');
    const dispatchStore = tx.objectStore('dispatches');
    const scanStore = tx.objectStore('scans');

    // 1. Delete all scans linked to this dispatch
    const scanIndex = scanStore.index('dispatch_id');
    const request = scanIndex.getAllKeys(dispatchId);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const keys = request.result;
        keys.forEach(key => scanStore.delete(key));
        // 2. Delete the dispatch record
        dispatchStore.delete(dispatchId);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  private async recalculateDispatchTotals(dispatchId: string): Promise<void> {
    const dispatch = await this.getDispatchById(dispatchId);
    if (!dispatch) return;
    
    const scans = await this.getScansForDispatch(dispatchId);
    const uniqueParts = new Set(scans.map(s => s.part_no));
    const totalQty = scans.reduce((sum, s) => sum + s.qty_nos, 0);

    dispatch.total_boxes_cached = scans.length;
    dispatch.total_qty_cached = totalQty;
    dispatch.parts_count_cached = uniqueParts.size;
    
    // Patch 1: Mark exports as outdated if editing a completed dispatch
    if (dispatch.status === DispatchStatus.COMPLETED) {
      dispatch.exports_outdated = true;
    }
    
    await this.updateDispatch(dispatch);
  }

  private getStore(name: string, mode: IDBTransactionMode) {
    if (!this.db) throw new Error("DB not initialized");
    return this.db.transaction(name, mode).objectStore(name);
  }
}

export const dbService = new DispatchDatabase();
