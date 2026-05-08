import { create } from "zustand";
import type { TransportStoreState } from "../types/transport";

export const TRANSPORT_STORE_KEY = "loop-soup-transport";

/**
 * Transport store
 *
 * Owns runtime transport toggles/signals only:
 * - play/pause state
 * - add / extend toggles
 * - playhead beat + MIDI view window anchor
 */
export const useTransportStore = create<TransportStoreState>()((set) => ({
  isPlaying: false,
  extendOn: false,
  isScrubbing: false,
  playheadBeat: 0,
  viewMeasureIndex: 0,
  followNowbar: true,

  setPlaying: (value) => set({ isPlaying: value }),
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setExtendOn: (value) => set({ extendOn: value }),
  toggleExtendOn: () => set((s) => ({ extendOn: !s.extendOn })),
  setScrubbing: (value) =>
    set((s) => (s.isScrubbing === value ? s : { isScrubbing: value })),
  setPlayheadBeat: (beat) => set({ playheadBeat: beat }),
  setViewMeasureIndex: (index) => set({ viewMeasureIndex: index }),
  setFollowNowbar: (value) => set({ followNowbar: value }),
}));
