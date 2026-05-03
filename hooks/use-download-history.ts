"use client"
import { useState, useCallback, useEffect } from 'react';

export interface HistoryItem {
  url: string;
  title: string;
  thumbnail: string | null;
  uploader: string | null;
  format: string;
  downloadedAt: number;
}

const STORAGE_KEY = 'clypt-download-history';
const MAX_ITEMS = 30;

function load(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch { return []; }
}

function save(items: HistoryItem[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
}

export function useDownloadHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setHistory(load());
  }, []);

  const addItem = useCallback((item: Omit<HistoryItem, 'downloadedAt'>) => {
    setHistory(prev => {
      const filtered = prev.filter(h => h.url !== item.url);
      const next = [{ ...item, downloadedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
      save(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((url: string) => {
    setHistory(prev => {
      const next = prev.filter(h => h.url !== url);
      save(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => { setHistory([]); save([]); }, []);

  return { history, addItem, removeItem, clearHistory };
}
