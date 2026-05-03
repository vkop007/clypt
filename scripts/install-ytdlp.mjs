#!/usr/bin/env node
/**
 * Downloads the yt-dlp standalone binary for the current platform and
 * saves it to ./bin/yt-dlp so it is bundled into the Vercel deployment.
 *
 * Skips if:
 *  - YTDLP_PATH env var is set (user manages the binary themselves)
 *  - the binary already exists in ./bin/
 *  - yt-dlp is already available on the system PATH
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, chmodSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { IncomingMessage } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = join(__dirname, '..', 'bin');
const IS_WIN = process.platform === 'win32';
const BIN_PATH = join(BIN_DIR, IS_WIN ? 'yt-dlp.exe' : 'yt-dlp');

const RELEASE_URLS = {
  linux:  'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
  darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
  win32:  'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
};

// 1. Honour explicit user override — nothing to do
if (process.env.YTDLP_PATH) {
  console.log('[clypt] YTDLP_PATH is set — skipping binary download');
  process.exit(0);
}

// 2. Binary already downloaded
if (existsSync(BIN_PATH)) {
  console.log('[clypt] yt-dlp binary already present at', BIN_PATH);
  process.exit(0);
}

// 3. yt-dlp already on system PATH (local dev)
try {
  execSync('yt-dlp --version', { stdio: 'ignore' });
  console.log('[clypt] yt-dlp found on system PATH — skipping download');
  process.exit(0);
} catch {}

// 4. Download the binary
const url = RELEASE_URLS[process.platform] ?? RELEASE_URLS.linux;
console.log(`[clypt] Downloading yt-dlp for platform "${process.platform}" from GitHub…`);
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
    writeFileSync(BIN_PATH, buf);
    if (!IS_WIN) chmodSync(BIN_PATH, 0o755);
    console.log(`[clypt] yt-dlp installed → ${BIN_PATH} (${(buf.length / 1e6).toFixed(1)} MB)`);
  })
  .catch((err) => {
    console.error('[clypt] Failed to download yt-dlp:', err.message);
    console.error('[clypt] Install yt-dlp manually and set YTDLP_PATH or ensure it is on PATH.');
    // Non-fatal: allow the build to continue; the app will error at runtime if yt-dlp is missing.
  });
