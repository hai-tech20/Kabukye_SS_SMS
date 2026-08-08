import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const CAPTURE_SCALE = 1.1;
const JPEG_QUALITY = 0.88;

export async function waitForImages(element: HTMLElement): Promise<void> {
  const images = Array.from(element.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
    )
  );
}

export async function captureReportCardPdf(element: HTMLElement): Promise<Blob> {
  await waitForImages(element);

  const canvas = await Promise.race([
    html2canvas(element, {
      scale: CAPTURE_SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      imageTimeout: 6000,
      ignoreElements: (el) => el.tagName === 'SCRIPT',
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Capture timed out')), 30000)
    ),
  ]);

  const imgData = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (canvas.height * pageWidth) / canvas.width;
  pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight);

  canvas.width = 0;
  canvas.height = 0;

  return pdf.output('blob');
}

/** Yield to the browser between captures so the UI stays responsive. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve());
    } else {
      setTimeout(resolve, 0);
    }
  });
}
