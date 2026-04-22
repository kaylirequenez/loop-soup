import { initialNotesForLayerLoop } from "../../lib/initialPatternNotes";
import { createDefaultLoop } from "../../lib/loopModel";
import { LAYER_META } from "../../lib/layers";
import type {
  LayerId,
  LayerKnobEffect,
  LayerState,
  LayersState,
  MidiLoopRollPlacementMap,
  MidiRollPlacement,
  MidiNoteSelection,
} from "../../types/model";
import {
  LAYERS,
  MIDI_LOOP_ROLL_PLACEMENTS,
} from "./midiPlacement";

const LAYER_KNOB_EFFECTS = ["filter", "reverb"] as const;

const DEFAULT_LAYER = {
  sound: null as string | null,
  volume: 0.7,
  knobs: [
    { effect: "filter" as const, value: 0.8 },
    { effect: "reverb" as const, value: 0.2 },
  ],
  muted: false,
  activeLoopIndex: 0,
  loops: [createDefaultLoop()],
};

const LAYER_DEFAULTS: Record<LayerId, { spanBeats: number }> = {
  A: { spanBeats: 1 },
  B: { spanBeats: 2 },
  C: { spanBeats: 3 },
  D: { spanBeats: 4 },
  E: { spanBeats: 2 },
};

export function buildInitialLayer(layerId: LayerId): LayerState {
  const defaults = LAYER_DEFAULTS[layerId];
  const spanBeats = Math.max(1, defaults.spanBeats ?? 4);
  return {
    ...DEFAULT_LAYER,
    sound: LAYER_META[layerId]?.sound ?? null,
    loops:
      layerId === "E"
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
              notes: initialNotesForLayerLoop(layerId, 0),
            }),
          ],
    activeLoopIndex: 0,
  };
}

export const buildInitialLayers = (): LayersState => ({
  A: buildInitialLayer("A"),
  B: buildInitialLayer("B"),
  C: buildInitialLayer("C"),
  D: buildInitialLayer("D"),
  E: buildInitialLayer("E"),
});

export const buildInitialRecordings = (): Record<LayerId, unknown[]> => ({
  A: [],
  B: [],
  C: [],
  D: [],
  E: [],
});

export const buildInitialLayerLoopSelectionMemory = (): Record<
  LayerId,
  MidiNoteSelection
> => ({
  A: null,
  B: null,
  C: null,
  D: null,
  E: null,
});

export function buildDefaultMidiLoopRollPlacement(): MidiLoopRollPlacementMap {
  return {
    A: {},
    B: {},
    C: {},
    D: {},
    E: {},
  };
}

function legacyLayerRollPlacementFromPersist(
  legacyLayerMap: unknown,
  legacyRoll1Visibility: unknown,
  legacyRoll2Visibility: unknown,
): Record<LayerId, MidiRollPlacement> | null {
  if (legacyLayerMap && typeof legacyLayerMap === "object") {
    const per: Record<LayerId, MidiRollPlacement> = {
      A: "both",
      B: "both",
      C: "both",
      D: "both",
      E: "both",
    };
    const map = legacyLayerMap as Record<string, unknown>;
    let any = false;
    for (const id of LAYERS) {
      const v = map[id];
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(v as MidiRollPlacement)) {
        per[id] = v as MidiRollPlacement;
        any = true;
      }
    }
    if (any) {
      return per;
    }
  }
  const r1 =
    legacyRoll1Visibility && typeof legacyRoll1Visibility === "object"
      ? (legacyRoll1Visibility as Record<string, unknown>)
      : null;
  const r2 =
    legacyRoll2Visibility && typeof legacyRoll2Visibility === "object"
      ? (legacyRoll2Visibility as Record<string, unknown>)
      : null;
  if (!r1 || !r2) {
    return null;
  }
  const per: Record<LayerId, MidiRollPlacement> = {
    A: "both",
    B: "both",
    C: "both",
    D: "both",
    E: "both",
  };
  for (const id of LAYERS) {
    const a = r1[id] !== false;
    const b = r2[id] !== false;
    if (a && b) per[id] = "both";
    else if (a) per[id] = "1";
    else if (b) per[id] = "2";
    else per[id] = "both";
  }
  return per;
}

