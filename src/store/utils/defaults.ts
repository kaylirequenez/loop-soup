import type { LayerId, LayersState, LoopNote } from "../../types/layer";
import {
  KNOB_SPECS,
  MIX_KNOB_SPECS,
} from "../../sound/soundSpecs";
import { mappingToLoopSound } from "../../sound/soundMapping";
import type {
  LayerDefaultSoundState,
  LayerMixState,
  LayerVolumeState,
  LoopSoundStateByKey,
  SoundMapping,
  SoundId,
} from "../../types/sound";
import type {
  MidiLoopRollPlacementMap,
  MidiLayerPlacement,
} from "../../types/midi";

export const DEFAULT_MIDI_LOOP_ROLL_PLACEMENT: MidiLoopRollPlacementMap = {
  A: {},
  B: {},
  C: {},
  D: {},
  E: {},
};
export const DEFAULT_MIDI_LAYER_PLACEMENT: MidiLayerPlacement = {
  A: "both",
  B: "both",
  C: "both",
  D: "both",
  E: "both",
};

function defaultMapping(soundId: SoundId): SoundMapping {
  return {
    soundId,
    mix: {
      volume: 0.7,
      pan: 0.5,
    },
    knobsByEffect: {
      attack: { value: 0, label: KNOB_SPECS.attack.label },
      decay: { value: 0.3, label: KNOB_SPECS.decay.label },
      sustain: { value: 0.5, label: KNOB_SPECS.sustain.label },
      release: { value: 0.4, label: KNOB_SPECS.release.label },
      filterCutoff: { value: 1, label: KNOB_SPECS.filterCutoff.label },
      filterResonance: { value: 0, label: KNOB_SPECS.filterResonance.label },
      drive: { value: 0, label: KNOB_SPECS.drive.label },
      driveWet: { value: 0, label: KNOB_SPECS.driveWet.label },
      reverbSend: { value: 0.12, label: KNOB_SPECS.reverbSend.label },
      delaySend: { value: 0.08, label: KNOB_SPECS.delaySend.label },
      chorusDepth: { value: 0, label: KNOB_SPECS.chorusDepth.label },
      chorusRate: { value: 0, label: KNOB_SPECS.chorusRate.label },
      phaserDepth: { value: 0, label: KNOB_SPECS.phaserDepth.label },
      phaserRate: { value: 0, label: KNOB_SPECS.phaserRate.label },
      vibratoDepth: { value: 0, label: KNOB_SPECS.vibratoDepth.label },
      vibratoRate: { value: 0, label: KNOB_SPECS.vibratoRate.label },
      autoFilterRate: { value: 0, label: KNOB_SPECS.autoFilterRate.label },
      autoFilterDepth: { value: 0, label: KNOB_SPECS.autoFilterDepth.label },
      tremoloDepth: { value: 0, label: KNOB_SPECS.tremoloDepth.label },
      tremoloRate: { value: 0, label: KNOB_SPECS.tremoloRate.label },
      bitCrusherBits: { value: 0, label: KNOB_SPECS.bitCrusherBits.label },
      pitchDriftRange: { value: 0, label: KNOB_SPECS.pitchDriftRange.label },
      portamento: { value: 0, label: KNOB_SPECS.portamento.label },
    },
  };
}

function defaultMixKnobs() {
  return {
    eqLow: { value: 0.5, label: MIX_KNOB_SPECS.eqLow.label },
    eqMid: { value: 0.5, label: MIX_KNOB_SPECS.eqMid.label },
    eqHigh: { value: 0.5, label: MIX_KNOB_SPECS.eqHigh.label },
    compThreshold: { value: 1.0, label: MIX_KNOB_SPECS.compThreshold.label },
    compRatio: { value: 0.0, label: MIX_KNOB_SPECS.compRatio.label },
    compAttack: { value: 0.2, label: MIX_KNOB_SPECS.compAttack.label },
    compRelease: { value: 0.3, label: MIX_KNOB_SPECS.compRelease.label },
  };
}

export const DEFAULT_PAGE_ORDER = ["Filter", "Send", "Synth"];

const REPEAT_DEFAULTS = {
  repeatUnit: "measures" as const,
  repeatEveryMeasuresMemory: null,
  repeatEveryBeatsMemory: null,
};

function defaultInstance(startBeat: number, spanBeats: number) {
  return { startBeat, repeatCount: null, endBeat: startBeat + spanBeats };
}

const DEFAULT_SOUNDS: Record<LayerId, SoundId> = {
  A: "sawtooth",
  B: "sine",
  C: "sawtooth",
  D: "triangle",
  E: "square",
};

