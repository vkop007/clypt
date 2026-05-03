"use client"
import React, { useEffect, useRef, useState } from 'react';
import { X, Camera, Upload, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { onScan: (value: string) => void; onClose: () => void; }

declare const BarcodeDetector: any;

export function QrScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<'requesting' | 'scanning' | 'error' | 'unsupported'>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const [found, setFound] = useState('');
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window;

  useEffect(() => {
    if (!supported) { setStatus('unsupported'); return; }
    startCamera();
    return () => { stopCamera(); cancelAnimationFrame(rafRef.current); };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => { videoRef.current!.play(); setStatus('scanning'); scanLoop(); };
      }
    } catch { setStatus('error'); setErrorMsg('Camera access denied. Upload a QR image instead.'); }
  }

  function stopCamera() { streamRef.current?.getTracks().forEach(t => t.stop()); }

  async function scanLoop() {
    if (!videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(scanLoop); return; }
    try {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(videoRef.current);
      if (codes.length > 0) {
        const val = codes[0].rawValue as string;
        setFound(val); stopCamera(); cancelAnimationFrame(rafRef.current);
        setTimeout(() => { onScan(val); onClose(); }, 800);
        return;
      }
    } catch {}
    rafRef.current = requestAnimationFrame(scanLoop);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!supported) { setErrorMsg('QR scanning not supported. Try Chrome or Edge.'); return; }
    try {
      const img = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const codes = await detector.detect(img);
      if (codes.length > 0) { const val = codes[0].rawValue as string; setFound(val); setTimeout(() => { onScan(val); onClose(); }, 600); }
      else { setErrorMsg('No QR code found. Try a clearer image.'); }
    } catch { setErrorMsg('Could not read image. Try another file.'); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div className="flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /><h2 className="font-bold text-sm text-foreground">QR Code Scanner</h2></div>
          <button onClick={onClose} className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {found ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center"><QrCode className="w-6 h-6 text-green-600 dark:text-green-400" /></div>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">QR code detected!</p>
              <p className="text-xs text-muted-foreground text-center break-all">{found}</p>
            </div>
          ) : status === 'scanning' ? (
            <div className="relative aspect-square w-full max-w-[260px] mx-auto rounded-xl overflow-hidden bg-black">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 relative">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
                  <div className="absolute top-1/2 -translate-y-px left-2 right-2 h-0.5 bg-primary/60 animate-pulse" />
                </div>
              </div>
            </div>
          ) : status === 'requesting' ? (
            <div className="flex flex-col items-center gap-3 py-8"><Camera className="w-10 h-10 text-muted-foreground/40 animate-pulse" /><p className="text-sm text-muted-foreground">Requesting camera…</p></div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6"><Camera className="w-10 h-10 text-muted-foreground/30" /><p className="text-sm text-muted-foreground text-center">{status === 'unsupported' ? 'Live scanning requires Chrome or Edge. Upload a QR image instead.' : errorMsg || 'Camera unavailable.'}</p></div>
          )}
          {errorMsg && status === 'scanning' && <p className="text-xs text-destructive text-center">{errorMsg}</p>}
          <div className="flex flex-col gap-2">
            {(status === 'error' || status === 'unsupported' || status === 'scanning') && (
              <label className="w-full cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <div className="h-10 w-full rounded-xl border border-border/60 bg-muted/40 hover:bg-muted transition-colors flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><Upload className="w-4 h-4" />Upload QR image</div>
              </label>
            )}
            <Button variant="ghost" size="sm" onClick={onClose} className="rounded-xl text-xs">Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
