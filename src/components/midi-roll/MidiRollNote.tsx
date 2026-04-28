import type { KeyboardEvent, PointerEvent } from "react";
import type { RollSlot } from "../../types/midi";
import type { NoteRect } from "./midiRollLayout";
import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useMidiStore } from "../../store/midiStore";

interface MidiRollNoteProps {
  rect: NoteRect;
  inSelectedLayer: boolean;
  inSelectedLoop: boolean;
  dimSameLayerOtherLoop: boolean;
  isMuted: boolean;
  rollSlot: RollSlot;
}

export function MidiRollNote({
  rect,
  inSelectedLayer,
  inSelectedLoop,
  dimSameLayerOtherLoop,
  isMuted,
  rollSlot,
}: MidiRollNoteProps) {
  const tap = () => {
    const layerId = rect.layer;
    const loopId = rect.layerLoopId;
    const editorState = useLayerEditorStore.getState();
    const isSelected =
      editorState.selectedLayerId === layerId &&
      editorState.selectedLoopId === loopId;
    editorState.toggleLoopSelection(layerId, loopId);
    if (!isSelected) {
      const midiState = useMidiStore.getState();
      if (!midiState.midiRollSplitByRootOctave && midiState.midiRollCount >= 2) {
        midiState.setMidiLayerRollPlacement(layerId, rollSlot === 1 ? "1" : "2");
      }
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.pointerType !== "mouse" || event.button === 0) tap();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      tap();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={`mnote mnote-${rect.layer.toLowerCase()} mnote-loop-${rect.loopIndex % 4} ${inSelectedLayer ? "mnote-layer-selected" : "mnote-layer-unselected"} ${inSelectedLoop ? "mnote-focus" : ""} ${dimSameLayerOtherLoop ? "mnote-loop-dim" : ""} ${isMuted ? "mnote-muted" : ""} ${rect.overlapCount > 1 ? "mnote-overlap" : ""}`}
      title={
        isMuted
          ? `Layer ${rect.layer} muted`
          : `Loop ${rect.loopIndex + 1} — click to edit repeat/phrase — octave ${rect.storedOctave}`
      }
      style={{
        left: `${rect.leftPct}%`,
        width: `${rect.widthPct}%`,
        top: `${rect.topPct}%`,
        height: `${rect.heightPct}%`,
      }}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    >
      {inSelectedLoop && (
        <span className="mnote-octave-badge">{rect.storedOctave}</span>
      )}
    </div>
  );
}
