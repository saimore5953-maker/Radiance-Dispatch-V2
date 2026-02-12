
import { Dispatch, ScanRecord, PartSummary } from '../types';

export interface ExportResult {
  fileName: string;
  blob: Blob;
  mimeType: string;
  simulatedPath: string;
}

export async function generateExports(dispatch: Dispatch, scans: ScanRecord[], summaries: PartSummary[]): Promise<{ pdf: ExportResult, excel: ExportResult }> {
  console.log("Generating industrial exports for:", dispatch.dispatch_id);
  
  // Simulate heavy processing for industrial feel
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate CSV (Excel fallback)
  const csvHeader = "Part No,Part Name,Boxes,Total Qty\n";
  const csvRows = summaries.map(s => `"${s.part_no}","${s.part_name}",${s.boxes},${s.total_qty}`).join("\n");
  const csvBlob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });

  // Generate a mock PDF (Text based for demonstration in browser)
  const pdfHeader = `RADIANCE DISPATCH REPORT\nID: ${dispatch.dispatch_id}\nOperator: ${dispatch.operator_id}\nGenerated: ${new Date().toLocaleString()}\n\n`;
  const pdfBody = summaries.map(s => `${s.part_no} | ${s.boxes} Boxes | ${s.total_qty} Total Qty`).join("\n");
  const pdfBlob = new Blob([pdfHeader + pdfBody], { type: 'application/pdf' });

  return {
    pdf: {
      fileName: `Dispatch_${dispatch.dispatch_id}.pdf`,
      blob: pdfBlob,
      mimeType: 'application/pdf',
      simulatedPath: `Downloads/RadianceDispatch/Dispatch_${dispatch.dispatch_id}.pdf`
    },
    excel: {
      fileName: `Dispatch_${dispatch.dispatch_id}.csv`,
      blob: csvBlob,
      mimeType: 'text/csv',
      simulatedPath: `Downloads/RadianceDispatch/Dispatch_${dispatch.dispatch_id}.csv`
    }
  };
}

export function triggerDownload(result: ExportResult) {
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', result.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function shareFile(result: ExportResult) {
  if (navigator.share) {
    try {
      const file = new File([result.blob], result.fileName, { type: result.mimeType });
      await navigator.share({
        files: [file],
        title: 'Dispatch Report',
        text: `Export for Dispatch: ${result.fileName}`,
      });
      return true;
    } catch (err) {
      console.error("Sharing failed", err);
      return false;
    }
  }
  return false;
}
