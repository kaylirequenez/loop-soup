import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useLayerStore } from "./layerStore";
import { useCompositionStore } from "./compositionStore";
import { useTransportStore } from "./transportStore";
import type { MidiStoreState } from "../types/midi";
import {
  DEFAULT_MIDI_LAYER_PLACEMENT,
  DEFAULT_MIDI_LOOP_ROLL_PLACEMENT,
} from "./utils/defaults";
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
      midiLoopRollPlacement: DEFAULT_MIDI_LOOP_ROLL_PLACEMENT,
      midiLayerPlacement: DEFAULT_MIDI_LAYER_PLACEMENT,

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
        set(() => {
          const { totalMeasures } = useCompositionStore.getState();
          const maxStart = totalMeasures - value;
          const { viewMeasureIndex } = useTransportStore.getState();
          const nextStart = Math.min(viewMeasureIndex, maxStart);
          useTransportStore.setState({ viewMeasureIndex: nextStart });
          return { midiMeasuresVisible: value };
        }),

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
      }),
    },
  ),
);
