import type { LayersState } from "../../types/layer";

const DEFAULT_KNOBS = {
  filter: { value: 0.8, label: "fltr" },
  reverb: { value: 0.2, label: "rvb" },
};

const DEFAULT_KNOB_ORDER = ["filter", "reverb"] as const;

export const DEFAULT_LAYERS = {
  A: {
    role: "hook",
    volume: 0.7,
    defaultMapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: {
      1: {
        id: 1,
        definition: {
          spanBeats: 1,
          notes: [
            { pitchClass: 4, octave: 4, beatIndex: 0, startInBeat: 0, lengthInBeat: 0.5 },
          ],
        },
        mapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 0, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
    },
  },
  B: {
    role: "bass",
    volume: 0.7,
    defaultMapping: { soundId: "sub bass", knobsByEffect: DEFAULT_KNOBS },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: {
      1: {
        id: 1,
        definition: {
          spanBeats: 2,
          notes: [
            { pitchClass: 0, octave: 1, beatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 10, octave: 1, beatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
          ],
        },
        mapping: { soundId: "sub bass", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 0, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
    },
  },
  C: {
    role: "melody",
    volume: 0.7,
    defaultMapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: {
      1: {
        id: 1,
        definition: {
          spanBeats: 3,
          notes: [
            { pitchClass: 4, octave: 4, beatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 6, octave: 4, beatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 7, octave: 4, beatIndex: 2, startInBeat: 0, lengthInBeat: 1 },
          ],
        },
        mapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 0, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
    },
  },
  D: {
    role: "harmony",
    volume: 0.7,
    defaultMapping: { soundId: "pad", knobsByEffect: DEFAULT_KNOBS },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: {
      1: {
        id: 1,
        definition: {
          spanBeats: 4,
          notes: [
            { pitchClass: 2, octave: 2, beatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 4, octave: 2, beatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 1, octave: 2, beatIndex: 2, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 3, octave: 2, beatIndex: 3, startInBeat: 0, lengthInBeat: 1 },
          ],
        },
        mapping: { soundId: "pad", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 0, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
    },
  },
  E: {
    role: "drums",
    volume: 0.7,
    defaultMapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
    knobOrder: [...DEFAULT_KNOB_ORDER],
    layerLoops: {
      1: {
        id: 1,
        definition: {
          spanBeats: 2,
          notes: [
            { pitchClass: 11, octave: 3, beatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 0, octave: 3, beatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
          ],
        },
        mapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 0, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
      2: {
        id: 2,
        definition: {
          spanBeats: 2,
          notes: [
            { pitchClass: 2, octave: 3, beatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
            { pitchClass: 1, octave: 3, beatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
          ],
        },
        mapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: {
          1: { id: 1, startBeat: 4, repeatUnit: "measures", repeatEveryMeasuresMemory: null, repeatEveryBeatsMemory: null, repeatCount: null },
        },
      },
    },
  },
} satisfies LayersState;
