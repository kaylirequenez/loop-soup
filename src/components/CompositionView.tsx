import { Fragment, useCallback, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useCompositionStore } from "../store/compositionStore";
import { useTransportStore } from "../store/transportStore";
import { usePlayheadDrag } from "../hooks/usePlayheadDrag";
import { usePlacementGhost } from "../hooks/usePlacementGhost";
import { useInstanceEditor } from "../hooks/useInstanceEditor";
import { Nowbar } from "./Nowbar";
import { RollPlacementButtons } from "./midi-settings/RollPlacementButtons";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { loopTimeline } from "../utils/loopTimeline";
import {
  resolveTimelineNoteEndBeat,
  timelineNoteFractionRect,
} from "../utils/timelineNoteLayout";
import { findInstanceIndex } from "../utils/loopInstanceUtils";
import { timelineNoteSelectionHighlightClasses } from "../ui/timelineNoteHighlight";
const MAX_VISIBLE_ROWS = 6;
function rowHeightForLoopCount(loopCount: number) {
  if (loopCount <= 1) return 24;
  if (loopCount === 2) return 20;
  if (loopCount === 3) return 17;
  return 14;
}

function pct(fract: number) {
  return `${fract * 100}%`;
}

interface GhostSpanDef {
  startBeat: number;
  endBeat: number;
  notes: { startBeat: number; endBeat: number }[];
}

function GhostSpans({
  spans,
  compositionBeats,
}: {
  spans: GhostSpanDef[];
  compositionBeats: number;
}) {
  return (
    <>
      {spans.map((ghost, gIdx) => {
        const { leftFract, widthFract } = timelineNoteFractionRect(
          ghost.startBeat,
          ghost.endBeat,
          compositionBeats,
        );
        const spanWidthBeats = ghost.endBeat - ghost.startBeat;
        return (
          <div
            key={`ghost-${gIdx}`}
            className="comp-ghost"
            style={{ left: pct(leftFract), width: pct(widthFract), pointerEvents: "none" }}
          >
            {spanWidthBeats > 0 &&
              ghost.notes.map((note, nIdx) => (
                <div
                  key={`gn-${nIdx}`}
                  className="comp-ghost-note"
                  style={{
                    left: pct((note.startBeat - ghost.startBeat) / spanWidthBeats),
                    width: pct((note.endBeat - note.startBeat) / spanWidthBeats),
                  }}
                />
              ))}
          </div>
        );
      })}
    </>
  );
}

