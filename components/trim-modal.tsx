"use client"
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Scissors, X, Play, Check, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrimModalProps {
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  startTime: string;
  endTime: string;
  onApply: (start: string, end: string) => void;
  onClose: () => void;
}

function parseTime(val: string): number | null {
  const v = val.trim();
  if (!v) return null;
  const parts = v.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1 && !isNaN(parts[0])) return parts[0];
  return null;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTimeVerbose(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function TrimModal({ title, thumbnail, duration, startTime, endTime, onApply, onClose }: TrimModalProps) {
  const [start, setStart] = useState(startTime);
  const [end, setEnd] = useState(endTime);
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const totalDur = duration ?? 0;

  const parsedStart = parseTime(start) ?? 0;
  const parsedEnd = parseTime(end) ?? totalDur;

  const startPct = totalDur > 0 ? Math.min(100, Math.max(0, (parsedStart / totalDur) * 100)) : 0;
  const endPct = totalDur > 0 ? Math.min(100, Math.max(0, (parsedEnd / totalDur) * 100)) : 100;

  const clipDuration = Math.max(0, (parseTime(end) ?? totalDur) - (parseTime(start) ?? 0));

  const errors: string[] = [];
  if (start && parseTime(start) === null) errors.push('Start time format invalid — use m:ss or h:mm:ss');
  if (end && parseTime(end) === null) errors.push('End time format invalid — use m:ss or h:mm:ss');
  if (parseTime(start) !== null && parseTime(end) !== null && parsedStart >= parsedEnd)
    errors.push('Start must be before end');
  if (totalDur > 0 && parsedStart > totalDur) errors.push('Start exceeds video duration');
  if (totalDur > 0 && parsedEnd > totalDur) errors.push('End exceeds video duration');

  const pctToTime = useCallback((pct: number) => {
    if (totalDur === 0) return '0:00';
    return formatTime(Math.round((pct / 100) * totalDur));
  }, [totalDur]);

  const handleTrackPointer = useCallback((e: React.PointerEvent<HTMLDivElement> | PointerEvent) => {
    if (!trackRef.current || !dragging) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const t = pctToTime(pct);
    if (dragging === 'start') setStart(t);
    else setEnd(t);
  }, [dragging, pctToTime]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => handleTrackPointer(e);
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dragging, handleTrackPointer]);

  const handleApply = () => {
    if (errors.length > 0) return;
    onApply(start, end);
    onClose();
  };

  const handleClear = () => {
    setStart('');
    setEnd('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-orange-500/15 flex items-center justify-center">
              <Scissors className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Trim Clip</h2>
              <p className="text-xs text-muted-foreground">Set start &amp; end points</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video info */}
        <div className="flex items-center gap-3 px-5 py-3.5 bg-muted/10 border-b border-border/30">
          {thumbnail
            ? <img src={thumbnail} alt="" className="w-16 h-11 rounded-lg object-cover flex-shrink-0 bg-muted" />
            : <div className="w-16 h-11 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center"><Play className="w-4 h-4 text-muted-foreground opacity-30" /></div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            {totalDur > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Total duration: <span className="font-mono font-semibold">{formatTime(totalDur)}</span>
              </p>
            )}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Timeline scrubber */}
          {totalDur > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
                <span>0:00</span>
                <span>{formatTime(totalDur)}</span>
              </div>

              {/* Track */}
              <div
                ref={trackRef}
                className="relative h-10 bg-muted/40 rounded-xl overflow-visible cursor-pointer border border-border/40 select-none"
                onPointerDown={(e) => {
                  if (!trackRef.current) return;
                  const rect = trackRef.current.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  const startDist = Math.abs(pct - startPct);
                  const endDist = Math.abs(pct - endPct);
                  setDragging(startDist < endDist ? 'start' : 'end');
                  handleTrackPointer(e);
                }}
              >
                {/* Background film strip marks */}
                <div className="absolute inset-0 flex">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div key={i} className="flex-1 border-r border-border/20 last:border-r-0" />
                  ))}
                </div>

                {/* Inactive regions */}
                <div className="absolute top-0 bottom-0 left-0 bg-black/30 rounded-l-xl" style={{ width: `${startPct}%` }} />
                <div className="absolute top-0 bottom-0 right-0 bg-black/30 rounded-r-xl" style={{ width: `${100 - endPct}%` }} />

                {/* Active region */}
                <div
                  className="absolute top-0 bottom-0 bg-orange-500/25 border-t-2 border-b-2 border-orange-500/60"
                  style={{ left: `${startPct}%`, right: `${100 - endPct}%` }}
                />

                {/* Start handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 cursor-ew-resize"
                  style={{ left: `${startPct}%` }}
                >
                  <div className={`h-10 w-3.5 rounded-md flex items-center justify-center transition-all ${dragging === 'start' ? 'bg-orange-600 scale-110' : 'bg-orange-500 hover:bg-orange-600'} shadow-lg border border-orange-400/50`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="w-0.5 h-2.5 bg-white/70 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* End handle */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 cursor-ew-resize"
                  style={{ left: `${endPct}%` }}
                >
                  <div className={`h-10 w-3.5 rounded-md flex items-center justify-center transition-all ${dragging === 'end' ? 'bg-orange-600 scale-110' : 'bg-orange-500 hover:bg-orange-600'} shadow-lg border border-orange-400/50`}>
                    <div className="flex flex-col gap-0.5">
                      <div className="w-0.5 h-2.5 bg-white/70 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground text-center">Drag the handles to set start and end, or type times below</p>
            </div>
          )}

          {/* Time inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground/60 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                Start time
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={totalDur > 0 ? '0:00' : 'm:ss'}
                  value={start}
                  onChange={e => setStart(e.target.value)}
                  className="w-full h-11 px-3 pr-10 rounded-xl border border-border/60 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all text-center text-foreground"
                />
                {start && (
                  <button onClick={() => setStart('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {totalDur > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[0, Math.floor(totalDur * 0.25), Math.floor(totalDur * 0.5)].map(t => (
                    <button key={t} onClick={() => setStart(formatTime(t))} className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted hover:bg-orange-100 dark:hover:bg-orange-950/40 text-muted-foreground hover:text-orange-600 transition-colors border border-border/40">
                      {formatTime(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-foreground/60 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                End time
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={totalDur > 0 ? formatTime(totalDur) : 'm:ss'}
                  value={end}
                  onChange={e => setEnd(e.target.value)}
                  className="w-full h-11 px-3 pr-10 rounded-xl border border-border/60 bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 transition-all text-center text-foreground"
                />
                {end && (
                  <button onClick={() => setEnd('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {totalDur > 0 && (
                <div className="flex flex-wrap gap-1">
                  {[Math.floor(totalDur * 0.5), Math.floor(totalDur * 0.75), totalDur].map(t => (
                    <button key={t} onClick={() => setEnd(formatTime(t))} className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted hover:bg-orange-100 dark:hover:bg-orange-950/40 text-muted-foreground hover:text-orange-600 transition-colors border border-border/40">
                      {formatTime(t)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clip summary */}
          {(start || end) && errors.length === 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Scissors className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">Clip range</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="font-bold text-orange-600 dark:text-orange-400">{start || '0:00'}</span>
                <span className="text-orange-400 text-sm">→</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{end || (totalDur > 0 ? formatTime(totalDur) : 'end')}</span>
                {clipDuration > 0 && (
                  <span className="ml-1 text-orange-500/80 font-medium">· {formatTimeVerbose(clipDuration)}</span>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="flex flex-col gap-1.5 animate-in fade-in duration-150">
              {errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/15 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />{err}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <button
              onClick={handleClear}
              disabled={!start && !end}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />Clear trim
            </button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} className="h-9 rounded-xl text-sm font-semibold px-4">
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={errors.length > 0}
                className="h-9 rounded-xl text-sm font-bold px-5 bg-orange-500 hover:bg-orange-600 text-white border-0 shadow-sm shadow-orange-500/30 disabled:opacity-50"
              >
                <Check className="w-4 h-4 mr-1.5" />Apply Trim
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
