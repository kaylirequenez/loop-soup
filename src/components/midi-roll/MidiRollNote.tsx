import type { KeyboardEvent, PointerEvent } from "react";
import type { NoteRect } from "./midiRollLayout";
import { useLayerEditorStore } from "../../store/layerEditorStore";

interface MidiRollNoteProps {
  rect: NoteRect;
  inSelectedLoop: boolean;
  inSelectedLayer: boolean;
  dimSameLayerOtherLoop: boolean;
  isMuted: boolean;
}

export function MidiRollNote({
  rect,
  inSelectedLoop,
  inSelectedLayer,
  dimSameLayerOtherLoop,
  isMuted,
}: MidiRollNoteProps) {
  const tap = () => {
    const layerId = rect.layer;
    const loopId = rect.layerLoopId;
    const instanceId = rect.loopInstanceId;
    useLayerEditorStore
      .getState()
      .toggleInstanceSelection(layerId, loopId, instanceId);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    tap();
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
    >
      {inSelectedLoop && (
        <span className="mnote-octave-badge">{rect.storedOctave}</span>
      )}
    </div>
  );
}