function defaultLayer(overrides: {
  role: string;
  loops: { spanBeats: number; notes: LoopNote[]; startBeat: number }[];
}) {
  return {
    role: overrides.role,
    layerLoops: overrides.loops.map(({ spanBeats, notes, startBeat }) => ({
      definition: { spanBeats, notes, ...REPEAT_DEFAULTS },
      pageOrder: [...DEFAULT_PAGE_ORDER],
      loopInstances: [defaultInstance(startBeat, spanBeats)],
    })),
  };
}

export const DEFAULT_LAYERS: LayersState = {
  A: defaultLayer({
    role: "hook",
    loops: [
      {
        spanBeats: 1,
        startBeat: 0,
        notes: [
          {
            pitchClass: 4,
            octave: 4,
            beatIndex: 0,
            startInBeat: 0,
            lengthInBeat: 0.5,
          },
        ],
      },
    ],
  }),
  B: defaultLayer({
    role: "bass",
    loops: [
      {
        spanBeats: 2,
        startBeat: 0,
        notes: [
          {
            pitchClass: 0,
            octave: 1,
            beatIndex: 0,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 10,
            octave: 1,
            beatIndex: 1,
            startInBeat: 0,
            lengthInBeat: 1,
          },
        ],
      },
    ],
  }),
  C: defaultLayer({
    role: "melody",
    loops: [
      {
        spanBeats: 3,
        startBeat: 0,
        notes: [
          {
            pitchClass: 4,
            octave: 4,
            beatIndex: 0,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 6,
            octave: 4,
            beatIndex: 1,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 7,
            octave: 4,
            beatIndex: 2,
            startInBeat: 0,
            lengthInBeat: 1,
          },
        ],
      },
    ],
  }),
  D: defaultLayer({
    role: "harmony",
    loops: [
      {
        spanBeats: 4,
        startBeat: 0,
        notes: [
          {
            pitchClass: 2,
            octave: 2,
            beatIndex: 0,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 4,
            octave: 2,
            beatIndex: 1,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 1,
            octave: 2,
            beatIndex: 2,
            startInBeat: 0,
            lengthInBeat: 1,
          },
          {
            pitchClass: 3,
            octave: 2,
            beatIndex: 3,
            startInBeat: 0,
            lengthInBeat: 1,
          },
        ],
      },
    ],
  }),
  E: {
    ...defaultLayer({
      role: "drums",
      loops: [],
    }),
    layerLoops: [
      {
        definition: {
          spanBeats: 2,
          notes: [
            {
              pitchClass: 11,
              octave: 3,
              beatIndex: 0,
              startInBeat: 0,
              lengthInBeat: 1,
            },
            {
              pitchClass: 0,
              octave: 3,
              beatIndex: 1,
              startInBeat: 0,
              lengthInBeat: 1,
            },
          ],
          ...REPEAT_DEFAULTS,
        },
        pageOrder: [...DEFAULT_PAGE_ORDER],
        loopInstances: [defaultInstance(0, 2)],
      },
      {
        definition: {
          spanBeats: 2,
          notes: [
            {
              pitchClass: 2,
              octave: 3,
              beatIndex: 0,
              startInBeat: 0,
              lengthInBeat: 1,
            },
            {
              pitchClass: 1,
              octave: 3,
              beatIndex: 1,
              startInBeat: 0,
              lengthInBeat: 1,
            },
          ],
          ...REPEAT_DEFAULTS,
        },
        pageOrder: [...DEFAULT_PAGE_ORDER],
        loopInstances: [defaultInstance(4, 2)],
      },
    ],
  },
};

export const DEFAULT_LAYER_VOLUMES: LayerVolumeState = {
  A: 0.7,
  B: 0.7,
  C: 0.7,
  D: 0.7,
  E: 0.7,
};

export const DEFAULT_LAYER_MIX_KNOBS: LayerMixState = {
  A: defaultMixKnobs(),
  B: defaultMixKnobs(),
  C: defaultMixKnobs(),
  D: defaultMixKnobs(),
  E: defaultMixKnobs(),
};

export const DEFAULT_LAYER_SOUND_DEFAULTS: LayerDefaultSoundState = {
  A: mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.A)),
  B: mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.B)),
  C: mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.C)),
  D: mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.D)),
  E: mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.E)),
};

export const DEFAULT_LOOP_SOUNDS: LoopSoundStateByKey = {
  "A:0": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.A)),
  "B:0": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.B)),
  "C:0": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.C)),
  "D:0": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.D)),
  "E:0": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.E)),
  "E:1": mappingToLoopSound(defaultMapping(DEFAULT_SOUNDS.E)),
};
