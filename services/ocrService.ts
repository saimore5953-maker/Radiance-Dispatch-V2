
import { OCRResult } from "../types";
import Tesseract from 'https://esm.sh/tesseract.js@5.1.1';

/**
 * On-Device OCR Service - RADIANCE TUNED V3
 * ROI-Only processing with Order-Based Field Extraction.
 */

export interface ROIRect {
  x: number; // percentage 0-1
  y: number; // percentage 0-1
  w: number; // percentage 0-1
  h: number; // percentage 0-1
}

export interface PreprocessResult {
  processedBase64: string;
  debugUrl: string;
  isBlurry: boolean;
}

/**
 * Main OCR entry point. 
 * Now accepts a mandatory ROI rectangle relative to the full frame.
 */
export async function performLocalOCR(
  base64Image: string, 
  roi: ROIRect = { x: 0.2, y: 0.3, w: 0.6, h: 0.4 } // Default fallback
): Promise<OCRResult & { debugUrl?: string }> {
  try {
    // 1. Image Preprocessing (Strict ROI Crop + Enhancement)
    const preprocess = await preprocessForRadianceTag(base64Image, roi);

    // 2. Blur Guard (Mandatory)
    if (preprocess.isBlurry) {
      throw new Error("Image blurry — retake");
    }

    // 3. Run OCR on ROI only
    const { data: { lines } } = await Tesseract.recognize(
      `data:image/jpeg;base64,${preprocess.processedBase64}`,
      'eng',
      { 
        logger: m => console.debug('OCR Progress:', (m.progress * 100).toFixed(0) + '%')
      }
    );

    // 4. Clean noise and normalize lines
    const noiseWords = ["ACCEPTED", "RADIANCE", "POLYMERS", "SIGN", "DATE", "DATE:", "QA"];
    const filteredLines = lines
      .map(line => line.text.trim())
      .filter(text => {
        if (!text || text.length < 2) return false;
        const upper = text.toUpperCase();
        return !noiseWords.some(word => upper.includes(word));
      })
      .map(text => text.replace(/\s+/g, ' ')); // Collapse spaces

    // 5. Order-Based Parsing Logic
    // Fixed layout: Line 1 (Part No) -> Line 2 (Part Name) -> Line 3 (Qty NOS)
    
    let partNo = "UNKNOWN";
    let partName = "UNKNOWN";
    let qty = 0;

    // A. Anchored Search
    const partNoMatch = filteredLines.find(l => /Part\s*N[O0][:\-]*\s*([A-Z0-9]+)/i.test(l))?.match(/Part\s*N[O0][:\-]*\s*([A-Z0-9]+)/i);
    const partNameMatch = filteredLines.find(l => /Part\s*Name[:\-]*\s*(.+)/i.test(l))?.match(/Part\s*Name[:\-]*\s*(.+)/i);
    const qtyMatch = filteredLines.find(l => /(\d{1,7})\s*(NOS|Nos|nos)/i.test(l))?.match(/(\d{1,7})\s*(NOS|Nos|nos)/i);

    if (partNoMatch) partNo = partNoMatch[1];
    if (partNameMatch) partName = partNameMatch[1];
    if (qtyMatch) qty = parseInt(qtyMatch[1], 10);

    // B. Fixed Order Fallback (if anchors fail)
    if (partNo === "UNKNOWN" && filteredLines.length > 0) {
      // Find first line that looks like a Part No (Alphanumeric with digits)
      const candidate = filteredLines.find(l => /[A-Z].*\d|\d.*[A-Z]/i.test(l) && l.length >= 4);
      if (candidate) partNo = candidate.split(/[:\-]/).pop()?.trim() || candidate;
    }

    if (partName === "UNKNOWN" && partNo !== "UNKNOWN") {
      const pIndex = filteredLines.findIndex(l => l.includes(partNo));
      if (pIndex !== -1 && filteredLines[pIndex + 1]) {
        const nextLine = filteredLines[pIndex + 1];
        if (!nextLine.toLowerCase().includes("nos")) {
            partName = nextLine.split(/[:\-]/).pop()?.trim() || nextLine;
        }
      }
    }

    if (qty === 0) {
      const anyQty = filteredLines.find(l => /\b\d{1,7}\b/.test(l));
      if (anyQty) qty = parseInt(anyQty.match(/\d+/)?.[0] || "0", 10);
    }

    const isReliable = (partNo !== "UNKNOWN" && qty > 0);
    const confidence = isReliable ? 0.95 : 0.40;

    return {
      partNo,
      partName,
      qty,
      confidence,
      rawText: filteredLines.join('\n'),
      debugUrl: preprocess.debugUrl
    };
  } catch (error) {
    console.error("Local OCR Engine Error:", error);
    throw error;
  }
}

