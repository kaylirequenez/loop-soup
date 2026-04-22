import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { initialNotesForLayerLoop } from "../lib/initialPatternNotes";
import {
  clampLoopOctave,
  clampLoopsToMeasures,
  createDefaultLoop,
  isRepeatDisabled,
  maxRepeatEveryForUnit,
  normalizeRepeatUnit,
  MAX_COMPOSITION_BEATS,
  maxMeasuresCompositionLimit,
  shiftLoopNotesOctaveBy,
} from "../lib/loopModel";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
  readMidiCompositionBeat,
} from "../lib/midiPlayhead";
import { LAYER_META, LAYER_ORDER } from "../lib/specs";

/**
 * Clamp a layer's loops to composition bounds and keep `activeLoopIndex` valid.
 * @param {object} layer - Layer state containing `loops` and `activeLoopIndex`.
 * @param {number} beatsPerMeasure - Meter-derived beats per measure.
 * @param {number} totalMeasures - Total composition measures available.
 * @returns {object} Normalized layer object with clamped loops.
 * @calledBy `patchLayerActiveLoop`, repeat actions, octave-shift actions, measure edits.
 * @effects Pure helper; does not mutate store directly.
 */
function layerWithClampedLoops(layer, beatsPerMeasure, totalMeasures) {
  const loops = clampLoopsToMeasures(
    layer.loops ?? [createDefaultLoop()],
    beatsPerMeasure,
    totalMeasures,
  );
  return {
    ...layer,
    loops,
    activeLoopIndex: Math.min(
      layer.activeLoopIndex ?? 0,
      Math.max(0, loops.length - 1),
    ),
  };
}

/** zustand `persist` localStorage key — export so dev reset can clear the same entry. */
export const APP_PERSIST_STORAGE_KEY = "loop-soup";

/** `midiNoteSelection.noteKey` when the user picks a loop from the top bar (no specific note yet). */
export const LOOP_PHRASE_PLACEHOLDER_NOTE_KEY = "__loopPhrase__";

const LAYERS = LAYER_ORDER;
const MAX_EXTRA_KNOBS = 3;
const SOFTPOT_HIGH_ROOT_INDEX = 11;
const SOFTPOT_STEPS = 24;
const DEFAULT_SOFTPOT_POSITION = SOFTPOT_HIGH_ROOT_INDEX / (SOFTPOT_STEPS - 1);
const MIDI_SELECTION_VIEWS = new Set(["layers", "midi", "dual"]);

/**
 * Normalize loop note timing fields so downstream math is safe.
 * @param {unknown} notes - Potential note list.
 * @returns {Array<object>} Sanitized notes list.
 * @calledBy `patchLoopNoteByIndex`, `setLoopNotes`.
 * @effects Pure helper.
 */
function sanitizeLoopNotes(notes) {
  return (Array.isArray(notes) ? notes : []).map((n) => ({
    ...n,
    localBeatIndex: Math.max(0, Math.floor(Number(n.localBeatIndex) || 0)),
    startInBeat: Math.max(0, Number(n.startInBeat) || 0),
    lengthInBeat: Math.max(0.05, Number(n.lengthInBeat) || 1),
  }));
}

const DEFAULT_LAYER = {
  sound: null,
  mode: "loop",
  volume: 0.7,
  filter: 0.8,
  reverb: 0.2,
  layerFx: 0.0,
  extraKnobs: 1,
  extraKnobValues: [0.5, 0.5, 0.5],
  muted: false,
  hasContent: false,
  entryLoop: null,
  /** Index into `loops` that the bottom bar edits (future: multiple loops per layer). */
  activeLoopIndex: 0,
  loops: [createDefaultLoop()],
};

/** Per-layer defaults: `spanBeats` seeds each loop on that layer (layer E has two loops, both use this). */
const LAYER_DEFAULTS = {
  A: { spanBeats: 1, hasContent: true },
  B: { spanBeats: 2, hasContent: false },
  C: { spanBeats: 3, hasContent: false },
  D: { spanBeats: 4, hasContent: false },
  E: { spanBeats: 2, hasContent: false },
};

/**
 * Build initial per-layer state including default loops and seeded notes.
 * @returns {Record<string, object>} Initial `layers` map.
 * @calledBy Initial store state, persisted merge fallback.
 * @effects Pure helper.
 */
const buildInitialLayers = () =>
  Object.fromEntries(
    LAYERS.map((id) => {
      const defaults = LAYER_DEFAULTS[id];
      const spanBeats = Math.max(1, defaults.spanBeats ?? 4);
      return [
        id,
        {
          ...DEFAULT_LAYER,
          mode: "loop",
          sound: LAYER_META[id]?.sound ?? null,
          hasContent: defaults.hasContent,
          loops:
            id === "E"
              ? [
                  createDefaultLoop({
                    spanBeats,
                    notes: initialNotesForLayerLoop("E", 0),
                  }),
                  createDefaultLoop({
                    spanBeats,
                    notes: initialNotesForLayerLoop("E", 1),
                  }),
                ]
              : [
                  createDefaultLoop({
                    spanBeats,
                    notes: initialNotesForLayerLoop(id, 0),
                  }),
                ],
          activeLoopIndex: 0,
        },
      ];
    }),
  );