export function mergePersistedMidiLoopRollPlacement(
  stored: unknown,
): MidiLoopRollPlacementMap {
  const base = buildDefaultMidiLoopRollPlacement();
  if (!stored || typeof stored !== "object") {
    return base;
  }
  const storedMap = stored as Record<string, unknown>;
  for (const id of LAYERS) {
    const inner = storedMap[id];
    if (!inner || typeof inner !== "object") {
      continue;
    }
    const next: Record<string, MidiRollPlacement> = {};
    for (const [loopId, raw] of Object.entries(inner as Record<string, unknown>)) {
      if (!loopId) continue;
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(raw as MidiRollPlacement)) {
        next[loopId] = raw as MidiRollPlacement;
      }
    }
    base[id] = next;
  }
  return base;
}

export function mergePersistedMidiLoopRollPlacementWithLegacy(
  persistedRaw: unknown,
  layers: LayersState,
  legacyLayerMap: unknown,
  legacyRoll1: unknown,
  legacyRoll2: unknown,
): MidiLoopRollPlacementMap {
  const fromSaved = mergePersistedMidiLoopRollPlacement(persistedRaw);
  const legacy = legacyLayerRollPlacementFromPersist(
    legacyLayerMap,
    legacyRoll1,
    legacyRoll2,
  );
  if (!legacy) {
    return fromSaved;
  }
  const out = { ...fromSaved };
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

export function clampPersistedMidiPlayheadBeat(
  raw: unknown,
  beatLength: number,
): number {
  const len = Math.max(1e-6, beatLength);
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.min(Math.max(0, raw), len - 1e-6);
}

export function mergePersistedLayer(base: LayerState, stored: unknown): LayerState {
  if (!stored || typeof stored !== "object") {
    return base;
  }
  const storedObj = stored as Record<string, unknown>;
  const merged: LayerState & Record<string, unknown> = { ...base, ...storedObj };
  const mergedAny = merged as Record<string, unknown>;
  const legacyKnobs: { effect: LayerKnobEffect; value: number }[] = [];
  if (typeof storedObj.filter === "number") {
    legacyKnobs.push({ effect: "filter", value: storedObj.filter });
  }
  if (typeof storedObj.reverb === "number") {
    legacyKnobs.push({ effect: "reverb", value: storedObj.reverb });
  }
  const sourceKnobs =
    Array.isArray(merged.knobs) && merged.knobs.length > 0
      ? merged.knobs
      : legacyKnobs.length > 0
        ? legacyKnobs
        : base.knobs;
  merged.knobs = LAYER_KNOB_EFFECTS.map((effect) => {
    const raw = sourceKnobs.find((k) => k?.effect === effect)?.value;
    const fallback = base.knobs.find((k) => k.effect === effect)?.value ?? 0.5;
    return {
      effect,
      value:
        typeof raw === "number" && Number.isFinite(raw)
          ? Math.max(0, Math.min(1, raw))
          : fallback,
    };
  });
  delete mergedAny.filter;
  delete mergedAny.reverb;
  delete mergedAny.layerFx;
  delete mergedAny.extraKnobs;
  delete mergedAny.extraKnobValues;
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

export function mergePersistedLayers(stored: unknown): LayersState {
  const base = buildInitialLayers();
  if (!stored || typeof stored !== "object") {
    return base;
  }
  const storedObj = stored as Record<string, unknown>;
  return {
    A: mergePersistedLayer(base.A, storedObj.A),
    B: mergePersistedLayer(base.B, storedObj.B),
    C: mergePersistedLayer(base.C, storedObj.C),
    D: mergePersistedLayer(base.D, storedObj.D),
    E: mergePersistedLayer(base.E, storedObj.E),
  };
}
