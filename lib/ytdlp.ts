import path from 'path';
import fs from 'fs';

/**
 * Resolves the path to the yt-dlp binary using the following priority:
 *
 * 1. YTDLP_PATH environment variable (explicit user override)
 * 2. ./bin/yt-dlp bundled by the postinstall script (used in Vercel deployments)
 * 3. 'yt-dlp' on the system PATH (local development)
 */
export function ytDlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;

  const bundled = path.join(
    process.cwd(),
    'bin',
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );
  if (fs.existsSync(bundled)) return bundled;

  return 'yt-dlp';
}

export type OutputFormat = 'mp4' | 'webm' | 'mp3' | 'm4a' | 'wav' | 'ogg' | 'gif';

export function isAudioFormat(fmt: string): boolean {
  return ['mp3', 'm4a', 'wav', 'ogg'].includes(fmt);
}

export interface RawFormat {
  format_id: string;
  format_note?: string;
  ext: string;
  height?: number;
  filesize?: number;
  filesize_approx?: number;
  vcodec?: string;
  acodec?: string;
  abr?: number;
}

export function parseFormats(rawFormats: RawFormat[], targetFormat: string) {
  if (isAudioFormat(targetFormat)) {
    return [{ formatId: 'bestaudio/best', quality: 'Best Audio', ext: targetFormat }];
  }

  const seen = new Set<string>();
  const out: { formatId: string; quality: string; ext: string; filesize?: number | null }[] = [];

  const videoFormats = rawFormats
    .filter((f) => f.vcodec && f.vcodec !== 'none' && f.height)
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0));

  for (const f of videoFormats) {
    const label = `${f.height}p`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      formatId: `bestvideo[height<=${f.height}]+bestaudio/best[height<=${f.height}]`,
      quality: label,
      ext: targetFormat,
      filesize: f.filesize ?? f.filesize_approx ?? null,
    });
  }

  if (out.length === 0) {
    out.push({ formatId: 'bestvideo+bestaudio/best', quality: 'Best', ext: targetFormat });
  }

  return out;
}
