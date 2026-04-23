import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  clampLoopOctave,
  isRepeatDisabled,
  maxRepeatEveryForUnit,
  normalizeRepeatUnit,
  repeatEveryForUnit,
  MAX_COMPOSITION_BEATS,
  maxMeasuresCompositionLimit,
  shiftLoopNotesOctaveBy,
} from "../lib/loopModel";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
} from "../lib/midiPlayhead";
import {
  buildInitialLayerLoopSelectionMemory,
  buildDefaultMidiLoopRollPlacement,
  clampPersistedMidiPlayheadBeat,
  mergePersistedLayers,
  mergePersistedMidiLoopRollPlacementWithLegacy,
} from "./utils/persistence";
import { MIDI_LOOP_ROLL_PLACEMENTS } from "./utils/midiPlacement";
import { maybeSwitchToMidiForLoopEdit } from "./utils/layerMutations";
import { withMutatedActiveLayerLoop } from "./utils/layerLoopMutations";
import {
  clampMidiViewStart,
  clampStateMidiViewStart,
  getTimelineMetrics,
  playheadMeasureIndex,
  wrapBeat,
} from "./utils/timeline";
import { LAYER_ORDER } from "../lib/layers";
import { layerLoopsForUi, listLayerLoopsOrdered } from "../lib/layerRuntime";
import type { LayerId, LayerLoopId } from "../types/layer";

import { LAYER_STORE_KEY, useLayerStore } from "./layerStore";
import { useLayerEditorStore } from "./layerEditorStore";
import { LOOP_DEFINITION_STORE_KEY, useLoopDefinitionStore } from "./loopDefinitionStore";
import { TRANSPORT_STORE_KEY, useTransportStore } from "./transportStore";
import type {
  MidiNoteSelection,
  MidiLoopRollPlacementMap,
  MidiRollPlacement,
  MidiLoopEditMode,
} from "../types/midi";
import type { AppView } from "../types/app";

/** zustand `persist` localStorage key (legacy name); same as former app slice. */
export const APP_PERSIST_STORAGE_KEY = "loop-soup";

function migrateMidiNoteSelection(raw: unknown): MidiNoteSelection {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const r = raw as Record<string, unknown>;
  const layerId = r.layerId;
  const loopId = (r.loopId ?? r.loopId) as unknown;
  if (
    layerId !== "A" &&
    layerId !== "B" &&
    layerId !== "C" &&
    layerId !== "D" &&
    layerId !== "E"
  ) {
    return null;
  }
  if (typeof loopId !== "string") {
    return null;
  }
  return { layerId: layerId as LayerId, loopId: loopId as LayerLoopId };
}

const SOFTPOT_HIGH_ROOT_INDEX = 11;
const SOFTPOT_STEPS = 24;
const DEFAULT_SOFTPOT_POSITION = SOFTPOT_HIGH_ROOT_INDEX / (SOFTPOT_STEPS - 1);
const MIDI_SELECTION_VIEWS = new Set<"layers" | "midi" | "dual">([
  "layers",
  "midi",
  "dual",
]);

