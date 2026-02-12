
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";

/**
 * Cloud OCR Service (Gemini 3 Flash)
 * Restored version for high-accuracy industrial tag extraction.
 */
export async function performOCR(base64Image: string): Promise<OCRResult> {
  // Always create a new instance right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Fix: contents must be an object containing a parts array, not a direct array of parts.
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
          },
        },
        {
          text: 'Extract the Part Number, Part Name, and Quantity from this industrial dispatch tag. Look for anchors like "PART NO", "PART NAME", and "QTY" or "NOS". Return JSON.',
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          partNo: { 
            type: Type.STRING,
            description: "The alphanumeric part number"
          },
          partName: { 
            type: Type.STRING,
            description: "The descriptive part name"
          },
          qty: { 
            type: Type.INTEGER,
            description: "The numeric quantity"
          }
        },
        required: ["partNo", "partName", "qty"]
      }
    }
  });

  try {
    // response.text is a property, which is correctly used here.
    const data = JSON.parse(response.text || "{}");
    return {
      partNo: data.partNo || "UNKNOWN",
      partName: data.partName || "UNKNOWN",
      qty: data.qty || 0,
      confidence: 0.99,
      rawText: response.text || "",
    };
  } catch (e) {
    console.error("OCR Parse Error", e);
    throw new Error("Cloud OCR failed to parse result. Use Manual Entry.");
  }
}
