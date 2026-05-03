import https from 'https';
import http from 'http';
import { URL } from 'url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return Response.json({ error: 'url required' }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return Response.json({ error: 'Invalid URL' }, { status: 400 }); }

  return new Promise<Response>((resolve) => {
    const protocol = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Clypt/1.0)' },
    };

    const proxyReq = protocol.get(options, (imgRes) => {
      const contentType = imgRes.headers['content-type'] ?? 'image/jpeg';
      const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
      const chunks: Buffer[] = [];
      imgRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      imgRes.on('end', () => {
        resolve(new Response(Buffer.concat(chunks), {
          headers: {
            'Content-Type': contentType,
            'Content-Disposition': `attachment; filename="thumbnail.${ext}"`,
            'Cache-Control': 'public, max-age=86400',
          },
        }));
      });
    });

    proxyReq.on('error', () => resolve(Response.json({ error: 'Failed to fetch thumbnail' }, { status: 502 })));
  });
}