export interface MidiState {
  currentView: AppView;
  pickerOpen: boolean;
  octaveView: number;
  softpotPosition: number;
  midiRollCount: number;
  midiRollSplitByRootOctave: boolean;
  midiMeasuresVisible: number;
  midiMenuOpen: boolean;
  midiLoopRollPlacement: MidiLoopRollPlacementMap;
  sampleSoundOn: boolean;
  midiViewMeasureIndex: number;
  midiPlayheadBeat: number;
  midiNoteSelection: MidiNoteSelection;
  midiLoopEditMode: MidiLoopEditMode;
  midiLoopSelectionMemory: Record<LayerId, MidiNoteSelection>;
  setLayerLoopPhraseSelection: (layerId: LayerId, loopIndexOrNull: number | null) => void;
  applyMidiNoteTap: (params: {
    layerId: LayerId;
    loopId: LayerLoopId;
    rollSlot?: 1 | 2;
  }) => void;
  selectLayer: (id: LayerId) => void;
  setView: (value: AppView) => void;
  togglePickerOpen: () => void;
  setSoftpotPosition: (value: number) => void;
  setMidiRollCount: (value: number) => void;
  toggleSecondRoll: () => void;
  setMidiRollSplitByRootOctave: (value: boolean) => void;
  setSplitByRootOctaveEnabled: (enabled: boolean) => void;
  toggleMidiMenuOpen: () => void;
  setMidiLayerRollPlacement: (layerId: LayerId, placement: MidiRollPlacement) => void;
  setMidiLoopRollPlacement: (
    layerId: LayerId,
    loopId: LayerLoopId,
    placement: MidiRollPlacement,
  ) => void;
  setSampleSoundOn: (value: boolean) => void;
  setMidiViewMeasureIndex: (value: number) => void;
  setMidiMeasuresVisible: (value: number) => void;
  setMidiPlayheadBeat: (beat: number) => void;
  seekCompositionTimelineToBeat: (beatRaw: number) => void;
  advanceTransportByMs: (dtMs: number) => void;
  restartTransportFromStart: () => void;
  snapPlayheadToVisibleWindowStart: () => void;
  addCompositionMeasure: () => void;
  removeLastCompositionMeasure: () => void;
  setLayerRepeatUnit: (id: LayerId, unitRaw: unknown) => void;
  toggleLayerRepeatEvery: (id: LayerId, valueRaw: unknown) => void;
  setLayerLoopStartMeasure: (id: LayerId, measure: number) => void;
  setLayerLoopRepeatEndMeasure: (id: LayerId, endMeasure: number | null) => void;
  setOctaveView: (octave: number) => void;
  shiftLayerLoopNotesOctave: (id: LayerId, delta: number) => void;
  clearPersistedSession: () => void;
}

