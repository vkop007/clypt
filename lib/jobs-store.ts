import fs from 'fs';

export type JobStatus = 'pending' | 'downloading' | 'complete' | 'error';

export type ProgressEvent =
  | { type: 'progress'; percent: number; speed: string; eta: string; size: string }
  | { type: 'complete'; filename: string }
  | { type: 'error'; message: string };

export interface Job {
  id: string;
  status: JobStatus;
  outputPath?: string;
  filename?: string;
  error?: string;
  listeners: Set<(e: ProgressEvent) => void>;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __clyptJobs: Map<string, Job> | undefined;
}

export const jobs: Map<string, Job> =
  globalThis.__clyptJobs ?? (globalThis.__clyptJobs = new Map());

setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      if (job.outputPath) {
        try { fs.unlinkSync(job.outputPath); } catch {}
      }
      jobs.delete(id);
    }
  }
}, 5 * 60 * 1000);
