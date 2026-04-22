export function MidiRollNote({
  rect,
  inSelectedLayer,
  inSelectedLoop,
  dimSameLayerOtherLoop,
  inLoopEditMode,
  dragConflict,
  isDragging,
  isMuted,
  isDragPreviewTarget,
  dragPreview,
  sliceGlobalStart,
  sliceGlobalEnd,
  rollSlot,
  noteGlobalStart,
  noteGlobalEnd,
  onPointerDown,
  onTap,
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`mnote mnote-${rect.layer.toLowerCase()} mnote-loop-${(rect.loopIndex ?? 0) % 4} ${inSelectedLayer ? "mnote-layer-selected" : "mnote-layer-unselected"} ${inSelectedLoop ? "mnote-focus" : ""} ${dimSameLayerOtherLoop ? "mnote-loop-dim" : ""} ${isMuted ? "mnote-muted" : ""} ${(rect.overlapCount ?? 1) > 1 ? "mnote-overlap" : ""} ${inLoopEditMode ? "mnote-loop-editing" : ""} ${dragConflict ? "mnote-drag-conflict" : ""} ${isDragging ? "mnote-dragging" : ""}`}
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
      onPointerDown={(e) =>
        onPointerDown(e, {
          rect,
          inLoopEditMode,
          rollSlot,
          noteGlobalStart,
          noteGlobalEnd,
        })
      }
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          if (rect.noteKey && rect.loopId) {
            onTap({
              layerId: rect.layer,
              loopId: rect.loopId,
              noteKey: rect.noteKey,
              rollSlot,
            });
          }
        }
      }}
    >
      {isDragPreviewTarget &&
        (() => {
          const eps = 1e-6;
          const segStart = sliceGlobalStart;
          const segEnd = sliceGlobalEnd;
          const segSpan = segEnd - segStart;
          if (segSpan <= eps) {
            return null;
          }
          return dragPreview.overlapRanges
            .map((rng, i) => {
              const overlapStart = Math.max(segStart, rng.startBeat);
              const overlapEnd = Math.min(segEnd, rng.endBeat);
              if (overlapEnd - overlapStart <= eps) {
                return null;
              }
              return (
                <span
                  key={`overlap-${i}`}
                  className="mnote-invalid-fill"
                  style={{
                    left: `${((overlapStart - segStart) / segSpan) * 100}%`,
                    width: `${((overlapEnd - overlapStart) / segSpan) * 100}%`,
                  }}
                />
              );
            })
            .filter(Boolean);
        })()}
      {inSelectedLoop && typeof rect.storedOctave === "number" && (
        <span className="mnote-octave-badge">{rect.storedOctave}</span>
      )}
    </div>
  );
}
