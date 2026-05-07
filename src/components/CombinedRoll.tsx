import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useTransportStore } from "../store/transportStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { usePlayheadDrag } from "../hooks/usePlayheadDrag";
import { Nowbar } from "./Nowbar";
import { chromaticOctaveRows, pitchClassRowIndex } from "../utils/pitch";
import type { RollSlot } from "../types/midi";
import type { LayerId } from "../types/layer";
import type { RawRollNote, TimelineNoteFractionRect } from "../types/timeline";
import {
  resolveTimelineNoteEndBeat,
  timelineNoteFractionRect,
} from "../utils/timelineNoteLayout";
import { timelineNoteSelectionHighlightClasses } from "../ui/timelineNoteHighlight";
import { compositionLoopBeatLength } from "../utils/compositionState";

interface CombinedRollProps {
  rollSlot: RollSlot;
  notes: RawRollNote[];
}

type VisibleNote = RawRollNote &
  TimelineNoteFractionRect & { rowIndex: number };

function CombinedRollNote({ item }: { item: VisibleNote }) {
  const { selectedLayerId, selectedLoopId, selectedInstanceId } =
    useLayerEditorStore(
      useShallow((s) => ({
        selectedLayerId: s.selectedLayerId,
        selectedLoopId: s.selectedLoopId,
        selectedInstanceId: s.selectedInstanceId,
      })),
    );
  const hlClass = timelineNoteSelectionHighlightClasses({
    selectedLoopId,
    selectedLayerId,
    selectedInstanceId,
    noteLayerId: item.layerId,
    noteLoopIndex: item.loopIndex,
    noteInstanceIndex: item.instanceIndex,
  });

  const showOctaveBadge =
    selectedLoopId != null &&
    item.layerId === selectedLayerId &&
    item.loopIndex === selectedLoopId;
  const isInstancePressed =
    showOctaveBadge && selectedInstanceId === item.instanceIndex;
  const cls = [
    "midi-roll-timeline-note",
    "mnote",
    `mnote-${item.layerId.toLowerCase()}`,
    `mnote-loop-${item.loopIndex % 4}`,
    hlClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      style={{
        left: `${item.leftFract * 100}%`,
        width: `${item.widthFract * 100}%`,
        top: `${(item.rowIndex / 12) * 100}%`,
        height: `${(1 / 12) * 100}%`,
      }}
      aria-label={`Layer ${item.layerId} loop ${item.loopIndex + 1}`}
      aria-pressed={isInstancePressed}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showOctaveBadge && (
        <span className="mnote-octave-badge">{item.loopNote.octave + 1}</span>
      )}
    </button>
  );
}

