import fs from 'fs';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function sanitizeFilename(name: string): string {
  return name.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!/^[0-9a-f-]{36}$/.test(jobId)) {
    return Response.json({ error: 'Invalid job ID' }, { status: 400 });
  }

  const metaPath = path.join(os.tmpdir(), `clypt-meta-${jobId}.json`);

  if (!fs.existsSync(metaPath)) {
    return Response.json({ error: 'File not found or expired. Re-download if needed.' }, { status: 404 });
  }

  let meta: { outputPath: string; filename: string };
  try {
    meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch {
    return Response.json({ error: 'Invalid job metadata' }, { status: 500 });
  }

  const { outputPath, filename } = meta;

  if (!fs.existsSync(outputPath)) {
    try { fs.unlinkSync(metaPath); } catch {}
    return Response.json({ error: 'File expired or already downloaded' }, { status: 410 });
  }

  const ext = path.extname(outputPath).slice(1).toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    mp4: 'video/mp4',
    webm: 'video/webm',
    gif: 'image/gif',
  };
  const contentType = mimeMap[ext] ?? 'application/octet-stream';
  const safeFilename = sanitizeFilename(filename || `download.${ext}`);
  const fileSize = fs.statSync(outputPath).size;

  const nodeStream = fs.createReadStream(outputPath);
  nodeStream.on('end', () => {
    try { fs.unlinkSync(outputPath); } catch {}
    try { fs.unlinkSync(metaPath); } catch {}
  });

  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Content-Type': contentType,
      'Content-Length': String(fileSize),
      'Cache-Control': 'no-store',
    },
  });
}
