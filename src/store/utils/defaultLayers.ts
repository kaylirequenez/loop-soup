import type { LayersState, LoopDefinition } from "../../types/layer";
import { endBeatFromRepeatCount } from "../../utils/loopInstanceUtils";

/** Matches initial `meter.beatsPerMeasure` in composition store (repeat step math only). */
const DEFAULT_BEATS_PER_MEASURE = 4;

const DEFAULT_KNOBS = {
  filter: { value: 0.8, label: "fltr" },
  reverb: { value: 0.2, label: "rvb" },
};

const DEFAULT_KNOB_ORDER = ["filter", "reverb"] as const;

const REPEAT_DEFAULTS = {
  repeatUnit: "measures" as const,
  repeatEveryMeasuresMemory: null,
  repeatEveryBeatsMemory: null,
};

function defaultDefinitionForSpan(spanBeats: number): LoopDefinition {
  return {
    spanBeats,
    notes: [],
    ...REPEAT_DEFAULTS,
  };
}

function defaultInstance(startBeat: number, spanBeats: number) {
  const proposed = { startBeat, repeatCount: null as number | null };
  return {
    ...proposed,
    endBeat: endBeatFromRepeatCount(
      proposed,
      defaultDefinitionForSpan(spanBeats),
      DEFAULT_BEATS_PER_MEASURE,
    ),
  };
}

export const DEFAULT_LAYERS = {
  A: {
    role: "hook",
    volume: 0.7,
    defaultMapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 1)],
      },
    ],
  },
  B: {
    role: "bass",
    volume: 0.7,
    defaultMapping: { soundId: "sub bass", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "sub bass", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 2)],
      },
    ],
  },
  C: {
    role: "melody",
    volume: 0.7,
    defaultMapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "synth lead", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 3)],
      },
    ],
  },
  D: {
    role: "harmony",
    volume: 0.7,
    defaultMapping: { soundId: "pad", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "pad", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(0, 4)],
      },
    ],
  },
  E: {
    role: "drums",
    volume: 0.7,
    defaultMapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
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
        mapping: { soundId: "electronic kit", knobsByEffect: DEFAULT_KNOBS },
        knobOrder: [...DEFAULT_KNOB_ORDER],
        loopInstances: [defaultInstance(4, 2)],
      },
    ],
  },
} satisfies LayersState;
