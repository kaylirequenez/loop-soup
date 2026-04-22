import type { LayerLoop } from "../../types/model";

export interface BottomControlsProps {
  isPlaying: boolean;
  addOn: boolean;
  beatsPerMeasure: number;
  totalMeasures: number;
  activeLoop: LayerLoop | null;
  repeatPhraseEnabled?: boolean;
  repeatPlacementEnabled?: boolean;
  phraseFieldSyncKey?: string;
  onTogglePlay: () => void;
  onRestartTransport: () => void;
  onRestartPlayheadInView: () => void;
  onToggleAdd: () => void;
  onShiftLoopNotesOctave: (delta: number) => void;
  onAddMeasure: () => void;
  onRemoveLastMeasure: () => void;
  canRemoveLastMeasure: boolean;
  onSetRepeatUnit: (value: unknown) => void;
  onToggleRepeatEvery: (value: unknown) => void;
  onSetStartMeasure: (value: number) => void;
  onSetRepeatEndMeasure: (value: number | null) => void;
}
