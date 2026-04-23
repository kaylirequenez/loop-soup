import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { TransportStoreState } from "../types/transport";

export const TRANSPORT_STORE_KEY = "loop-soup-transport";

/**
 * Transport store
 *
 * Owns timeline / clock settings:
 * - Persisted: tempo (`bpm`), `key`, `meter`, composition length (`masterLoopLength`).
 * - Runtime: `isPlaying`, add/extend toggles, `playheadPhase`, `transportNonce`.
 *
 * Does not own:
 * - layer or MIDI project data
 * - fractional MIDI playhead (see midiStore)
 */
export const useTransportStore = create<TransportStoreState>()(
  persist(
    (set) => ({
      isPlaying: false,
      addOn: false,
      extendOn: false,
      bpm: 128,
      key: "A min",
      meter: "4/4",
      masterLoopLength: 4,
      playheadPhase: 0.32,
      transportNonce: 0,

      setPlaying: (value) => set({ isPlaying: value }),
      togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
      setAddOn: (value) => set({ addOn: value }),
      toggleAddOn: () => set((s) => ({ addOn: !s.addOn })),
      setExtendOn: (value) => set({ extendOn: value }),
      toggleExtendOn: () => set((s) => ({ extendOn: !s.extendOn })),
      setBpm: (value) => set({ bpm: value }),
      setKey: (value) => set({ key: value }),
      setMeter: (value) => set({ meter: value }),
      setPlayheadPhase: (value) =>
        set({ playheadPhase: Math.max(0, Math.min(1, value)) }), // TODO: simplify
      bumpTransportNonce: () =>
        set((s) => ({ transportNonce: s.transportNonce + 1 })),
    }),
    {
      name: TRANSPORT_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bpm: state.bpm,
        key: state.key,
        meter: state.meter,
        masterLoopLength: state.masterLoopLength,
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Record<string, unknown>;
        return {
          ...currentState,
          bpm: typeof p.bpm === "number" ? p.bpm : currentState.bpm,
          key: typeof p.key === "string" ? p.key : currentState.key,
          meter: typeof p.meter === "string" ? p.meter : currentState.meter,
          masterLoopLength:
            typeof p.masterLoopLength === "number" && p.masterLoopLength > 0
              ? p.masterLoopLength
              : currentState.masterLoopLength,
          isPlaying: false,
          transportNonce: 0,
        };
      },
    },
  ),
);
