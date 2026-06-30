import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { ytDlpPath, ffmpegPath, isAudioFormat, cleanOldTempFiles } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const PROGRESS_RE = /\[download\]\s+(\d+\.?\d*)%\s+of\s+(\S+)\s+at\s+(\S+)\s+ETA\s+(\S+)/;

function convertToGif(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), [
      '-i', inputPath,
      '-vf', 'fps=12,scale=640:-1:flags=lanczos',
      '-loop', '0', '-y', outputPath,
    ]);
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
  try { cleanOldTempFiles(); } catch {}

  let body: Record<string, string>;
  try { body = await req.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { url, format, formatId, audioQuality, startTime, endTime } = body;
  if (!url || !format || !formatId) {
    return Response.json({ error: 'url, format and formatId are required' }, { status: 400 });
  }

  const jobId = randomUUID();
  const encoder = new TextEncoder();
  const isGif = format === 'gif';
  const isAudio = isAudioFormat(format);
  const tmpDir = os.tmpdir();
  const outputTemplate = path.join(tmpDir, `clypt-%(title).50s-${jobId}.%(ext)s`);

  const args: string[] = [
    '--no-playlist', '-f', formatId,
    '-o', outputTemplate,
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

  const stream = new ReadableStream({
    start(controller) {
      const emit = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {}
      };

      const proc = spawn(ytDlpPath(), args);
      let stderr = '';
      let outputPath = '';

      let stdoutBuf = '';
      proc.stdout.on('data', (chunk: Buffer) => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && fs.existsSync(trimmed)) {
            outputPath = trimmed;
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderr += text;
        for (const line of text.split('\n')) {
          const m = line.match(PROGRESS_RE);
          if (m) {
            emit({
              type: 'progress',
              percent: isGif ? parseFloat(m[1]) * 0.85 : parseFloat(m[1]),
              size: m[2], speed: m[3], eta: m[4],
            });
          }
        }
      });

      const timeout = setTimeout(() => {
        proc.kill();
        emit({ type: 'error', message: 'Download timed out (10 min limit)' });
        try { controller.close(); } catch {}
      }, 10 * 60 * 1000);

      proc.on('close', async (code) => {
        clearTimeout(timeout);

        if (code === 0 && outputPath && fs.existsSync(outputPath)) {
          let finalPath = outputPath;

          if (isGif) {
            emit({ type: 'progress', percent: 90, speed: '—', eta: 'Converting…', size: '' });
            try {
              const gifPath = outputPath.replace(/\.[^.]+$/, '.gif');
              await convertToGif(outputPath, gifPath);
              try { fs.unlinkSync(outputPath); } catch {}
              finalPath = gifPath;
            } catch (err) {
              emit({ type: 'error', message: err instanceof Error ? err.message : 'GIF conversion failed' });
              try { controller.close(); } catch {}
              return;
            }
          }

          const filename = path.basename(finalPath);
          const metaPath = path.join(tmpDir, `clypt-meta-${jobId}.json`);
          try {
            fs.writeFileSync(metaPath, JSON.stringify({ outputPath: finalPath, filename }));
          } catch {}

          emit({ type: 'complete', jobId, filename });
        } else {
          const errLine = stderr.split('\n').find(l => l.includes('ERROR:'));
          const msg = errLine ? errLine.replace(/.*ERROR:\s*/, '') : 'Download failed';
          emit({ type: 'error', message: msg });
        }

        try { controller.close(); } catch {}
      });

      req.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        try { proc.kill(); } catch {}
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