/**
 * Build initial recordings bucket per layer.
 * @returns {Record<string, Array<unknown>>} Empty recording lists.
 * @calledBy Initial store state and persisted merge fallback.
 * @effects Pure helper.
 */
const buildInitialRecordings = () => ({ A: [], B: [], C: [], D: [], E: [] });
/**
 * Build initial memory for last-selected loop per layer.
 * @returns {Record<string, null>} Layer selection memory map.
 * @calledBy Initial store state and persisted merge fallback.
 * @effects Pure helper.
 */
const buildInitialLayerLoopSelectionMemory = () =>
  Object.fromEntries(LAYERS.map((id) => [id, null]));
export const MIDI_LOOP_ROLL_PLACEMENTS = ["both", "1", "2"];

/**
 * Derive MIDI menu value for a layer: shared value if all loops match, else `null`.
 * @param {Record<string, { loops?: { id: string }[] }>} layers - Layer state map.
 * @param {Record<string, Record<string, string>>} midiLoopRollPlacement - Per-loop placement map.
 * @param {string} layerId - Layer being inspected.
 * @returns {"1"|"2"|"both"|null} Menu selection state for the layer.
 * @calledBy `WorkspacePanel` roll menu.
 * @effects Pure helper.
 */
export function deriveMidiLayerRollMenuFromLoops(
  layers,
  midiLoopRollPlacement,
  layerId,
) {
  const layer = layers[layerId];
  const loops = layer?.loops ?? [];
  if (loops.length === 0) {
    return null;
  }
  const placements = loops.map((l) =>
    getMidiLoopRollPlacement(midiLoopRollPlacement, layerId, l.id),
  );
  const first = placements[0];
  if (loops.length === 1) {
    return first;
  }
  return placements.every((p) => p === first) ? first : null;
}

/**
 * Resolve effective layer roll placement used in note visibility.
 * @param {Record<string, { loops?: { id: string }[] }>} layers - Layer state map.
 * @param {Record<string, Record<string, string>>} midiLoopRollPlacement - Per-loop placement map.
 * @param {string} layerId - Layer id.
 * @returns {"1"|"2"|"both"} Effective placement (mixed resolves to `both`).
 * @calledBy MIDI roll visibility logic.
 * @effects Pure helper.
 */
export function getEffectiveLayerRollPlacementForNotes(
  layers,
  midiLoopRollPlacement,
  layerId,
) {
  const d = deriveMidiLayerRollMenuFromLoops(
    layers,
    midiLoopRollPlacement,
    layerId,
  );
  return d === null ? "both" : d;
}

/**
 * Migrate legacy persisted layer visibility into placement values.
 * @param {Record<string, string> | undefined} legacyLayerMap - Old per-layer placement map.
 * @param {unknown} legacyRoll1Visibility - Old roll-1 visibility map.
 * @param {unknown} legacyRoll2Visibility - Old roll-2 visibility map.
 * @returns {Record<string, '1' | '2' | 'both'> | null} Placement map or null when unavailable.
 * @calledBy `mergePersistedMidiLoopRollPlacementWithLegacy`.
 * @effects Pure migration helper.
 */
function legacyLayerRollPlacementFromPersist(
  legacyLayerMap,
  legacyRoll1Visibility,
  legacyRoll2Visibility,
) {
  if (legacyLayerMap && typeof legacyLayerMap === "object") {
    const per = {};
    let any = false;
    for (const id of LAYERS) {
      const v = legacyLayerMap[id];
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(v)) {
        per[id] = v;
        any = true;
      }
    }
    if (any) {
      return per;
    }
  }
  const r1 =
    legacyRoll1Visibility && typeof legacyRoll1Visibility === "object"
      ? legacyRoll1Visibility
      : null;
  const r2 =
    legacyRoll2Visibility && typeof legacyRoll2Visibility === "object"
      ? legacyRoll2Visibility
      : null;
  if (!r1 || !r2) {
    return null;
  }
  const per = {};
  for (const id of LAYERS) {
    const a = r1[id] !== false;
    const b = r2[id] !== false;
    if (a && b) {
      per[id] = "both";
    } else if (a) {
      per[id] = "1";
    } else if (b) {
      per[id] = "2";
    } else {
      per[id] = "both";
    }
  }
  return per;
}

/**
 * Check whether all loops in a layer share the same roll placement.
 * @param {Record<string, { loops?: { id: string }[] }>} layers - Layer state map.
 * @param {Record<string, Record<string, string>>} midiLoopRollPlacement - Per-loop placement map.
 * @param {string} layerId - Layer id.
 * @returns {boolean} True when all loop placements match.
 * @calledBy Composition/midi placement UI.
 * @effects Pure helper.
 */