export default function CompositionView() {
  const {
    selectedLayerId,
    selectedLoopId,
    selectedInstanceIds,
    isRecordingLoop,
    toggleLoopSelection,
    toggleInstanceSelection,
    toggleAddInstanceSelection,
    pendingPlacement,
    instanceEditState,
  } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      selectedLoopId: s.selectedLoopId,
      selectedInstanceIds: s.selectedInstanceIds,
      isRecordingLoop: s.isRecordingLoop,
      toggleLoopSelection: s.toggleLoopSelection,
      toggleInstanceSelection: s.toggleInstanceSelection,
      toggleAddInstanceSelection: s.toggleAddInstanceSelection,
      pendingPlacement: s.pendingPlacement,
      instanceEditState: s.instanceEditState,
    })),
  );
  const layerLoops = useLayerStore((s) => s.layers[selectedLayerId].layerLoops);
  const { meter, totalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      totalMeasures: s.totalMeasures,
    })),
  );
  const {
    midiRollCount,
    midiRollSplitByRootOctave,
    midiLoopRollPlacement,
    setMidiLoopRollPlacement,
    midiMeasuresVisible,
  } = useMidiStore(
    useShallow((s) => ({
      midiRollCount: s.midiRollCount,
      midiRollSplitByRootOctave: s.midiRollSplitByRootOctave,
      midiLoopRollPlacement: s.midiLoopRollPlacement,
      setMidiLoopRollPlacement: s.setMidiLoopRollPlacement,
      midiMeasuresVisible: s.midiMeasuresVisible,
    })),
  );
  const { playheadBeat, setViewMeasureIndex } = useTransportStore(
    useShallow((s) => ({
      playheadBeat: s.playheadBeat,
      setViewMeasureIndex: s.setViewMeasureIndex,
    })),
  );
  const timelineRevision = useSyncExternalStore(
    (onStoreChange) => loopTimeline.subscribe(onStoreChange),
    () => loopTimeline.getRevision(),
    () => loopTimeline.getRevision(),
  );

  const beatsPerMeasure = meter.beatsPerMeasure;
  const compositionBeats = compositionLoopBeatLength(
    totalMeasures,
    beatsPerMeasure,
  );
  const compositionDims = useMemo(
    () => ({ beatsPerMeasure, compositionEndBeat: compositionBeats }),
    [beatsPerMeasure, compositionBeats],
  );

  const loops = layerLoops;
  const visibleRows = Math.min(MAX_VISIBLE_ROWS, Math.max(1, loops.length));
  const rowHeight = rowHeightForLoopCount(loops.length);
  const showRollPlacement = midiRollCount >= 2 && !midiRollSplitByRootOctave;

  const selectedLoopIndex =
    selectedLoopId !== null && selectedLoopId < loops.length
      ? selectedLoopId
      : -1;

  const timelineNotesByLoop = useMemo(() => {
    const out = new Map<
      number,
      ReturnType<typeof loopTimeline.getNotesForLoop>
    >();
    for (let i = 0; i < loops.length; i++) {
      out.set(i, loopTimeline.getNotesForLoop(selectedLayerId, i) ?? []);
    }
    return out;
  }, [loops, selectedLayerId, timelineRevision]);

  const { ghostData, getTrackProps } = usePlacementGhost({
    selectedLayerId,
    layerLoops,
    compositionBeats,
    beatsPerMeasure,
  });

  const { rulerTicks, ghostsByLoopId, onRulerClick } = useInstanceEditor(
    selectedLoopIndex >= 0 ? selectedLoopIndex : null,
    compositionDims,
  );

  const handleRulerDrag = usePlayheadDrag<HTMLDivElement>({
    getBeatWindow: () => ({ startBeat: 0, endBeat: compositionBeats }),
    onSeek: () => {},
    onDragEnd: () => {
      const beat = useTransportStore.getState().playheadBeat;
      const targetMeasure = Math.floor(beat / beatsPerMeasure);
      const maxStart = Math.max(0, totalMeasures - midiMeasuresVisible);
      setViewMeasureIndex(Math.max(0, Math.min(maxStart, targetMeasure)));
    },
  });

  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!instanceEditState) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const beatAtClick =
        ((e.clientX - rect.left) / rect.width) * compositionBeats;
      onRulerClick(beatAtClick, rect.width);
    },
    [instanceEditState, compositionBeats, onRulerClick],
  );

  const loopOfLabel = `loop ${selectedLoopIndex >= 0 ? selectedLoopIndex + 1 : "_"} of ${loops.length}`;

  const zoneStyle = {
    "--comp-row-height": `${rowHeight}px`,
    "--visible-comp-rows": String(visibleRows),
  } as CSSProperties;

  return (
    <div
      className={`comp-zone ${showRollPlacement ? "comp-zone--roll-pick" : ""}`}
      style={zoneStyle}
    >
      <div className="comp-layer-lbl">{`Layer ${selectedLayerId}`}</div>
      <div
        className={`comp-ruler-track ${instanceEditState ? "comp-ruler-track--edit" : ""}`}
        onPointerDown={instanceEditState ? undefined : handleRulerDrag}
        onClick={instanceEditState ? handleRulerClick : undefined}
        aria-label="Seek playhead"
      >
        {Array.from({ length: totalMeasures }).map((_, mIdx) => (
          <div
            key={`ruler-m-${mIdx}`}
            className="comp-ruler-measure"
            style={{
              left: `${(mIdx / totalMeasures) * 100}%`,
              width: `${100 / totalMeasures}%`,
            }}
          >
            <span className="comp-ruler-measure-num">{mIdx + 1}</span>
            {Array.from({ length: beatsPerMeasure - 1 }).map((__, bIdx) => (
              <div
                key={`tick-${bIdx}`}
                className="comp-ruler-beat-tick"
                style={{ left: `${((bIdx + 1) / beatsPerMeasure) * 100}%` }}
              />
            ))}
          </div>
        ))}
        {/* Edit-mode ticks */}
        {rulerTicks.map((beat) => (
          <div
            key={`etick-${beat}`}
            className={`comp-ruler-edit-tick comp-ruler-edit-tick--${instanceEditState?.activeMode ?? "shift"}`}
            style={{ left: `${(beat / compositionBeats) * 100}%` }}
          />
        ))}
        <span className="comp-ruler-loop-of" aria-live="polite">
          {loopOfLabel}
        </span>
      </div>
      {showRollPlacement && (
        <div
          className="comp-hdr-midi-roll-label"
          title="Which MIDI roll shows each loop when two rolls are stacked"
        >
          MIDI view
        </div>
      )}

      {loops.map((loop, idx) => {
        const isLoopSelected = idx === selectedLoopIndex;
        const editedInstanceIds =
          instanceEditState != null && isLoopSelected
            ? new Set(instanceEditState.sortedIds)
            : null;
        const rollPlacement =
          midiLoopRollPlacement[selectedLayerId]?.[idx] ?? "both";
        const editGhosts = ghostsByLoopId.get(idx);
        return (
          <Fragment key={idx}>
            <button
              type="button"
              className={`clbl clbl-loop-select ${isLoopSelected ? "clbl-loop-select--on" : ""}`}
              onClick={() => toggleLoopSelection(selectedLayerId, idx)}
              aria-pressed={isLoopSelected}
            >
              <span className="clbl-loop-select-mark" aria-hidden="true">
                {isRecordingLoop && idx === selectedLoopId ? "●" : idx + 1}
              </span>
            </button>
            <div
              className={`ctrack ${isLoopSelected ? "ctrack-selected" : ""}${instanceEditState != null && isLoopSelected ? " ctrack--editing" : ""}${pendingPlacement?.loopId === idx ? " ctrack--placement" : ""}`}
              onClick={(e) => {
                const trackProps = getTrackProps(idx);
                if (trackProps) {
                  trackProps.onClick(e);
                } else {
                  toggleLoopSelection(selectedLayerId, idx);
                }
              }}
              onMouseMove={getTrackProps(idx)?.onMouseMove}
              onMouseLeave={getTrackProps(idx)?.onMouseLeave}
            >
              {Array.from({ length: Math.max(0, totalMeasures - 1) }).map(
                (_, measureIdx) => (
                  <div
                    key={`m-${idx}-${measureIdx}`}
                    className="comp-measure-divider"
                    style={{
                      left: `${(((measureIdx + 1) * beatsPerMeasure) / compositionBeats) * 100}%`,
                    }}
                  />
                ),
              )}
              {loop.loopInstances.map((inst, instanceIdx) => {
                if (editedInstanceIds?.has(instanceIdx)) return null;
                if (inst.endBeat == null) return null;
                const startBeat = inst.startBeat;
                const endBeat = Math.ceil(inst.endBeat!);
                const { leftFract, widthFract } = timelineNoteFractionRect(
                  startBeat,
                  endBeat,
                  compositionBeats,
                );
                return (
                  <div
                    key={`ispan-${idx}-${instanceIdx}`}
                    className={`comp-instance-span mnote-${selectedLayerId.toLowerCase()}`}
                    style={{
                      left: `${leftFract * 100}%`,
                      width: `${widthFract * 100}%`,
                    }}
                  />
                );
              })}
              {/* Placement-mode ghosts (copy/paste) */}
              {ghostData?.loopId === idx && (
                <GhostSpans spans={ghostData.ghosts} compositionBeats={compositionBeats} />
              )}
              {/* Edit-mode ghosts (shift/start/end) */}
              {editGhosts && (
                <GhostSpans spans={editGhosts} compositionBeats={compositionBeats} />
              )}
              {(timelineNotesByLoop.get(idx) ?? []).map((noteRow, barIdx) => {
                const instanceIndex = findInstanceIndex(
                  noteRow.absoluteStartBeat - noteRow.repeatOffsetBeats,
                  loop.loopInstances,
                );
                if (editedInstanceIds?.has(instanceIndex)) return null;
                const resolvedEnd = resolveTimelineNoteEndBeat(
                  noteRow.absoluteStartBeat,
                  noteRow.absoluteEndBeat,
                  playheadBeat,
                  compositionBeats,
                );
                const { leftFract, widthFract } = timelineNoteFractionRect(
                  noteRow.absoluteStartBeat,
                  resolvedEnd,
                  compositionBeats,
                );
                const hlClass = timelineNoteSelectionHighlightClasses({
                  selectedLoopId,
                  selectedLayerId,
                  selectedInstanceIds,
                  noteLayerId: selectedLayerId,
                  noteLoopIndex: idx,
                  noteInstanceIndex: instanceIndex,
                });
                const isInstanceSelected =
                  selectedLoopId != null &&
                  isLoopSelected &&
                  selectedInstanceIds.includes(instanceIndex);
                return (
                  <button
                    key={`tn-${idx}-${instanceIndex}-${noteRow.repeatOffsetBeats}-${noteRow.noteIndexInDefinition}-${noteRow.absoluteStartBeat}-${barIdx}`}
                    type="button"
                    className={`cblock comp-timeline-note mnote-${selectedLayerId.toLowerCase()} mnote-loop-${idx % 4}${hlClass ? ` ${hlClass}` : ""}`}
                    style={{
                      left: `${leftFract * 100}%`,
                      width: `${widthFract * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (instanceEditState) return;
                      if (e.metaKey || e.ctrlKey) {
                        toggleAddInstanceSelection(
                          selectedLayerId,
                          idx,
                          instanceIndex,
                        );
                      } else {
                        toggleInstanceSelection(
                          selectedLayerId,
                          idx,
                          instanceIndex,
                        );
                      }
                    }}
                    aria-pressed={isInstanceSelected}
                  />
                );
              })}
            </div>
            {showRollPlacement && (
              <div
                className="comp-roll-placement-cell"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <RollPlacementButtons
                  value={rollPlacement}
                  ariaLabel={`MIDI roll assignment for loop ${idx + 1}`}
                  onChange={(placement) =>
                    setMidiLoopRollPlacement(selectedLayerId, idx, placement)
                  }
                />
              </div>
            )}
          </Fragment>
        );
      })}

      <div
        className={`comp-nowbar-wrap ${showRollPlacement ? "comp-nowbar-wrap--roll-pick" : ""}`}
      >
        <Nowbar
          beat={playheadBeat}
          startBeat={0}
          endBeat={compositionBeats}
          className="comp-nowbar"
        />
      </div>
    </div>
  );
}
