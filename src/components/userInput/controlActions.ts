import { getNowbarBeat } from "../../audio/transportController";
import { useCompositionStore } from "../../store/compositionStore";
import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useLayerStore } from "../../store/layerStore";
import { useMidiStore } from "../../store/midiStore";
import { useTransportStore } from "../../store/transportStore";
import {
  compositionLoopBeatLength,
  maxMeasuresCompositionLimit,
} from "../../utils/compositionState";

export function getCompositionDims() {
  const { meter, totalMeasures } = useCompositionStore.getState();
  return {
    beatsPerMeasure: meter.beatsPerMeasure,
    compositionEndBeat: compositionLoopBeatLength(
      totalMeasures,
      meter.beatsPerMeasure,
    ),
  };
}

export function startLoopRecording(): void {
  const { selectedLayerId } = useLayerEditorStore.getState();
  useLayerStore.getState().addNewLoop(selectedLayerId);
}

export function endLoopRecording(): void {
  const editor = useLayerEditorStore.getState();
  const endBeat = getNowbarBeat();
  if (editor.selectedLoopId !== null) {
    useLayerStore
      .getState()
      .finalizeLoop(editor.selectedLayerId, editor.selectedLoopId, endBeat);
  }
  editor.stopRecording();
}

export function toggleLoopRecording(): void {
  if (useLayerEditorStore.getState().isRecordingLoop) {
    endLoopRecording();
  } else {
    startLoopRecording();
  }
}

export function addCompositionMeasure(): void {
  const { totalMeasures, setTotalMeasures } = useCompositionStore.getState();
  if (totalMeasures >= maxMeasuresCompositionLimit()) return;
  const { midiMeasuresVisible } = useMidiStore.getState();
  const { setViewMeasureIndex } = useTransportStore.getState();
  const newTotal = totalMeasures + 1;
  setTotalMeasures(newTotal);
  setViewMeasureIndex(newTotal - midiMeasuresVisible);
}

export function removeCompositionMeasure(): void {
  const { totalMeasures, setTotalMeasures } = useCompositionStore.getState();
  if (totalMeasures < 2) return;
  const { midiMeasuresVisible, setMidiMeasuresVisible } =
    useMidiStore.getState();
  const { viewMeasureIndex, setViewMeasureIndex } =
    useTransportStore.getState();
  const newTotal = totalMeasures - 1;
  const nextVisible = Math.min(midiMeasuresVisible, newTotal);
  const nextMaxStart = Math.max(0, newTotal - nextVisible);
  setMidiMeasuresVisible(nextVisible);
  setTotalMeasures(newTotal);
  setViewMeasureIndex(Math.min(viewMeasureIndex, nextMaxStart));
}