export function layerLoopsAgreeOnMidiRollPlacement(
  layers,
  midiLoopRollPlacement,
  layerId,
) {
  const layer = layers[layerId];
  const loops = layer?.loops ?? [];
  if (loops.length <= 1) {
    return true;
  }
  const placements = loops.map((loop) =>
    getMidiLoopRollPlacement(midiLoopRollPlacement, layerId, loop.id),
  );
  const first = placements[0];
  return placements.every((p) => p === first);
}

/**
 * Build empty per-loop placement map for each layer.
 * @returns {Record<string, Record<string, string>>} Default placement map.
 * @calledBy Initial store state and persisted merge.
 * @effects Pure helper.
 */
function buildDefaultMidiLoopRollPlacement() {
  return Object.fromEntries(LAYERS.map((id) => [id, {}]));
}

/**
 * Sanitize persisted per-loop placement data.
 * @param {unknown} stored - Persisted raw value.
 * @returns {Record<string, Record<string, string>>} Clean placement map.
 * @calledBy Persist `merge`.
 * @effects Pure helper.
 */
function mergePersistedMidiLoopRollPlacement(stored) {
  const base = buildDefaultMidiLoopRollPlacement();
  if (!stored || typeof stored !== "object") {
    return base;
  }
  for (const id of LAYERS) {
    const inner = stored[id];
    if (!inner || typeof inner !== "object") {
      continue;
    }
    const next = {};
    for (const [loopId, raw] of Object.entries(inner)) {
      if (typeof loopId !== "string" || !loopId) {
        continue;
      }
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(raw)) {
        next[loopId] = raw;
      }
    }
    base[id] = next;
  }
  return base;
}

/**
 * Merge saved per-loop placements with legacy per-layer placement settings.
 * Saved per-loop keys win over legacy defaults.
 * @param {unknown} persistedRaw - Persisted placement map.
 * @param {Record<string, { loops?: { id: string }[] }>} layers - Current layers.
 * @param {unknown} legacyLayerMap - Legacy per-layer map.
 * @param {unknown} legacyRoll1 - Legacy roll-1 visibility.
 * @param {unknown} legacyRoll2 - Legacy roll-2 visibility.
 * @returns {Record<string, Record<string, string>>} Merged placement map.
 * @calledBy Persist `merge`.
 * @effects Pure helper.
 */
function mergePersistedMidiLoopRollPlacementWithLegacy(
  persistedRaw,
  layers,
  legacyLayerMap,
  legacyRoll1,
  legacyRoll2,
) {
  const fromSaved = mergePersistedMidiLoopRollPlacement(persistedRaw);
  const legacy = legacyLayerRollPlacementFromPersist(
    legacyLayerMap,
    legacyRoll1,
    legacyRoll2,
  );
  if (!legacy) {
    return fromSaved;
  }
  let out = { ...fromSaved };
  for (const id of LAYERS) {
    const v = legacy[id];
    if (!MIDI_LOOP_ROLL_PLACEMENTS.includes(v)) {
      continue;
    }
    const loops = layers[id]?.loops ?? [];
    const inner = { ...(out[id] ?? {}) };
    for (const loop of loops) {
      inner[loop.id] = v;
    }
    out[id] = inner;
  }
  for (const id of LAYERS) {
    const savedInner = fromSaved[id];
    if (!savedInner || typeof savedInner !== "object") {
      continue;
    }
    out[id] = { ...(out[id] ?? {}), ...savedInner };
  }
  return out;
}

/**
 * Read one loop's placement with fallback to `both`.
 * @param {Record<string, Record<string, string>> | undefined} map - Placement map.
 * @param {string} layerId - Layer id.
 * @param {string} loopId - Loop id.
 * @returns {"1"|"2"|"both"} Placement for this loop.
 * @calledBy Composition + MIDI roll rendering.
 * @effects Pure helper.
 */
export function getMidiLoopRollPlacement(map, layerId, loopId) {
  const v = map?.[layerId]?.[loopId];
  if (v === "1" || v === "2" || v === "both") {
    return v;
  }
  return "both";
}

/**
 * Determine whether a placement is visible on a given roll slot.
 * @param {'both' | '1' | '2'} placement - Loop placement assignment.
 * @param {1 | 2} rollSlot - Roll slot to test.
 * @param {number} midiRollCount - Number of visible rolls.
 * @returns {boolean} True when the note should render on this slot.
 * @calledBy MIDI roll note filtering.
 * @effects Pure helper.
 */
export function loopPlacementVisibleOnRoll(placement, rollSlot, midiRollCount) {
  if (midiRollCount < 2) {
    return true;
  }
  if (placement === "both") {
    return true;
  }
  if (placement === "1") {
    return rollSlot === 1;
  }
  if (placement === "2") {
    return rollSlot === 2;
  }
  return true;
}

/**
 * Clamp persisted playhead beat to a valid composition range.
 * @param {unknown} raw - Persisted beat value.
 * @param {number} beatLength - Composition beat length.
 * @returns {number} Safe beat value in [0, beatLength).
 * @calledBy Persist `merge`.
 * @effects Pure helper.
 */
