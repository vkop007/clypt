import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Resolves the path to the yt-dlp binary.
 * If bundled binary exists but is not executable (e.g. read-only filesystem in Lambda/Amplify),
 * it copies it to /tmp/yt-dlp, chmods it, and executes it from there.
 */
export function ytDlpPath(): string {
  if (process.env.YTDLP_PATH) return process.env.YTDLP_PATH;

  const bundled = path.join(
    process.cwd(),
    'bin',
    process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
  );

  if (fs.existsSync(bundled)) {
    if (process.platform === 'win32') {
      return bundled;
    }
    // Check if the bundled binary is executable
    try {
      fs.accessSync(bundled, fs.constants.X_OK);
      return bundled;
    } catch {
      // Not executable (common in AWS Lambda/Amplify deployment archives)
      const tmpPath = path.join(os.tmpdir(), 'yt-dlp');
      try {
        const bundledStats = fs.statSync(bundled);
        let shouldCopy = true;
        if (fs.existsSync(tmpPath)) {
          const tmpStats = fs.statSync(tmpPath);
          if (tmpStats.size === bundledStats.size) {
            shouldCopy = false;
          }
        }
        if (shouldCopy) {
          fs.copyFileSync(bundled, tmpPath);
        }
        fs.chmodSync(tmpPath, 0o755);
        return tmpPath;
      } catch (err) {
        console.error('Failed to copy and chmod yt-dlp to /tmp:', err);
        return bundled;
      }
    }
  }

  return 'yt-dlp';
}

/**
 * Resolves the path to the ffmpeg binary.
 * If bundled binary exists but is not executable, it copies it to /tmp/ffmpeg,
 * chmods it, and executes it from there.
 */
export function ffmpegPath(): string {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;

  const bundled = path.join(
    process.cwd(),
    'bin',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );

  if (fs.existsSync(bundled)) {
    if (process.platform === 'win32') {
      return bundled;
    }
    // Check if the bundled binary is executable
    try {
      fs.accessSync(bundled, fs.constants.X_OK);
      return bundled;
    } catch {
      // Not executable
      const tmpPath = path.join(os.tmpdir(), 'ffmpeg');
      try {
        const bundledStats = fs.statSync(bundled);
        let shouldCopy = true;
        if (fs.existsSync(tmpPath)) {
          const tmpStats = fs.statSync(tmpPath);
          if (tmpStats.size === bundledStats.size) {
            shouldCopy = false;
          }
        }
        if (shouldCopy) {
          fs.copyFileSync(bundled, tmpPath);
        }
        fs.chmodSync(tmpPath, 0o755);
        return tmpPath;
      } catch (err) {
        console.error('Failed to copy and chmod ffmpeg to /tmp:', err);
        return bundled;
      }
    }
  }

  return 'ffmpeg';
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
