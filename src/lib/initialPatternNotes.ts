import { defaultLoopOctaveForLayerId } from "./loopModel";
import type { LayerId, LoopNote } from "../types/model";

/**
 * Demo / seed pattern: loop-local beats (same shape as prior MidiRoll BASE_PATTERN_NOTES).
 * Octave is assigned per note when building initial layer loops.
 */
const DEMO_PATTERN_BASE = [
  { layer: "B", loopIndex: 0, pitchClass: 0, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
  { layer: "E", loopIndex: 0, pitchClass: 0, localBeatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
  { layer: "D", loopIndex: 0, pitchClass: 1, localBeatIndex: 2, startInBeat: 0, lengthInBeat: 1 },
  { layer: "E", loopIndex: 1, pitchClass: 1, localBeatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
  { layer: "D", loopIndex: 0, pitchClass: 2, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
  { layer: "E", loopIndex: 1, pitchClass: 2, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
  { layer: "D", loopIndex: 0, pitchClass: 3, localBeatIndex: 3, startInBeat: 0, lengthInBeat: 1 },
  { layer: "A", loopIndex: 0, pitchClass: 4, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 0.5 },
  { layer: "C", loopIndex: 0, pitchClass: 4, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
  { layer: "D", loopIndex: 0, pitchClass: 4, localBeatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
  { layer: "C", loopIndex: 0, pitchClass: 6, localBeatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
  { layer: "C", loopIndex: 0, pitchClass: 7, localBeatIndex: 2, startInBeat: 0, lengthInBeat: 1 },
  { layer: "B", loopIndex: 0, pitchClass: 10, localBeatIndex: 1, startInBeat: 0, lengthInBeat: 1 },
  { layer: "E", loopIndex: 0, pitchClass: 11, localBeatIndex: 0, startInBeat: 0, lengthInBeat: 1 },
];

/**
 * Notes for one layer loop, with per-note octave matching previous per-loop default for that layer.
 */
export function initialNotesForLayerLoop(
  layerId: LayerId,
  loopIndex: number,
): LoopNote[] {
  const oct = defaultLoopOctaveForLayerId(layerId);
  return DEMO_PATTERN_BASE.filter(
    (n) => n.layer === layerId && (n.loopIndex ?? 0) === loopIndex,
  ).map((n) => ({
    pitchClass: n.pitchClass,
    localBeatIndex: n.localBeatIndex,
    startInBeat: n.startInBeat ?? 0,
    lengthInBeat: n.lengthInBeat ?? 1,
    octave: oct,
  }));
}
