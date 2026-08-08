/**
 * Persistent report-card PDF generation job state.
 * Survives page refresh via localStorage (metadata) + IndexedDB (PDF blobs).
 */

const JOB_KEY = 'report_card_pdf_job';
const DB_NAME = 'report_card_pdf_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_blobs';

export type PdfJobStatus = 'running' | 'stopped' | 'completed' | 'failed';

export interface PdfJobStudent {
  id: string;
  full_name: string;
  class: string;
  stream: string;
}

export interface PdfJobState {
  id: string;
  status: PdfJobStatus;
  term: string;
  year: string;
  selectedClass: string;
  selectedStream: string;
  students: PdfJobStudent[];
  currentIndex: number;
  completedIds: string[];
  zipFileName: string;
  startedAt: number;
  updatedAt: number;
  error?: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export function getActiveJob(): PdfJobState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(JOB_KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PdfJobState;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') return null;
    return job;
  } catch {
    return null;
  }
}

export function saveJob(job: PdfJobState) {
  job.updatedAt = Date.now();
  localStorage.setItem(JOB_KEY, JSON.stringify(job));
}

export function clearJob() {
  localStorage.removeItem(JOB_KEY);
}

export function stopJob() {
  const job = getActiveJob();
  if (job) {
    job.status = 'stopped';
    saveJob(job);
  }
}

export function isJobStopped(): boolean {
  const job = getActiveJob();
  return !job || job.status === 'stopped';
}

export async function clearJobStorage(jobId: string) {
  clearJob();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(jobId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // IndexedDB may be unavailable
  }
}

export async function savePdfBlob(jobId: string, studentId: string, blob: Blob) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, `${jobId}:${studentId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getAllPdfBlobs(
  jobId: string,
  studentIds: string[]
): Promise<Map<string, Blob>> {
  const result = new Map<string, Blob>();
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      let pending = studentIds.length;
      if (pending === 0) {
        resolve();
        return;
      }
      for (const studentId of studentIds) {
        const req = store.get(`${jobId}:${studentId}`);
        req.onsuccess = () => {
          if (req.result) result.set(studentId, req.result as Blob);
          pending -= 1;
          if (pending === 0) resolve();
        };
        req.onerror = () => {
          pending -= 1;
          if (pending === 0) resolve();
        };
      }
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
  return result;
}

export function createJob(params: {
  term: string;
  year: string;
  selectedClass: string;
  selectedStream: string;
  students: PdfJobStudent[];
}): PdfJobState {
  const termLabel = params.term === '1' ? 'Term 1' : params.term === '2' ? 'Term 2' : 'Term 3';
  const zipFileName = `${termLabel} Report Cards ${params.year}.zip`;

  const job: PdfJobState = {
    id: `job_${Date.now()}`,
    status: 'running',
    term: params.term,
    year: params.year,
    selectedClass: params.selectedClass,
    selectedStream: params.selectedStream,
    students: params.students,
    currentIndex: 0,
    completedIds: [],
    zipFileName,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  };

  saveJob(job);
  return job;
}

export function getClassFolderName(className: string): string {
  const match = className?.match(/^(S[1-6])/i);
  return match ? match[1].toUpperCase() : className.replace(/[^a-zA-Z0-9]/g, '_');
}
