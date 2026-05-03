"use client"
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { API_BASE } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertCircle, Download, Film, Music, Link as LinkIcon, DownloadCloud,
  Sparkles, Subtitles, ListVideo, Globe, Clipboard,
  History, Trash2, X, ChevronDown, ChevronUp, Scissors,
  Eye, ThumbsUp, CalendarDays, Info, FileText, QrCode, Image, Play, Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDownloadHistory } from '@/hooks/use-download-history';
import { useDownloadQueue } from '@/hooks/use-download-queue';
import { DownloadQueue } from '@/components/download-queue';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import { QrScanner } from '@/components/qr-scanner';
import { VideoPreview } from '@/components/video-preview';
import { PlaylistBrowser } from '@/components/playlist-browser';
import { TrimModal } from '@/components/trim-modal';
import { ScheduleModal } from '@/components/schedule-modal';
import { VideoCardSkeleton } from '@/components/video-card-skeleton';

type VideoFormat = 'mp4' | 'webm' | 'gif';
type AudioFormat = 'mp3' | 'm4a' | 'wav' | 'ogg';
type OutputFormat = VideoFormat | AudioFormat;
type AudioQuality = 'best' | '320k' | '192k' | '128k';

interface VideoInfo {
  url: string;
  title: string;
  thumbnail?: string | null;
  duration?: number | null;
  uploader?: string | null;
  viewCount?: number | null;
  uploadDate?: string | null;
  description?: string | null;
  likeCount?: number | null;
  formats: { formatId: string; quality: string; ext: string; filesize?: number | null }[];
  error?: string | null;
}

