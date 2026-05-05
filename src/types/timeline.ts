import type {
  LayerId,
  LayerLoopId,
  LoopInstanceId,
} from "./layer";

/**
 * One materialized note occurrence on the composition timeline (absolute beats).
 * Not persisted — derived from `LayerLoop` + instances.
 *
 * When the source note has `lengthInBeat == null`, `absoluteEndBeat` is null; callers
 * supply their own end (e.g. playhead) for UI or playback.
 */
export interface TimelineExpandedNote {
  layerId: LayerId;
  loopId: LayerLoopId;
  instanceId: LoopInstanceId;
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
