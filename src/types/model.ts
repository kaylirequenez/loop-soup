export type LayerId = "A" | "B" | "C" | "D" | "E";

export type LoopId = string;

export type AppView = "layers" | "midi" | "dual";

export type MidiRollPlacement = "1" | "2" | "both";

export type LayerKnobEffect = "filter" | "reverb";

export interface LayerKnob {
  effect: LayerKnobEffect;
  value: number;
}

export interface LoopNote {
  pitchClass: number;
  octave: number;
  localBeatIndex: number;
  startInBeat?: number;
  lengthInBeat?: number;
}

export interface LayerLoop {
  id: LoopId;
  startMeasure: number;
  spanBeats: number;
  repeatUnit: "measures" | "beats";
  repeatEveryMeasuresMemory: number | null;
  repeatEveryBeatsMemory: number | null;
  repeatEndMeasure: number | null;
  notes: LoopNote[];
}

export interface LayerState {
  sound: string | null;
  volume: number;
  knobs: LayerKnob[];
  muted: boolean;
  activeLoopIndex: number;
  loops: LayerLoop[];
}

export type LayersState = Record<LayerId, LayerState>;

export type MidiNoteSelection = { layerId: LayerId; loopId: LoopId } | null;

export type MidiLoopEditMode = { layerId: LayerId; loopId: LoopId } | null;

/** Sparse per-loop map per layer. Missing loop keys default to `"both"`. */
export type MidiLoopRollPlacementMap = Record<
  LayerId,
  Partial<Record<LoopId, MidiRollPlacement>>
>;