function clampPersistedMidiPlayheadBeat(raw, beatLength) {
  const len = Math.max(1e-6, beatLength);
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.min(Math.max(0, raw), len - 1e-6);
}

/**
 * Merge one persisted layer snapshot onto current defaults.
 * @param {object} base - Default layer shape.
 * @param {unknown} stored - Persisted layer value.
 * @returns {object} Merged layer with normalized loop schema.
 * @calledBy `mergePersistedLayers`.
 * @effects Pure helper.
 */
function mergePersistedLayer(base, stored) {
  if (!stored || typeof stored !== "object") {
    return base;
  }
  const merged = { ...base, ...stored };
  if (!Array.isArray(merged.loops) || merged.loops.length === 0) {
    merged.loops = [...base.loops];
  } else {
    merged.loops = merged.loops.map((l, i) =>
      createDefaultLoop({
        ...l,
        id: typeof l?.id === "string" ? l.id : `loop-${i}`,
      }),
    );
  }
  merged.activeLoopIndex = Math.max(
    0,
    Math.min(merged.loops.length - 1, merged.activeLoopIndex ?? 0),
  );
  return merged;
}

/**
 * Merge all persisted layers onto default layer templates.
 * @param {unknown} stored - Persisted layers object.
 * @returns {Record<string, object>} Merged layers map.
 * @calledBy Persist `merge`.
 * @effects Pure helper.
 */
function mergePersistedLayers(stored) {
  const base = buildInitialLayers();
  if (!stored || typeof stored !== "object") {
    return base;
  }
  return Object.fromEntries(
    LAYERS.map((id) => [id, mergePersistedLayer(base[id], stored[id])]),
  );
}

/**
 * Auto-switch from layers view to MIDI view when loop editing requires it.
 * @param {object} state - Current app store state.
 * @param {object} loop - Loop currently being edited.
 * @returns {object} Partial state patch; empty when no switch needed.
 * @calledBy Loop edit/repeat/octave mutation actions.
 * @effects Pure helper returning a patch only.
 */
function maybeSwitchToMidiForLoopEdit(state, loop) {
  if (state.currentView !== "layers" || !loop) {
    return {};
  }
  return {
    currentView: "midi",
  };
}

