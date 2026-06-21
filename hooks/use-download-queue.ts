"use client"
import { useState, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '@/lib/api';

export type QueueItemStatus = 'scheduled' | 'queued' | 'pending' | 'downloading' | 'complete' | 'error';

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
  params: QueueParams;
  attempts: number;
  createdAt: number;
  completedAt?: number;
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

const QUEUE_STORAGE_KEY = 'clypt-download-queue-v2';
const DEFAULT_CONCURRENCY = 2;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = 3;

interface StoredQueue {
  version: 2;
  concurrencyLimit: number;
  items: QueueItem[];
}

function makeQueueId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function clampConcurrency(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_CONCURRENCY;
  return Math.min(MAX_CONCURRENCY, Math.max(MIN_CONCURRENCY, Math.round(value)));
}

function hasRunnableParams(item: Partial<QueueItem>): item is QueueItem {
  return !!(
    item.params?.url &&
    item.params?.format &&
    item.params?.formatId &&
    item.params?.title
  );
}

function restoreItem(item: QueueItem): QueueItem | null {
  if (!hasRunnableParams(item)) return null;
  if (item.status === 'complete') return null;

  const activeStatus = item.status === 'pending' || item.status === 'downloading';
  const scheduledFor = item.scheduledFor ?? item.params.scheduledFor;
  const pastScheduled = item.status === 'scheduled' && !!scheduledFor && scheduledFor <= Date.now();
  const status: QueueItemStatus = activeStatus || pastScheduled ? 'queued' : item.status;

  return {
    ...item,
    jobId: makeQueueId(),
    status,
    scheduledFor,
    percent: 0,
    speed: '',
    eta: '',
    size: '',
    error: status === 'error' ? item.error : undefined,
    attempts: item.attempts ?? 0,
    createdAt: item.createdAt ?? Date.now(),
  };
}

function toStoredItem(item: QueueItem): QueueItem {
  if (item.status === 'pending' || item.status === 'downloading') {
    return {
      ...item,
      jobId: makeQueueId(),
      status: 'queued',
      percent: 0,
      speed: '',
      eta: '',
      size: '',
      error: undefined,
    };
  }

  return item;
}

function resetForRetry(item: QueueItem): QueueItem {
  const scheduledFor = item.scheduledFor ?? item.params.scheduledFor;
  const isFutureSchedule = !!scheduledFor && scheduledFor > Date.now();

  return {
    ...item,
    jobId: makeQueueId(),
    status: isFutureSchedule ? 'scheduled' : 'queued',
    percent: 0,
    speed: '',
    eta: '',
    size: '',
    error: undefined,
    scheduledFor,
    completedAt: undefined,
  };
}

export function useDownloadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [concurrencyLimit, setConcurrencyLimitState] = useState(DEFAULT_CONCURRENCY);
  const [hasHydrated, setHasHydrated] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const startJob = useCallback(async (tempId: string, params: QueueParams) => {
    if (abortControllers.current.has(tempId)) return;

    setItems(prev => prev.map(i => i.jobId === tempId ? {
      ...i,
      status: 'pending',
      percent: 0,
      speed: '',
      eta: '',
      size: '',
      error: undefined,
      attempts: i.attempts + 1,
    } : i));

    const controller = new AbortController();
    abortControllers.current.set(tempId, controller);

    let completedJobId = '';
    let terminalEventSeen = false;

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
        const data = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || 'Failed to start download');
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
              terminalEventSeen = true;
              completedJobId = event.jobId as string;
              setItems(prev => prev.map(i =>
                i.jobId === tempId
                  ? { ...i, jobId: completedJobId, status: 'complete', percent: 100, speed: '', eta: '', completedAt: Date.now() }
                  : i
              ));
            } else if (event.type === 'error') {
              terminalEventSeen = true;
              setItems(prev => prev.map(i =>
                i.jobId === tempId ? { ...i, status: 'error', error: event.message as string } : i
              ));
            }
          } catch {}
        }
      }

      if (!terminalEventSeen) {
        setItems(prev => prev.map(i =>
          i.jobId === tempId ? { ...i, status: 'error', error: 'Download ended before completion' } : i
        ));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setItems(prev => prev.map(i =>
        i.jobId === tempId ? { ...i, status: 'error', error: err instanceof Error ? err.message : 'Connection lost or download failed' } : i
      ));
    } finally {
      abortControllers.current.delete(tempId);
      if (completedJobId) abortControllers.current.delete(completedJobId);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as Partial<StoredQueue>;
      const restoredItems = Array.isArray(stored.items)
        ? stored.items.map(item => restoreItem(item)).filter((item): item is QueueItem => !!item)
        : [];

      setItems(restoredItems);
      setConcurrencyLimitState(clampConcurrency(stored.concurrencyLimit ?? DEFAULT_CONCURRENCY));
    } catch {
      window.localStorage.removeItem(QUEUE_STORAGE_KEY);
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    const stored: StoredQueue = {
      version: 2,
      concurrencyLimit,
      items: items.map(toStoredItem),
    };
    window.localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(stored));
  }, [concurrencyLimit, hasHydrated, items]);

  const addToQueue = useCallback((params: QueueParams) => {
    const tempId = makeQueueId();
    const isScheduled = !!params.scheduledFor && params.scheduledFor > Date.now();
    const item: QueueItem = {
      jobId: tempId,
      url: params.url,
      title: params.title,
      thumbnail: params.thumbnail,
      format: params.format,
      status: isScheduled ? 'scheduled' : 'queued',
      percent: 0, speed: '', eta: '', size: '',
      scheduledFor: params.scheduledFor,
      params,
      attempts: 0,
      createdAt: Date.now(),
    };
    setItems(prev => [...prev, item]);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const startReadyJobs = () => {
      const now = Date.now();
      const runningCount = items.filter(i => i.status === 'pending' || i.status === 'downloading').length;
      let slots = Math.max(0, concurrencyLimit - runningCount);
      if (slots === 0) return;

      for (const item of items) {
        if (slots === 0) break;
        const isQueued = item.status === 'queued';
        const isDueSchedule = item.status === 'scheduled' && (item.scheduledFor ?? 0) <= now;
        if ((!isQueued && !isDueSchedule) || abortControllers.current.has(item.jobId)) continue;

        startJob(item.jobId, item.params);
        slots -= 1;
      }
    };

    startReadyJobs();
    const id = window.setInterval(startReadyJobs, 1000);
    return () => clearInterval(id);
  }, [concurrencyLimit, hasHydrated, items, startJob]);

  const downloadFile = useCallback((jobId: string) => {
    window.open(`${API_BASE}/api/videos/download/${jobId}/file`, '_blank');
  }, []);

  const removeItem = useCallback((jobId: string) => {
    abortControllers.current.get(jobId)?.abort();
    abortControllers.current.delete(jobId);
    setItems(prev => prev.filter(i => i.jobId !== jobId));
  }, []);

  const clearCompleted = useCallback(() => {
    setItems(prev => prev.filter(i => i.status !== 'complete' && i.status !== 'error'));
  }, []);

  const retryItem = useCallback((jobId: string) => {
    setItems(prev => prev.map(i => i.jobId === jobId ? resetForRetry(i) : i));
  }, []);

  const retryFailed = useCallback(() => {
    setItems(prev => prev.map(i => i.status === 'error' ? resetForRetry(i) : i));
  }, []);

  const setConcurrencyLimit = useCallback((value: number) => {
    setConcurrencyLimitState(clampConcurrency(value));
  }, []);

  const activeCount = items.filter(i =>
    i.status === 'downloading' || i.status === 'pending'
  ).length;

  return {
    items,
    addToQueue,
    downloadFile,
    removeItem,
    clearCompleted,
    retryItem,
    retryFailed,
    concurrencyLimit,
    setConcurrencyLimit,
    activeCount,
  };
}
