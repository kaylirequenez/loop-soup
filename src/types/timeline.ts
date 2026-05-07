import type { LayerId } from "./layer";
import type { LoopNote } from "./layer";

/**
 * One materialized note occurrence on the composition timeline (absolute beats).
 * Not persisted — derived from `LayerLoop` + instances.
 *
 * When the source note has `lengthInBeat == null`, `absoluteEndBeat` is null; callers
 * supply their own end (e.g. playhead) for UI or playback.
 */
/** Horizontal placement as fractions of composition length ([0,1]). */
export interface TimelineNoteFractionRect {
  leftFract: number;
  widthFract: number;
}

/** A timeline note augmented with the source LoopNote needed to render it on a roll. */
export type RawRollNote = TimelineExpandedNote & {
  loopNote: LoopNote;
  reactKey: string;
  /** Array index of the loop within its layer's layerLoops. */
  loopIndex: number;
  /** Array index of the instance within its loop's loopInstances. */
  instanceIndex: number;
};

export interface TimelineExpandedNote {
  layerId: LayerId;
  /** Which repeat tile after `instance.startBeat` produced this row (`0` = base phrase). */
  repeatIndex: number;
  /** Beat offset added to `instance.startBeat` for this tile. */
  repeatOffsetBeats: number;
  /** Index into `loop.definition.notes`. */
  noteIndexInDefinition: number;
  absoluteStartBeat: number;
  /** null while the source note is still open (`lengthInBeat == null`). */
  absoluteEndBeat: number | null;
  /** True when source `lengthInBeat` was null (recording / open duration). */
  isActiveRecordingNote: boolean;
}