export const useMidiStore = create<MidiState>()(
  persist(
    (rawSet) => {
      const set = (
        partial:
          | MidiState
          | Partial<MidiState>
          | ((state: MidiState) => MidiState | Partial<MidiState>),
        replace?: false,
      ): void => {
        rawSet(partial, replace);
      };
      return {
        currentView: "layers",
        pickerOpen: false,
        /** Global softpot + MIDI roll label range (0–7); not per-layer. */
        octaveView: 3,
        softpotPosition: DEFAULT_SOFTPOT_POSITION,
        midiRollCount: 1,
        /**
         * When true, two rolls split by pitch: roll 1 = notes ≥ key root in `octaveView`,
         * roll 2 = notes below that threshold. Ignores per-layer / per-loop roll placement.
         */
        midiRollSplitByRootOctave: false,
        /** User preference: how many measures to fit in the MIDI viewport (1–4; clamped vs layer length when rendering). */
        midiMeasuresVisible: 1,
        midiMenuOpen: false,
        /**
         * Per layer, per loop id: which roll(s) show that loop's notes when two rolls are visible.
         * MIDI menu derives its selection from these (when all loops match); menu clicks set every loop.
         * Omitted entries default to `'both'`.
         */
        midiLoopRollPlacement: buildDefaultMidiLoopRollPlacement(),
        sampleSoundOn: true,
        /** Which measure is in view on the MIDI roll (0-based). */
        midiViewMeasureIndex: 0,
        /**
         * Fractional beat along the shared composition timeline [0, length). One playhead for all layers.
         */
        midiPlayheadBeat: 0,

        /**
         * When set, repeat + phrase in the bottom bar apply to this loop; cleared when picking a layer in the list or toggling the same loop off.
         */
        midiNoteSelection: null,
        midiLoopEditMode: null,
        /** Last chosen loop/note per layer; restored when returning to MIDI/dual or switching layers. */
        midiLoopSelectionMemory: buildInitialLayerLoopSelectionMemory(),

        setLayerLoopPhraseSelection: (layerId, loopIndexOrNull) =>
          set((state) => {
            if (loopIndexOrNull == null) {
              useLayerEditorStore.getState().clearLoopFocus(layerId);
              const clearMidi =
                state.midiNoteSelection?.layerId === layerId
                  ? null
                  : state.midiNoteSelection;
              return {
                midiNoteSelection: clearMidi,
                midiLoopSelectionMemory: {
                  ...state.midiLoopSelectionMemory,
                  [layerId]: null,
                },
              };
            }
            const { layers } = useLayerStore.getState();
            const defs = useLoopDefinitionStore.getState().definitions;
            const selectedLayerId = useLayerEditorStore.getState().selectedLayerId;
            const layer = layers[layerId];
            const loops = listLayerLoopsOrdered(layer);
            const n = loops.length;
            if (n === 0) {
              return state;
            }
            const ai = Math.max(0, Math.min(n - 1, Math.floor(loopIndexOrNull)));
            const loop = loops[ai];
            if (!loop) return state;
            const nextSelection = { layerId, loopId: loop.id };
            useLayerEditorStore.getState().selectLoop(layerId, loop.id);
            return {
              midiNoteSelection:
                selectedLayerId === layerId ? nextSelection : state.midiNoteSelection,
              midiLoopSelectionMemory: {
                ...state.midiLoopSelectionMemory,
                [layerId]: nextSelection,
              },
            };
          }),

        applyMidiNoteTap: ({ layerId, loopId, rollSlot }) =>
          set((state) => {
            const cur = state.midiNoteSelection;
            if (cur && cur.layerId === layerId && cur.loopId === loopId) {
              useLayerEditorStore.getState().clearLoopFocus(layerId);
              return {
                midiNoteSelection: null,
                midiLoopSelectionMemory: {
                  ...state.midiLoopSelectionMemory,
                  [layerId]: null,
                },
              };
            }
            const { layers } = useLayerStore.getState();
            const defs = useLoopDefinitionStore.getState().definitions;
            const { meter, masterLoopLength } = useTransportStore.getState();
            const layer = layers[layerId];
            const loops = listLayerLoopsOrdered(layer);
            const midiViewMeasureIndex = clampStateMidiViewStart({
              meter,
              masterLoopLength,
              midiMeasuresVisible: state.midiMeasuresVisible,
              midiViewMeasureIndex: state.midiViewMeasureIndex,
            });
            const placementSync =
              !state.midiRollSplitByRootOctave &&
              state.midiRollCount >= 2 &&
              (rollSlot === 1 || rollSlot === 2)
                ? rollSlot === 1
                  ? "1"
                  : "2"
                : "both";
            const nextLoopMap = { ...(state.midiLoopRollPlacement[layerId] ?? {}) };
            if (!state.midiRollSplitByRootOctave) for (const lp of loops) nextLoopMap[lp.id] = placementSync;
            useLayerEditorStore.getState().selectLoop(layerId, loopId);
            return {
              midiViewMeasureIndex,
              midiNoteSelection: { layerId, loopId },
              midiLoopSelectionMemory: {
                ...state.midiLoopSelectionMemory,
                [layerId]: { layerId, loopId },
              },
              midiLoopRollPlacement: {
                ...state.midiLoopRollPlacement,
                [layerId]: nextLoopMap,
              },
            };
          }),

        selectLayer: (id) =>
          set((state) => {
            useLayerEditorStore.getState().setSelectedLayerId(id);
            const { meter, masterLoopLength } = useTransportStore.getState();
            const shouldShowSelection = MIDI_SELECTION_VIEWS.has(state.currentView);
            const rememberedSelection = state.midiLoopSelectionMemory[id] ?? null;
            return {
              midiViewMeasureIndex: clampStateMidiViewStart({
                meter,
                masterLoopLength,
                midiMeasuresVisible: state.midiMeasuresVisible,
                midiViewMeasureIndex: state.midiViewMeasureIndex,
              }),
              midiNoteSelection: shouldShowSelection ? rememberedSelection : null,
            };
          }),

        setView: (value) =>
          set((state) => {
            const showingSelection = MIDI_SELECTION_VIEWS.has(value);
            return {
              currentView: value,
              midiNoteSelection: showingSelection
                ? (state.midiLoopSelectionMemory[
                    useLayerEditorStore.getState().selectedLayerId
                  ] ?? null)
                : null,
            };
          }),

        togglePickerOpen: () => set((state) => ({ pickerOpen: !state.pickerOpen })),

        setSoftpotPosition: (value) =>
          set({ softpotPosition: Math.max(0, Math.min(1, value)) }),

        setMidiRollCount: (value) => {
          const next = value >= 2 ? 2 : 1;
          set({
            midiRollCount: next,
            ...(next < 2 ? { midiRollSplitByRootOctave: false } : {}),
          });
        },

        toggleSecondRoll: () =>
          set((state) => {
            const next = state.midiRollCount >= 2 ? 1 : 2;
            return {
              midiRollCount: next,
              ...(next < 2 ? { midiRollSplitByRootOctave: false } : {}),
            };
          }),

        setMidiRollSplitByRootOctave: (value) =>
          set((state) => ({
            midiRollSplitByRootOctave: Boolean(value),
            ...(value && MIDI_SELECTION_VIEWS.has(state.currentView) ? { midiNoteSelection: null } : {}),
          })),

        setSplitByRootOctaveEnabled: (enabled) =>
          set((state) => ({
            midiRollSplitByRootOctave: Boolean(enabled),
            midiRollCount: enabled ? 2 : state.midiRollCount,
            ...(enabled && MIDI_SELECTION_VIEWS.has(state.currentView) ? { midiNoteSelection: null } : {}),
          })),

        toggleMidiMenuOpen: () => set((state) => ({ midiMenuOpen: !state.midiMenuOpen })),

        setMidiLayerRollPlacement: (layerId, placement) =>
          set((state) => {
            if (!MIDI_LOOP_ROLL_PLACEMENTS.includes(placement)) {
              return state;
            }
            const layer = useLayerStore.getState().layers[layerId];
            if (!layer) {
              return state;
            }
            const defs = useLoopDefinitionStore.getState().definitions;
            const loops = listLayerLoopsOrdered(layer);
            const nextLoopMap = {
              ...(state.midiLoopRollPlacement[layerId] ?? {}),
            };
            for (const lp of loops) {
              nextLoopMap[lp.id] = placement;
            }
            return {
              midiLoopRollPlacement: {
                ...state.midiLoopRollPlacement,
                [layerId]: nextLoopMap,
              },
            };
          }),

        setMidiLoopRollPlacement: (layerId, loopId, placement) =>
          set((state) => {
            if (!MIDI_LOOP_ROLL_PLACEMENTS.includes(placement)) {
              return state;
            }
            const prevLayer = state.midiLoopRollPlacement?.[layerId] ?? {};
            return {
              midiLoopRollPlacement: {
                ...state.midiLoopRollPlacement,
                [layerId]: {
                  ...prevLayer,
                  [loopId]: placement,
                },
              },
            };
          }),

        setSampleSoundOn: (value) => set({ sampleSoundOn: value }),

        setMidiViewMeasureIndex: (value) =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            return {
              midiViewMeasureIndex: clampMidiViewStart(value, metrics.maxStart),
            };
          }),

        setMidiMeasuresVisible: (value) =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            const vis = Math.max(1, Math.min(4, Math.floor(value)));
            const effectiveVisible = Math.max(1, Math.min(vis, metrics.measureCount));
            const maxStart = Math.max(0, metrics.measureCount - effectiveVisible);
            return {
              midiMeasuresVisible: vis,
              midiViewMeasureIndex: Math.min(state.midiViewMeasureIndex, maxStart),
            };
          }),

        setMidiPlayheadBeat: (beat) =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            const clamped = wrapBeat(beat, metrics.beatLength);
            return { midiPlayheadBeat: clamped };
          }),

        seekCompositionTimelineToBeat: (beatRaw) =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const len = compositionLoopBeatLength(masterLoopLength, beatsPerMeasure);
            let w = ((Number(beatRaw) % len) + len) % len;
            if (w >= len - 1e-9) {
              w = 0;
            }
            const clamped = Math.min(Math.max(0, w), len - 1e-6);
            const measureCount = Math.max(1, Math.ceil(len / beatsPerMeasure));
            const visible = Math.max(1, Math.min(state.midiMeasuresVisible, measureCount, 4));
            const maxStart = Math.max(0, measureCount - visible);
            const playheadMeasureIdx = Math.min(
              measureCount - 1,
              Math.max(0, Math.floor(clamped / beatsPerMeasure)),
            );
            const midiViewMeasureIndex = Math.max(0, Math.min(maxStart, playheadMeasureIdx));
            const phase = len > 0 ? clamped / len : 0;
            const ts = useTransportStore.getState();
            useTransportStore.setState({
              playheadPhase: Math.max(0, Math.min(1, phase)),
              ...(ts.isPlaying ? { transportNonce: ts.transportNonce + 1 } : {}),
            });
            return { midiPlayheadBeat: clamped, midiViewMeasureIndex };
          }),

        advanceTransportByMs: (dtMs) =>
          set((state) => {
            const { meter, masterLoopLength, bpm } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            const clampedBpm = Math.max(40, Math.min(240, bpm));
            const msPerBeat = 60000 / clampedBpm;
            const prev = state.midiPlayheadBeat ?? 0;
            const nextRaw = prev + dtMs / msPerBeat;
            const nextBeat = wrapBeat(nextRaw, metrics.beatLength);
            const playheadIdx = playheadMeasureIndex(
              nextBeat,
              metrics.beatLength,
              metrics.beatsPerMeasure,
              metrics.measureCount,
            );
            useTransportStore.setState({
              playheadPhase:
                metrics.beatLength > 0
                  ? Math.max(0, Math.min(1, nextBeat / metrics.beatLength))
                  : 0,
            });
            return {
              midiPlayheadBeat: nextBeat,
              midiViewMeasureIndex: clampMidiViewStart(playheadIdx, metrics.maxStart),
            };
          }),

        restartTransportFromStart: () =>
          set(() => {
            useTransportStore.setState((s) => ({ transportNonce: s.transportNonce + 1 }));
            return { midiViewMeasureIndex: 0, midiPlayheadBeat: 0 };
          }),

        snapPlayheadToVisibleWindowStart: () =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            const targetMeasure =
              metrics.visibleCount === 1
                ? playheadMeasureIndex(
                    state.midiPlayheadBeat,
                    metrics.beatLength,
                    metrics.beatsPerMeasure,
                    metrics.measureCount,
                  )
                : Math.min(
                    metrics.measureCount - 1,
                    Math.max(0, state.midiViewMeasureIndex),
                  );
            const beat = wrapBeat(targetMeasure * metrics.beatsPerMeasure, metrics.beatLength);
            useTransportStore.setState((s) => ({ transportNonce: s.transportNonce + 1 }));
            return { midiPlayheadBeat: beat };
          }),

        addCompositionMeasure: () =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const current = Math.max(1, Number(masterLoopLength) || beatsPerMeasure);
            const next = Math.min(MAX_COMPOSITION_BEATS, current + beatsPerMeasure);
            const prevMeasures = Math.ceil(current / beatsPerMeasure);
            const nextMeasures = Math.ceil(next / beatsPerMeasure);
            let midiViewMeasureIndex = state.midiViewMeasureIndex;
            if (nextMeasures > prevMeasures) {
              const vis = Math.min(state.midiMeasuresVisible, nextMeasures);
              midiViewMeasureIndex = Math.max(0, nextMeasures - vis);
            }
            useTransportStore.setState({ masterLoopLength: next });
            return { midiViewMeasureIndex };
          }),

        removeLastCompositionMeasure: () =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const current = Math.max(1, Number(masterLoopLength) || beatsPerMeasure);
            const measureCount = Math.ceil(current / beatsPerMeasure);
            if (measureCount < 2) {
              return state;
            }
            const next = Math.max(beatsPerMeasure, current - beatsPerMeasure);
            const nextMeasures = Math.ceil(next / beatsPerMeasure);
            const vis = Math.min(state.midiMeasuresVisible, nextMeasures);
            const midiViewMeasureIndex = Math.min(
              state.midiViewMeasureIndex,
              Math.max(0, nextMeasures - vis),
            );
            useTransportStore.setState({ masterLoopLength: next });
            return { midiViewMeasureIndex };
          }),

        setLayerRepeatUnit: (id, unitRaw) =>
          set((state) => {
            const { meter } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const unit = normalizeRepeatUnit(unitRaw);
            const { layers: newLayers, nextLoop } = withMutatedActiveLayerLoop(
              useLayerStore.getState().layers,
              id,
              (cur) => {
                cur.repeatUnit = unit;
                let remembered = repeatEveryForUnit(cur);
                cur.repeatEndMeasure = unit === "measures" ? cur.repeatEndMeasure : null;
                const maxEvery = maxRepeatEveryForUnit(unit, beatsPerMeasure);
                if (remembered != null) {
                  remembered = Math.min(Math.max(1, remembered), maxEvery);
                  if (unit === "measures") {
                    cur.repeatEveryMeasuresMemory = remembered;
                  } else {
                    cur.repeatEveryBeatsMemory = remembered;
                  }
                }
                if (
                  remembered != null &&
                  isRepeatDisabled(cur.spanBeats, beatsPerMeasure, cur.repeatUnit, remembered)
                ) {
                  if (unit === "measures") {
                    cur.repeatEveryMeasuresMemory = null;
                  } else {
                    cur.repeatEveryBeatsMemory = null;
                  }
                  cur.repeatEndMeasure = null;
                }
                return cur;
              },
            );
            useLayerStore.setState({ layers: newLayers });
            return maybeSwitchToMidiForLoopEdit(state, nextLoop);
          }),

        toggleLayerRepeatEvery: (id, valueRaw) =>
          set((state) => {
            const { meter } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const value = Math.floor(Number(valueRaw));
            if (!Number.isFinite(value) || value < 1) {
              return state;
            }
            let changed = true;
            const { layers: newLayers, nextLoop } = withMutatedActiveLayerLoop(
              useLayerStore.getState().layers,
              id,
              (cur) => {
                const unit = normalizeRepeatUnit(cur.repeatUnit);
                const maxEvery = maxRepeatEveryForUnit(unit, beatsPerMeasure);
                if (value > maxEvery) {
                  changed = false;
                  return cur;
                }
                const activeRepeatEvery = repeatEveryForUnit(cur);
                if (activeRepeatEvery === value) {
                  if (unit === "measures") {
                    cur.repeatEveryMeasuresMemory = null;
                  } else {
                    cur.repeatEveryBeatsMemory = null;
                  }
                  cur.repeatEndMeasure = null;
                  return cur;
                }
                if (isRepeatDisabled(cur.spanBeats, beatsPerMeasure, unit, value)) {
                  changed = false;
                  return cur;
                }
                cur.repeatUnit = unit;
                if (unit === "measures") {
                  cur.repeatEveryMeasuresMemory = value;
                } else {
                  cur.repeatEveryBeatsMemory = value;
                }
                if (unit === "beats") {
                  cur.repeatEndMeasure = null;
                }
                return cur;
              },
            );
            if (!changed) return state;
            useLayerStore.setState({ layers: newLayers });
            return maybeSwitchToMidiForLoopEdit(state, nextLoop);
          }),

        setLayerLoopStartMeasure: (id, measure) =>
          set((state) => {
            const { meter, masterLoopLength } = useTransportStore.getState();
            const metrics = getTimelineMetrics(meter, masterLoopLength, state.midiMeasuresVisible);
            const totalMeasures = metrics.measureCount;
            const m = Math.min(Math.max(1, Math.floor(measure)), totalMeasures);
            const { layers: newLayers, nextLoop } = withMutatedActiveLayerLoop(
              useLayerStore.getState().layers,
              id,
              (cur) => {
                cur.startMeasure = m;
                if (cur.repeatEndMeasure != null && cur.repeatEndMeasure <= m) {
                  cur.repeatEndMeasure = Math.min(totalMeasures, m + 1);
                }
                return cur;
              },
            );
            useLayerStore.setState({ layers: newLayers });
            return maybeSwitchToMidiForLoopEdit(state, nextLoop);
          }),

        setLayerLoopRepeatEndMeasure: (id, endMeasure) =>
          set((state) => {
            const { meter } = useTransportStore.getState();
            const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
            const maxMeasures = maxMeasuresCompositionLimit(beatsPerMeasure);
            const { layers: newLayers, nextLoop } = withMutatedActiveLayerLoop(
              useLayerStore.getState().layers,
              id,
              (cur) => {
                if (endMeasure == null) {
                  cur.repeatEndMeasure = null;
                  return cur;
                }
                const start = Math.max(1, Math.floor(cur.startMeasure) || 1);
                const em = Math.min(
                  maxMeasures,
                  Math.max(start + 1, Math.floor(endMeasure)),
                );
                cur.repeatEndMeasure = em;
                return cur;
              },
            );
            useLayerStore.setState({ layers: newLayers });
            return maybeSwitchToMidiForLoopEdit(state, nextLoop);
          }),

        setOctaveView: (octave) => set({ octaveView: clampLoopOctave(octave) }),

        shiftLayerLoopNotesOctave: (id, delta) =>
          set((state) => {
            const { layers: newLayers, nextLoop } = withMutatedActiveLayerLoop(
              useLayerStore.getState().layers,
              id,
              (cur) => ({ ...cur, notes: shiftLoopNotesOctaveBy(cur.notes, delta) }),
            );
            useLayerStore.setState({ layers: newLayers });
            return maybeSwitchToMidiForLoopEdit(state, nextLoop);
          }),

        clearPersistedSession: () => {
          try {
            localStorage.removeItem(APP_PERSIST_STORAGE_KEY);
            localStorage.removeItem(LAYER_STORE_KEY);
            localStorage.removeItem(TRANSPORT_STORE_KEY);
            localStorage.removeItem(LOOP_DEFINITION_STORE_KEY);
          } catch {
            /* ignore quota / private mode */
          }
          window.location.reload();
        },
      };
    },
    {
      name: APP_PERSIST_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentView: state.currentView,
        octaveView: state.octaveView,
        softpotPosition: state.softpotPosition,
        midiRollCount: state.midiRollCount,
        midiRollSplitByRootOctave: state.midiRollSplitByRootOctave,
        midiMeasuresVisible: state.midiMeasuresVisible,
        midiLoopRollPlacement: state.midiLoopRollPlacement,
        midiViewMeasureIndex: state.midiViewMeasureIndex,
        midiPlayheadBeat: state.midiPlayheadBeat,
        midiLoopSelectionMemory: state.midiLoopSelectionMemory,
      }),
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Record<string, unknown>;
        const { layers: legacyLayers, definitions: legacyDefs } = mergePersistedLayers(
          p.layers,
        );
        if (Object.keys(legacyDefs).length > 0) {
          useLoopDefinitionStore.setState((s) => ({
            definitions: { ...s.definitions, ...legacyDefs },
          }));
        }
        const octaveView =
          typeof p.octaveView === "number" && Number.isFinite(p.octaveView)
            ? clampLoopOctave(p.octaveView)
            : currentState.octaveView;
        const { meter, masterLoopLength } = useTransportStore.getState();
        const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
        const beatLength = Math.max(1, masterLoopLength || beatsPerMeasure);
        const selectedLayerId = useLayerEditorStore.getState().selectedLayerId;
        const mergedMemory = { ...buildInitialLayerLoopSelectionMemory() };
        const rawMem = p.midiLoopSelectionMemory;
        if (rawMem && typeof rawMem === "object") {
          for (const id of LAYER_ORDER) {
            mergedMemory[id] = migrateMidiNoteSelection(
              (rawMem as Record<string, unknown>)[id],
            );
          }
        }
        return {
          ...currentState,
          ...p,
          midiRollSplitByRootOctave:
            typeof p.midiRollSplitByRootOctave === "boolean"
              ? p.midiRollSplitByRootOctave
              : currentState.midiRollSplitByRootOctave,
          octaveView,
          midiPlayheadBeat: clampPersistedMidiPlayheadBeat(p.midiPlayheadBeat, beatLength),
          midiMeasuresVisible:
            typeof p.midiMeasuresVisible === "number"
              ? Math.max(1, Math.min(4, Math.round(p.midiMeasuresVisible)))
              : currentState.midiMeasuresVisible,
          midiLoopRollPlacement: mergePersistedMidiLoopRollPlacementWithLegacy(
            p.midiLoopRollPlacement,
            legacyLayers,
            p.midiLayerRollPlacement,
            p.roll1LayersVisibility,
            p.roll2LayersVisibility,
          ),
          midiLoopSelectionMemory:
            rawMem && typeof rawMem === "object" ? mergedMemory : currentState.midiLoopSelectionMemory,
          midiNoteSelection: MIDI_SELECTION_VIEWS.has((p.currentView ?? currentState.currentView) as AppView)
            ? (migrateMidiNoteSelection(
                (rawMem as Record<string, unknown> | undefined)?.[selectedLayerId],
              ) ??
              mergedMemory[selectedLayerId] ??
              null)
            : null,
        } as MidiState;
      },
    },
  ),
);
