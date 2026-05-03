"use client"
import React, { useState, useMemo } from 'react';
import { API_BASE } from '@/lib/api';
import { X, ListVideo, Search, CheckSquare, Square, Loader2, AlertCircle, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface PlaylistEntry {
  id: string;
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  url: string;
  uploader?: string | null;
}

interface Props {
  initialUrl?: string;
  onAddUrls: (urls: string[]) => void;
  onClose: () => void;
}

function fmtDur(s?: number | null) {
  if (!s) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function PlaylistBrowser({ initialUrl = '', onAddUrls, onClose }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PlaylistEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [playlistTitle, setPlaylistTitle] = useState('');

  const filtered = useMemo(() =>
    search.trim() ? entries.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) || (e.uploader ?? '').toLowerCase().includes(search.toLowerCase())) : entries,
    [entries, search]);

  const handleLoad = async () => {
    if (!url.trim()) return;
    setLoading(true); setError(null); setEntries([]); setSelected(new Set()); setPlaylistTitle('');
    try {
      const res = await fetch(`${API_BASE}/api/videos/playlist?url=${encodeURIComponent(url.trim())}&limit=100`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load playlist'); return; }
      setEntries(data.items);
      setPlaylistTitle(data.title || '');
      setSelected(new Set<string>(data.items.map((i: PlaylistEntry) => i.id)));
    } catch { setError('Network error. Check the URL and try again.'); }
    finally { setLoading(false); }
  };

  const toggleOne = (id: string) => setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleAll = () => { if (selected.size === filtered.length) setSelected(new Set()); else setSelected(new Set(filtered.map(e => e.id))); };
  const handleAdd = () => { const urls = entries.filter(e => selected.has(e.id)).map(e => e.url); if (urls.length > 0) onAddUrls(urls); onClose(); };

  const selectedCount = entries.filter(e => selected.has(e.id)).length;
  const allSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40 shrink-0">
          <ListVideo className="w-4 h-4 text-primary shrink-0" />
          <h2 className="font-bold text-sm text-foreground flex-1">Playlist / Channel Browser</h2>
          <button onClick={onClose} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 border-b border-border/40 shrink-0">
          <div className="flex gap-2">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLoad()} placeholder="https://youtube.com/playlist?list=... or @channel" className="flex-1 h-10 px-3 text-sm rounded-xl border border-border/60 bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-foreground placeholder:text-muted-foreground" />
            <Button onClick={handleLoad} disabled={loading || !url.trim()} className="h-10 px-5 rounded-xl font-bold text-sm shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load'}
            </Button>
          </div>
          {error && <div className="mt-2 flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/10 rounded-xl px-3 py-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
        </div>

        {entries.length > 0 && (
          <>
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40 bg-muted/20 shrink-0">
              {playlistTitle && <p className="text-xs font-semibold text-foreground truncate flex-1">{playlistTitle}</p>}
              <span className="text-xs text-muted-foreground shrink-0">{entries.length} video{entries.length !== 1 ? 's' : ''}</span>
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…" className="h-7 pl-7 pr-3 text-xs rounded-lg border border-border/60 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 w-28" />
              </div>
              <button onClick={toggleAll} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0">
                {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5" />}
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-border/30">
              {filtered.map(entry => {
                const isSelected = selected.has(entry.id);
                const dur = fmtDur(entry.duration);
                return (
                  <button key={entry.id} onClick={() => toggleOne(entry.id)} className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}>
                    <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${isSelected ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                      {isSelected && <div className="w-2 h-2 rounded-sm bg-white" />}
                    </div>
                    <div className="w-16 h-11 rounded-lg overflow-hidden bg-muted shrink-0 relative">
                      {entry.thumbnail ? <img src={entry.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-muted-foreground opacity-30" /></div>}
                      {dur && <span className="absolute bottom-0.5 right-0.5 bg-black/70 text-white text-[9px] px-1 rounded font-mono">{dur}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-snug">{entry.title}</p>
                      {entry.uploader && <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.uploader}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-4 border-t border-border/40 flex items-center justify-between gap-3 shrink-0">
              <span className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{selectedCount}</span> of {entries.length} selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={onClose} className="rounded-xl text-sm">Cancel</Button>
                <Button onClick={handleAdd} disabled={selectedCount === 0} className="rounded-xl font-bold text-sm shadow-sm">Add {selectedCount > 0 ? selectedCount : ''} URL{selectedCount !== 1 ? 's' : ''}</Button>
              </div>
            </div>
          </>
        )}

        {entries.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <ListVideo className="w-10 h-10 opacity-20" />
            <p className="text-sm">Paste a playlist or channel URL above and click Load</p>
          </div>
        )}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Loading playlist…</p>
            <p className="text-xs">This may take a moment for large playlists</p>
          </div>
        )}
      </div>
    </div>
  );
}
