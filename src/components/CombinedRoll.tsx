import { useMemo, useSyncExternalStore } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useCompositionStore } from "../store/compositionStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { usePlayheadDrag } from "../hooks/usePlayheadDrag";
import { Nowbar } from "./Nowbar";
import { chromaticOctaveRows, pitchClassRowIndex } from "../utils/pitch";
import type { RollSlot } from "../types/midi";
import type { LayerId, LayerLoopId, LoopInstanceId } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import {
  collectMidiRollStripNoteInputs,
  layoutMidiRollStripNotes,
  midiRollNoteVerticalFractions,
  type MidiRollStripNoteLayout,
} from "../utils/midiRollOverlapLayout";
import {
  resolveTimelineNoteEndBeat,
  timelineNoteFractionRect,
} from "../utils/timelineNoteLayout";
import { timelineNoteSelectionHighlightClasses } from "../ui/timelineNoteHighlight";
import { loopTimeline } from "../utils/loopTimeline";
import { compositionLoopBeatLength } from "../utils/compositionState";

interface CombinedRollProps {
  rollSlot: RollSlot;
}

function CombinedRollNote({
  item,
  toggleInstanceSelection,
}: {
  item: MidiRollStripNoteLayout;
  toggleInstanceSelection: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
  ) => void;
}) {
  const { selectedLayerId, selectedLoopId, selectedInstanceId } =
    useLayerEditorStore(
      useShallow((s) => ({
        selectedLayerId: s.selectedLayerId,
        selectedLoopId: s.selectedLoopId,
        selectedInstanceId: s.selectedInstanceId,
      })),
    );
  const { topFract, heightFract } = midiRollNoteVerticalFractions(
    item.rowIndex,
    item.verticalSlot,
    item.overlapClusterSize,
  );
  const hlClass = timelineNoteSelectionHighlightClasses({
    selectedLoopId,
    selectedLayerId,
    selectedInstanceId,
    noteLayerId: item.layerId,
    noteLoopId: item.loopId,
    noteInstanceId: item.instanceId,
  });

  const showOctaveBadge =
    selectedLoopId != null &&
    item.layerId === selectedLayerId &&
    item.loopId === selectedLoopId;
  const isInstancePressed =
    selectedLoopId != null &&
    item.layerId === selectedLayerId &&
    item.loopId === selectedLoopId &&
    selectedInstanceId === item.instanceId;
  const cls = [
    "midi-roll-timeline-note",
    "mnote",
    `mnote-${item.layerId.toLowerCase()}`,
    `mnote-loop-${item.loopIdx % 4}`,
    item.overlapClusterSize > 1 ? "mnote-overlap" : "",
    hlClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      key={item.reactKey}
      type="button"
      className={cls}
      style={{
        left: `${item.leftFract * 100}%`,
        width: `${item.widthFract * 100}%`,
        top: `${topFract * 100}%`,
        height: `${heightFract * 100}%`,
      }}
      aria-label={`Layer ${item.layerId} loop ${item.loopId + 1}`}
      aria-pressed={isInstancePressed}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        toggleInstanceSelection(item.layerId, item.loopId, item.instanceId);
      }}
    >
      {showOctaveBadge && (
        <span className="mnote-octave-badge">{item.note.octave + 1}</span>
      )}
    </button>
  );
}

