import type { LayerId, LayerLoopId } from "./layer";

export type OscillatorSoundId = "sawtooth" | "sine" | "triangle" | "square";
export type SamplerSoundId = "piano" | "casio";
export type PlayerSoundId = "kick" | "snare" | "hihat";
export type SoundId = OscillatorSoundId | SamplerSoundId | PlayerSoundId;
export type SoundCategory = "oscillator" | "sampler" | "player";

export interface VoiceHandle {
  frequency: { linearRampToValueAtTime(value: number, time: number): void };
}

export type KnobEffect =
  | "attack"
  | "decay"
  | "sustain"
  | "release"
  | "filterCutoff"
  | "filterResonance"
  | "drive"
  | "driveWet"
  | "reverbSend"
  | "delaySend"
  | "chorusDepth"
  | "chorusRate"
  | "phaserDepth"
  | "phaserRate"
  | "vibratoDepth"
  | "vibratoRate"
  | "autoFilterRate"
  | "autoFilterDepth"
  | "tremoloDepth"
  | "tremoloRate"
  | "bitCrusherBits"
  | "pitchDriftRange"
  | "portamento";

export type LayerMixEffect =
  | "eqLow"
  | "eqMid"
  | "eqHigh"
  | "compThreshold"
  | "compRatio"
  | "compAttack"
  | "compRelease";

export interface LayerKnob {
  value: number;
  label: string;
}

export type LayerKnobsByEffect = Partial<Record<KnobEffect, LayerKnob>>;
export type LayerMixKnobs = Partial<Record<LayerMixEffect, LayerKnob>>;

export interface SoundMapping {
  soundId: SoundId;
  mix: LoopMixState;
  knobsByEffect: LayerKnobsByEffect;
}

export interface EnvelopeState {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterState {
  cutoff: number;
  resonance: number;
}

export interface LoopSendState {
  reverb: number;
  delay: number;
}

export interface LoopMixState {
  volume: number;
  pan: number;
}

export type LoopEffect =
  | { type: "distortion"; drive: number; mix: number }
  | { type: "chorus"; depth: number; rate: number }
  | { type: "phaser"; depth: number; rate: number }
  | { type: "vibrato"; depth: number; rate: number }
  | { type: "autoFilter"; depth: number; rate: number }
  | { type: "tremolo"; depth: number; rate: number }
  | { type: "bitCrusher"; amount: number };

export type LoopEffectType = LoopEffect["type"];

export interface LoopSoundState {
  soundId: SoundId;
  mix: LoopMixState;
  envelope: EnvelopeState;
  filter: FilterState;
  sends: LoopSendState;
  portamento: number;
  pitchDrift: number;
  effects: LoopEffect[];
}

export type LoopSoundKey = `${LayerId}:${LayerLoopId}`;
export type LayerVolumeState = Record<LayerId, number>;
export type LayerMixState = Record<LayerId, LayerMixKnobs>;
export type LayerDefaultSoundState = Record<LayerId, LoopSoundState>;
export type LoopSoundStateByKey = Record<LoopSoundKey, LoopSoundState>;

export interface SoundStoreState {
  layerVolumes: LayerVolumeState;
  layerMixKnobs: LayerMixState;
  layerDefaults: LayerDefaultSoundState;
  loopSounds: LoopSoundStateByKey;

  getLayerVolume: (layerId: LayerId) => number;
  getLayerMixKnobs: (layerId: LayerId) => LayerMixKnobs;
  getLayerDefaultSound: (layerId: LayerId) => LoopSoundState;
  getLoopSound: (layerId: LayerId, loopId: LayerLoopId) => LoopSoundState;
  getLayerDefaultMapping: (layerId: LayerId) => SoundMapping;
  getLoopMapping: (layerId: LayerId, loopId: LayerLoopId) => SoundMapping;

  setLayerVolume: (layerId: LayerId, volume: number) => void;
  setLayerSoundId: (layerId: LayerId, soundId: SoundId) => void;
  setLayerKnobValue: (
    layerId: LayerId,
    effect: KnobEffect,
    value: number,
  ) => void;
  setLayerMixKnobValue: (
    layerId: LayerId,
    effect: LayerMixEffect,
    value: number,
  ) => void;
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
  setLoopVolume: (
    layerId: LayerId,
    loopId: LayerLoopId,
    volume: number,
  ) => void;
  setLoopPan: (layerId: LayerId, loopId: LayerLoopId, pan: number) => void;
  createLoopMappingFromLayerDefault: (
    layerId: LayerId,
    loopId: LayerLoopId,
  ) => void;
  duplicateLoopMapping: (
    layerId: LayerId,
    sourceLoopId: LayerLoopId,
    nextLoopId: LayerLoopId,
  ) => void;
  deleteLoopMapping: (layerId: LayerId, loopId: LayerLoopId) => void;
  addLoopEffect: (layerId: LayerId, loopId: LayerLoopId, effectType: LoopEffectType) => void;
  removeLoopEffect: (layerId: LayerId, loopId: LayerLoopId, effectType: LoopEffectType) => void;
}