async function preprocessForRadianceTag(base64: string, roi: ROIRect): Promise<PreprocessResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      
      // Captured sensor size
      const sw = img.width;
      const sh = img.height;

      // 1. ROI-ONLY CROP (Implementation Requirement A)
      // Map screen percentages to sensor coordinates
      const cropX = sw * roi.x;
      const cropY = sh * roi.y;
      const cropW = sw * roi.w;
      const cropH = sh * roi.h;

      // Ensure minimum 1200px width for readable resolution
      const targetW = Math.max(1200, cropW);
      const scale = targetW / cropW;
      const targetH = cropH * scale;

      canvas.width = targetW;
      canvas.height = targetH;

      // Draw ROI region only
      ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, targetW, targetH);

      const imageData = ctx.getImageData(0, 0, targetW, targetH);
      const pixels = imageData.data;
      
      // 2. Blur Detection (Requirement 4)
      const isBlurry = detectBlur(pixels, targetW, targetH);

      // 3. Enhancement (Requirement 2)
      // Grayscale + Contrast + Adaptive Thresholding
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Increase Contrast
        gray = (gray - 128) * 1.6 + 128;
        
        // Thresholding for Black on White
        const final = gray > 155 ? 255 : 0;
        
        pixels[i] = pixels[i+1] = pixels[i+2] = final;
      }
      ctx.putImageData(imageData, 0, 0);

      // Light Sharpen
      sharpenCanvas(ctx, targetW, targetH);

      const debugUrl = canvas.toDataURL('image/jpeg', 0.5);
      const processedBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];

      resolve({
        processedBase64,
        debugUrl,
        isBlurry
      });
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}

function detectBlur(pixels: Uint8ClampedArray, w: number, h: number): boolean {
  let sumDiff = 0;
  let count = 0;
  // Sample every 4th pixel for speed
  for (let i = 0; i < pixels.length - 8; i += 16) {
    const diff = Math.abs(pixels[i] - pixels[i+4]);
    if (diff > 15) {
        sumDiff += diff;
        count++;
    }
  }
  const avgDiff = sumDiff / (count || 1);
  return avgDiff < 10; // Threshold for blurry text on high-contrast backgrounds
}

function sharpenCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const weights = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const side = 3;
  const halfSide = 1;
  const srcData = ctx.getImageData(0, 0, w, h);
  const src = srcData.data;
  const output = ctx.createImageData(w, h);
  const dst = output.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dstOff = (y * w + x) * 4;
      let r = 0, g = 0, b = 0;
      for (let cy = 0; cy < side; cy++) {
        for (let cx = 0; cx < side; cx++) {
          const scy = y + cy - halfSide;
          const scx = x + cx - halfSide;
          if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
            const srcOff = (scy * w + scx) * 4;
            const wt = weights[cy * side + cx];
            r += src[srcOff] * wt;
            g += src[srcOff + 1] * wt;
            b += src[srcOff + 2] * wt;
          }
        }
      }
      dst[dstOff] = r; dst[dstOff+1] = g; dst[dstOff+2] = b; dst[dstOff+3] = 255;
    }
  }
  ctx.putImageData(output, 0, 0);
}
