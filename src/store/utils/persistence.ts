import { DEFAULT_LAYERS } from "./defaultLayers";
import type { LayersState } from "../../types/layer";
import type {
  MidiLayerPlacement,
  MidiLoopRollPlacementMap,
} from "../../types/midi";

export { DEFAULT_LAYERS };

export const LAYER_SCHEMA_VERSION = 2;

export function buildDefaultMidiLoopRollPlacement(): MidiLoopRollPlacementMap {
  return { A: {}, B: {}, C: {}, D: {}, E: {} };
}

export function buildDefaultMidiLayerPlacement(): MidiLayerPlacement {
  return { A: "both", B: "both", C: "both", D: "both", E: "both" };
}


export function clampPersistedMidiPlayheadBeat(
  raw: unknown,
  beatLength: number,
): number {
  const len = Math.max(1e-6, beatLength);
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.min(Math.max(0, raw), len - 1e-6);
}

export function mergePersistedLayers(stored: unknown): LayersState {
  if (!stored || typeof stored !== "object") return DEFAULT_LAYERS;
  const p = stored as Record<string, unknown>;
  if (p.schemaVersion !== LAYER_SCHEMA_VERSION) return DEFAULT_LAYERS;
  if (!p.layers || typeof p.layers !== "object") return DEFAULT_LAYERS;
  return p.layers as LayersState;
}
