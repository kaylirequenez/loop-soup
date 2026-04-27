import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CompositionStoreState } from "../types/composition";
import { clampLoopOctave } from "../utils/compositionState";

export const COMPOSITION_STORE_KEY = "loop-soup-composition";

export const useCompositionStore = create<CompositionStoreState>()(
  persist(
    (set) => ({
      bpm: 128,
      key: { root: "A", accidental: null, mode: "min" },
      meter: { beatsPerMeasure: 4, noteValue: 4 },
      octave: 3,
      totalMeasures: 4,

      setBpm: (value) => set({ bpm: value }),
      setKey: (value) => set({ key: value }),
      setMeter: (value) => set({ meter: value }),
      setOctave: (value) => set({ octave: value }),
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
