"use client"
import React, { useState } from 'react';
import { Clock, X, Check, CalendarDays, Play, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScheduleModalProps {
  title: string;
  thumbnail?: string | null;
  scheduleTime: string;
  onApply: (dateTimeLocal: string) => void;
  onClose: () => void;
}

function formatRelative(dateTimeLocal: string): string | null {
  if (!dateTimeLocal) return null;
  const ts = new Date(dateTimeLocal).getTime();
  if (isNaN(ts)) return null;
  const diff = ts - Date.now();
  if (diff <= 0) return null;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `in ${days}d ${Math.floor((diff % 86400000) / 3600000)}h`;
  if (hours > 0) return `in ${hours}h ${Math.floor((diff % 3600000) / 60000)}m`;
  return `in ${mins}m`;
}

function offsetIso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().slice(0, 16);
}

const QUICK_PICKS = [
  { label: 'In 30 min', offset: 30 * 60 * 1000 },
  { label: 'In 1 hour', offset: 60 * 60 * 1000 },
  { label: 'In 3 hours', offset: 3 * 60 * 60 * 1000 },
  { label: 'Tonight 9 PM', offset: -1, getIso: () => {
    const d = new Date(); d.setHours(21, 0, 0, 0);
    if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 16);
  }},
  { label: 'Tomorrow 8 AM', offset: -1, getIso: () => {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  }},
  { label: 'In 1 day', offset: 24 * 60 * 60 * 1000 },
];

export function ScheduleModal({ title, thumbnail, scheduleTime, onApply, onClose }: ScheduleModalProps) {
  const [value, setValue] = useState(scheduleTime);

  const minIso = new Date(Date.now() + 60000).toISOString().slice(0, 16);
  const isPast = value ? new Date(value).getTime() <= Date.now() : false;
  const relative = formatRelative(value);

  const handleApply = () => {
    if (!value || isPast) return;
    onApply(value);
    onClose();
  };

  const handleClear = () => {
    onApply('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-card border border-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
              <Clock className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Schedule Download</h2>
              <p className="text-xs text-muted-foreground">Set a date &amp; time to start</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 flex items-center justify-center transition-colors"
          >
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
            <p className="text-xs text-muted-foreground mt-0.5">Will be added to the queue at the scheduled time</p>
          </div>
        </div>

        <div className="p-5 flex flex-col gap-5">

          {/* Quick picks */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground/60 flex items-center gap-1.5">
              <Zap className="w-3 h-3" />Quick picks
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PICKS.map(qp => {
                const iso = qp.getIso ? qp.getIso() : offsetIso(qp.offset);
                const active = value === iso;
                return (
                  <button
                    key={qp.label}
                    onClick={() => setValue(iso)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${active ? 'bg-indigo-500 text-white border-indigo-500 shadow-sm shadow-indigo-500/25' : 'bg-muted/40 text-foreground/70 border-border/40 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800'}`}
                  >
                    {qp.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & time picker */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-foreground/60 flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3" />Custom date &amp; time
            </label>
            <div className="relative">
              <input
                type="datetime-local"
                value={value}
                min={minIso}
                onChange={e => setValue(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-border/60 bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-all text-foreground [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          {/* Scheduled summary / error */}
          {value && !isPast && relative && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Scheduled</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
                  {new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-indigo-400">·</span>
                <span className="text-indigo-500 font-medium">{relative}</span>
              </div>
            </div>
          )}

          {value && isPast && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/15 px-3 py-2 rounded-lg animate-in fade-in duration-150">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              Selected time is in the past — please choose a future time
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1 border-t border-border/30">
            <button
              onClick={handleClear}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 disabled:opacity-40"
              disabled={!scheduleTime}
            >
              <X className="w-3.5 h-3.5" />Clear schedule
            </button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} className="h-9 rounded-xl text-sm font-semibold px-4">
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!value || isPast}
                className="h-9 rounded-xl text-sm font-bold px-5 bg-indigo-500 hover:bg-indigo-600 text-white border-0 shadow-sm shadow-indigo-500/30 disabled:opacity-50"
              >
                <Check className="w-4 h-4 mr-1.5" />Schedule
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