const AUDIO_FORMATS: { value: AudioFormat; label: string }[] = [
  { value: 'mp3', label: 'MP3' }, { value: 'm4a', label: 'M4A' },
  { value: 'wav', label: 'WAV' }, { value: 'ogg', label: 'OGG' },
];
const VIDEO_FORMATS: { value: VideoFormat; label: string; note?: string }[] = [
  { value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' },
  { value: 'gif', label: 'GIF', note: 'Animated — best with trim' },
];
const AUDIO_QUALITY_OPTIONS: { value: AudioQuality; label: string }[] = [
  { value: 'best', label: 'Best quality' }, { value: '320k', label: '320 kbps' },
  { value: '192k', label: '192 kbps' }, { value: '128k', label: '128 kbps' },
];
const PLATFORM_GROUPS = [
  { category: 'Social Media', color: 'bg-muted/50 text-muted-foreground border-border/50', platforms: ['YouTube', 'TikTok', 'Instagram', 'Twitter / X', 'Facebook', 'Reddit', 'LinkedIn', 'Threads', 'Snapchat', 'Pinterest', 'Tumblr', 'Mastodon'] },
  { category: 'Video Platforms', color: 'bg-muted/50 text-muted-foreground border-border/50', platforms: ['Vimeo', 'Twitch', 'Dailymotion', 'Loom', 'Streamable', 'Bilibili', 'Niconico', 'Rumble', 'Odysee', 'PeerTube', 'Kick', 'Floatplane'] },
  { category: 'Music & Podcasts', color: 'bg-muted/50 text-muted-foreground border-border/50', platforms: ['SoundCloud', 'Bandcamp', 'Mixcloud', 'Audiomack', 'Spotify (clips)', 'Deezer', 'Podbean', 'Buzzsprout'] },
  { category: 'News & Media', color: 'bg-muted/50 text-muted-foreground border-border/50', platforms: ['BBC iPlayer', 'The Guardian', 'Reuters', 'Bloomberg', 'Vice', 'Vox', 'CNN', 'NBC News', 'Sky News', 'Arte', 'France TV'] },
  { category: 'Other', color: 'bg-muted/50 text-muted-foreground border-border/50', platforms: ['9GAG', 'Flickr', 'Imgur', 'Gfycat', 'Giphy', 'Patreon', 'Substack', 'Weibo', 'VK', '+ 1000 more'] },
];

function isAudioFormat(fmt: OutputFormat): boolean { return ['mp3', 'm4a', 'wav', 'ogg'].includes(fmt); }
function formatDuration(seconds?: number | null) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function formatSize(bytes?: number | null) { if (!bytes) return ''; return `${(bytes / 1048576).toFixed(1)} MB`; }
function formatViews(n?: number | null): string | null {
  if (!n) return null;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B views`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K views`;
  return `${n} views`;
}
function formatUploadDate(raw?: string | null): string | null {
  if (!raw || raw.length !== 8) return null;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(raw.slice(4,6))-1]} ${parseInt(raw.slice(6,8))}, ${raw.slice(0,4)}`;
}
function timeAgo(ts: number): string {
  const diff = Date.now() - ts, m = Math.floor(diff/60000), h = Math.floor(diff/3600000), d = Math.floor(diff/86400000);
  if (d > 0) return `${d}d ago`; if (h > 0) return `${h}h ago`; if (m > 0) return `${m}m ago`; return 'just now';
}

export function Home() {
  const [urlsInput, setUrlsInput] = useState('');
  const [format, setFormat] = useState<OutputFormat>('mp4');
  const [audioQuality, setAudioQuality] = useState<AudioQuality>('best');
  const [subtitles, setSubtitles] = useState(false);
  const [allowPlaylist, setAllowPlaylist] = useState(false);
  const [showAllPlatforms, setShowAllPlatforms] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedFormats, setSelectedFormats] = useState<Record<string, string>>({});
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [trimModalUrl, setTrimModalUrl] = useState<string | null>(null);
  const [trimStart, setTrimStart] = useState<Record<string, string>>({});
  const [trimEnd, setTrimEnd] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<{ url: string; title: string; thumbnail?: string | null } | null>(null);
  const [scheduleModalUrl, setScheduleModalUrl] = useState<string | null>(null);
  const [scheduleTime, setScheduleTime] = useState<Record<string, string>>({});
  const [results, setResults] = useState<VideoInfo[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { history, addItem, removeItem, clearHistory } = useDownloadHistory();
  const { items: queueItems, addToQueue, downloadFile, removeItem: removeQueueItem, clearCompleted, activeCount } = useDownloadQueue();
  const { searches, addSearch, clearSearches } = useRecentSearches();
  const { toast } = useToast();

  const urlCount = useMemo(() => urlsInput.split('\n').map(u => u.trim()).filter(u => u.length > 0).length, [urlsInput]);

  const appendUrls = useCallback((incoming: string[]) => {
    const cleaned = incoming.map(u => u.trim()).filter(u => u.length > 0);
    if (cleaned.length === 0) return;
    setUrlsInput(prev => { const existing = prev.trim(); return existing ? `${existing}\n${cleaned.join('\n')}` : cleaned.join('\n'); });
  }, []);

  const handleFetch = async () => {
    const urls = urlsInput.split('\n').map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) { toast({ title: 'No URLs provided', description: 'Please enter at least one valid URL.', variant: 'destructive' }); return; }
    setPendingCount(urls.length);
    setIsPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/videos/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [...new Set(urls)], format, audioQuality: isAudioFormat(format) ? audioQuality : undefined, subtitles: !isAudioFormat(format) ? subtitles : undefined, allowPlaylist }),
      });
      const data: VideoInfo[] = await res.json();
      setResults(data);
      addSearch(urls);
      const newSelections: Record<string, string> = {};
      data.forEach(video => { if (video.formats?.length > 0) newSelections[video.url] = video.formats[0].formatId; });
      setSelectedFormats(newSelections);
      setTrimModalUrl(null); setTrimStart({}); setTrimEnd({}); setShowDetails({}); setShowRecentSearches(false); setScheduleModalUrl(null);
    } catch (err: unknown) {
      toast({ title: 'Failed to fetch', description: err instanceof Error ? err.message : 'An error occurred.', variant: 'destructive' });
    } finally { setIsPending(false); }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { toast({ title: 'Clipboard is empty', variant: 'destructive' }); return; }
      const lines = text.split('\n').map(u => u.trim()).filter(u => u.length > 0);
      appendUrls(lines);
      toast({ title: `Pasted ${lines.length} URL${lines.length !== 1 ? 's' : ''}` });
    } catch { toast({ title: 'Clipboard access denied', description: 'Please paste manually with Ctrl+V.', variant: 'destructive' }); }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const urls = text.split('\n').map(l => l.trim()).filter(l => l.startsWith('http://') || l.startsWith('https://'));
      if (urls.length === 0) { toast({ title: 'No URLs found', description: 'Make sure the file has one URL per line.', variant: 'destructive' }); return; }
      appendUrls(urls);
      toast({ title: `Imported ${urls.length} URL${urls.length !== 1 ? 's' : ''}`, description: file.name });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (!text) return;
    const urls = text.split(/[\n\r]+/).map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length > 0) { appendUrls(urls); toast({ title: `Added ${urls.length} URL${urls.length !== 1 ? 's' : ''}`, description: 'Dropped from browser' }); }
  };

  const handleThumbnailDownload = (thumbnailUrl: string, title: string) => {
    const a = document.createElement('a');
    a.href = `${API_BASE}/api/videos/thumbnail?url=${encodeURIComponent(thumbnailUrl)}`;
    a.download = `${title.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}_thumbnail.jpg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast({ title: 'Downloading thumbnail…' });
  };

  const queueDownload = (video: VideoInfo) => {
    const formatId = selectedFormats[video.url];
    if (!formatId) return;
    const rawTime = scheduleTime[video.url];
    const scheduledFor = rawTime ? new Date(rawTime).getTime() : undefined;
    const isScheduled = !!scheduledFor && scheduledFor > Date.now();
    addToQueue({ url: video.url, format, formatId, audioQuality: isAudioFormat(format) ? audioQuality : undefined, startTime: trimStart[video.url] || undefined, endTime: trimEnd[video.url] || undefined, title: video.title, thumbnail: video.thumbnail ?? null, scheduledFor });
    addItem({ url: video.url, title: video.title, thumbnail: video.thumbnail ?? null, uploader: video.uploader ?? null, format });
    toast({ title: isScheduled ? 'Scheduled' : 'Added to queue', description: video.title });
  };

  const handleQueueAll = () => {
    results.filter(v => !v.error && v.formats?.length > 0).forEach((video, index) => {
      if (selectedFormats[video.url]) setTimeout(() => queueDownload(video), index * 200);
    });
  };

  const successfulCount = results.filter(v => !v.error).length;
  const isAudio = isAudioFormat(format);
  const visibleGroups = showAllPlatforms ? PLATFORM_GROUPS : PLATFORM_GROUPS.slice(0, 2);

  return (
    <div className="w-full bg-background flex flex-col items-center relative overflow-x-hidden font-sans selection:bg-primary/20 selection:text-primary">
      <div className="absolute top-0 left-0 w-[60%] h-[40%] rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-[100px] pointer-events-none -translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 right-0 w-[60%] h-[40%] rounded-full bg-gradient-to-tl from-orange-400/10 to-transparent blur-[100px] pointer-events-none translate-x-1/4 translate-y-1/4" />

      <div className="w-full max-w-3xl flex flex-col gap-8 sm:gap-10 py-10 sm:py-14 px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header */}
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <button onClick={() => setShowHistory(v => !v)} className={`relative h-9 w-9 rounded-xl border flex items-center justify-center transition-all ${showHistory ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`} title="Download history">
              <History className="w-4 h-4" />
              {history.length > 0 && !showHistory && <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">{history.length > 9 ? '9+' : history.length}</span>}
            </button>
          </div>
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-card shadow-sm border border-border/50 ring-4 ring-primary/5">
            <DownloadCloud className="w-7 h-7 sm:w-8 sm:h-8 text-primary" strokeWidth={2.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-none">Clypt</h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-sm sm:max-w-md font-medium leading-snug">Paste your links. Choose your format. Download instantly.</p>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 px-3 py-1.5 rounded-full border border-primary/15">
            <Globe className="w-3.5 h-3.5" />1,000+ supported websites
          </div>
        </div>

        {/* History panel */}
        {showHistory && (
          <Card className="border-border/60 shadow-lg bg-card rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
            <CardContent className="p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><History className="w-4 h-4 text-primary" /><h2 className="font-bold text-sm text-foreground">Download History</h2><span className="text-xs text-muted-foreground">({history.length})</span></div>
                <div className="flex items-center gap-2">
                  {history.length > 0 && <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"><Trash2 className="w-3.5 h-3.5" />Clear all</button>}
                  <button onClick={() => setShowHistory(false)} className="text-muted-foreground hover:text-foreground transition-colors ml-1"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No downloads yet. Start downloading to build your history.</div>
              ) : (
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {history.map(item => (
                    <div key={`${item.url}-${item.downloadedAt}`} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                      {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-12 h-9 rounded-lg object-cover flex-shrink-0 bg-muted" /> : <div className="w-12 h-9 rounded-lg bg-muted flex-shrink-0 flex items-center justify-center"><Film className="w-4 h-4 text-muted-foreground opacity-40" /></div>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5"><span className="uppercase font-bold text-primary/70">{item.format}</span><span>·</span><span>{timeAgo(item.downloadedAt)}</span></p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setUrlsInput(prev => prev ? `${prev}\n${item.url}` : item.url)} className="h-7 px-2 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">Re-use</button>
                        <button onClick={() => removeItem(item.url)} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex items-center justify-center"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Input Card */}
        <Card className="border-border/60 shadow-xl bg-card/70 backdrop-blur-xl rounded-2xl sm:rounded-3xl ring-1 ring-white/10 dark:ring-white/5">
          <CardContent className="p-5 sm:p-7 lg:p-9 flex flex-col gap-6">
            {/* URL input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label htmlFor="urls" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground/70">
                  <LinkIcon className="w-3.5 h-3.5 text-primary" />Video URLs
                </label>
                <div className="flex items-center gap-1.5">
                  {urlCount > 0 && <span className="text-xs font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{urlCount} URL{urlCount !== 1 ? 's' : ''}</span>}
                  {searches.length > 0 && (
                    <button onClick={() => setShowRecentSearches(v => !v)} className={`flex items-center gap-1.5 text-xs font-semibold transition-colors px-2.5 py-1 rounded-lg border ${showRecentSearches ? 'bg-primary/10 text-primary border-primary/20' : 'text-muted-foreground hover:text-primary bg-muted/50 hover:bg-primary/10 border-border/50'}`} title="Recent searches">
                      <Clock className="w-3 h-3" />Recent
                    </button>
                  )}
                  <button onClick={() => setShowQrScanner(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-muted/50 hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-border/50" title="Scan QR code">
                    <QrCode className="w-3 h-3" />QR
                  </button>
                  <button onClick={() => setShowPlaylist(true)} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-muted/50 hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-border/50" title="Browse a playlist or channel">
                    <ListVideo className="w-3 h-3" />Playlist
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-muted/50 hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-border/50" title="Import URLs from .txt file">
                    <FileText className="w-3 h-3" />Import
                  </button>
                  <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="hidden" onChange={handleFileImport} />
                  <button onClick={handlePasteFromClipboard} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors bg-muted/50 hover:bg-primary/10 px-2.5 py-1 rounded-lg border border-border/50">
                    <Clipboard className="w-3 h-3" />Paste
                  </button>
                </div>
              </div>

              {showRecentSearches && searches.length > 0 && (
                <div className="bg-card border border-border/60 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-muted/30">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Recent searches</span>
                    <button onClick={() => { clearSearches(); setShowRecentSearches(false); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium flex items-center gap-1"><Trash2 className="w-3 h-3" />Clear</button>
                  </div>
                  <div className="max-h-52 overflow-y-auto divide-y divide-border/30">
                    {searches.map(s => (
                      <button key={s.id} onClick={() => { setUrlsInput(s.urls.join('\n')); setShowRecentSearches(false); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/40 transition-colors group">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                        <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-foreground truncate">{s.label}</p><p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(s.timestamp)}</p></div>
                        <span className="text-[10px] font-bold text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Use</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} className={`relative rounded-xl transition-all duration-200 ${isDragging ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}>
                {isDragging && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-primary/10 backdrop-blur-sm rounded-xl border-2 border-dashed border-primary pointer-events-none">
                    <LinkIcon className="w-6 h-6 text-primary animate-bounce" /><p className="text-sm font-bold text-primary">Drop URL here</p>
                  </div>
                )}
                <Textarea id="urls" placeholder={"Paste one URL per line, or drag & drop a link here…\nhttps://youtube.com/watch?v=...\nhttps://tiktok.com/@user/video/...\nhttps://vimeo.com/..."} className="min-h-[130px] sm:min-h-[150px] text-sm resize-y bg-background/50 border-border/60 focus-visible:ring-primary/30 focus-visible:border-primary shadow-inner rounded-xl p-4 leading-relaxed" value={urlsInput} onChange={(e) => setUrlsInput(e.target.value)} />
              </div>
            </div>

            {/* Format */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground/70">Format</span>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Film className="w-3 h-3" /> Video</span>
                <div className="flex flex-wrap gap-2">
                  {VIDEO_FORMATS.map(f => (
                    <div key={f.value} className="flex flex-col gap-0.5">
                      <button onClick={() => setFormat(f.value)} className={`h-9 px-4 rounded-xl text-sm font-semibold border transition-all ${format === f.value ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25' : 'bg-muted/40 text-foreground/70 border-border/40 hover:bg-muted/70 hover:text-foreground'}`}>{f.label}</button>
                      {f.note && format === f.value && <span className="text-[10px] text-orange-500 font-medium px-1">{f.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Music className="w-3 h-3" /> Audio only</span>
                <div className="flex flex-wrap gap-2">
                  {AUDIO_FORMATS.map(f => (
                    <button key={f.value} onClick={() => setFormat(f.value)} className={`h-9 px-4 rounded-xl text-sm font-semibold border transition-all ${format === f.value ? 'bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/25' : 'bg-muted/40 text-foreground/70 border-border/40 hover:bg-muted/70 hover:text-foreground'}`}>{f.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="flex flex-col gap-3">
              {isAudio && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Audio Quality</label>
                  <Select value={audioQuality} onValueChange={(v) => setAudioQuality(v as AudioQuality)}>
                    <SelectTrigger className="w-full sm:w-56 h-10 bg-muted/30 rounded-xl font-medium border-border/60 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {AUDIO_QUALITY_OPTIONS.map(q => <SelectItem key={q.value} value={q.value} className="font-medium rounded-lg text-sm">{q.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
                {!isAudio && format !== 'gif' && (
                  <div className="flex items-center gap-2.5">
                    <Switch id="subtitles" checked={subtitles} onCheckedChange={setSubtitles} />
                    <Label htmlFor="subtitles" className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer select-none"><Subtitles className="w-4 h-4 text-primary" />Download subtitles</Label>
                  </div>
                )}
                <div className="flex items-center gap-2.5">
                  <Switch id="allowPlaylist" checked={allowPlaylist} onCheckedChange={setAllowPlaylist} />
                  <Label htmlFor="allowPlaylist" className="flex items-center gap-1.5 text-sm font-semibold cursor-pointer select-none"><ListVideo className="w-4 h-4 text-primary" />Allow playlist</Label>
                </div>
              </div>
            </div>

            <Button onClick={handleFetch} disabled={isPending || !urlsInput.trim()} className="h-11 px-6 rounded-xl font-bold shadow-md shadow-primary/25 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-[0.98] text-sm w-full sm:w-auto self-end">
              {isPending ? <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 animate-pulse shrink-0" />Fetching...</span> : `Fetch Media${urlCount > 1 ? ` (${urlCount})` : ''}`}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex flex-col gap-6">
          {isPending && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {Array.from({ length: Math.max(1, pendingCount) }).map((_, i) => (
                <VideoCardSkeleton key={i} />
              ))}
            </div>
          )}

          {!isPending && results.length > 0 && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground leading-tight">Ready to Download</h2>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {successfulCount} video{successfulCount !== 1 ? 's' : ''} found
                      {results.length !== successfulCount ? ` · ${results.length - successfulCount} error${results.length - successfulCount !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                </div>
                {successfulCount >= 2 && (
                  <Button onClick={handleQueueAll} className="h-9 rounded-xl font-bold text-sm shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/25 transition-all">
                    <Download className="w-3.5 h-3.5 mr-1.5 shrink-0" />Queue All {successfulCount}
                  </Button>
                )}
              </div>

              <div className="flex flex-col gap-4">
                {results.map((video, idx) => {
                  const dur = formatDuration(video.duration);
                  const views = formatViews(video.viewCount);
                  const uploaded = formatUploadDate(video.uploadDate);
                  const description = video.description;
                  const isDetailOpen = showDetails[video.url] ?? false;
                  const hasTrim = !!(trimStart[video.url] || trimEnd[video.url]);

                  return (
                    <Card key={`${video.url}-${idx}`} className="overflow-hidden border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl group">
                      <div className="flex flex-col sm:flex-row">
                        {/* Thumbnail */}
                        <div className="w-full sm:w-52 lg:w-60 h-44 sm:h-auto bg-muted/20 relative flex-shrink-0 border-b sm:border-b-0 sm:border-r border-border/40 overflow-hidden">
                          {video.thumbnail ? <img src={video.thumbnail} alt={video.title || 'Thumbnail'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Film className="w-10 h-10 opacity-20" /></div>}
                          {!video.error && dur && <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-md text-white text-xs px-2 py-0.5 rounded-md font-mono font-medium">{dur}</div>}
                          {!video.error && (
                            <div className="absolute top-2 left-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <button onClick={() => setPreviewVideo({ url: video.url, title: video.title, thumbnail: video.thumbnail })} title="Preview" className="h-7 w-7 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 flex items-center justify-center transition-colors"><Play className="w-3.5 h-3.5" /></button>
                              {video.thumbnail && <button onClick={() => handleThumbnailDownload(video.thumbnail!, video.title)} title="Save thumbnail" className="h-7 w-7 rounded-lg bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 flex items-center justify-center transition-colors"><Image className="w-3.5 h-3.5" /></button>}
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3 min-w-0">
                          {video.error ? (
                            <div className="flex items-start gap-3 bg-destructive/5 p-3 rounded-xl border border-destructive/10">
                              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-destructive" />
                              <div className="space-y-1 min-w-0"><h3 className="font-semibold text-xs truncate text-destructive/80">{video.url}</h3><p className="text-sm font-medium text-destructive">{video.error}</p></div>
                            </div>
                          ) : (
                            <>
                              <div>
                                <h3 className="font-bold text-sm sm:text-base line-clamp-2 leading-snug text-foreground" title={video.title}>{video.title}</h3>
                                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">{video.uploader || 'Unknown Uploader'}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                {views && <span className="flex items-center gap-1"><Eye className="w-3 h-3 shrink-0" />{views}</span>}
                                {uploaded && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3 shrink-0" />{uploaded}</span>}
                                {description && <button onClick={() => setShowDetails(prev => ({ ...prev, [video.url]: !isDetailOpen }))} className="flex items-center gap-1 hover:text-primary transition-colors font-semibold"><Info className="w-3 h-3 shrink-0" />{isDetailOpen ? 'Hide' : 'Details'}</button>}
                              </div>
                              {isDetailOpen && description && <div className="bg-muted/30 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed line-clamp-4 border border-border/30">{description}</div>}

                              <div className="flex flex-col xs:flex-row xs:items-center gap-2 mt-auto">
                                <Select value={selectedFormats[video.url] || ''} onValueChange={(val) => setSelectedFormats(prev => ({ ...prev, [video.url]: val }))}>
                                  <SelectTrigger className="w-full xs:w-auto xs:flex-1 sm:max-w-[220px] h-10 bg-muted/30 rounded-xl font-medium border-border/60 text-sm"><SelectValue placeholder="Select quality" /></SelectTrigger>
                                  <SelectContent className="rounded-xl">
                                    {video.formats.map(f => <SelectItem key={f.formatId} value={f.formatId} className="font-medium rounded-lg text-sm">{f.quality} {f.ext && `(${f.ext})`}{f.filesize ? ` — ${formatSize(f.filesize)}` : ''}</SelectItem>)}
                                  </SelectContent>
                                </Select>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => setPreviewVideo({ url: video.url, title: video.title, thumbnail: video.thumbnail })} title="Preview video" className="h-10 w-10 rounded-xl border border-border/40 bg-muted/40 text-muted-foreground hover:text-primary hover:bg-primary/10 hover:border-primary/20 flex items-center justify-center transition-all"><Play className="w-4 h-4" /></button>
                                  <button onClick={() => setScheduleModalUrl(video.url)} title="Schedule download" className={`h-10 w-10 rounded-xl border flex items-center justify-center transition-all ${scheduleTime[video.url] ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/70'}`}><Clock className="w-4 h-4" /></button>
                                  <button onClick={() => setTrimModalUrl(video.url)} title="Trim clip" className={`h-10 px-2.5 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-xs font-semibold ${hasTrim ? 'bg-orange-500 text-white border-orange-500' : 'bg-muted/40 border-border/40 text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:border-orange-200'}`}><Scissors className="w-3.5 h-3.5 shrink-0" />{hasTrim ? 'Trimmed' : 'Trim'}</button>
                                  <Button className="h-10 flex-1 xs:flex-none rounded-xl font-bold shadow-sm text-sm shrink-0" disabled={!selectedFormats[video.url]} onClick={() => queueDownload(video)}>
                                    {scheduleTime[video.url] && new Date(scheduleTime[video.url]).getTime() > Date.now()
                                      ? <><Clock className="w-4 h-4 mr-2 shrink-0" />Schedule</>
                                      : <><Download className="w-4 h-4 mr-2 shrink-0" />Queue</>}
                                  </Button>
                                </div>
                              </div>

                              {scheduleTime[video.url] && new Date(scheduleTime[video.url]).getTime() > Date.now() && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 rounded-xl">
                                  <Clock className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span className="text-xs font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                    {new Date(scheduleTime[video.url]).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button onClick={() => setScheduleModalUrl(video.url)} className="ml-1 text-[10px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors">Edit</button>
                                  <button onClick={() => setScheduleTime(p => { const n = {...p}; delete n[video.url]; return n; })} className="ml-auto text-[10px] font-bold text-indigo-400 hover:text-indigo-600 transition-colors">✕ Clear</button>
                                </div>
                              )}

                              {hasTrim && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/40 rounded-xl">
                                  <Scissors className="w-3 h-3 text-orange-500 shrink-0" />
                                  <span className="text-xs font-mono font-semibold text-orange-600 dark:text-orange-400">
                                    {trimStart[video.url] || '0:00'} → {trimEnd[video.url] || 'end'}
                                  </span>
                                  <button onClick={() => setTrimModalUrl(video.url)} className="ml-1 text-[10px] font-bold text-orange-500 hover:text-orange-700 transition-colors">Edit</button>
                                  <button onClick={() => { setTrimStart(p => { const n = {...p}; delete n[video.url]; return n; }); setTrimEnd(p => { const n = {...p}; delete n[video.url]; return n; }); }} className="ml-auto text-[10px] font-bold text-orange-400 hover:text-orange-600 transition-colors">✕ Clear</button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supported platforms */}
          <div className="flex flex-col gap-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Supported Platforms</h2>
              <button onClick={() => setShowAllPlatforms(v => !v)} className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors">
                {showAllPlatforms ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Show all</>}
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {visibleGroups.map(group => (
                <div key={group.category} className="flex flex-col gap-2">
                  <p className="text-xs font-semibold text-muted-foreground">{group.category}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.platforms.map(p => <span key={p} className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${group.color}`}>{p}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating download queue */}
      <DownloadQueue items={queueItems} onDownloadFile={downloadFile} onRemoveItem={removeQueueItem} onClearCompleted={clearCompleted} activeCount={activeCount} />

      {/* Modals */}
      {showQrScanner && <QrScanner onScan={(val) => { appendUrls([val]); toast({ title: 'QR URL added' }); }} onClose={() => setShowQrScanner(false)} />}
      {previewVideo && <VideoPreview url={previewVideo.url} title={previewVideo.title} thumbnail={previewVideo.thumbnail} onClose={() => setPreviewVideo(null)} />}
      {scheduleModalUrl && (() => {
        const v = results.find(r => r.url === scheduleModalUrl);
        if (!v) return null;
        return (
          <ScheduleModal
            title={v.title}
            thumbnail={v.thumbnail}
            scheduleTime={scheduleTime[scheduleModalUrl] || ''}
            onApply={(dt) => {
              if (dt) setScheduleTime(prev => ({ ...prev, [scheduleModalUrl]: dt }));
              else setScheduleTime(prev => { const n = { ...prev }; delete n[scheduleModalUrl]; return n; });
            }}
            onClose={() => setScheduleModalUrl(null)}
          />
        );
      })()}
      {trimModalUrl && (() => {
        const v = results.find(r => r.url === trimModalUrl);
        if (!v) return null;
        return (
          <TrimModal
            title={v.title}
            thumbnail={v.thumbnail}
            duration={v.duration}
            startTime={trimStart[trimModalUrl] || ''}
            endTime={trimEnd[trimModalUrl] || ''}
            onApply={(s, e) => {
              setTrimStart(prev => ({ ...prev, [trimModalUrl]: s }));
              setTrimEnd(prev => ({ ...prev, [trimModalUrl]: e }));
            }}
            onClose={() => setTrimModalUrl(null)}
          />
        );
      })()}
      {showPlaylist && (
        <PlaylistBrowser
          initialUrl={urlsInput.split('\n').find(u => u.trim().startsWith('http')) ?? ''}
          onAddUrls={(urls) => { appendUrls(urls); toast({ title: `Added ${urls.length} URL${urls.length !== 1 ? 's' : ''} from playlist` }); }}
          onClose={() => setShowPlaylist(false)}
        />
      )}
    </div>
  );
}
