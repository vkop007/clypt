import { spawn } from 'child_process';
import { ytDlpPath } from '@/lib/ytdlp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get('url');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

  if (!rawUrl) return Response.json({ error: 'url required' }, { status: 400 });

  return new Promise<Response>((resolve) => {
    const args = ['--flat-playlist', '--dump-json', '--no-warnings', '--no-abort-on-error', rawUrl];
    const proc = spawn(ytDlpPath(), args);
    const items: object[] = [];
    let buffer = '';
    let errBuf = '';
    let playlistTitle = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        if (items.length >= limit) { proc.kill(); return; }
        try {
          const obj = JSON.parse(line);
          if (!playlistTitle && obj.playlist_title) playlistTitle = obj.playlist_title;
          const videoUrl = obj.url ?? obj.webpage_url ??
            (obj.id ? `https://www.youtube.com/watch?v=${obj.id}` : null);
          if (!videoUrl) continue;
          items.push({
            id: obj.id ?? String(items.length),
            title: obj.title ?? '(Untitled)',
            duration: obj.duration ?? null,
            thumbnail: obj.thumbnail ?? obj.thumbnails?.[0]?.url ?? null,
            url: videoUrl,
            uploader: obj.uploader ?? obj.channel ?? null,
          });
        } catch { /* skip */ }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => { errBuf += chunk.toString(); });
    const timeout = setTimeout(() => proc.kill(), 60_000);

    proc.on('close', () => {
      clearTimeout(timeout);
      if (items.length === 0) {
        const msg = errBuf.split('\n').find(l => l.includes('ERROR:'))?.replace(/.*ERROR:\s*/, '')
          || 'No videos found. Check the URL and try again.';
        resolve(Response.json({ error: msg }, { status: 400 }));
        return;
      }
      resolve(Response.json({ items, title: playlistTitle }));
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timeout);
      resolve(Response.json({ error: err.message }, { status: 500 }));
    });
  });
}
