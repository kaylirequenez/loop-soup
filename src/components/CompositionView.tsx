import { Fragment, useMemo, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useCompositionStore } from "../store/compositionStore";
import { useTransportStore } from "../store/transportStore";
import { usePlayheadDrag } from "../hooks/usePlayheadDrag";
import { Nowbar } from "./Nowbar";
import { RollPlacementButtons } from "./midi-settings/RollPlacementButtons";
import { compositionLoopBeatLength } from "../utils/compositionState";
import { loopTimeline } from "../utils/loopTimeline";
import {
  resolveTimelineNoteEndBeat,
  timelineNoteFractionRect,
} from "../utils/timelineNoteLayout";
import {
  loopInstanceSpans,
  findInstanceIndex,
  type InstanceSpan,
} from "../utils/loopInstanceUtils";
import { timelineNoteSelectionHighlightClasses } from "../ui/timelineNoteHighlight";

const MAX_VISIBLE_ROWS = 6;
function rowHeightForLoopCount(loopCount: number) {
  if (loopCount <= 1) return 24;
  if (loopCount === 2) return 20;
  if (loopCount === 3) return 17;
  return 14;
}

export default function CompositionView() {
  const {
    selectedLayerId,
    selectedLoopId,
    selectedInstanceId,
    isRecordingLoop,
    toggleLoopSelection,
    toggleInstanceSelection,
  } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      selectedLoopId: s.selectedLoopId,
      selectedInstanceId: s.selectedInstanceId,
      isRecordingLoop: s.isRecordingLoop,
      toggleLoopSelection: s.toggleLoopSelection,
      toggleInstanceSelection: s.toggleInstanceSelection,
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
  const { playheadBeat, setViewMeasureIndex } =
    useTransportStore(
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

  const instanceSpansByLoop = useMemo(() => {
    const out = new Map<number, InstanceSpan[]>();
    for (let i = 0; i < loops.length; i++) {
      out.set(i, loopInstanceSpans(loops[i].loopInstances));
    }
    return out;
  }, [loops]);

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
        className="comp-ruler-track"
        onPointerDown={handleRulerDrag}
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
        const rollPlacement =
          midiLoopRollPlacement[selectedLayerId]?.[idx] ?? "both";
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
              className={`ctrack ${isLoopSelected ? "ctrack-selected" : ""}`}
              onClick={() => toggleLoopSelection(selectedLayerId, idx)}
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
              {(instanceSpansByLoop.get(idx) ?? []).map(
                ({ startBeat, endBeat }, spanIdx) => {
                  const { leftFract, widthFract } = timelineNoteFractionRect(
                    startBeat,
                    endBeat,
                    compositionBeats,
                  );
                  return (
                    <div
                      key={`ispan-${idx}-${spanIdx}`}
                      className={`comp-instance-span mnote-${selectedLayerId.toLowerCase()}`}
                      style={{
                        left: `${leftFract * 100}%`,
                        width: `${widthFract * 100}%`,
                      }}
                    />
                  );
                },
              )}
              {(timelineNotesByLoop.get(idx) ?? []).map((noteRow, barIdx) => {
                const instanceIndex = findInstanceIndex(
                  noteRow.absoluteStartBeat - noteRow.repeatOffsetBeats,
                  loop.loopInstances,
                );
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
                  selectedInstanceId,
                  noteLayerId: selectedLayerId,
                  noteLoopIndex: idx,
                  noteInstanceIndex: instanceIndex,
                });
                const isInstanceSelected =
                  selectedLoopId != null &&
                  isLoopSelected &&
                  selectedInstanceId === instanceIndex;
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
                      toggleInstanceSelection(
                        selectedLayerId,
                        idx,
                        instanceIndex,
                      );
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
