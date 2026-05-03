import { jobs, type ProgressEvent } from '@/lib/jobs-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = jobs.get(jobId);
  if (!job) return Response.json({ error: 'Job not found' }, { status: 404 });

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: ProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (event.type === 'complete' || event.type === 'error') {
            if (cleanup) cleanup();
            try { controller.close(); } catch {}
          }
        } catch {}
      };

      if (job.status === 'complete') {
        send({ type: 'complete', filename: job.filename! });
        controller.close();
        return;
      }
      if (job.status === 'error') {
        send({ type: 'error', message: job.error || 'Unknown error' });
        controller.close();
        return;
      }

      job.listeners.add(send as (e: ProgressEvent) => void);
      cleanup = () => job.listeners.delete(send as (e: ProgressEvent) => void);

      req.signal.addEventListener('abort', () => {
        if (cleanup) cleanup();
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      if (cleanup) cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
