export type LayerId = "A" | "B" | "C" | "D" | "E";
export const LAYER_IDS: LayerId[] = ["A", "B", "C", "D", "E"];
export type LayerLoopId = number;
export type LoopInstanceId = number;

export type LayerKnobEffect = "filter" | "reverb";

export type RepeatUnit = "measures" | "beats";

export interface LayerKnob {
  value: number;
  label: string;
}

export type LayerKnobsByEffect = Partial<Record<LayerKnobEffect, LayerKnob>>;

export interface SoundMapping {
  soundId: string | null;
  knobsByEffect: LayerKnobsByEffect;
}

export interface LoopNote {
  pitchClass: number;
  octave: number;
  /** Integer beat offset from loop definition beat 0. */
  beatIndex: number;
  /** Sub-beat offset within that beat; in [0, 1). */
  startInBeat: number;
  lengthInBeat: number;
}

/** Placed instance row (placement/repeat only). Definition and mapping are owned by LayerLoop. */
export interface LayerLoopInstance {
  id: LoopInstanceId;
  /** 0-indexed beat in the composition at which this instance starts. */
  startBeat: number;
  repeatUnit: RepeatUnit;
  repeatEveryMeasuresMemory: number | null;
  repeatEveryBeatsMemory: number | null;
  /** Exclusive end beat for repeats; repeats stop before reaching this beat. */
  repeatEndBeat: number | null;
}

/** Musical content shared across all instances of this loop. */
export interface LoopDefinition {
  spanBeats: number;
  notes: LoopNote[];
}

/**
 * Numbered layer loop (owns definition + mapping + ordered instances).
 */
export interface LayerLoop {
  id: LayerLoopId;
  definition: LoopDefinition;
  mapping: SoundMapping;
  knobOrder: LayerKnobEffect[];
  /** Instances keyed by id; sort by startBeat for timeline order. */
  loopInstances: Record<LoopInstanceId, LayerLoopInstance>;
}

export interface Layer {
  role: string;
  /** Layer output fader (0–1), separate from sound mapping. */
  volume: number;
  defaultMapping: SoundMapping;
  knobOrder: LayerKnobEffect[];
  layerLoops: Record<LayerLoopId, LayerLoop>;
}

/** Alias for saved layer row (same as `Layer`). */
export type LayerState = Layer;

export type LayersState = Record<LayerId, Layer>;