export function CombinedRoll({ rollSlot }: CombinedRollProps) {
  const { midiViewMeasureIndex, midiMeasuresVisible, midiPlayheadBeat } =
    useMidiStore(
      useShallow((s) => ({
        midiViewMeasureIndex: s.midiViewMeasureIndex,
        midiMeasuresVisible: s.midiMeasuresVisible,
        midiPlayheadBeat: s.midiPlayheadBeat,
      })),
    );
  const { beatsPerMeasure, beatLength, musicalKey } =
    useCompositionStore(
      useShallow((s) => ({
        beatsPerMeasure: s.meter.beatsPerMeasure,
        beatLength: compositionLoopBeatLength(
          s.totalMeasures,
          s.meter.beatsPerMeasure,
        ),
        musicalKey: s.key,
      })),
    );
  const timelineRevision = useSyncExternalStore(
    (onStoreChange) => loopTimeline.subscribe(onStoreChange),
    () => loopTimeline.getRevision(),
    () => loopTimeline.getRevision(),
  );
  const { toggleInstanceSelection } = useLayerEditorStore(
    useShallow((s) => ({
      toggleInstanceSelection: s.toggleInstanceSelection,
    })),
  );
  const rowLabels = useMemo(
    () => chromaticOctaveRows(musicalKey),
    [musicalKey],
  );

  // Open recording notes — recomputes only when timelineRevision changes (not on every playhead tick).
  // Rendered inline so they grow with midiPlayheadBeat, which CombinedRoll already tracks for the Nowbar.
  const openRecordingNotes = useMemo(() => {
    const midi = useMidiStore.getState();
    const layers = useLayerStore.getState().layers;
    const result: Array<{
      key: string;
      absoluteStartBeat: number;
      rowIndex: number;
      layerId: LayerId;
      loopIdx: number;
    }> = [];
    for (const layerId of LAYER_IDS) {
      const loopsArr = Object.values(layers[layerId].layerLoops).sort(
        (a, b) => a.id - b.id,
      );
      for (let loopIdx = 0; loopIdx < loopsArr.length; loopIdx += 1) {
        const loop = loopsArr[loopIdx]!;
        const rows = loopTimeline.getNotesForLoop(layerId, loop.id);
        if (!rows) continue;
        for (const row of rows) {
          if (row.absoluteEndBeat != null) continue;
          const ln = loop.definition.notes[row.noteIndexInDefinition];
          if (!ln) continue;
          if (!midi.isNoteOnRoll(layerId, loop.id, ln.octave, rollSlot)) continue;
          result.push({
            key: `rec-${layerId}-${loop.id}-${row.absoluteStartBeat}`,
            absoluteStartBeat: row.absoluteStartBeat,
            rowIndex: pitchClassRowIndex(ln.pitchClass, musicalKey),
            layerId,
            loopIdx,
          });
        }
      }
    }
    return result;
  }, [rollSlot, timelineRevision, musicalKey]);

  const laidOutNotes = useMemo(() => {
    const composition = useCompositionStore.getState();
    const midi = useMidiStore.getState();
    const inputs = collectMidiRollStripNoteInputs({
      layers: useLayerStore.getState().layers,
      musicalKey: composition.key,
      rollSlot,
      beatLength: compositionLoopBeatLength(
        composition.totalMeasures,
        composition.meter.beatsPerMeasure,
      ),
      midiPlayheadBeat: midi.midiPlayheadBeat,
      reactKeyPrefix: `mr${rollSlot}`,
      isNoteOnRoll: (layerId, loopId, octave) =>
        midi.isNoteOnRoll(layerId, loopId, octave, rollSlot),
    });

    return layoutMidiRollStripNotes(
      inputs,
      compositionLoopBeatLength(
        composition.totalMeasures,
        composition.meter.beatsPerMeasure,
      ),
    );
  }, [rollSlot, timelineRevision]);

  const stripNotes = useMemo(
    () =>
      laidOutNotes.map((item) => (
        <CombinedRollNote
          key={item.reactKey}
          item={item}
          toggleInstanceSelection={toggleInstanceSelection}
        />
      )),
    [laidOutNotes, toggleInstanceSelection],
  );

  const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
  const visibleMeasureCount = Math.max(
    1,
    Math.min(midiMeasuresVisible, measureCount, 4),
  );
  const stripTranslatePct =
    measureCount > 0 ? (midiViewMeasureIndex / measureCount) * 100 : 0;
  const stripWidthPct =
    measureCount > 0 ? (measureCount / visibleMeasureCount) * 100 : 100;
  const rightmostVisibleMeasureIdx =
    midiViewMeasureIndex + visibleMeasureCount - 1;
  const handlePlayheadDrag = usePlayheadDrag<HTMLDivElement>({
    getBeatWindow: () => {
      const startBeat = midiViewMeasureIndex * beatsPerMeasure;
      const endBeat = Math.min(
        beatLength,
        (midiViewMeasureIndex + visibleMeasureCount) * beatsPerMeasure,
      );
      return { startBeat, endBeat };
    },
    onSeek: useMidiStore.getState().setMidiPlayheadBeat,
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
              {Array.from({ length: measureCount }).map((_, mIdx) => (
                <div
                  className="midi-roll-measure"
                  key={`r${rollSlot}-m-${mIdx}`}
                  style={{ flex: `0 0 calc(100% / ${measureCount})` }}
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
                          height: `${100 / 12}%`,
                        }}
                      >
                        {(visibleMeasureCount <= 1 ||
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
            <div className="midi-roll-strip-notes">
              {stripNotes}
              {openRecordingNotes.map(({ key, absoluteStartBeat, rowIndex, layerId, loopIdx }) => {
                const resolvedEnd = resolveTimelineNoteEndBeat(
                  absoluteStartBeat,
                  null,
                  midiPlayheadBeat,
                  beatLength,
                );
                const { leftFract, widthFract } = timelineNoteFractionRect(
                  absoluteStartBeat,
                  resolvedEnd,
                  beatLength,
                );
                const { topFract, heightFract } = midiRollNoteVerticalFractions(rowIndex, 0, 1);
                return (
                  <div
                    key={key}
                    className={`midi-roll-timeline-note mnote mnote-${layerId.toLowerCase()} mnote-loop-${loopIdx % 4}`}
                    style={{
                      left: `${leftFract * 100}%`,
                      width: `${widthFract * 100}%`,
                      top: `${topFract * 100}%`,
                      height: `${heightFract * 100}%`,
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
