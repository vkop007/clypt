"use client"
import { useState, useCallback, useEffect } from 'react';

export interface SavedSearch {
  id: string;
  urls: string[];
  label: string;
  timestamp: number;
}

const KEY = 'clypt-recent-searches';

function load(): SavedSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch { return []; }
}

export function useRecentSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSearches(load());
  }, []);

  const addSearch = useCallback((urls: string[]) => {
    if (urls.length === 0) return;
    const label = urls[0].length > 52 ? urls[0].slice(0, 52) + '…' : urls[0];
    const suffix = urls.length > 1 ? ` +${urls.length - 1} more` : '';
    const entry: SavedSearch = { id: Date.now().toString(), urls, label: label + suffix, timestamp: Date.now() };
    setSearches(prev => {
      const deduped = prev.filter(s => s.urls.join('|') !== urls.join('|'));
      const next = [entry, ...deduped].slice(0, 10);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setSearches([]);
    localStorage.removeItem(KEY);
  }, []);

  return { searches, addSearch, clearSearches };
}
