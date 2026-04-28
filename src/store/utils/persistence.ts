import { DEFAULT_LAYERS } from "./defaultLayers";
import type { LayersState } from "../../types/layer";
import type {
  MidiLayerPlacement,
  MidiLoopRollPlacementMap,
} from "../../types/midi";

export { DEFAULT_LAYERS };

export const LAYER_SCHEMA_VERSION = 2;

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

/**
 * Purpose:
 * Accepts persisted layer payload only when schema/version and shape match.
 *
 * Behavior:
 * - Falls back to DEFAULT_LAYERS for invalid or stale payloads.
 */
export function mergePersistedLayers(stored: unknown): LayersState {
  if (!stored || typeof stored !== "object") return DEFAULT_LAYERS;
  const p = stored as Record<string, unknown>;
  if (p.schemaVersion !== LAYER_SCHEMA_VERSION) return DEFAULT_LAYERS;
  if (!p.layers || typeof p.layers !== "object") return DEFAULT_LAYERS;
  return p.layers as LayersState;
}
