#!/usr/bin/env node
/**
 * Downloads the ffmpeg standalone binary for the current platform/arch
 * and saves it to ./bin/ffmpeg so it is bundled into the deployment.
 *
 * Skips if:
 *  - FFMPEG_PATH env var is set (user manages the binary themselves)
 *  - the binary already exists in ./bin/
 *  - ffmpeg is already available on the system PATH
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, '..', 'bin');
const IS_WIN = process.platform === 'win32';
const BIN_PATH = join(BIN_DIR, IS_WIN ? 'ffmpeg.exe' : 'ffmpeg');

// 1. Honour explicit user override — nothing to do
if (process.env.FFMPEG_PATH) {
  console.log('[clypt] FFMPEG_PATH is set — skipping binary download');
  process.exit(0);
}

// 2. Binary already downloaded
if (existsSync(BIN_PATH)) {
  console.log('[clypt] ffmpeg binary already present at', BIN_PATH);
  process.exit(0);
}

// 3. ffmpeg already on system PATH (local dev)
try {
  if (process.env.FORCE_DOWNLOAD !== '1') {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    console.log('[clypt] ffmpeg found on system PATH — skipping download');
    process.exit(0);
  }
} catch {}

// 4. Download the binary
const platform = process.platform;
let arch = process.arch;
if (arch === 'x32') arch = 'ia32';

const filename = `ffmpeg-${platform}-${arch}.gz`;
const url = `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.1.1/${filename}`;

console.log(`[clypt] Downloading ffmpeg for platform/arch "${platform}/${arch}" from GitHub…`);
mkdirSync(BIN_DIR, { recursive: true });

/**
 * Follows up to `maxRedirects` HTTP redirects and resolves with the final
 * IncomingMessage whose statusCode is 200.
 */
function fetchFollowRedirects(url, maxRedirects = 10) {
  return new Promise((resolve, reject) => {
    function attempt(url, remaining) {
      get(url, (res) => {
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && res.headers.location) {
          if (remaining === 0) { reject(new Error('Too many redirects')); return; }
          attempt(res.headers.location, remaining - 1);
        } else if (res.statusCode === 200) {
          resolve(res);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
      }).on('error', reject);
    }
    attempt(url, maxRedirects);
  });
}

fetchFollowRedirects(url)
  .then((res) => new Promise((resolve, reject) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => resolve(Buffer.concat(chunks)));
    res.on('error', reject);
  }))
  .then((buf) => {
    console.log('[clypt] Decompressing gzip archive…');
    const decompressed = zlib.gunzipSync(buf);
    writeFileSync(BIN_PATH, decompressed);
    if (!IS_WIN) chmodSync(BIN_PATH, 0o755);
    console.log(`[clypt] ffmpeg installed → ${BIN_PATH} (${(decompressed.length / 1e6).toFixed(1)} MB)`);
  })
  .catch((err) => {
    console.error('[clypt] Failed to download ffmpeg:', err.message);
    console.error('[clypt] Install ffmpeg manually and set FFMPEG_PATH or ensure it is on PATH.');
    // Non-fatal: allow the build to continue
  });
