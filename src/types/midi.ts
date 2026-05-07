import type { LayerId, LayerLoopId, LoopInstanceId, LoopNote } from "./layer";

export type RollSlot = 1 | 2;

export type MidiRollPlacement = "1" | "2" | "both";

/** Per-layer agreed placement, or null when loops have mixed placements. */
export type MidiLayerPlacement = Record<LayerId, MidiRollPlacement | null>;

/** Sparse per-loop map per layer. Missing loop keys default to `"both"` at read time. */
export type MidiLoopRollPlacementMap = Record<
  LayerId,
  Partial<Record<LayerLoopId, MidiRollPlacement>>
>;

export interface MidiStoreState {
  /** Number of visible roll panes (1 or 2). */
  midiRollCount: number;
  /** When true, split notes by octave around composition root instead of placement map. */
  midiRollSplitByRootOctave: boolean;
  /** Number of measures currently visible in the roll viewport. */
  midiMeasuresVisible: number;
  /** Per-layer/per-loop assignment to roll slot(s). */
  midiLoopRollPlacement: MidiLoopRollPlacementMap;
  /** Layer-level placement summary (`null` when loops are mixed). */
  midiLayerPlacement: MidiLayerPlacement;

  toggleSecondRoll: () => void;
  setMidiRollSplitByRootOctave: (enabled: boolean) => void;
  setMidiMeasuresVisible: (value: number) => void;
  setMidiLayerRollPlacement: (
    layerId: LayerId,
    placement: MidiRollPlacement,
  ) => void;
  setMidiLoopRollPlacement: (
    layerId: LayerId,
    loopId: LayerLoopId,
    placement: MidiRollPlacement,
  ) => void;
  isNoteOnRoll: (
    layerId: LayerId,
    loopId: LayerLoopId,
    storedOctave: number,
    rollSlot: RollSlot,
  ) => boolean;
}

export interface CombinedNoteEvent extends LoopNote {
  /** Layer this note belongs to (A-E). */
  layer: LayerId;
  /** 0-based loop index within the layer's ordered loops. */
  loopIndex: number;
  /** Stable loop id in layer storage. */
  layerLoopId: LayerLoopId;
  /** Stable instance id in layer storage. */
  loopInstanceId: LoopInstanceId;
  /** 0-based note index inside the loop definition note array. */
  noteIndex: number;
  /** Effective octave used for roll split/routing decisions. */
  storedOctave: number;
  /** Stable-ish render key including layer/loop/instance/note timing details. */
  noteKey: string;
  /** Repeat offset (in beats) relative to instance.startBeat that produced this copy. */
  instanceOffset: number;
  /** Absolute composition beat at note start (includes sub-beat). */
  globalStart: number;
  /** Absolute composition beat at note end (exclusive). */
  globalEnd: number;
  /** MIDI-roll row index after key-relative pitch mapping (0..11). */
  rowIndex: number;
}
