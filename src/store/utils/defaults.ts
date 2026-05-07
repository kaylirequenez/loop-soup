import type { LayersState } from "../../types/layer";
import {
  SOUND_CATALOG,
  KNOB_LABELS,
  DEFAULT_SOUND_FOR_LAYER,
} from "../../audio/sounds";
import type { SoundId } from "../../audio/types";
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

function defaultKnobs(soundId: NonNullable<SoundId>) {
  const defaults = SOUND_CATALOG[soundId].defaultKnobs;
  return {
    attack: { value: defaults.attack, label: KNOB_LABELS.attack },
    decay: { value: defaults.decay, label: KNOB_LABELS.decay },
    sustain: { value: defaults.sustain, label: KNOB_LABELS.sustain },
    release: { value: defaults.release, label: KNOB_LABELS.release },
  };
}

const DEFAULT_KNOB_ORDER = ["attack", "decay", "sustain", "release"] as const;

const REPEAT_DEFAULTS = {
  repeatUnit: "measures" as const,
  repeatEveryMeasuresMemory: null,
  repeatEveryBeatsMemory: null,
};

function defaultInstance(startBeat: number, spanBeats: number) {
  return { startBeat, repeatCount: null, endBeat: startBeat + spanBeats };
}

const SAW = DEFAULT_SOUND_FOR_LAYER.A; // "sawtooth"
const SINE = DEFAULT_SOUND_FOR_LAYER.B; // "sine"
const TRI = DEFAULT_SOUND_FOR_LAYER.D; // "triangle"
const SQR = DEFAULT_SOUND_FOR_LAYER.E; // "square"

export const DEFAULT_LAYERS = {
  A: {
    role: "hook",
    volume: 0.7,
    defaultMapping: { soundId: SAW, knobsByEffect: defaultKnobs(SAW) },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: [
      {
        definition: {
          spanBeats: 1,
          notes: [
            {
              pitchClass: 4,
              octave: 4,
              beatIndex: 0,
              startInBeat: 0,
              lengthInBeat: 0.5,
            },
          ],
          ...REPEAT_DEFAULTS,
        },
        mapping: { soundId: SAW, knobsByEffect: defaultKnobs(SAW) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 1)],
      },
    ],
  },
  B: {
    role: "bass",
    volume: 0.7,
    defaultMapping: { soundId: SINE, knobsByEffect: defaultKnobs(SINE) },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: [
      {
        definition: {
          spanBeats: 2,
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
          ...REPEAT_DEFAULTS,
        },
        mapping: { soundId: SINE, knobsByEffect: defaultKnobs(SINE) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 2)],
      },
    ],
  },
  C: {
    role: "melody",
    volume: 0.7,
    defaultMapping: { soundId: SAW, knobsByEffect: defaultKnobs(SAW) },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: [
      {
        definition: {
          spanBeats: 3,
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
          ...REPEAT_DEFAULTS,
        },
        mapping: { soundId: SAW, knobsByEffect: defaultKnobs(SAW) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 3)],
      },
    ],
  },
  D: {
    role: "harmony",
    volume: 0.7,
    defaultMapping: { soundId: TRI, knobsByEffect: defaultKnobs(TRI) },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: [
      {
        definition: {
          spanBeats: 4,
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
          ...REPEAT_DEFAULTS,
        },
        mapping: { soundId: TRI, knobsByEffect: defaultKnobs(TRI) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 4)],
      },
    ],
  },
  E: {
    role: "drums",
    volume: 0.7,
    defaultMapping: { soundId: SQR, knobsByEffect: defaultKnobs(SQR) },
    knobOrder: [...DEFAULT_KNOB_ORDER],
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
        mapping: { soundId: SQR, knobsByEffect: defaultKnobs(SQR) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
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
        mapping: { soundId: SQR, knobsByEffect: defaultKnobs(SQR) },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(4, 2)],
      },
    ],
  },
} satisfies LayersState;
