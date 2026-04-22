import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  clampLoopOctave,
  createDefaultLoop,
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
  readMidiCompositionBeat,
} from "../lib/midiPlayhead";
import {
  buildInitialLayerLoopSelectionMemory,
  buildInitialLayers,
  buildInitialRecordings,
  buildDefaultMidiLoopRollPlacement,
  clampPersistedMidiPlayheadBeat,
  mergePersistedLayers,
  mergePersistedMidiLoopRollPlacementWithLegacy,
} from "./utils/persistence";
import {
  MIDI_LOOP_ROLL_PLACEMENTS,
} from "./utils/midiPlacement";
import { maybeSwitchToMidiForLoopEdit } from "./utils/layerMutations";
import { withMutatedActiveLayerLoop } from "./utils/layerLoopMutations";
import {
  clampMidiViewStart,
  clampStateMidiViewStart,
  getTimelineMetrics,
  playheadMeasureIndex,
  wrapBeat,
} from "./utils/timeline";
import type {
  LayerId,
  LoopId,
  LayersState,
  LayerKnobEffect,
  MidiNoteSelection,
  MidiLoopRollPlacementMap,
  AppView,
  MidiRollPlacement,
  MidiLoopEditMode,
} from "../types/model";

/** zustand `persist` localStorage key — export so dev reset can clear the same entry. */
export const APP_PERSIST_STORAGE_KEY = "loop-soup";

const SOFTPOT_HIGH_ROOT_INDEX = 11;
const SOFTPOT_STEPS = 24;
const DEFAULT_SOFTPOT_POSITION = SOFTPOT_HIGH_ROOT_INDEX / (SOFTPOT_STEPS - 1);
const MIDI_SELECTION_VIEWS = new Set<"layers" | "midi" | "dual">([
  "layers",
  "midi",
  "dual",
]);
const LAYER_KNOB_EFFECTS = ["filter", "reverb"] as const;

export interface AppState {
  isPlaying: boolean;
  addOn: boolean;
  extendOn: boolean;
  currentLoop: number;
  totalLoops: number;
  masterLoopLength: number;
  bpm: number;
  key: string;
  meter: string;
  selectedLayer: LayerId;
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
  previewSound: string | null;
  soloLayerId: LayerId | null;
  preSoloMutes: Record<LayerId, boolean> | null;
  playheadPhase: number;
  midiViewMeasureIndex: number;
  midiPlayheadBeat: number;
  transportNonce: number;
  midiNoteSelection: MidiNoteSelection;
  midiLoopEditMode: MidiLoopEditMode;
  midiLoopSelectionMemory: Record<LayerId, MidiNoteSelection>;
  layers: LayersState;
  recordings: Record<LayerId, unknown[]>;

