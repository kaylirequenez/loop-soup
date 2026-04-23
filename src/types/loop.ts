export type LoopDefinitionId = string;
export type LoopInstanceId = string;

export interface LoopNote {
  pitchClass: number;
  octave: number;
  localBeatIndex: number;
  startInBeat: number;
  lengthInBeat: number;
}

export interface LoopDefinition {
  id: LoopDefinitionId;
  spanBeats: number;
  notes: LoopNote[];
}

/** Catalog of reusable loop definitions (project data). */
export type LoopDefinitionsState = Record<LoopDefinitionId, LoopDefinition>;
