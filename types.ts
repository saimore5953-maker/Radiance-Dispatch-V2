
export enum DispatchStatus {
  DRAFT = 'DRAFT',
  COMPLETED = 'COMPLETED'
}

export enum ScanStatus {
  ACCEPTED = 'ACCEPTED',
  CORRECTED = 'CORRECTED',
  DUPLICATE_CONFIRMED = 'DUPLICATE_CONFIRMED',
  REJECTED = 'REJECTED'
}

export interface Dispatch {
  id: string; // Internal UUID
  dispatch_no: number; // Sequential 000001
  dispatch_id: string; // DSP-YYMMDD-##
  operator_id: string;
  start_time: string;
  end_time?: string;
  status: DispatchStatus;
  total_boxes_cached: number;
  total_qty_cached: number;
  parts_count_cached: number;
  pdf_path?: string;
  excel_path?: string;
  generated_at?: string;
  exports_outdated?: boolean; // New flag for Patch 1
}

export interface ScanRecord {
  id: string;
  dispatch_id: string;
  timestamp: string;
  part_no: string;
  part_name: string;
  qty_nos: number;
  tag_date?: string;
  qa_sign?: string;
  status: ScanStatus;
  ocr_text_raw: string;
  ocr_confidence: number;
  ocr_text_hash: string;
  image_phash: string;
  image_path?: string;
  correction_reason?: string;
}

export interface PartSummary {
  part_no: string;
  part_name: string;
  boxes: number;
  total_qty: number;
}

export interface AuthState {
  operatorId: string | null;
  isLoggedIn: boolean;
}

export interface OCRResult {
  partNo: string;
  partName: string;
  qty: number;
  confidence: number;
  rawText: string;
}
