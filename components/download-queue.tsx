"use client"
import React, { useState, useEffect } from 'react';
import { Download, X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Film, Loader2, Clock, RotateCcw, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { QueueItem } from '@/hooks/use-download-queue';

interface DownloadQueueProps {
  items: QueueItem[];
  onDownloadFile: (jobId: string) => void;
  onRemoveItem: (jobId: string) => void;
  onClearCompleted: () => void;
  onRetryItem: (jobId: string) => void;
  onRetryFailed: () => void;
  concurrencyLimit: number;
  onConcurrencyChange: (value: number) => void;
  activeCount: number;
}

function QueueItemSkeleton({ thumbnail, title, onRemove }: { thumbnail: string | null; title: string; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative">
        {thumbnail ? <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-40" /> : <Skeleton className="w-full h-full rounded-lg" />}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <p className="text-sm font-semibold text-foreground/40 truncate">{title}</p>
        <div className="flex flex-col gap-1.5">
          <div className="h-1.5 w-full rounded-full overflow-hidden bg-muted relative">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-primary/20 rounded-full animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-8 rounded" /><Skeleton className="h-3 w-16 rounded" /><Skeleton className="h-3 w-14 rounded" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Loader2 className="w-4 h-4 text-primary/50 animate-spin" />
        <button onClick={onRemove} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}

function Countdown({ until }: { until: number }) {
  const [, forceRender] = useState(0);
  useEffect(() => { const id = setInterval(() => forceRender(n => n + 1), 1000); return () => clearInterval(id); }, []);
  const diff = Math.max(0, Math.floor((until - Date.now()) / 1000));
  const h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60), s = diff % 60;
  if (diff === 0) return <span className="text-xs text-primary font-semibold">Starting…</span>;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold tabular-nums">Starts in {parts.join(' ')}</span>;
}

export function DownloadQueue({
  items,
  onDownloadFile,
  onRemoveItem,
  onClearCompleted,
  onRetryItem,
  onRetryFailed,
  concurrencyLimit,
  onConcurrencyChange,
  activeCount,
}: DownloadQueueProps) {
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;

  const doneCount = items.filter(i => i.status === 'complete' || i.status === 'error').length;
  const failedCount = items.filter(i => i.status === 'error').length;
  const scheduledCount = items.filter(i => i.status === 'scheduled').length;
  const queuedCount = items.filter(i => i.status === 'queued' || i.status === 'pending').length;
  const downloadingCount = items.filter(i => i.status === 'downloading').length;
  const workCount = queuedCount + downloadingCount;
  const isOnlyScheduled = scheduledCount > 0 && workCount === 0;
  const headline = scheduledCount > 0 && workCount === 0
    ? `${scheduledCount} download${scheduledCount !== 1 ? 's' : ''} scheduled`
    : workCount > 0
      ? `${downloadingCount} active · ${queuedCount} queued`
      : failedCount > 0
        ? `${failedCount} download${failedCount !== 1 ? 's' : ''} failed`
        : 'All downloads complete';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-4 pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto shadow-2xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none border-b border-border/40 hover:bg-muted/30 transition-colors" onClick={() => setExpanded(v => !v)}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {activeCount > 0 ? <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" /> : isOnlyScheduled ? <Clock className="w-4 h-4 text-amber-500 shrink-0" /> : failedCount > 0 ? <AlertCircle className="w-4 h-4 text-destructive shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
            <span className="text-sm font-bold text-foreground truncate">
              {headline}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1">
            {failedCount > 0 && <button onClick={(e) => { e.stopPropagation(); onRetryFailed(); }} className="text-xs font-medium text-primary hover:text-primary/80 px-2 py-1 rounded-lg hover:bg-primary/10 transition-colors">Retry failed</button>}
            {doneCount > 0 && <button onClick={(e) => { e.stopPropagation(); onClearCompleted(); }} className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors">Clear done</button>}
            {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-border/30 bg-muted/15">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <ListOrdered className="w-3.5 h-3.5 text-primary" />
                Queue manager
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Parallel</span>
                {[1, 2, 3].map(value => (
                  <button
                    key={value}
                    onClick={() => onConcurrencyChange(value)}
                    className={`h-7 min-w-7 rounded-lg border px-2 text-xs font-bold transition-colors ${concurrencyLimit === value ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/70 text-muted-foreground border-border/50 hover:text-foreground hover:bg-muted'}`}
                    aria-label={`Download ${value} at a time`}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-border/30">
              {items.map(item => {
              if (item.status === 'scheduled') {
                return (
                  <div key={item.jobId} className="flex items-center gap-3 px-4 py-3 bg-amber-50/40 dark:bg-amber-950/10">
                    <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-60" /> : <Film className="w-4 h-4 text-muted-foreground opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                        {item.scheduledFor ? <Countdown until={item.scheduledFor} /> : <span className="text-xs text-muted-foreground">Scheduled</span>}
                        {item.scheduledFor && <span className="text-[10px] text-muted-foreground ml-1">({new Date(item.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>}
                      </div>
                    </div>
                    <button onClick={() => onRemoveItem(item.jobId)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              }

              if (item.status === 'queued') {
                return (
                  <div key={item.jobId} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover opacity-70" /> : <Film className="w-4 h-4 text-muted-foreground opacity-40" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">Waiting for a download slot · {item.format.toUpperCase()}</p>
                    </div>
                    <button onClick={() => onRemoveItem(item.jobId)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                );
              }

              const isLoading = item.status === 'pending' || (item.status === 'downloading' && item.percent === 0);
              if (isLoading) return <QueueItemSkeleton key={item.jobId} thumbnail={item.thumbnail} title={item.title} onRemove={() => onRemoveItem(item.jobId)} />;

              return (
                <div key={item.jobId} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                    {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" /> : <Film className="w-4 h-4 text-muted-foreground opacity-40" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                    {item.status === 'downloading' && (
                      <div className="mt-1.5 flex flex-col gap-1">
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${item.percent}%` }} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-bold text-primary tabular-nums">{item.percent.toFixed(1)}%</span>
                          {item.size && <span>{item.size}</span>}
                          {item.speed && <span>· {item.speed}</span>}
                          {item.eta && item.eta !== 'Unknown' && <span>· ETA {item.eta}</span>}
                        </div>
                      </div>
                    )}
                    {item.status === 'complete' && <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-0.5">Ready to save · {item.format.toUpperCase()}</p>}
                    {item.status === 'error' && <p className="text-xs text-destructive font-medium mt-0.5 truncate">{item.error || 'Download failed'}</p>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.status === 'complete' && <Button size="sm" className="h-8 px-3 text-xs rounded-xl font-bold" onClick={() => onDownloadFile(item.jobId)}><Download className="w-3.5 h-3.5 mr-1" />Save</Button>}
                    {item.status === 'error' && <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs rounded-xl font-bold" onClick={() => onRetryItem(item.jobId)}><RotateCcw className="w-3.5 h-3.5 mr-1" />Retry</Button>}
                    {item.status === 'downloading' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                    <button onClick={() => onRemoveItem(item.jobId)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
