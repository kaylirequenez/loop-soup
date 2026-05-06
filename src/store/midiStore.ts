import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  buildDefaultMidiLayerPlacement,
  buildDefaultMidiLoopRollPlacement,
} from "./utils/persistence";
import { useLayerStore } from "./layerStore";
import { useCompositionStore } from "./compositionStore";
import type { MidiStoreState } from "../types/midi";
/**
 * Midi store
 *
 * Owns persisted MIDI-view and playhead state:
 * - roll split/count layout
 * - visible measure window
 * - roll placement routing
 * - current composition playhead beat
 */
export const useMidiStore = create<MidiStoreState>()(
  persist(
    (set, get) => ({
      midiRollCount: 2,
      midiRollSplitByRootOctave: false,
      midiMeasuresVisible: 2,
      midiViewMeasureIndex: 0,
      midiPlayheadBeat: 0,
      midiLoopRollPlacement: buildDefaultMidiLoopRollPlacement(),
      midiLayerPlacement: buildDefaultMidiLayerPlacement(),

      toggleSecondRoll: () =>
        set((state) => {
          const next = state.midiRollCount == 2 ? 1 : 2;
          return {
            midiRollCount: next,
            ...(next < 2 ? { midiRollSplitByRootOctave: false } : {}),
          };
        }),

      setMidiRollSplitByRootOctave: (enabled) =>
        set(() => ({
          midiRollSplitByRootOctave: enabled,
          midiRollCount: 2,
        })),

      setMidiMeasuresVisible: (value) =>
        set((state) => {
          const { totalMeasures } = useCompositionStore.getState();
          const maxStart = totalMeasures - value;
          const nextStart = Math.min(state.midiViewMeasureIndex, maxStart);
          return {
            midiMeasuresVisible: value,
            midiViewMeasureIndex: nextStart,
          };
        }),

      setMidiViewMeasureIndex: (value) => set({ midiViewMeasureIndex: value }),

      setMidiPlayheadBeat: (beat) => set({ midiPlayheadBeat: beat }),

      setMidiLayerRollPlacement: (layerId, placement) =>
        set((state) => {
          const loops = useLayerStore.getState().layers[layerId].layerLoops;
          return {
            midiLoopRollPlacement: {
              ...state.midiLoopRollPlacement,
              [layerId]: Object.fromEntries(
                loops.map((_, i) => [i, placement]),
              ),
            },
            midiLayerPlacement: {
              ...state.midiLayerPlacement,
              [layerId]: placement,
            },
          };
        }),

      setMidiLoopRollPlacement: (layerId, loopId, placement) =>
        set((state) => {
          const nextLayerMap = {
            ...state.midiLoopRollPlacement[layerId],
            [loopId]: placement,
          };
          const loops = useLayerStore.getState().layers[layerId].layerLoops;
          const allSame = loops.every((_, i) => nextLayerMap[i] === placement);
          return {
            midiLoopRollPlacement: {
              ...state.midiLoopRollPlacement,
              [layerId]: nextLayerMap,
            },
            midiLayerPlacement: {
              ...state.midiLayerPlacement,
              [layerId]: allSame ? placement : null,
            },
          };
        }),

      isNoteOnRoll: (layerId, loopId, storedOctave, rollSlot) => {
        const {
          midiRollCount,
          midiRollSplitByRootOctave,
          midiLoopRollPlacement,
        } = get();
        if (midiRollCount < 2) return true;
        if (midiRollSplitByRootOctave) {
          const { octave } = useCompositionStore.getState();
          return (storedOctave > octave ? 1 : 2) === rollSlot;
        }
        const placement = midiLoopRollPlacement[layerId]?.[loopId] ?? "both";
        return placement === "both" || Number(placement) === rollSlot;
      },
    }),
    {
      name: "loop-soup",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        midiRollCount: state.midiRollCount,
        midiRollSplitByRootOctave: state.midiRollSplitByRootOctave,
        midiMeasuresVisible: state.midiMeasuresVisible,
        midiLoopRollPlacement: state.midiLoopRollPlacement,
        midiLayerPlacement: state.midiLayerPlacement,
        midiViewMeasureIndex: state.midiViewMeasureIndex,
        midiPlayheadBeat: state.midiPlayheadBeat,
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Record<string, unknown>;
        return {
          ...currentState,
          ...p,
          midiPlayheadBeat: p.midiPlayheadBeat as number,
        } as MidiStoreState;
      },
    },
  ),
);
