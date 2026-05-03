import { execFile } from 'child_process';
import { ytDlpPath, parseFormats, isAudioFormat } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RawVideoInfo {
  title: string;
  thumbnail?: string;
  duration?: number;
  uploader?: string;
  view_count?: number;
  upload_date?: string;
  description?: string;
  like_count?: number;
  formats?: Array<{
    format_id: string; ext: string; height?: number;
    filesize?: number; filesize_approx?: number;
    vcodec?: string; acodec?: string; abr?: number;
  }>;
}

function fetchVideoInfo(url: string, format: string, allowPlaylist: boolean) {
  return new Promise<object>((resolve, reject) => {
    const args = ['--dump-json'];
    if (!allowPlaylist) args.push('--no-playlist');
    args.push(url);

    const proc = execFile(ytDlpPath(), args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) { reject(new Error(err.message.split('\n')[0])); return; }
      try {
        const info: RawVideoInfo = JSON.parse(stdout.trim());
        resolve({
          url,
          title: info.title ?? url,
          thumbnail: info.thumbnail ?? null,
          duration: info.duration ?? null,
          uploader: info.uploader ?? null,
          viewCount: info.view_count ?? null,
          uploadDate: info.upload_date ?? null,
          description: info.description ? info.description.slice(0, 500) : null,
          likeCount: info.like_count ?? null,
          formats: parseFormats(info.formats ?? [], format),
          error: null,
        });
      } catch { reject(new Error('Failed to parse video info')); }
    });
    setTimeout(() => { proc.kill(); reject(new Error('Timed out fetching video info')); }, 30000);
  });
}

export async function POST(req: Request) {
  let body: { urls?: string[]; format?: string; allowPlaylist?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { urls, format = 'mp4', allowPlaylist = false } = body;
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return Response.json({ error: 'urls array required' }, { status: 400 });
  }

  const dedupedUrls = [...new Set(urls.map((u: string) => u.trim()).filter(Boolean))];
  const results = await Promise.all(
    dedupedUrls.map(async (url) => {
      try {
        return await fetchVideoInfo(url, format, !!allowPlaylist);
      } catch (err) {
        return {
          url, title: url, thumbnail: null, duration: null, uploader: null,
          formats: [], error: err instanceof Error ? err.message : 'Failed to fetch video info',
        };
      }
    })
  );

  return Response.json(results);
}
