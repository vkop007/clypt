import https from 'https';
import http from 'http';
import { URL } from 'url';
import dns from 'dns';
import { isIP } from 'net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isPrivateIP(ip: string): boolean {
  if (ip === '::1' || ip === '0.0.0.0') return true;
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip.startsWith('172.')) {
    const parts = ip.split('.').map(Number);
    if (parts[1] >= 16 && parts[1] <= 31) return true;
  }
  if (ip.startsWith('192.168.')) return true;
  const lower = ip.toLowerCase();
  if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) return true;
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return Response.json({ error: 'url required' }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch { return Response.json({ error: 'Invalid URL' }, { status: 400 }); }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return Response.json({ error: 'Only http and https protocols are supported' }, { status: 400 });
  }

  const hostname = parsed.hostname;
  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      return Response.json({ error: 'Access denied' }, { status: 403 });
    }
  }

  return new Promise<Response>((resolve) => {
    const resolveIPCheck = (ip: string) => {
      if (isPrivateIP(ip)) {
        resolve(Response.json({ error: 'Access denied' }, { status: 403 }));
        return true;
      }
      return false;
    };

    const runProxy = () => {
      const protocol = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Clypt/1.0)' },
      };

      const proxyReq = protocol.get(options, (imgRes) => {
        const contentLength = parseInt(imgRes.headers['content-length'] ?? '0');
        const contentType = imgRes.headers['content-type'] ?? '';

        if (contentLength > 5 * 1024 * 1024) {
          resolve(Response.json({ error: 'File too large' }, { status: 400 }));
          return;
        }
        if (!contentType.startsWith('image/')) {
          resolve(Response.json({ error: 'Invalid content type' }, { status: 400 }));
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;

        imgRes.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > 5 * 1024 * 1024) {
            imgRes.destroy();
            resolve(Response.json({ error: 'Response exceeded limit' }, { status: 400 }));
            return;
          }
          chunks.push(chunk);
        });

        imgRes.on('end', () => {
          const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
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
    };

    if (isIP(hostname)) {
      runProxy();
    } else {
      dns.lookup(hostname, (err, address) => {
        if (err) {
          resolve(Response.json({ error: 'DNS resolution failed' }, { status: 400 }));
          return;
        }
        if (resolveIPCheck(address)) return;
        runProxy();
      });
    }
  });
}