export const useAppStore = create(
  persist(
    (set) => ({
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
       * When set, repeat + phrase in the bottom bar apply to this loop; cleared when picking a layer in the list or toggling the same MIDI note off.
       * `noteKey` may be the loop-phrase placeholder when chosen from the top bar (no specific note yet).
       * @type {{ layerId: string, loopId: string, noteKey: string } | null}
       */
      midiNoteSelection: null,
      /**
       * MIDI pattern edit mode for one loop (entered from composition “edit” button).
       * @type {{ layerId: string, loopId: string, instanceOffset: number } | null}
       */
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
          if (!(layerId in state.layers)) {
            return state;
          }
          if (loopIndexOrNull == null) {
            // Clear phrase/note selection for this layer (e.g. loop number pressed again in
            // composition view). Do not depend on `shouldShowSelection`; match applyMidiNoteTap.
            const clearMidi =
              state.midiNoteSelection?.layerId === layerId
                ? null
                : state.midiNoteSelection;
            return {
              midiNoteSelection: clearMidi,
              midiLoopEditMode:
                state.midiLoopEditMode?.layerId === layerId
                  ? null
                  : state.midiLoopEditMode,
              midiLoopSelectionMemory: {
                ...state.midiLoopSelectionMemory,
                [layerId]: null,
              },
            };
          }
          const layer = state.layers[layerId];
          const loops = layer.loops ?? [createDefaultLoop()];
          const n = loops.length;
          const ai = Math.max(0, Math.min(n - 1, Math.floor(loopIndexOrNull)));
          const loop = loops[ai];
          if (!loop) {
            return state;
          }
          const nextSelection = {
            layerId,
            loopId: loop.id,
            noteKey: LOOP_PHRASE_PLACEHOLDER_NOTE_KEY,
          };
          return {
            // Same as clear: composition loop-index button must always set/clear phrase
            // selection for the current layer; do not gate on `currentView`.
            midiNoteSelection:
              state.selectedLayer === layerId
                ? nextSelection
                : state.midiNoteSelection,
            midiLoopEditMode: null,
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
      applyMidiNoteTap: ({ layerId, loopId, noteKey, rollSlot }) =>
        set((state) => {
          const cur = state.midiNoteSelection;
          if (
            cur &&
            cur.layerId === layerId &&
            cur.loopId === loopId &&
            cur.noteKey === noteKey
          ) {
            return {
              midiNoteSelection: null,
              midiLoopSelectionMemory: {
                ...state.midiLoopSelectionMemory,
                [layerId]: null,
              },
            };
          }
          const layer = state.layers[layerId];
          if (!layer) {
            return state;
          }
          const loops = layer.loops ?? [createDefaultLoop()];
          const found = loops.findIndex((l) => l.id === loopId);
          const loopIndex = found >= 0 ? found : 0;
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beats = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const measureCount = Math.max(1, Math.ceil(beats / beatsPerMeasure));
          const effectiveVisible = Math.max(
            1,
            Math.min(state.midiMeasuresVisible, measureCount),
          );
          const maxStart = Math.max(0, measureCount - effectiveVisible);
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
            midiViewMeasureIndex: Math.min(
              state.midiViewMeasureIndex,
              maxStart,
            ),
            midiNoteSelection: { layerId, loopId, noteKey },
            midiLoopSelectionMemory: {
              ...state.midiLoopSelectionMemory,
              [layerId]: { layerId, loopId, noteKey },
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
      /**
       * Toggle MIDI edit mode for a loop from composition view. Selects layer + loop;
       * clears edit when switching layers. Click again on the same loop to exit edit mode.
       */
      toggleMidiLoopEditFromComposition: (layerId, loopIndex) =>
        set((state) => {
          if (!(layerId in state.layers)) {
            return state;
          }
          const layer = state.layers[layerId];
          const loops = layer.loops ?? [createDefaultLoop()];
          const ai = Math.max(
            0,
            Math.min(loops.length - 1, Math.floor(loopIndex)),
          );
          const loop = loops[ai];
          if (!loop) {
            return state;
          }
          const editingThis =
            state.midiLoopEditMode?.layerId === layerId &&
            state.midiLoopEditMode?.loopId === loop.id;
          if (editingThis) {
            return { midiLoopEditMode: null };
          }
          const nextSelection = {
            layerId,
            loopId: loop.id,
            noteKey: LOOP_PHRASE_PLACEHOLDER_NOTE_KEY,
          };
          return {
            selectedLayer: layerId,
            midiLoopEditMode: {
              layerId,
              loopId: loop.id,
              instanceOffset: 0,
            },
            midiNoteSelection: nextSelection,
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
       * Clear MIDI loop edit mode.
       * @returns {void}
       * @calledBy UI mode-exit flows.
       * @effects Sets `midiLoopEditMode` to `null`.
       */
      clearMidiLoopEditMode: () => set({ midiLoopEditMode: null }),
      /**
       * Patch one note in a specific loop by note index.
       * @param {string} layerId
       * @param {string} loopId
       * @param {number} noteIndex
       * @param {object} patch
       * @returns {void}
       * @calledBy MIDI note drag/edit flows.
       * @effects Updates `layers[layerId].loops[*].notes`.
       */
      patchLoopNoteByIndex: (layerId, loopId, noteIndex, patch) =>
        set((state) => {
          const layer = state.layers[layerId];
          if (!layer) {
            return state;
          }
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const loopIndex = loops.findIndex((l) => l.id === loopId);
          if (loopIndex < 0) {
            return state;
          }
          const loop = loops[loopIndex];
          const notes = sanitizeLoopNotes(loop.notes);
          if (noteIndex < 0 || noteIndex >= notes.length) {
            return state;
          }
          notes[noteIndex] = {
            ...notes[noteIndex],
            ...patch,
          };
          loops[loopIndex] = { ...loop, notes: sanitizeLoopNotes(notes) };
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                loops,
              },
            },
          };
        }),
      /**
       * Replace all notes in a loop after sanitization.
       * @param {string} layerId
       * @param {string} loopId
       * @param {unknown} notesRaw
       * @returns {void}
       * @calledBy MIDI pattern edit flows.
       * @effects Replaces one loop's `notes` array.
       */
      setLoopNotes: (layerId, loopId, notesRaw) =>
        set((state) => {
          const layer = state.layers[layerId];
          if (!layer) {
            return state;
          }
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const loopIndex = loops.findIndex((l) => l.id === loopId);
          if (loopIndex < 0) {
            return state;
          }
          const loop = loops[loopIndex];
          loops[loopIndex] = {
            ...loop,
            notes: sanitizeLoopNotes(notesRaw),
          };
          return {
            layers: {
              ...state.layers,
              [layerId]: {
                ...layer,
                loops,
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
       * @effects Updates `selectedLayer`, `midiViewMeasureIndex`, `midiNoteSelection`, `midiLoopEditMode`.
       */
      selectLayer: (id) =>
        set((state) => {
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beats = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const measureCount = Math.max(1, Math.ceil(beats / beatsPerMeasure));
          const effectiveVisible = Math.max(
            1,
            Math.min(state.midiMeasuresVisible, measureCount),
          );
          const maxStart = Math.max(0, measureCount - effectiveVisible);
          const shouldShowSelection = MIDI_SELECTION_VIEWS.has(
            state.currentView,
          );
          const rememberedSelection = state.midiLoopSelectionMemory[id] ?? null;
          return {
            selectedLayer: id,
            midiViewMeasureIndex: Math.min(
              state.midiViewMeasureIndex,
              maxStart,
            ),
            midiNoteSelection: shouldShowSelection ? rememberedSelection : null,
            midiLoopEditMode: null,
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
            midiLoopEditMode: showingSelection ? state.midiLoopEditMode : null,
          };
        }),
      /** @param {boolean} value @returns {void} @effects Sets `pickerOpen`. */
      setPickerOpen: (value) => set({ pickerOpen: value }),
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
          if (!LAYERS.includes(layerId)) {
            return state;
          }
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
          if (
            !LAYERS.includes(layerId) ||
            typeof loopId !== "string" ||
            !loopId
          ) {
            return state;
          }
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
      /** @param {unknown} value @returns {void} @effects Sets `previewSound`. */
      setPreviewSound: (value) => set({ previewSound: value }),
      /** @param {number} value @returns {void} @effects Sets `bpm`. */
      setBpm: (value) => set({ bpm: value }),
      /** @param {string} value @returns {void} @effects Sets `key`. */
      setKey: (value) => set({ key: value }),
      /**
       * Set meter and re-clamp loop boundaries against new measure size.
       * @param {string} value
       * @returns {void}
       * @calledBy Session controls/import.
       * @effects Updates `meter` and normalized `layers`.
       */
      setMeter: (value) =>
        set((state) => {
          const bpm = Number.parseInt(String(value).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const layers = Object.fromEntries(
            LAYERS.map((id) => {
              const layer = state.layers[id];
              const loops = clampLoopsToMeasures(
                layer.loops ?? [createDefaultLoop()],
                beatsPerMeasure,
                totalMeasures,
              );
              return [
                id,
                {
                  ...layer,
                  loops,
                  activeLoopIndex: Math.min(
                    layer.activeLoopIndex ?? 0,
                    Math.max(0, loops.length - 1),
                  ),
                },
              ];
            }),
          );
          return { meter: value, layers };
        }),

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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const measureCount = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const visible = Math.max(
            1,
            Math.min(state.midiMeasuresVisible, measureCount, 4),
          );
          const maxStart = Math.max(0, measureCount - visible);
          return {
            midiViewMeasureIndex: Math.max(0, Math.min(maxStart, value)),
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const measureCount = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const vis = Math.max(1, Math.min(4, Math.floor(value)));
          const effectiveVisible = Math.max(1, Math.min(vis, measureCount));
          const maxStart = Math.max(0, measureCount - effectiveVisible);
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const len = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          let w = ((beat % len) + len) % len;
          if (w >= len - 1e-9) {
            w = 0;
          }
          const clamped = Math.min(Math.max(0, w), len - 1e-6);
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
          const next = {
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

      /** Add one full measure of beats (per current meter) to the composition loop. */
      addCompositionMeasure: () =>
        set((state) => {
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
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
          const layers = Object.fromEntries(
            LAYERS.map((id) => [
              id,
              layerWithClampedLoops(
                state.layers[id],
                beatsPerMeasure,
                nextMeasures,
              ),
            ]),
          );
          return {
            midiViewMeasureIndex,
            masterLoopLength: next,
            layers,
          };
        }),

      /**
       * Remove one measure worth of beats from the end. No-op unless the loop
       * spans at least two measures; always leaves at least one full measure.
       */
      removeLastCompositionMeasure: () =>
        set((state) => {
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
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
          const layers = Object.fromEntries(
            LAYERS.map((lid) => {
              const layer = state.layers[lid];
              const loops = clampLoopsToMeasures(
                layer.loops ?? [createDefaultLoop()],
                beatsPerMeasure,
                nextMeasures,
              );
              return [
                lid,
                {
                  ...layer,
                  loops,
                  activeLoopIndex: Math.min(
                    layer.activeLoopIndex ?? 0,
                    Math.max(0, loops.length - 1),
                  ),
                },
              ];
            }),
          );
          return {
            midiViewMeasureIndex,
            masterLoopLength: next,
            layers,
          };
        }),

      /**
       * Shallow patch one layer object.
       * @param {string} id
       * @param {object} patch
       * @returns {void}
       * @calledBy Generic layer editing flows.
       * @effects Updates `layers[id]`.
       */
      updateLayer: (id, patch) =>
        set((state) => ({
          layers: { ...state.layers, [id]: { ...state.layers[id], ...patch } },
        })),

      /**
       * Patch the active loop for a layer and re-normalize loop constraints.
       * @param {string} id
       * @param {object} patch
       * @returns {void}
       * @calledBy Loop editing flows.
       * @effects Updates active loop data in `layers`; may switch current view to MIDI.
       */
      patchLayerActiveLoop: (id, patch) =>
        set((state) => {
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          loops[ai] = { ...loops[ai], ...patch };
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const unit = normalizeRepeatUnit(unitRaw);
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const cur = { ...loops[ai] };
          const prevUnit = normalizeRepeatUnit(cur.repeatUnit);
          if (cur.repeatEvery != null) {
            if (prevUnit === "measures") {
              cur.repeatEveryMeasuresMemory = cur.repeatEvery;
            } else {
              cur.repeatEveryBeatsMemory = cur.repeatEvery;
            }
          }
          cur.repeatUnit = unit;
          const remembered =
            unit === "measures"
              ? cur.repeatEveryMeasuresMemory
              : cur.repeatEveryBeatsMemory;
          cur.repeatEvery = remembered ?? null;
          cur.repeatEndMeasure =
            unit === "measures" ? cur.repeatEndMeasure : null;
          const maxEvery = maxRepeatEveryForUnit(unit, beatsPerMeasure);
          if (cur.repeatEvery != null) {
            cur.repeatEvery = Math.min(Math.max(1, cur.repeatEvery), maxEvery);
          }
          if (
            cur.repeatEvery != null &&
            isRepeatDisabled(
              cur.spanBeats,
              beatsPerMeasure,
              cur.repeatUnit,
              cur.repeatEvery,
            )
          ) {
            cur.repeatEvery = null;
          }
          loops[ai] = cur;
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const value = Math.floor(Number(valueRaw));
          if (!Number.isFinite(value) || value < 1) {
            return state;
          }
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const cur = { ...loops[ai] };
          const unit = normalizeRepeatUnit(cur.repeatUnit);
          const maxEvery = maxRepeatEveryForUnit(unit, beatsPerMeasure);
          if (value > maxEvery) {
            return state;
          }
          if (cur.repeatEvery === value) {
            cur.repeatEvery = null;
            cur.repeatEndMeasure = null;
          } else if (
            isRepeatDisabled(cur.spanBeats, beatsPerMeasure, unit, value)
          ) {
            return state;
          } else {
            cur.repeatEvery = value;
            cur.repeatUnit = unit;
            if (unit === "measures") {
              cur.repeatEveryMeasuresMemory = value;
            } else {
              cur.repeatEveryBeatsMemory = value;
            }
            if (unit === "beats") {
              cur.repeatEndMeasure = null;
            }
          }
          loops[ai] = cur;
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const m = Math.min(Math.max(1, Math.floor(measure)), totalMeasures);
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const cur = { ...loops[ai], startMeasure: m };
          if (cur.repeatEndMeasure != null && cur.repeatEndMeasure <= m) {
            cur.repeatEndMeasure = Math.min(totalMeasures, m + 1);
          }
          loops[ai] = cur;
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const maxMeasures = maxMeasuresCompositionLimit(beatsPerMeasure);
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const cur = { ...loops[ai] };
          if (endMeasure == null) {
            cur.repeatEndMeasure = null;
          } else {
            const start = Math.max(1, Math.floor(cur.startMeasure) || 1);
            const em = Math.min(
              maxMeasures,
              Math.max(start + 1, Math.floor(endMeasure)),
            );
            cur.repeatEndMeasure = em;
          }
          loops[ai] = cur;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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
          const bpm = Number.parseInt(String(state.meter).split("/")[0], 10);
          const beatsPerMeasure = bpm > 0 ? bpm : 4;
          const beatLength = Math.max(
            1,
            Number(state.masterLoopLength) || beatsPerMeasure,
          );
          const totalMeasures = Math.max(
            1,
            Math.ceil(beatLength / beatsPerMeasure),
          );
          const layer = state.layers[id];
          const ai = Math.max(
            0,
            Math.min(
              (layer.loops?.length ?? 1) - 1,
              layer.activeLoopIndex ?? 0,
            ),
          );
          const loops = [...(layer.loops ?? [createDefaultLoop()])];
          const prev = loops[ai] ?? createDefaultLoop();
          const notes = shiftLoopNotesOctaveBy(
            prev.notes,
            delta,
            prev.octave ?? 3,
          );
          loops[ai] = { ...prev, notes };
          const nextLayer = layerWithClampedLoops(
            { ...layer, loops },
            beatsPerMeasure,
            totalMeasures,
          );
          const nextLoop =
            nextLayer.loops[
              Math.max(
                0,
                Math.min(
                  nextLayer.loops.length - 1,
                  nextLayer.activeLoopIndex ?? 0,
                ),
              )
            ];
          return {
            ...maybeSwitchToMidiForLoopEdit(
              state,
              nextLoop,
              beatsPerMeasure,
              totalMeasures,
            ),
            layers: {
              ...state.layers,
              [id]: nextLayer,
            },
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

      /** @param {string} id @param {string} knobKey @param {number} value @returns {void} @effects Sets clamped layer knob value. */
      setLayerKnobValue: (id, knobKey, value) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [id]: {
              ...state.layers[id],
              [knobKey]: Math.max(0, Math.min(1, value)),
            },
          },
        })),

      /** @param {string} id @param {number} knobIndex @param {number} value @returns {void} @effects Sets clamped extra knob value. */
      setLayerExtraKnobValue: (id, knobIndex, value) =>
        set((state) => {
          const baseValues = state.layers[id].extraKnobValues ?? [
            0.5, 0.5, 0.5,
          ];
          const nextValues = [...baseValues];
          if (knobIndex >= 0 && knobIndex < nextValues.length) {
            nextValues[knobIndex] = Math.max(0, Math.min(1, value));
          }
          return {
            layers: {
              ...state.layers,
              [id]: {
                ...state.layers[id],
                extraKnobValues: nextValues,
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
            const restoredLayers = Object.fromEntries(
              Object.entries(state.layers).map(([layerId, layer]) => [
                layerId,
                { ...layer, muted: Boolean(state.preSoloMutes[layerId]) },
              ]),
            );
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

      /** @param {string} id @returns {void} @effects Increments `extraKnobs` up to cap. */
      addLayerKnob: (id) =>
        set((state) => ({
          layers: {
            ...state.layers,
            [id]: {
              ...state.layers[id],
              extraKnobs: Math.min(
                MAX_EXTRA_KNOBS,
                (state.layers[id].extraKnobs ?? 0) + 1,
              ),
            },
          },
        })),

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
            const restoredLayers = Object.fromEntries(
              Object.entries(state.layers).map(([layerId, layer]) => [
                layerId,
                { ...layer, muted: Boolean(state.preSoloMutes[layerId]) },
              ]),
            );
            return {
              layers: restoredLayers,
              soloLayerId: null,
              preSoloMutes: null,
            };
          }

          const baseMutes =
            state.preSoloMutes ??
            Object.fromEntries(
              Object.entries(state.layers).map(([layerId, layer]) => [
                layerId,
                Boolean(layer.muted),
              ]),
            );

          const soloLayers = Object.fromEntries(
            Object.entries(state.layers).map(([layerId, layer]) => [
              layerId,
              { ...layer, muted: layerId !== id },
            ]),
          );

          return {
            layers: soloLayers,
            soloLayerId: id,
            preSoloMutes: baseMutes,
          };
        }),

      /**
       * Store recorded notes for a layer and mark it as containing content.
       * @param {string} id
       * @param {Array<unknown>} notes
       * @returns {void}
       * @calledBy Recording engine integration.
       * @effects Updates `recordings[id]` and `layers[id].hasContent`.
       */
      commitRecording: (id, notes) =>
        set((state) => ({
          recordings: { ...state.recordings, [id]: notes },
          layers: {
            ...state.layers,
            [id]: { ...state.layers[id], hasContent: true },
          },
        })),

      /**
       * Set top-level session metadata in one call.
       * @param {number} bpm
       * @param {string} key
       * @param {string} meter
       * @param {number} loopLength
       * @returns {void}
       * @calledBy Session import/setup flows.
       * @effects Updates `bpm`, `key`, `meter`, and `masterLoopLength`.
       */
      setSessionInfo: (bpm, key, meter, loopLength) =>
        set({ bpm, key, meter, masterLoopLength: loopLength }),

      /** Clears persisted session (localStorage) and reloads the page. */
      clearPersistedSession: () => {
        try {
          localStorage.removeItem(APP_PERSIST_STORAGE_KEY);
        } catch {
          /* ignore quota / private mode */
        }
        window.location.reload();
      },
    }),
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
       * @param {object} currentState
       * @returns {object} Hydrated app state.
       * @calledBy Zustand `persist` middleware.
       * @effects Rebuilds clamped layer/transport fields; never restores live playback.
       */
      merge: (persistedState, currentState) => {
        const p = persistedState ?? {};
        const mergedLayers = mergePersistedLayers(p.layers);
        const octaveView =
          typeof p.octaveView === "number" && Number.isFinite(p.octaveView)
            ? clampLoopOctave(p.octaveView)
            : currentState.octaveView;
        const bpm = Number.parseInt(
          String(p.meter ?? currentState.meter).split("/")[0],
          10,
        );
        const beatsPerMeasure = bpm > 0 ? bpm : 4;
        const beatLength = Math.max(
          1,
          Number(p.masterLoopLength ?? currentState.masterLoopLength) ||
            beatsPerMeasure,
        );
        const totalMeasures = Math.max(
          1,
          Math.ceil(beatLength / beatsPerMeasure),
        );
        const layers = Object.fromEntries(
          LAYERS.map((id) => {
            const layer = mergedLayers[id];
            const loops = clampLoopsToMeasures(
              layer.loops ?? [createDefaultLoop()],
              beatsPerMeasure,
              totalMeasures,
            );
            return [
              id,
              {
                ...layer,
                loops,
                activeLoopIndex: Math.min(
                  layer.activeLoopIndex ?? 0,
                  Math.max(0, loops.length - 1),
                ),
              },
            ];
          }),
        );
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
                  ...p.midiLoopSelectionMemory,
                }
              : currentState.midiLoopSelectionMemory,
          midiNoteSelection: MIDI_SELECTION_VIEWS.has(
            p.currentView ?? currentState.currentView,
          )
            ? ((p.midiLoopSelectionMemory &&
                p.midiLoopSelectionMemory[
                  p.selectedLayer ?? currentState.selectedLayer
                ]) ??
              currentState.midiLoopSelectionMemory[
                p.selectedLayer ?? currentState.selectedLayer
              ] ??
              null)
            : null,
        };
      },
    },
  ),
);
