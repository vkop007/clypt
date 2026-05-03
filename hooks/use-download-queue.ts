"use client"
import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

export type QueueItemStatus = 'scheduled' | 'pending' | 'downloading' | 'complete' | 'error';

export interface QueueItem {
  jobId: string;
  url: string;
  title: string;
  thumbnail: string | null;
  format: string;
  status: QueueItemStatus;
  percent: number;
  speed: string;
  eta: string;
  size: string;
  error?: string;
  scheduledFor?: number;
}

export interface QueueParams {
  url: string;
  format: string;
  formatId: string;
  audioQuality?: string;
  startTime?: string;
  endTime?: string;
  title: string;
  thumbnail: string | null;
  scheduledFor?: number;
}

export function useDownloadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const scheduledMap = useRef<Map<string, QueueParams>>(new Map());

  function updateItem(jobId: string, patch: Partial<QueueItem>) {
    setItems(prev => prev.map(i => i.jobId === jobId ? { ...i, ...patch } : i));
  }

  const startJob = useCallback(async (tempId: string, params: QueueParams) => {
    updateItem(tempId, { status: 'pending' });
    scheduledMap.current.delete(tempId);

    const controller = new AbortController();
    abortControllers.current.set(tempId, controller);

    let completedJobId = '';

    try {
      const res = await fetch(`${API_BASE}/api/videos/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: params.url,
          format: params.format,
          formatId: params.formatId,
          audioQuality: params.audioQuality,
          startTime: params.startTime,
          endTime: params.endTime,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start download');
      }

      setItems(prev => prev.map(i =>
        i.jobId === tempId ? { ...i, status: 'downloading' } : i
      ));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'progress') {
              setItems(prev => prev.map(i =>
                i.jobId === tempId
                  ? { ...i, status: 'downloading', percent: event.percent, speed: event.speed, eta: event.eta, size: event.size }
                  : i
              ));
            } else if (event.type === 'complete') {
              completedJobId = event.jobId as string;
              setItems(prev => prev.map(i =>
                i.jobId === tempId
                  ? { ...i, jobId: completedJobId, status: 'complete', percent: 100, speed: '', eta: '' }
                  : i
              ));
            } else if (event.type === 'error') {
              setItems(prev => prev.map(i =>
                i.jobId === tempId ? { ...i, status: 'error', error: event.message as string } : i
              ));
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setItems(prev => prev.map(i =>
        i.jobId === tempId ? { ...i, status: 'error', error: 'Connection lost or download failed' } : i
      ));
    } finally {
      abortControllers.current.delete(tempId);
      if (completedJobId) abortControllers.current.delete(completedJobId);
    }
  }, []);

  const addToQueue = useCallback(async (params: QueueParams) => {
    const tempId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isScheduled = !!params.scheduledFor && params.scheduledFor > Date.now();
    const item: QueueItem = {
      jobId: tempId,
      url: params.url,
      title: params.title,
      thumbnail: params.thumbnail,
      format: params.format,
      status: isScheduled ? 'scheduled' : 'pending',
      percent: 0, speed: '', eta: '', size: '',
      scheduledFor: params.scheduledFor,
    };
    setItems(prev => [item, ...prev]);
    if (isScheduled) { scheduledMap.current.set(tempId, params); return; }
    await startJob(tempId, params);
  }, [startJob]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      for (const [tempId, params] of Array.from(scheduledMap.current.entries())) {
        if ((params.scheduledFor ?? 0) <= now) startJob(tempId, params);
      }
    }, 5000);
    return () => clearInterval(id);
  }, [startJob]);

  const downloadFile = useCallback((jobId: string) => {
    window.open(`${API_BASE}/api/videos/download/${jobId}/file`, '_blank');
  }, []);

  const removeItem = useCallback((jobId: string) => {
    abortControllers.current.get(jobId)?.abort();
    abortControllers.current.delete(jobId);
    scheduledMap.current.delete(jobId);
    setItems(prev => prev.filter(i => i.jobId !== jobId));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(i => i.status !== 'complete' && i.status !== 'error'));
  }, []);

  const activeCount = items.filter(i =>
    i.status === 'downloading' || i.status === 'pending' || i.status === 'scheduled'
  ).length;

  return { items, addToQueue, downloadFile, removeItem, clearCompleted, activeCount };
}
