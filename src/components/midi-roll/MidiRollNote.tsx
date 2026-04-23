import type { KeyboardEvent, PointerEvent } from "react";
import type { LayerId } from "../../types/layer";
import type { MidiRollTapParams, RollSlot } from "./types";

interface MidiRollNoteProps {
  rect: {
    layer: LayerId;
    loopId?: string;
    loopIndex?: number;
    storedOctave?: number;
    overlapCount?: number;
    leftPct: number;
    widthPct: number;
    topPct: number;
    heightPct: number;
  };
  inSelectedLayer: boolean;
  inSelectedLoop: boolean;
  dimSameLayerOtherLoop: boolean;
  isMuted: boolean;
  rollSlot: RollSlot;
  onTap: (params: MidiRollTapParams) => void;
}

export function MidiRollNote({
  rect,
  inSelectedLayer,
  inSelectedLoop,
  dimSameLayerOtherLoop,
  isMuted,
  rollSlot,
  onTap,
}: MidiRollNoteProps) {
  const tap = () => {
    if (rect.loopId) {
      onTap({ layerId: rect.layer, loopId: rect.loopId, rollSlot });
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button === 0) {
      tap();
    }
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
      className={`mnote mnote-${rect.layer.toLowerCase()} mnote-loop-${(rect.loopIndex ?? 0) % 4} ${inSelectedLayer ? "mnote-layer-selected" : "mnote-layer-unselected"} ${inSelectedLoop ? "mnote-focus" : ""} ${dimSameLayerOtherLoop ? "mnote-loop-dim" : ""} ${isMuted ? "mnote-muted" : ""} ${(rect.overlapCount ?? 1) > 1 ? "mnote-overlap" : ""}`}
      title={
        isMuted
          ? `Layer ${rect.layer} muted`
          : `Loop ${(rect.loopIndex ?? 0) + 1} — click to edit repeat/phrase${typeof rect.storedOctave === "number" ? ` — octave ${rect.storedOctave}` : ""}`
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
      {inSelectedLoop && typeof rect.storedOctave === "number" && (
        <span className="mnote-octave-badge">{rect.storedOctave}</span>
      )}
    </div>
  );
}
