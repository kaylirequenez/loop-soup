import { DEFAULT_LAYERS } from "./defaultLayers";
import type {
  LayerId,
  LayerLoop,
  LayerLoopInstance,
  LayersState,
  LoopDefinition,
  RepeatUnit,
} from "../../types/layer";
import type {
  MidiLayerPlacement,
  MidiLoopRollPlacementMap,
} from "../../types/midi";

export { DEFAULT_LAYERS };

export const LAYER_SCHEMA_VERSION = 4;

/** Builds empty per-layer loop placement maps for MIDI roll routing. */
export function buildDefaultMidiLoopRollPlacement(): MidiLoopRollPlacementMap {
  return { A: {}, B: {}, C: {}, D: {}, E: {} };
}

/** Builds default layer-level MIDI roll placement (`both` for all layers). */
export function buildDefaultMidiLayerPlacement(): MidiLayerPlacement {
  return { A: "both", B: "both", C: "both", D: "both", E: "both" };
}

/**
 * Purpose:
 * Safely clamps persisted playhead beat to current composition length.
 */
export function clampPersistedMidiPlayheadBeat(
  raw: unknown,
  beatLength: number,
): number {
  const len = Math.max(1e-6, beatLength);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(Math.max(0, raw), len - 1e-6);
}

/** Shape of loop/instance data from v2/v3 saves (record-keyed with id fields). */
type LegacyInstance = {
  id?: number;
  startBeat: number;
  repeatCount?: number | null;
  repeatUnit?: RepeatUnit;
  repeatEveryMeasuresMemory?: number | null;
  repeatEveryBeatsMemory?: number | null;
};

type LegacyLoop = {
  id?: number;
  definition: Partial<LoopDefinition> & { spanBeats: number | null; notes: unknown[] };
  mapping: unknown;
  knobOrder: unknown;
  loopInstances: Record<string, LegacyInstance> | LayerLoopInstance[];
  nextInstanceId?: number;
};

function isArrayInstances(v: unknown): v is LayerLoopInstance[] {
  return Array.isArray(v);
}

function normalizeLoop(raw: LegacyLoop): LayerLoop {
  // Normalize instances to array form
  let instances: LayerLoopInstance[];
  if (isArrayInstances(raw.loopInstances)) {
    instances = raw.loopInstances.map((inst) => ({
      startBeat: inst.startBeat,
      repeatCount: inst.repeatCount ?? null,
    }));
  } else {
    // v2/v3: record-keyed, sort by numeric key
    instances = Object.entries(raw.loopInstances)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, inst]) => ({
        startBeat: inst.startBeat,
        repeatCount: inst.repeatCount ?? null,
      }));
  }

  // Normalize repeat fields onto definition (v2 stored them on instances)
  const rawDef = raw.definition;
  let def: LoopDefinition;
  if (
    "repeatUnit" in rawDef &&
    "repeatEveryMeasuresMemory" in rawDef &&
    "repeatEveryBeatsMemory" in rawDef
  ) {
    def = {
      spanBeats: rawDef.spanBeats,
      notes: rawDef.notes as LoopDefinition["notes"],
      repeatUnit: rawDef.repeatUnit ?? "measures",
      repeatEveryMeasuresMemory: rawDef.repeatEveryMeasuresMemory ?? null,
      repeatEveryBeatsMemory: rawDef.repeatEveryBeatsMemory ?? null,
    };
  } else {
    // v2: promote repeat fields from lowest-id instance
    const donor = !isArrayInstances(raw.loopInstances)
      ? Object.values(raw.loopInstances).sort(
          (a, b) => (a.id ?? 0) - (b.id ?? 0),
        )[0]
      : undefined;
    def = {
      spanBeats: rawDef.spanBeats,
      notes: rawDef.notes as LoopDefinition["notes"],
      repeatUnit: donor?.repeatUnit ?? "measures",
      repeatEveryMeasuresMemory: donor?.repeatEveryMeasuresMemory ?? null,
      repeatEveryBeatsMemory: donor?.repeatEveryBeatsMemory ?? null,
    };
  }

  return {
    definition: def,
    mapping: raw.mapping as LayerLoop["mapping"],
    knobOrder: raw.knobOrder as LayerLoop["knobOrder"],
    loopInstances: instances,
  };
}

function migrateLayers(rawLayers: unknown): LayersState {
  const src = rawLayers as Record<string, unknown>;
  const next: LayersState = { ...DEFAULT_LAYERS };

  (Object.keys(next) as LayerId[]).forEach((layerId) => {
    const rawLayer = src[layerId] as Record<string, unknown> | undefined;
    if (!rawLayer) return;

    let loops: LayerLoop[];
    const rawLoops = rawLayer.layerLoops;
    if (Array.isArray(rawLoops)) {
      // v4: already an array
      loops = (rawLoops as LegacyLoop[]).map(normalizeLoop);
    } else if (rawLoops && typeof rawLoops === "object") {
      // v2/v3: record-keyed, sort by numeric key
      loops = Object.entries(rawLoops as Record<string, LegacyLoop>)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, loop]) => normalizeLoop(loop));
    } else {
      return;
    }

    next[layerId] = {
      ...(rawLayer as Layer),
      layerLoops: loops,
    } as LayersState[LayerId];
  });

  return next;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Layer = any;

/**
 * Purpose:
 * Accepts persisted layer payload and normalizes schema (v2/v3/v4 → current).
 *
 * Behavior:
 * - v2/v3: record-keyed loops and instances migrated to arrays.
 * - v4: already array-based, just normalized.
 * - Repeat spacing enforced on `LoopDefinition`.
 */
export function mergePersistedLayers(stored: unknown): LayersState {
  if (!stored || typeof stored !== "object") return DEFAULT_LAYERS;
  const p = stored as Record<string, unknown>;
  if (!p.layers || typeof p.layers !== "object") return DEFAULT_LAYERS;

  const version = p.schemaVersion;
  // Accept v2, v3, and v4; reject anything else
  if (version !== 2 && version !== 3 && version !== LAYER_SCHEMA_VERSION) {
    if (version == null) {
      // very old save, try to migrate
    } else {
      return DEFAULT_LAYERS;
    }
  }

  return migrateLayers(p.layers);
}
