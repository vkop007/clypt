import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { jobs, type Job } from '@/lib/jobs-store';
import { ytDlpPath, ffmpegPath, isAudioFormat } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROGRESS_RE = /\[download\]\s+(\d+\.?\d*)%\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/;

function emit(job: Job, event: object) {
  job.listeners.forEach(fn => (fn as (e: object) => void)(event));
}

function convertToGif(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), ['-i', inputPath, '-vf', 'fps=12,scale=640:-1:flags=lanczos', '-loop', '0', '-y', outputPath]);
    let stderr = '';
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    const t = setTimeout(() => { proc.kill(); reject(new Error('GIF conversion timed out')); }, 5 * 60 * 1000);
    proc.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve();
      else reject(new Error('GIF conversion failed: ' + stderr.slice(-200)));
    });
  });
}

export async function POST(req: Request) {
  let body: Record<string, string>;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { url, format, formatId, audioQuality, startTime, endTime } = body;
  if (!url || !format || !formatId) {
    return Response.json({ error: 'url, format and formatId are required' }, { status: 400 });
  }

  const jobId = randomUUID();
  const job: Job = { id: jobId, status: 'pending', listeners: new Set(), createdAt: Date.now() };
  jobs.set(jobId, job);

  const isGif = format === 'gif';
  const isAudio = isAudioFormat(format);
  const tmpDir = os.tmpdir();
  const outputTemplate = path.join(tmpDir, `clypt-%(title).30s.%(ext)s`);

  const args: string[] = [
    '--no-playlist', '-f', formatId, '-o', outputTemplate,
    '--print', 'after_move:filepath', '--newline',
    '--ffmpeg-location', path.dirname(ffmpegPath()),
  ];

  if (isAudio) {
    const audioFmt = format === 'ogg' ? 'vorbis' : format;
    const quality = audioQuality && ['320k', '192k', '128k'].includes(audioQuality) ? audioQuality : '0';
    args.push('-x', '--audio-format', audioFmt, '--audio-quality', quality);
  } else if (isGif) {
    args.push('--merge-output-format', 'mp4');
  } else {
    args.push('--merge-output-format', format);
  }

  if (startTime || endTime) {
    const start = startTime || '0';
    const end = endTime || '99:59:59';
    args.push('--download-sections', `*${start}-${end}`, '--force-keyframes-at-cuts');
  }

  args.push(url);

  job.status = 'downloading';
  const proc = spawn(ytDlpPath(), args);
  let stderr = '';

  let stdoutBuf = '';
  proc.stdout.on('data', (chunk: Buffer) => {
    stdoutBuf += chunk.toString();
    const lines = stdoutBuf.split('\n');
    stdoutBuf = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && fs.existsSync(trimmed)) {
        job.outputPath = trimmed;
        job.filename = path.basename(trimmed);
      }
    }
  });

  proc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString();
    stderr += text;
    for (const line of text.split('\n')) {
      const m = line.match(PROGRESS_RE);
      if (m) {
        emit(job, {
          type: 'progress',
          percent: isGif ? parseFloat(m[1]) * 0.85 : parseFloat(m[1]),
          size: m[2], speed: m[3], eta: m[4],
        });
      }
    }
  });

  const timeout = setTimeout(() => proc.kill(), 10 * 60 * 1000);

  proc.on('close', async (code) => {
    clearTimeout(timeout);
    if (code === 0 && job.outputPath && fs.existsSync(job.outputPath)) {
      if (isGif) {
        emit(job, { type: 'progress', percent: 90, speed: '—', eta: 'Converting…', size: '' });
        try {
          const gifPath = job.outputPath.replace(/\.[^.]+$/, '.gif');
          await convertToGif(job.outputPath, gifPath);
          try { fs.unlinkSync(job.outputPath); } catch {}
          job.outputPath = gifPath;
          job.filename = path.basename(gifPath);
        } catch (err) {
          job.status = 'error';
          job.error = err instanceof Error ? err.message : 'GIF conversion failed';
          emit(job, { type: 'error', message: job.error });
          job.listeners.clear();
          return;
        }
      }
      job.status = 'complete';
      emit(job, { type: 'complete', filename: job.filename! });
    } else {
      job.status = 'error';
      const msg = stderr.split('\n').find(l => l.includes('ERROR:'))?.replace(/.*ERROR:\s*/, '') || 'Download failed';
      job.error = msg;
      emit(job, { type: 'error', message: msg });
    }
    job.listeners.clear();
  });

  return Response.json({ jobId });
}
