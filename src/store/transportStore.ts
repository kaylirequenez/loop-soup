import { create } from "zustand";
import type { TransportStoreState } from "../types/transport";
import { transportDebug } from "../utils/transportDebug";

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
  playheadBeat: 0,
  viewMeasureIndex: 0,

  setPlaying: (value) =>
    set((s) => {
      transportDebug("setPlaying", { from: s.isPlaying, to: value });
      return { isPlaying: value };
    }),
  togglePlaying: () =>
    set((s) => {
      const next = !s.isPlaying;
      transportDebug("togglePlaying", { from: s.isPlaying, to: next });
      return { isPlaying: next };
    }),
  setExtendOn: (value) => set({ extendOn: value }),
  toggleExtendOn: () => set((s) => ({ extendOn: !s.extendOn })),
  setPlayheadBeat: (beat) =>
    set((s) => {
      transportDebug("setPlayheadBeat", { from: s.playheadBeat, to: beat });
      return { playheadBeat: beat };
    }),
  setViewMeasureIndex: (index) =>
    set((s) => {
      transportDebug("setViewMeasureIndex", {
        from: s.viewMeasureIndex,
        to: index,
      });
      return { viewMeasureIndex: index };
    }),
}));
