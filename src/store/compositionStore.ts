import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CompositionStoreState } from "../types/composition";
import { clampLoopOctaveForKey } from "../utils/compositionState";

export const COMPOSITION_STORE_KEY = "loop-soup-composition";

/**
 * Composition store
 *
 * Owns persisted global composition parameters:
 * - tempo (bpm)
 * - key signature
 * - meter
 * - composition octave anchor
 * - total measure count
 */
export const useCompositionStore = create<CompositionStoreState>()(
  persist(
    (set, get) => ({
      bpm: 128,
      key: { root: "A", accidental: null, mode: "min" },
      meter: { beatsPerMeasure: 4, noteValue: 4 },
      octave: 3,
      totalMeasures: 4,

      setBpm: (value) => set({ bpm: value }),
      setKey: (value) =>
        set((state) => ({
          key: value,
          octave: clampLoopOctaveForKey(state.octave, value),
        })),
      setMeter: (value) => set({ meter: value }),
      setOctave: (value) =>
        set(() => ({
          octave: clampLoopOctaveForKey(value, get().key),
        })),
      setTotalMeasures: (value) => set({ totalMeasures: value }),
    }),
    {
      name: COMPOSITION_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        bpm: state.bpm,
        key: state.key,
        meter: state.meter,
        octave: state.octave,
        totalMeasures: state.totalMeasures,
      }),
    },
  ),
);
