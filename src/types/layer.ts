import type { KnobEffect, SoundId } from "../audio/types";

export type { KnobEffect, SoundId };

export type LayerId = "A" | "B" | "C" | "D" | "E";
export const LAYER_IDS: LayerId[] = ["A", "B", "C", "D", "E"];
export type LayerLoopId = number;
export type LoopInstanceId = number;

export type RepeatUnit = "measures" | "beats";

export interface LoopInstanceCompositionDims {
  beatsPerMeasure: number;
  compositionEndBeat: number;
}

export interface LayerKnob {
  value: number;
  label: string;
}

export type LayerKnobsByEffect = Partial<Record<KnobEffect, LayerKnob>>;

export interface SoundMapping {
  soundId: SoundId;
  knobsByEffect: LayerKnobsByEffect;
}

export interface LoopNote {
  pitchClass: number;
  octave: number;
  /** Integer beat offset from loop definition beat 0. */
  beatIndex: number;
  /** Sub-beat offset within that beat; in [0, 1). */
  startInBeat: number;
  /** null while the note is still being recorded (duration unknown). */
  lengthInBeat: number | null;
  /** Optional note intensity in [0, 1]. Defaults to 1 when omitted. */
  velocity?: number;
}

/** Placed instance row (placement + per-instance repeat count only). Shared repeat spacing lives on `LoopDefinition`. */
export interface LayerLoopInstance {
  /** 0-indexed beat in the composition at which this instance starts. */
  startBeat: number;
  /** Number of extra repeats after the base phrase. null = repeat to composition end. */
  repeatCount: number | null;
  /**
   * Precomputed end beat. When repeatCount is not null, derived from startBeat + repeatCount * step + spanBeats.
   * When null, bounded by composition end at the time of last update.
   * Set to -1 for the in-progress recording instance (spanBeats not yet known).
   */
  endBeat: number | null;
}

/** Musical content shared across all instances of this loop. */
export interface LoopDefinition {
  /** null while the loop is still being recorded (span not finalized). */
  spanBeats: number | null;
  notes: LoopNote[];
  /** Shared by all instances of this loop (not per-instance). */
  repeatUnit: RepeatUnit;
  repeatEveryMeasuresMemory: number | null;
  repeatEveryBeatsMemory: number | null;
}

/**
 * Numbered layer loop (owns definition + mapping + ordered instances).
 */
export interface LayerLoop {
  definition: LoopDefinition;
  mapping: SoundMapping;
  knobOrder: KnobEffect[];
  /** Instances in placement order (index = instance id). */
  loopInstances: LayerLoopInstance[];
}

export interface Layer {
  role: string;
  /** Layer output fader (0–1), separate from sound mapping. */
  volume: number;
  defaultMapping: SoundMapping;
  knobOrder: KnobEffect[];
  /** Loops in creation order (index = loop id). */
  layerLoops: LayerLoop[];
}

export type LayersState = Record<LayerId, Layer>;

export interface LayerStoreState {
  /** Saved layer project data keyed by layer id. */
  layers: LayersState;

  setLayerVolume: (id: LayerId, volume: number) => void;
  setLayerSoundId: (id: LayerId, soundId: SoundId) => void;
  setLayerKnobValue: (
    id: LayerId,
    effect: KnobEffect,
    value: number,
  ) => void;
  addLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    startBeat: number,
    compositionDims: LoopInstanceCompositionDims,
    reference?: LayerLoopInstance[] | null,
  ) => void;
  deleteLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
  ) => void;
  duplicateLoop: (layerId: LayerId, loopId: LayerLoopId) => void;
  clearLoopInstances: (layerId: LayerId, loopId: LayerLoopId) => void;
  setLoopSoundId: (
    layerId: LayerId,
    loopId: LayerLoopId,
    soundId: SoundId,
  ) => void;
  setLoopKnobValue: (
    layerId: LayerId,
    loopId: LayerLoopId,
    effect: KnobEffect,
    value: number,
  ) => void;
  shiftLoopNotesOctave: (
    layerId: LayerId,
    loopId: LayerLoopId,
    delta: number,
  ) => void;
  setLoopRepeatUnit: (
    layerId: LayerId,
    loopId: LayerLoopId,
    unit: RepeatUnit,
    compositionDims: LoopInstanceCompositionDims,
  ) => void;
  setLoopRepeatEvery: (
    layerId: LayerId,
    loopId: LayerLoopId,
    value: number | null,
    compositionDims: LoopInstanceCompositionDims,
  ) => void;
  /** Sets repeatCount on a single instance. Pass null for open-ended (fills to composition end); pass a number to cap at that many repeats (clamped to what fits). */
  setInstanceRepeatCount: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    repeatCount: number | null,
    compositionDims: LoopInstanceCompositionDims,
  ) => void;
  /**
   * Applies a pre-validated instance array directly — no re-validation.
   * The hook computes and finalizes the array before calling this.
   */
  commitInstanceEdits: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instances: LayerLoopInstance[],
  ) => void;
  addNewLoop: (layerId: LayerId) => void;
  deleteLoop: (layerId: LayerId, loopId: LayerLoopId) => void;
  addLoopNote: (
    layerId: LayerId,
    loopId: LayerLoopId,
    pitchClass: number,
    octave: number,
    absoluteStartBeat: number,
  ) => void;
  endLoopNote: (
    layerId: LayerId,
    loopId: LayerLoopId,
    absoluteEndBeat: number,
  ) => void;
  finalizeLoop: (
    layerId: LayerId,
    loopId: LayerLoopId,
    endBeat: number,
  ) => void;

  /** Composition length shrank: truncate/fit only. */
  trimInstancesToComposition: (compositionDims: LoopInstanceCompositionDims) => void;
  /** Composition length grew: expand only last row if possible. */
  expandInstancesToComposition: (compositionDims: LoopInstanceCompositionDims) => void;
}