export function CombinedRoll({ rollSlot, notes }: CombinedRollProps) {
  const {
    midiMeasuresVisible,
    midiRollCount,
    midiRollSplitByRootOctave,
    midiLoopRollPlacement,
  } = useMidiStore(
    useShallow((s) => ({
      midiMeasuresVisible: s.midiMeasuresVisible,
      midiRollCount: s.midiRollCount,
      midiRollSplitByRootOctave: s.midiRollSplitByRootOctave,
      midiLoopRollPlacement: s.midiLoopRollPlacement,
    })),
  );
  const { midiViewMeasureIndex, midiPlayheadBeat } = useTransportStore(
    useShallow((s) => ({
      midiViewMeasureIndex: s.viewMeasureIndex,
      midiPlayheadBeat: s.playheadBeat,
    })),
  );
  const {
    beatsPerMeasure,
    beatLength,
    musicalKey,
    compositionOctave,
    totalMeasures,
  } = useCompositionStore(
    useShallow((s) => ({
      beatsPerMeasure: s.meter.beatsPerMeasure,
      beatLength: compositionLoopBeatLength(
        s.totalMeasures,
        s.meter.beatsPerMeasure,
      ),
      musicalKey: s.key,
      compositionOctave: s.octave,
      totalMeasures: s.totalMeasures,
    })),
  );
  const {
    selectedLayerId,
    selectedLoopId,
    selectedInstanceId,
    toggleInstanceSelection,
  } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      selectedLoopId: s.selectedLoopId,
      selectedInstanceId: s.selectedInstanceId,
      toggleInstanceSelection: s.toggleInstanceSelection,
    })),
  );
  const rowLabels = useMemo(
    () => chromaticOctaveRows(musicalKey),
    [musicalKey],
  );

  const { isNoteOnRoll } = useMidiStore.getState();

  const visibleNotes = useMemo(() => {
    const result: VisibleNote[] = [];
    for (const note of notes) {
      if (note.absoluteEndBeat == null) continue;
      if (!isNoteOnRoll(note.layerId, note.loopIndex, note.loopNote.octave, rollSlot))
        continue;
      const rowIndex = pitchClassRowIndex(note.loopNote.pitchClass, musicalKey);
      const resolvedEnd = resolveTimelineNoteEndBeat(
        note.absoluteStartBeat,
        note.absoluteEndBeat,
        midiPlayheadBeat,
        beatLength,
      );
      const { leftFract, widthFract } = timelineNoteFractionRect(
        note.absoluteStartBeat,
        resolvedEnd,
        beatLength,
      );
      result.push({ ...note, rowIndex, leftFract, widthFract });
    }
    return result;
  }, [
    notes,
    midiRollCount,
    midiRollSplitByRootOctave,
    midiLoopRollPlacement,
    compositionOctave,
    musicalKey,
    beatLength,
  ]);

  const stripNotes = useMemo(
    () =>
      visibleNotes.map((item) => (
        <CombinedRollNote key={item.reactKey} item={item} />
      )),
    [visibleNotes],
  );

  const stripTranslatePct = (midiViewMeasureIndex / totalMeasures) * 100;
  const stripWidthPct = (totalMeasures / midiMeasuresVisible) * 100;
  const rightmostVisibleMeasureIdx =
    midiViewMeasureIndex + midiMeasuresVisible - 1;
  const handlePlayheadDrag = usePlayheadDrag<HTMLDivElement>({
    getBeatWindow: () => {
      const startBeat = midiViewMeasureIndex * beatsPerMeasure;
      const endBeat = Math.min(
        beatLength,
        (midiViewMeasureIndex + midiMeasuresVisible) * beatsPerMeasure,
      );
      return { startBeat, endBeat };
    },
    onSeek: useTransportStore.getState().setPlayheadBeat,
  });

  return (
    <div className="combined-roll-panel">
      <div className="combined-roll-wrap">
        <div
          className="midi-roll-viewport"
          onPointerDown={handlePlayheadDrag}
          aria-label="Seek playhead"
        >
          <div
            className="midi-roll-strip midi-roll-strip--layered"
            style={{
              width: `${stripWidthPct}%`,
              transform: `translateX(-${stripTranslatePct}%)`,
            }}
          >
            <div className="midi-roll-strip-measures">
              {Array.from({ length: totalMeasures }).map((_, mIdx) => (
                <div
                  className="midi-roll-measure"
                  key={`r${rollSlot}-m-${mIdx}`}
                  style={{ flex: `0 0 calc(100% / ${totalMeasures})` }}
                >
                  <div className="combined-roll">
                    <div className="midi-grid-overlay" aria-hidden="true">
                      {Array.from({ length: beatsPerMeasure }).map(
                        (__, slotIdx) => {
                          const absoluteBeat = mIdx * beatsPerMeasure + slotIdx;
                          return (
                            <div
                              key={`r${rollSlot}-m${mIdx}-s${slotIdx}`}
                              className={`midi-beat-slot ${absoluteBeat < beatLength ? "midi-beat-slot--in-loop" : ""}`}
                              style={{
                                left: `${(slotIdx / beatsPerMeasure) * 100}%`,
                                width: `${100 / beatsPerMeasure}%`,
                              }}
                            />
                          );
                        },
                      )}
                      <div
                        className="midi-grid-line midi-grid-line-bar"
                        style={{ left: 0 }}
                      />
                      <div
                        className="midi-grid-line midi-grid-line-bar"
                        style={{ right: 0 }}
                      />
                      {Array.from({
                        length: Math.max(0, beatsPerMeasure - 1),
                      }).map((__, beatIdx) => (
                        <div
                          key={`r${rollSlot}-m${mIdx}-b${beatIdx}`}
                          className="midi-grid-line midi-grid-line-beat"
                          style={{
                            left: `${((beatIdx + 1) / beatsPerMeasure) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    {rowLabels.map((label, i) => (
                      <div
                        key={`r${rollSlot}-m${mIdx}-row${i}`}
                        className="roll-row"
                        style={{
                          top: `${(i / 12) * 100}%`,
                          height: `${(1 / 12) * 100}%`,
                        }}
                      >
                        {(midiMeasuresVisible <= 1 ||
                          mIdx === rightmostVisibleMeasureIdx) && (
                          <div className="row-note-label">{label}</div>
                        )}
                      </div>
                    ))}
                    <Nowbar
                      beat={midiPlayheadBeat}
                      startBeat={mIdx * beatsPerMeasure}
                      endBeat={(mIdx + 1) * beatsPerMeasure}
                      className="mroll-ph"
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              className="midi-roll-strip-notes"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const xFract = (e.clientX - rect.left) / rect.width;
                const yFract = (e.clientY - rect.top) / rect.height;
                const rowIndex = Math.floor(yFract * 12);
                const COLOCATED_EPS = 0.01;
                const candidates = visibleNotes
                  .filter(
                    (n) =>
                      n.rowIndex === rowIndex &&
                      xFract >= n.leftFract &&
                      xFract < n.leftFract + n.widthFract,
                  )
                  .sort((a, b) => {
                    const dDur = a.widthFract - b.widthFract;
                    if (Math.abs(dDur) > 1e-6) return dDur;
                    if (a.layerId !== b.layerId)
                      return a.layerId.localeCompare(b.layerId);
                    return a.loopIndex - b.loopIndex;
                  });
                if (candidates.length === 0) return;
                const shortest = candidates[0]!;
                // Only cycle among notes that are indistinguishably close in extent.
                const pool = candidates.filter(
                  (n) =>
                    Math.abs(n.leftFract - shortest.leftFract) <
                      COLOCATED_EPS &&
                    Math.abs(
                      n.leftFract +
                        n.widthFract -
                        (shortest.leftFract + shortest.widthFract),
                    ) < COLOCATED_EPS,
                );
                const currentIdx = pool.findIndex(
                  (n) =>
                    n.layerId === selectedLayerId &&
                    n.loopIndex === selectedLoopId &&
                    n.instanceIndex === selectedInstanceId,
                );
                const target = pool[(currentIdx + 1) % pool.length]!;
                toggleInstanceSelection(
                  target.layerId,
                  target.loopIndex,
                  target.instanceIndex,
                );
              }}
            >
              {stripNotes}
              {notes
                .filter(
                  (n) =>
                    n.absoluteEndBeat == null &&
                    isNoteOnRoll(n.layerId, n.loopIndex, n.loopNote.octave, rollSlot),
                )
                .map((n) => {
                  const resolvedEnd = resolveTimelineNoteEndBeat(
                    n.absoluteStartBeat,
                    null,
                    midiPlayheadBeat,
                    beatLength,
                  );
                  const { leftFract, widthFract } = timelineNoteFractionRect(
                    n.absoluteStartBeat,
                    resolvedEnd,
                    beatLength,
                  );
                  const rowIndex = pitchClassRowIndex(n.loopNote.pitchClass, musicalKey);
                  return (
                    <div
                      key={`rec-${n.reactKey}`}
                      className={`midi-roll-timeline-note mnote mnote-${n.layerId.toLowerCase()} mnote-loop-${n.loopIndex % 4}`}
                      style={{
                        left: `${leftFract * 100}%`,
                        width: `${widthFract * 100}%`,
                        top: `${(rowIndex / 12) * 100}%`,
                        height: `${(1 / 12) * 100}%`,
                      }}
                      aria-hidden="true"
                    />
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