  setLayerLoopPhraseSelection: (layerId: LayerId, loopIndexOrNull: number | null) => void;
  applyMidiNoteTap: (params: { layerId: LayerId; loopId: LoopId; rollSlot?: 1 | 2 }) => void;
  setPlaying: (value: boolean) => void;
  togglePlaying: () => void;
  setAddOn: (value: boolean) => void;
  toggleAddOn: () => void;
  setExtendOn: (value: boolean) => void;
  toggleExtendOn: () => void;
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
  setMidiLoopRollPlacement: (layerId: LayerId, loopId: LoopId, placement: MidiRollPlacement) => void;
  setSampleSoundOn: (value: boolean) => void;
  setBpm: (value: number) => void;
  setKey: (value: string) => void;
  setMeter: (value: string) => void;
  setPlayheadPhase: (value: number) => void;
  setMidiViewMeasureIndex: (value: number) => void;
  setMidiMeasuresVisible: (value: number) => void;
  setMidiPlayheadBeat: (beat: number) => void;
  seekCompositionTimelineToBeat: (beatRaw: number) => void;
  bumpTransportNonce: () => void;
  advanceTransportByMs: (dtMs: number) => void;
  restartTransportFromStart: () => void;
  snapPlayheadToVisibleWindowStart: () => void;
  restartPlayheadToViewWindowStart: () => void;
  addCompositionMeasure: () => void;
  removeLastCompositionMeasure: () => void;
  setLayerRepeatUnit: (id: LayerId, unitRaw: unknown) => void;
  toggleLayerRepeatEvery: (id: LayerId, valueRaw: unknown) => void;
  setLayerLoopStartMeasure: (id: LayerId, measure: number) => void;
  setLayerLoopRepeatEndMeasure: (id: LayerId, endMeasure: number | null) => void;
  setOctaveView: (octave: number) => void;
  shiftLayerLoopNotesOctave: (id: LayerId, delta: number) => void;
  setLayerVolume: (id: LayerId, volume: number) => void;
  setLayerKnobValue: (id: LayerId, effect: LayerKnobEffect, value: number) => void;
  toggleLayerMute: (id: LayerId) => void;
  toggleLayerSolo: (id: LayerId) => void;
  clearPersistedSession: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (rawSet) => {
      const set = (
        partial:
          | AppState
          | Partial<AppState>
          | ((state: AppState) => AppState | Partial<AppState>),
        replace?: false,
      ): void => {
        rawSet(partial, replace);
      };
      return {
        isPlaying: false,
        addOn: false,
        extendOn: false,
        currentLoop: 2,
        totalLoops: 4,
        masterLoopLength: 4,
        bpm: 128,
        key: "A min",
        meter: "4/4",
        selectedLayer: "A",
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
         * Per layer, per loop id: which roll(s) show that loop’s notes when two rolls are visible.
         * MIDI menu derives its selection from these (when all loops match); menu clicks set every loop.
         * Omitted entries default to `'both'`.
         */
        midiLoopRollPlacement: buildDefaultMidiLoopRollPlacement(),
        sampleSoundOn: true,
        previewSound: null,
        soloLayerId: null,
        preSoloMutes: null,
        /** 0–1 playhead phase within the layer loop (UI / now bar). */
        playheadPhase: 0.32,
        /** Which measure is in view on the MIDI roll (0-based). */
        midiViewMeasureIndex: 0,
        /**
         * Fractional beat along the shared composition timeline [0, length). One playhead for all layers.
         */
        midiPlayheadBeat: 0,
        /** Bumps when playhead is re-anchored (restart / snap while playing) so transport resets dt. */
        transportNonce: 0,

        /**
         * When set, repeat + phrase in the bottom bar apply to this loop; cleared when picking a layer in the list or toggling the same loop off.
         * @type {MidiNoteSelection}
         */
        midiNoteSelection: null,
        midiLoopEditMode: null,
        /** Last chosen loop/note per layer; restored when returning to MIDI/dual or switching layers. */
        midiLoopSelectionMemory: buildInitialLayerLoopSelectionMemory(),

        layers: buildInitialLayers(),

        recordings: buildInitialRecordings(),

        /**
         * Select active loop for the current layer and enable phrase editing (same highlighting as tapping a note in that loop). Pass null to clear.
         */
        setLayerLoopPhraseSelection: (layerId, loopIndexOrNull) =>
          set((state) => {
            if (loopIndexOrNull == null) {
              // Clear phrase/note selection for this layer (e.g. loop number pressed again in
              // composition view). Do not depend on `shouldShowSelection`; match applyMidiNoteTap.
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
            const layer = state.layers[layerId];
            const loops = layer.loops ?? [createDefaultLoop()];
            const n = loops.length;
            const ai = Math.max(
              0,
              Math.min(n - 1, Math.floor(loopIndexOrNull)),
            );
            const loop = loops[ai];
            if (!loop) {
              return state;
            }
            const nextSelection = {
              layerId,
              loopId: loop.id,
            };
            return {
              // Same as clear: composition loop-index button must always set/clear phrase
              // selection for the current layer; do not gate on `currentView`.
              midiNoteSelection:
                state.selectedLayer === layerId
                  ? nextSelection
                  : state.midiNoteSelection,
              midiLoopSelectionMemory: {
                ...state.midiLoopSelectionMemory,
                [layerId]: nextSelection,
              },
              layers: {
                ...state.layers,
                [layerId]: {
                  ...layer,
                  activeLoopIndex: ai,
                },
              },
            };
          }),

        /**
         * Selects layer + loop from a MIDI note tap; tap same note again to clear (repeat/phrase disabled until another note is chosen).
         * With two rolls, pass `rollSlot` so the layer + all its loops sync to that roll’s placement.
         */
        applyMidiNoteTap: ({ layerId, loopId, rollSlot }) =>
          set((state) => {
            const cur = state.midiNoteSelection;
            if (cur && cur.layerId === layerId && cur.loopId === loopId) {
              return {
                midiNoteSelection: null,
                midiLoopSelectionMemory: {
                  ...state.midiLoopSelectionMemory,
                  [layerId]: null,
                },
              };
            }
            const layer = state.layers[layerId];
            const loops = layer.loops ?? [createDefaultLoop()];
            const found = loops.findIndex((l) => l.id === loopId);
            const loopIndex = found >= 0 ? found : 0;
            const midiViewMeasureIndex = clampStateMidiViewStart({
              meter: state.meter,
              masterLoopLength: state.masterLoopLength,
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
            const nextLoopMap = {
              ...(state.midiLoopRollPlacement[layerId] ?? {}),
            };
            if (!state.midiRollSplitByRootOctave) {
              for (const lp of loops) {
                nextLoopMap[lp.id] = placementSync;
              }
            }
            return {
              selectedLayer: layerId,
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
              layers: {
                ...state.layers,
                [layerId]: {
                  ...layer,
                  activeLoopIndex: loopIndex,
                },
              },
            };
          }),
        /** @param {boolean} value @returns {void} @effects Sets `isPlaying`. */
        setPlaying: (value) => set({ isPlaying: value }),
        /** @returns {void} @effects Toggles `isPlaying`. */
        togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
        /** @param {boolean} value @returns {void} @effects Sets `addOn`. */
        setAddOn: (value) => set({ addOn: value }),
        /** @returns {void} @effects Toggles `addOn`. */
        toggleAddOn: () => set((state) => ({ addOn: !state.addOn })),
        /** @param {boolean} value @returns {void} @effects Sets `extendOn`. */
        setExtendOn: (value) => set({ extendOn: value }),
        /** @returns {void} @effects Toggles `extendOn`. */
        toggleExtendOn: () => set((state) => ({ extendOn: !state.extendOn })),
        /**
         * Select active layer and sync MIDI selection context.
         * @param {string} id
         * @returns {void}
         * @calledBy Layer list/card clicks.
         * @effects Updates `selectedLayer`, `midiViewMeasureIndex`, `midiNoteSelection`.
         */
        selectLayer: (id) =>
          set((state) => {
            const shouldShowSelection = MIDI_SELECTION_VIEWS.has(
              state.currentView,
            );
            const rememberedSelection =
              state.midiLoopSelectionMemory[id] ?? null;
            return {
              selectedLayer: id,
              midiViewMeasureIndex: clampStateMidiViewStart({
                meter: state.meter,
                masterLoopLength: state.masterLoopLength,
                midiMeasuresVisible: state.midiMeasuresVisible,
                midiViewMeasureIndex: state.midiViewMeasureIndex,
              }),
              midiNoteSelection: shouldShowSelection
                ? rememberedSelection
                : null,
            };
          }),
        /**
         * Set high-level workspace view mode.
         * @param {"layers"|"midi"|"dual"} value
         * @returns {void}
         * @calledBy App view bar + dev toolbar.
         * @effects Updates `currentView`; gates MIDI selection/edit visibility.
         */
        setView: (value) =>
          set((state) => {
            const showingSelection = MIDI_SELECTION_VIEWS.has(value);
            return {
              currentView: value,
              midiNoteSelection: showingSelection
                ? (state.midiLoopSelectionMemory[state.selectedLayer] ?? null)
                : null,
            };
          }),
        /** @returns {void} @effects Toggles `pickerOpen`. */
        togglePickerOpen: () =>
          set((state) => ({ pickerOpen: !state.pickerOpen })),
        /** @param {number} value @returns {void} @effects Sets clamped `softpotPosition` [0,1]. */
        setSoftpotPosition: (value) =>
          set({ softpotPosition: Math.max(0, Math.min(1, value)) }),
        /**
         * Set visible MIDI roll count (1 or 2).
         * @param {number} value
         * @returns {void}
         * @calledBy MIDI menu.
         * @effects Updates `midiRollCount`; may clear split mode when returning to one roll.
         */
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
        /**
         * Enable/disable root-octave roll split mode.
         * @param {boolean} value
         * @returns {void}
         * @calledBy MIDI menu split toggle.
         * @effects Updates `midiRollSplitByRootOctave`; may clear note selection in MIDI views.
         */
        setMidiRollSplitByRootOctave: (value) =>
          set((state) => ({
            midiRollSplitByRootOctave: Boolean(value),
            ...(value && MIDI_SELECTION_VIEWS.has(state.currentView)
              ? { midiNoteSelection: null }
              : {}),
          })),
        setSplitByRootOctaveEnabled: (enabled) =>
          set((state) => ({
            midiRollSplitByRootOctave: Boolean(enabled),
            midiRollCount: enabled ? 2 : state.midiRollCount,
            ...(enabled && MIDI_SELECTION_VIEWS.has(state.currentView)
              ? { midiNoteSelection: null }
              : {}),
          })),
        /** @returns {void} @effects Toggles `midiMenuOpen`. */
        toggleMidiMenuOpen: () =>
          set((state) => ({ midiMenuOpen: !state.midiMenuOpen })),
        /**
         * Assign all loops in one layer to the same roll placement.
         * @param {string} layerId
         * @param {"1"|"2"|"both"} placement
         * @returns {void}
         * @calledBy MIDI layer roll menu.
         * @effects Updates `midiLoopRollPlacement[layerId]`.
         */
        setMidiLayerRollPlacement: (layerId, placement) =>
          set((state) => {
            if (!MIDI_LOOP_ROLL_PLACEMENTS.includes(placement)) {
              return state;
            }
            const layer = state.layers[layerId];
            if (!layer) {
              return state;
            }
            const loops = layer.loops ?? [createDefaultLoop()];
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
        /**
         * Assign a single loop to a specific roll placement.
         * @param {string} layerId
         * @param {string} loopId
         * @param {"1"|"2"|"both"} placement
         * @returns {void}
         * @calledBy Composition per-loop placement controls.
         * @effects Updates one `midiLoopRollPlacement[layerId][loopId]`.
         */
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
        /** @param {boolean} value @returns {void} @effects Sets `sampleSoundOn`. */
        setSampleSoundOn: (value) => set({ sampleSoundOn: value }),
        /** @param {number} value @returns {void} @effects Sets `bpm`. */
        setBpm: (value) => set({ bpm: value }),
        /** @param {string} value @returns {void} @effects Sets `key`. */
        setKey: (value) => set({ key: value }),
        /**
         * Set session meter.
         * @param {string} value
         * @returns {void}
         * @calledBy Session controls/import.
         * @effects Updates `meter`.
         */
        setMeter: (value) => set({ meter: value }),

        /** @param {number} value @returns {void} @effects Sets clamped `playheadPhase` [0,1]. */
        setPlayheadPhase: (value) =>
          set({ playheadPhase: Math.max(0, Math.min(1, value)) }),

        /**
         * Set MIDI viewport starting measure index with bounds checking.
         * @param {number} value
         * @returns {void}
         * @calledBy `MidiMeasureNav`.
         * @effects Updates `midiViewMeasureIndex`.
         */
        setMidiViewMeasureIndex: (value) =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
            return {
              midiViewMeasureIndex: clampMidiViewStart(value, metrics.maxStart),
            };
          }),

        /**
         * Set preferred visible measure count in MIDI viewport.
         * @param {number} value
         * @returns {void}
         * @calledBy MIDI menu measure buttons.
         * @effects Updates `midiMeasuresVisible`; may clamp `midiViewMeasureIndex`.
         */
        setMidiMeasuresVisible: (value) =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
            const vis = Math.max(1, Math.min(4, Math.floor(value)));
            const effectiveVisible = Math.max(
              1,
              Math.min(vis, metrics.measureCount),
            );
            const maxStart = Math.max(0, metrics.measureCount - effectiveVisible);
            return {
              midiMeasuresVisible: vis,
              midiViewMeasureIndex: Math.min(
                state.midiViewMeasureIndex,
                maxStart,
              ),
            };
          }),

        /**
         * Set shared composition playhead beat with wrapping/clamping.
         * @param {number} beat
         * @returns {void}
         * @calledBy Transport runner.
         * @effects Updates `midiPlayheadBeat`.
         */
        setMidiPlayheadBeat: (beat) =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
            const clamped = wrapBeat(beat, metrics.beatLength);
            return { midiPlayheadBeat: clamped };
          }),

        /**
         * Scrub the shared composition playhead and align the MIDI roll window so
         * its first visible measure is the measure containing that beat (clamped
         * when the window cannot start that late).
         */
        seekCompositionTimelineToBeat: (beatRaw) =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const len = compositionLoopBeatLength(
              state.masterLoopLength,
              beatsPerMeasure,
            );
            let w = ((Number(beatRaw) % len) + len) % len;
            if (w >= len - 1e-9) {
              w = 0;
            }
            const clamped = Math.min(Math.max(0, w), len - 1e-6);
            const measureCount = Math.max(1, Math.ceil(len / beatsPerMeasure));
            const visible = Math.max(
              1,
              Math.min(state.midiMeasuresVisible, measureCount, 4),
            );
            const maxStart = Math.max(0, measureCount - visible);
            const playheadMeasureIdx = Math.min(
              measureCount - 1,
              Math.max(0, Math.floor(clamped / beatsPerMeasure)),
            );
            const midiViewMeasureIndex = Math.max(
              0,
              Math.min(maxStart, playheadMeasureIdx),
            );
            const phase = len > 0 ? clamped / len : 0;
            const next: Partial<AppState> = {
              midiPlayheadBeat: clamped,
              midiViewMeasureIndex,
              playheadPhase: Math.max(0, Math.min(1, phase)),
            };
            if (state.isPlaying) {
              next.transportNonce = state.transportNonce + 1;
            }
            return next;
          }),

        /** @returns {void} @effects Increments `transportNonce`. */
        bumpTransportNonce: () =>
          set((state) => ({ transportNonce: state.transportNonce + 1 })),
        advanceTransportByMs: (dtMs) =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
            const bpm = Math.max(40, Math.min(240, state.bpm));
            const msPerBeat = 60000 / bpm;
            const prev = state.midiPlayheadBeat ?? 0;
            const nextRaw = prev + dtMs / msPerBeat;
            const nextBeat = wrapBeat(nextRaw, metrics.beatLength);
            const playheadIdx = playheadMeasureIndex(
              nextBeat,
              metrics.beatLength,
              metrics.beatsPerMeasure,
              metrics.measureCount,
            );
            return {
              midiPlayheadBeat: nextBeat,
              midiViewMeasureIndex: clampMidiViewStart(
                playheadIdx,
                metrics.maxStart,
              ),
              playheadPhase:
                metrics.beatLength > 0
                  ? Math.max(0, Math.min(1, nextBeat / metrics.beatLength))
                  : 0,
            };
          }),

        /**
         * Restart transport and playhead from composition start.
         * @returns {void}
         * @calledBy Bottom transport restart button.
         * @effects Resets playhead state and bumps `transportNonce`.
         */
        restartTransportFromStart: () =>
          set((state) => ({
            transportNonce: state.transportNonce + 1,
            midiViewMeasureIndex: 0,
            midiPlayheadBeat: 0,
          })),
        snapPlayheadToVisibleWindowStart: () =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
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
            const beat = wrapBeat(
              targetMeasure * metrics.beatsPerMeasure,
              metrics.beatLength,
            );
            return {
              transportNonce: state.transportNonce + 1,
              midiPlayheadBeat: beat,
            };
          }),

        /**
         * Move the shared playhead to the start of the current MIDI view window.
         * If only one measure is visible, snaps to the start of the measure that contains the playhead.
         * If multiple measures are visible, snaps to the start of the first visible measure.
         * Bumps transport nonce while playing (same as other playhead re-anchors).
         */
        restartPlayheadToViewWindowStart: () =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const len = compositionLoopBeatLength(
              state.masterLoopLength,
              beatsPerMeasure,
            );
            const measureCount = Math.max(1, Math.ceil(len / beatsPerMeasure));
            const visibleCount = Math.max(
              1,
              Math.min(state.midiMeasuresVisible, measureCount, 4),
            );
            const layerBeat = readMidiCompositionBeat(
              state.midiPlayheadBeat,
              len,
            );
            const playheadMeasureIdx = Math.min(
              measureCount - 1,
              Math.max(0, Math.floor(layerBeat / beatsPerMeasure)),
            );
            const targetMeasure =
              visibleCount === 1
                ? playheadMeasureIdx
                : Math.min(
                    measureCount - 1,
                    Math.max(0, state.midiViewMeasureIndex),
                  );
            const beat = targetMeasure * beatsPerMeasure;
            let w = ((beat % len) + len) % len;
            if (w >= len - 1e-9) {
              w = 0;
            }
            const clamped = Math.min(Math.max(0, w), len - 1e-6);
            return {
              transportNonce: state.transportNonce + 1,
              midiPlayheadBeat: clamped,
            };
          }),

        /**
         * Add one full measure of beats (per current meter) to the composition loop.
         * Does not mutate per-layer loop boundaries.
         */
        addCompositionMeasure: () =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const current = Math.max(
              1,
              Number(state.masterLoopLength) || beatsPerMeasure,
            );
            const next = Math.min(
              MAX_COMPOSITION_BEATS,
              current + beatsPerMeasure,
            );
            const prevMeasures = Math.ceil(current / beatsPerMeasure);
            const nextMeasures = Math.ceil(next / beatsPerMeasure);
            let midiViewMeasureIndex = state.midiViewMeasureIndex;
            if (nextMeasures > prevMeasures) {
              const vis = Math.min(state.midiMeasuresVisible, nextMeasures);
              midiViewMeasureIndex = Math.max(0, nextMeasures - vis);
            }
            return {
              midiViewMeasureIndex,
              masterLoopLength: next,
            };
          }),

        /**
         * Remove one measure worth of beats from the end. No-op unless the loop
         * spans at least two measures; always leaves at least one full measure.
         * Does not mutate per-layer loop boundaries.
         */
        removeLastCompositionMeasure: () =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const current = Math.max(
              1,
              Number(state.masterLoopLength) || beatsPerMeasure,
            );
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
            return {
              midiViewMeasureIndex,
              masterLoopLength: next,
            };
          }),

        /**
         * Change repeat unit for the active loop on a layer.
         * @param {string} id
         * @param {unknown} unitRaw
         * @returns {void}
         * @calledBy BottomControls repeat unit controls.
         * @effects Updates repeat unit/every memories; may switch view to MIDI.
         */
        setLayerRepeatUnit: (id, unitRaw) =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const unit = normalizeRepeatUnit(unitRaw);
            const { layers, nextLoop } = withMutatedActiveLayerLoop(
              state.layers,
              id,
              (cur) => {
                cur.repeatUnit = unit;
                let remembered = repeatEveryForUnit(cur);
                cur.repeatEndMeasure =
                  unit === "measures" ? cur.repeatEndMeasure : null;
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
                  isRepeatDisabled(
                    cur.spanBeats,
                    beatsPerMeasure,
                    cur.repeatUnit,
                    remembered,
                  )
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
            return {
              ...maybeSwitchToMidiForLoopEdit(state, nextLoop),
              layers,
            };
          }),

        /**
         * Toggle repeat interval value for the active loop on a layer.
         * @param {string} id
         * @param {unknown} valueRaw
         * @returns {void}
         * @calledBy BottomControls repeat value controls.
         * @effects Updates loop repeat interval fields; may switch view to MIDI.
         */
        toggleLayerRepeatEvery: (id, valueRaw) =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const value = Math.floor(Number(valueRaw));
            if (!Number.isFinite(value) || value < 1) {
              return state;
            }
            let changed = true;
            const { layers, nextLoop } = withMutatedActiveLayerLoop(
              state.layers,
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
            if (!changed) {
              return state;
            }
            return {
              ...maybeSwitchToMidiForLoopEdit(state, nextLoop),
              layers,
            };
          }),

        /**
         * Set the active loop start measure.
         * @param {string} id
         * @param {number} measure
         * @returns {void}
         * @calledBy BottomControls start-measure input.
         * @effects Updates `startMeasure`; may adjust `repeatEndMeasure`.
         */
        setLayerLoopStartMeasure: (id, measure) =>
          set((state) => {
            const metrics = getTimelineMetrics(
              state.meter,
              state.masterLoopLength,
              state.midiMeasuresVisible,
            );
            const totalMeasures = metrics.measureCount;
            const m = Math.min(Math.max(1, Math.floor(measure)), totalMeasures);
            const { layers, nextLoop } = withMutatedActiveLayerLoop(
              state.layers,
              id,
              (cur) => {
                cur.startMeasure = m;
                if (cur.repeatEndMeasure != null && cur.repeatEndMeasure <= m) {
                  cur.repeatEndMeasure = Math.min(totalMeasures, m + 1);
                }
                return cur;
              },
            );
            return {
              ...maybeSwitchToMidiForLoopEdit(state, nextLoop),
              layers,
            };
          }),

        /**
         * Set/clear repeat end measure for the active loop.
         * @param {string} id
         * @param {number|null} endMeasure - Null means repeat through composition end.
         * @returns {void}
         * @calledBy BottomControls end-measure input.
         * @effects Updates loop `repeatEndMeasure`.
         */
        setLayerLoopRepeatEndMeasure: (id, endMeasure) =>
          set((state) => {
            const beatsPerMeasure = beatsPerMeasureFromMeter(state.meter);
            const maxMeasures = maxMeasuresCompositionLimit(beatsPerMeasure);
            const { layers, nextLoop } = withMutatedActiveLayerLoop(
              state.layers,
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
            return {
              ...maybeSwitchToMidiForLoopEdit(state, nextLoop),
              layers,
            };
          }),

        /** @param {number} octave @returns {void} @effects Sets clamped `octaveView`. */
        setOctaveView: (octave) => set({ octaveView: clampLoopOctave(octave) }),

        /**
         * Shift active-loop notes up/down by octave.
         * @param {string} id
         * @param {number} delta - Octave delta, typically -1 or +1.
         * @returns {void}
         * @calledBy BottomControls octave transpose buttons.
         * @effects Rewrites active loop notes; may switch view to MIDI.
         */
        shiftLayerLoopNotesOctave: (id, delta) =>
          set((state) => {
            const { layers, nextLoop } = withMutatedActiveLayerLoop(
              state.layers,
              id,
              (cur) => ({
                ...cur,
                notes: shiftLoopNotesOctaveBy(cur.notes, delta),
              }),
            );
            return {
              ...maybeSwitchToMidiForLoopEdit(state, nextLoop),
              layers,
            };
          }),

        /** @param {string} id @param {number} volume @returns {void} @effects Sets clamped layer volume. */
        setLayerVolume: (id, volume) =>
          set((state) => ({
            layers: {
              ...state.layers,
              [id]: {
                ...state.layers[id],
                volume: Math.max(0, Math.min(1, volume)),
              },
            },
          })),

        /** @param {string} id @param {"filter"|"reverb"} effect @param {number} value @returns {void} @effects Sets clamped layer knob value. */
        setLayerKnobValue: (id, effect, value) =>
          set((state) => {
            const layer = state.layers[id];
            const nextVal = Math.max(0, Math.min(1, value));
            const knobs = LAYER_KNOB_EFFECTS.map((eff) => {
              const existing =
                (layer.knobs ?? []).find((k) => k?.effect === eff)?.value ??
                0.5;
              return {
                effect: eff,
                value: eff === effect ? nextVal : existing,
              };
            });
            return {
              layers: {
                ...state.layers,
                [id]: {
                  ...layer,
                  knobs,
                },
              },
            };
          }),

        /**
         * Toggle mute for one layer with solo bookkeeping support.
         * @param {string} id
         * @returns {void}
         * @calledBy Layer list/card mute controls.
         * @effects Updates layer mute state and maybe `soloLayerId`/`preSoloMutes`.
         */
        toggleLayerMute: (id) =>
          set((state) => {
            const nextMuted = !state.layers[id].muted;

            if (state.soloLayerId === id && state.preSoloMutes) {
              const preSolo = state.preSoloMutes;
              const restoredLayers = Object.fromEntries(
                Object.entries(state.layers).map(([layerId, layer]) => [
                  layerId,
                  { ...layer, muted: Boolean(preSolo[layerId as LayerId]) },
                ]),
              ) as LayersState;
              restoredLayers[id] = {
                ...restoredLayers[id],
                muted: nextMuted,
              };
              return {
                layers: restoredLayers,
                soloLayerId: null,
                preSoloMutes: null,
              };
            }

            const nextLayers = {
              ...state.layers,
              [id]: {
                ...state.layers[id],
                muted: nextMuted,
              },
            };

            if (!state.soloLayerId || !state.preSoloMutes) {
              return { layers: nextLayers };
            }

            return {
              layers: nextLayers,
              preSoloMutes: {
                ...state.preSoloMutes,
                [id]: nextMuted,
              },
            };
          }),

        /**
         * Toggle solo mode for one layer.
         * @param {string} id
         * @returns {void}
         * @calledBy Layer list/card solo controls.
         * @effects Mutes/unmutes other layers and manages `preSoloMutes`.
         */
        toggleLayerSolo: (id) =>
          set((state) => {
            if (state.soloLayerId === id) {
              if (!state.preSoloMutes) {
                return { soloLayerId: null };
              }
              const preSolo = state.preSoloMutes;
              const restoredLayers = Object.fromEntries(
                Object.entries(state.layers).map(([layerId, layer]) => [
                  layerId,
                  { ...layer, muted: Boolean(preSolo[layerId as LayerId]) },
                ]),
              ) as LayersState;
              return {
                layers: restoredLayers,
                soloLayerId: null,
                preSoloMutes: null,
              };
            }

            const baseMutes: Record<LayerId, boolean> =
              state.preSoloMutes ??
              (Object.fromEntries(
                Object.entries(state.layers).map(([layerId, layer]) => [
                  layerId,
                  Boolean(layer.muted),
                ]),
              ) as Record<LayerId, boolean>);

            const soloLayers = Object.fromEntries(
              Object.entries(state.layers).map(([layerId, layer]) => [
                layerId,
                { ...layer, muted: layerId !== id },
              ]),
            ) as LayersState;

            return {
              layers: soloLayers,
              soloLayerId: id,
              preSoloMutes: baseMutes,
            };
          }),

        /** Clears persisted session (localStorage) and reloads the page. */
        clearPersistedSession: () => {
          try {
            localStorage.removeItem(APP_PERSIST_STORAGE_KEY);
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
      /**
       * Full save/load of compositions is planned separately (export/import project).
       * This persists user session + layer data in-browser so refresh keeps layout.
       */
      /**
       * Select the subset of state persisted to localStorage.
       * @param {object} state
       * @returns {object} Persistable slice.
       * @calledBy Zustand `persist` middleware.
       * @effects No runtime side effects; serialization shaping only.
       */
      partialize: (state) => ({
        masterLoopLength: state.masterLoopLength,
        bpm: state.bpm,
        key: state.key,
        meter: state.meter,
        selectedLayer: state.selectedLayer,
        currentView: state.currentView,
        octaveView: state.octaveView,
        softpotPosition: state.softpotPosition,
        midiRollCount: state.midiRollCount,
        midiRollSplitByRootOctave: state.midiRollSplitByRootOctave,
        midiMeasuresVisible: state.midiMeasuresVisible,
        midiLoopRollPlacement: state.midiLoopRollPlacement,
        sampleSoundOn: state.sampleSoundOn,
        midiViewMeasureIndex: state.midiViewMeasureIndex,
        midiPlayheadBeat: state.midiPlayheadBeat,
        midiLoopSelectionMemory: state.midiLoopSelectionMemory,
        layers: state.layers,
        recordings: state.recordings,
        soloLayerId: state.soloLayerId,
        preSoloMutes: state.preSoloMutes,
      }),
      /**
       * Merge persisted payload into live defaults with migration + sanitation.
       * @param {unknown} persistedState
       * @param {any} currentState
       * @returns {object} Hydrated app state.
       * @calledBy Zustand `persist` middleware.
       * @effects Merges migrated persisted state; never restores live playback.
       */
      merge: (persistedState, currentState) => {
        const p = (persistedState ?? {}) as Record<string, unknown>;
        const mergedLayers = mergePersistedLayers(p.layers);
        const octaveView =
          typeof p.octaveView === "number" && Number.isFinite(p.octaveView)
            ? clampLoopOctave(p.octaveView)
            : currentState.octaveView;
        const beatsPerMeasure = beatsPerMeasureFromMeter(
          String(p.meter ?? currentState.meter),
        );
        const beatLength = Math.max(
          1,
          Number(p.masterLoopLength ?? currentState.masterLoopLength) ||
            beatsPerMeasure,
        );
        const layers = mergedLayers;
        return {
          ...currentState,
          ...p,
          midiRollSplitByRootOctave:
            typeof p.midiRollSplitByRootOctave === "boolean"
              ? p.midiRollSplitByRootOctave
              : currentState.midiRollSplitByRootOctave,
          octaveView,
          /** Never resume transport from storage. */
          isPlaying: false,
          previewSound: null,
          playheadPhase: currentState.playheadPhase,
          layers,
          recordings:
            p.recordings && typeof p.recordings === "object"
              ? { ...buildInitialRecordings(), ...p.recordings }
              : currentState.recordings,
          midiPlayheadBeat: clampPersistedMidiPlayheadBeat(
            p.midiPlayheadBeat,
            beatLength,
          ),
          midiMeasuresVisible:
            typeof p.midiMeasuresVisible === "number"
              ? Math.max(1, Math.min(4, Math.round(p.midiMeasuresVisible)))
              : currentState.midiMeasuresVisible,
          midiLoopRollPlacement: mergePersistedMidiLoopRollPlacementWithLegacy(
            p.midiLoopRollPlacement,
            layers,
            p.midiLayerRollPlacement,
            p.roll1LayersVisibility,
            p.roll2LayersVisibility,
          ),
          midiLoopSelectionMemory:
            p.midiLoopSelectionMemory &&
            typeof p.midiLoopSelectionMemory === "object"
              ? {
                  ...buildInitialLayerLoopSelectionMemory(),
                  ...(p.midiLoopSelectionMemory as Record<string, unknown>),
                }
              : currentState.midiLoopSelectionMemory,
          midiNoteSelection: MIDI_SELECTION_VIEWS.has(
            (p.currentView ?? currentState.currentView) as AppView,
          )
            ? (((p.midiLoopSelectionMemory as Record<string, unknown>)?.[
                (p.selectedLayer ?? currentState.selectedLayer) as LayerId
              ] as MidiNoteSelection) ??
              currentState.midiLoopSelectionMemory[
                (p.selectedLayer ?? currentState.selectedLayer) as LayerId
              ] ??
              null)
            : null,
        } as AppState;
      },
    },
  ),
);
