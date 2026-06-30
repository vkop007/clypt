import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { jobs } from '@/lib/jobs-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs.get(jobId);

  if (!job || job.status !== 'complete' || !job.outputPath) {
    return Response.json({ error: 'File not ready' }, { status: 404 });
  }
  if (!fs.existsSync(job.outputPath)) {
    return Response.json({ error: 'File expired' }, { status: 410 });
  }

  const ext = path.extname(job.outputPath).slice(1);
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
    mp4: 'video/mp4', webm: 'video/webm', gif: 'image/gif',
  };
  const contentType = mimeMap[ext] ?? 'application/octet-stream';
  const filename = job.filename ?? path.basename(job.outputPath);
  const outputPath = job.outputPath;

  const nodeStream = fs.createReadStream(outputPath);
  const cleanup = () => {
    try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch {}
    jobs.delete(jobId);
  };
  nodeStream.on('end', cleanup);
  nodeStream.on('close', cleanup);
  nodeStream.on('error', cleanup);

  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': contentType,
    },
  });
}
