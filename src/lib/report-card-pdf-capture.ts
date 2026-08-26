import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/** Integer scale avoids sub-pixel canvas rounding (which made borders bleed into
 *  text). 3x on a 210mm-wide card works out to ~288dpi, well within print quality. */
const CAPTURE_SCALE = 3;
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

export interface CapturedReportCard {
  imageBlob: Blob;
  pixelWidth: number;
  pixelHeight: number;
}

/** Rasterizes a report-card element to a JPEG image (no PDF assembly here, so the
 *  same capture can be reused for both the individual PDF and the merged class PDF). */
export async function captureReportCardImage(element: HTMLElement): Promise<CapturedReportCard> {
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

  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/jpeg',
      JPEG_QUALITY
    );
  });

  const pixelWidth = canvas.width;
  const pixelHeight = canvas.height;
  canvas.width = 0;
  canvas.height = 0;

  return { imageBlob, pixelWidth, pixelHeight };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function createEmptyPdfDoc(): jsPDF {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
}

/** Adds a captured report-card image as a page. Pass isFirstPage=true for a doc's
 *  first page (jsPDF already creates one on construction); false calls addPage(). */
export function addImagePage(
  pdf: jsPDF,
  dataUrl: string,
  pixelWidth: number,
  pixelHeight: number,
  isFirstPage: boolean
): void {
  if (!isFirstPage) pdf.addPage();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const imgHeight = (pixelHeight * pageWidth) / pixelWidth;
  pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidth, imgHeight);
}

/** Kicks off image loads for the given URLs in parallel ahead of the capture loop,
 *  so by the time each student is captured its photo is already in the browser cache
 *  instead of blocking that student's capture on a fresh network round trip. */
export function preloadImages(urls: Array<string | undefined | null>): void {
  const unique = Array.from(new Set(urls.filter((u): u is string => !!u)));
  for (const url of unique) {
    const img = new Image();
    img.src = url;
  }
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
