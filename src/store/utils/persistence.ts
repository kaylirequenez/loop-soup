import { DEFAULT_LAYERS } from "./defaultLayers";
import type { LayersState } from "../../types/layer";
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

/** Trust persisted layer state as source of truth. */
export function mergePersistedLayers(stored: unknown): LayersState {
  if (!stored || typeof stored !== "object") return DEFAULT_LAYERS;
  const p = stored as Record<string, unknown>;
  return (p.layers as LayersState) ?? DEFAULT_LAYERS;
}
