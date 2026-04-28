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
  /** Number of extra repeats after the base phrase. null = repeat to composition end. */
  repeatCount: number | null;
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
      repeatUnit?: RepeatUnit;
      repeatEveryMeasuresMemory?: number | null;
      repeatEveryBeatsMemory?: number | null;
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
  setLoopInstanceRepeatUnit: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    unit: RepeatUnit,
    beatsPerMeasure: number,
  ) => void;
  toggleLoopInstanceRepeatEvery: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    value: number,
    beatsPerMeasure: number,
  ) => void;
  setLoopInstanceStartBeat: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    startBeat: number,
  ) => void;
}
