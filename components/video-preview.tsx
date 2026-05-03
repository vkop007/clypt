"use client"
import React from 'react';
import { X, Play, ExternalLink } from 'lucide-react';

interface Props { url: string; title: string; thumbnail?: string | null; onClose: () => void; }

function getEmbedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  return null;
}

export function VideoPreview({ url, title, thumbnail, onClose }: Props) {
  const embedUrl = getEmbedUrl(url);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
      <div className="w-full max-w-2xl bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border/40">
          <Play className="w-4 h-4 text-primary shrink-0" />
          <p className="text-sm font-semibold text-foreground truncate flex-1">{title}</p>
          <button onClick={onClose} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="relative w-full aspect-video bg-black">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          ) : thumbnail ? (
            <div className="w-full h-full relative flex items-center justify-center">
              <img src={thumbnail} alt={title} className="w-full h-full object-cover opacity-50" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <p className="text-white/80 text-sm font-medium">Preview not available for this site</p>
                <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors border border-white/20"><ExternalLink className="w-4 h-4" />Open original</a>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
              <p className="text-white/50 text-sm">No preview available</p>
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"><ExternalLink className="w-4 h-4" />Open original</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
