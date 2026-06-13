// src/lib/store/player.store.ts
// Global audio player state — satu player untuk seluruh app
import { create } from 'zustand';
import type { AudioAsset } from '@/types';

interface PlayerState {
  currentTrack: AudioAsset | null;
  isPlaying: boolean;
  progress: number;       // 0–100
  duration: number;       // dalam detik
  volume: number;         // 0–1
  queue: AudioAsset[];

  play: (track: AudioAsset) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: AudioAsset) => void;
  playNext: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  volume: 0.8,
  queue: [],

  play: (track) => set({ currentTrack: track, isPlaying: true, progress: 0 }),
  pause: () => set({ isPlaying: false }),
  resume: () => set({ isPlaying: true }),
  stop: () => set({ currentTrack: null, isPlaying: false, progress: 0 }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),

  addToQueue: (track) =>
    set((state) => ({
      queue: [...state.queue.filter((q) => q.id !== track.id), track],
    })),

  playNext: () => {
    const { queue, currentTrack } = get();
    if (!queue.length) return;
    const idx = queue.findIndex((q) => q.id === currentTrack?.id);
    const next = queue[idx + 1] ?? queue[0];
    set({ currentTrack: next, isPlaying: true, progress: 0 });
  },
}));
