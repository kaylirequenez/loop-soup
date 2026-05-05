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
  /** null while the note is still being recorded (duration unknown). */
  lengthInBeat: number | null;
}

/** Placed instance row (placement + per-instance repeat count only). Shared repeat spacing lives on `LoopDefinition`. */
export interface LayerLoopInstance {
  id: LoopInstanceId;
  /** 0-indexed beat in the composition at which this instance starts. */
  startBeat: number;
  /** Number of extra repeats after the base phrase. null = repeat to composition end. */
  repeatCount: number | null;
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

export type LayersState = Record<LayerId, Layer>;

export interface LayerStoreState {
  /** Saved layer project data keyed by layer id. */
  layers: LayersState;

  setLayerVolume: (id: LayerId, volume: number) => void;
  setLayerSoundId: (id: LayerId, soundId: string | null) => void;
  setLayerKnobValue: (
    id: LayerId,
    effect: LayerKnobEffect,
    value: number,
  ) => void;
  addLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    loopInstance: {
      id: LoopInstanceId;
      startBeat: number;
      repeatCount?: number | null;
    },
  ) => void;
  duplicateLoopInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    sourceLoopInstanceId: LoopInstanceId,
    nextLoopInstanceId: LoopInstanceId,
    nextStartBeat: number,
  ) => void;
  setLoopSoundId: (
    layerId: LayerId,
    loopId: LayerLoopId,
    soundId: string | null,
  ) => void;
  setLoopKnobValue: (
    layerId: LayerId,
    loopId: LayerLoopId,
    effect: LayerKnobEffect,
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
    beatsPerMeasure: number,
  ) => void;
  toggleLoopRepeatEvery: (
    layerId: LayerId,
    loopId: LayerLoopId,
    value: number,
  ) => void;
  setLoopInstanceStartBeat: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    startBeat: number,
  ) => void;
  addNewLoop: (layerId: LayerId) => void;
  deleteLastLoop: (layerId: LayerId) => void;
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
}
