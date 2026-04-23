import type { LoopDefinitionId, LoopInstanceId, LoopNote } from "./loop";

export type LayerId = "A" | "B" | "C" | "D" | "E";
export type LayerLoopId = string;

/** @deprecated Prefer `LayerLoopId`; kept for gradual renames in MIDI helpers. */
export type LoopId = LayerLoopId;

export type LayerKnobEffect = "filter" | "reverb";

export interface LayerKnob {
  value: number;
  label: string;
}

export type LayerKnobsByEffect = Partial<Record<LayerKnobEffect, LayerKnob>>;

export interface SoundMapping {
  soundId: string | null;
  knobsByEffect: LayerKnobsByEffect;
}

/** Placed instance row (placement/repeat only). Mapping + definition are owned by LayerLoop. */
export interface LayerLoopInstance {
  id: LoopInstanceId;
  startMeasure: number;
  repeatUnit: "measures" | "beats";
  repeatEveryMeasuresMemory: number | null;
  repeatEveryBeatsMemory: number | null;
  repeatEndMeasure: number | null;
}

/**
 * Numbered layer loop (owns mapping + one shared loop definition + ordered instances).
 */
export interface LayerLoop {
  id: LayerLoopId;
  loopDefinitionId: LoopDefinitionId;
  mapping: SoundMapping;
  knobOrder: LayerKnobEffect[];
  /** Ordered map: insertion order reflects loop timeline ordering for this loop's instances. */
  loopInstances: Record<LoopInstanceId, LayerLoopInstance>;
}

/**
 * Denormalized row used by timeline/repeat/MIDI math when operating on one placed instance.
 * This is derived runtime data; not persisted.
 */
export interface LayerLoopInstanceRow {
  loopId: LayerLoopId;
  loopInstanceId: LoopInstanceId;
  startMeasure: number;
  repeatUnit: "measures" | "beats";
  repeatEveryMeasuresMemory: number | null;
  repeatEveryBeatsMemory: number | null;
  repeatEndMeasure: number | null;
  spanBeats: number;
  notes: LoopNote[];
}

export interface Layer {
  /** Layer output fader (0–1), separate from sound mapping. */
  volume: number;
  defaultMapping: SoundMapping;
  knobOrder: LayerKnobEffect[];
  /** Numbered loops keyed by loop id. */
  layerLoops: Record<LayerLoopId, LayerLoop>;
}

/** Alias for saved layer row (same as `Layer`). */
export type LayerState = Layer;

export type LayersState = Record<LayerId, Layer>;
