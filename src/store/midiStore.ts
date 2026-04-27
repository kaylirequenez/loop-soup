import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { compositionLoopBeatLength } from "../utils/compositionState";
import {
  buildDefaultMidiLayerPlacement,
  buildDefaultMidiLoopRollPlacement,
  clampPersistedMidiPlayheadBeat,
} from "./utils/persistence";
import { useLayerStore } from "./layerStore";
import { useCompositionStore } from "./compositionStore";
import type { LayerId, LayerLoopId } from "../types/layer";
import type {
  MidiLayerPlacement,
  MidiLoopRollPlacementMap,
  MidiRollPlacement,
  RollSlot,
} from "../types/midi";

export interface MidiState {
  midiRollCount: number;
  midiRollSplitByRootOctave: boolean;
  midiMeasuresVisible: number;
  midiViewMeasureIndex: number;
  midiPlayheadBeat: number;
  midiLoopRollPlacement: MidiLoopRollPlacementMap;
  midiLayerPlacement: MidiLayerPlacement;

  toggleSecondRoll: () => void;
  setMidiRollSplitByRootOctave: (enabled: boolean) => void;
  setMidiMeasuresVisible: (value: number) => void;
  setMidiViewMeasureIndex: (value: number) => void;
  setMidiPlayheadBeat: (beat: number) => void;
  setMidiLayerRollPlacement: (
    layerId: LayerId,
    placement: MidiRollPlacement,
  ) => void;
  setMidiLoopRollPlacement: (
    layerId: LayerId,
    loopId: LayerLoopId,
    placement: MidiRollPlacement,
  ) => void;
  isNoteOnRoll: (
    layerId: LayerId,
    loopId: LayerLoopId,
    storedOctave: number,
    rollSlot: RollSlot,
  ) => boolean;
}

export const useMidiStore = create<MidiState>()(
  persist(
    (set, get) => ({
      midiRollCount: 1,
      midiRollSplitByRootOctave: false,
      midiMeasuresVisible: 1,
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

      setMidiMeasuresVisible: (value) => set({ midiMeasuresVisible: value }),

      setMidiViewMeasureIndex: (value) => set({ midiViewMeasureIndex: value }),

      setMidiPlayheadBeat: (beat) => set({ midiPlayheadBeat: beat }),

      setMidiLayerRollPlacement: (layerId, placement) =>
        set((state) => {
          const loops = Object.values(
            useLayerStore.getState().layers[layerId].layerLoops,
          );
          return {
            midiLoopRollPlacement: {
              ...state.midiLoopRollPlacement,
              [layerId]: Object.fromEntries(
                loops.map((lp) => [lp.id, placement]),
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
          const loops = Object.values(
            useLayerStore.getState().layers[layerId].layerLoops,
          );
          const allSame = loops.every(
            (lp) => nextLayerMap[lp.id] === placement,
          );
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
        const { midiRollCount, midiRollSplitByRootOctave, midiLoopRollPlacement } =
          get();
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
        const { meter, totalMeasures } = useCompositionStore.getState();
        const beatLength = compositionLoopBeatLength(
          totalMeasures,
          meter.beatsPerMeasure,
        );
        return {
          ...currentState,
          ...p,
          midiPlayheadBeat: clampPersistedMidiPlayheadBeat(
            p.midiPlayheadBeat,
            beatLength,
          ),
        } as MidiState;
      },
    },
  ),
);
