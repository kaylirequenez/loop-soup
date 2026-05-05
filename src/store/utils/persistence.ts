import { DEFAULT_LAYERS } from "./defaultLayers";
import type {
  LayerId,
  LayerLoop,
  LayerLoopInstance,
  LayersState,
  LoopDefinition,
  LoopInstanceId,
  RepeatUnit,
} from "../../types/layer";
import type {
  MidiLayerPlacement,
  MidiLoopRollPlacementMap,
} from "../../types/midi";

export { DEFAULT_LAYERS };

export const LAYER_SCHEMA_VERSION = 3;

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

type LegacyLoopInstance = LayerLoopInstance & {
  repeatUnit?: RepeatUnit;
  repeatEveryMeasuresMemory?: number | null;
  repeatEveryBeatsMemory?: number | null;
};

function repeatFieldsLiveOnDefinition(def: LoopDefinition): boolean {
  return (
    "repeatUnit" in def &&
    "repeatEveryMeasuresMemory" in def &&
    "repeatEveryBeatsMemory" in def
  );
}

function normalizeLoop(loop: LayerLoop): LayerLoop {
  const rawInstances = Object.values(loop.loopInstances) as LegacyLoopInstance[];
  let def = loop.definition;

  if (!repeatFieldsLiveOnDefinition(def)) {
    const sorted = [...rawInstances].sort((a, b) => a.id - b.id);
    const donor = sorted[0];
    def = {
      ...def,
      repeatUnit: donor?.repeatUnit ?? "measures",
      repeatEveryMeasuresMemory:
        donor?.repeatEveryMeasuresMemory ?? null,
      repeatEveryBeatsMemory: donor?.repeatEveryBeatsMemory ?? null,
    };
  } else {
    def = {
      ...def,
      repeatUnit: def.repeatUnit ?? "measures",
      repeatEveryMeasuresMemory: def.repeatEveryMeasuresMemory ?? null,
      repeatEveryBeatsMemory: def.repeatEveryBeatsMemory ?? null,
    };
  }

  const loopInstances = Object.fromEntries(
    rawInstances.map((inst) => [
      inst.id as LoopInstanceId,
      {
        id: inst.id,
        startBeat: inst.startBeat,
        repeatCount: inst.repeatCount ?? null,
      } satisfies LayerLoopInstance,
    ]),
  );

  return {
    ...loop,
    definition: def,
    loopInstances,
  };
}

function migrateLayers(layers: LayersState): LayersState {
  const next: LayersState = { ...layers };
  (Object.keys(next) as LayerId[]).forEach((layerId) => {
    const layer = next[layerId];
    const layerLoops = { ...layer.layerLoops };
    for (const lid of Object.keys(layerLoops).map(Number)) {
      layerLoops[lid] = normalizeLoop(layerLoops[lid]);
    }
    next[layerId] = { ...layer, layerLoops };
  });
  return next;
}

/**
 * Purpose:
 * Accepts persisted layer payload and normalizes schema (including v2 → v3).
 *
 * Behavior:
 * - Repeat spacing (`repeatUnit`, repeat-every memories) is enforced on `LoopDefinition`.
 * - Instances keep only `startBeat` and `repeatCount`.
 * - v2 payloads migrate repeat settings from the lowest-id instance onto the definition.
 */
export function mergePersistedLayers(stored: unknown): LayersState {
  if (!stored || typeof stored !== "object") return DEFAULT_LAYERS;
  const p = stored as Record<string, unknown>;
  if (!p.layers || typeof p.layers !== "object") return DEFAULT_LAYERS;

  let version = p.schemaVersion;
  if (version !== 2 && version !== LAYER_SCHEMA_VERSION) {
    // Older saves may omit schemaVersion while still carrying `layers`.
    if (version == null) version = 2;
    else return DEFAULT_LAYERS;
  }

  return migrateLayers(p.layers as LayersState);
}
