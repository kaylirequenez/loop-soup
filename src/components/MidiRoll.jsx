import { useMemo, useRef, useState } from "react";
import {
  LOOP_PHRASE_PLACEHOLDER_NOTE_KEY,
  useAppStore,
} from "../store/appStore";
import {
  midiRollOctaveRows,
  midiRollRowIndexForPitchClass,
  parseKeyRootPitchClass,
} from "../lib/keyLayout";
import { readMidiCompositionBeat } from "../lib/midiPlayhead";
import { buildOverlapHeightStackRects } from "../lib/midiRollLayout";
import { LAYER_ORDER } from "../lib/specs";
import { useMidiNoteDrag } from "./midi-roll/useMidiNoteDrag";
import { MidiRollNote } from "./midi-roll/MidiRollNote";
import { useMidiPlayheadScrub } from "./midi-roll/useMidiPlayheadScrub";
import {
  noteWithDragPreview,
  useMidiRollData,
} from "./midi-roll/useMidiRollData";

const DRAG_SELECTION_CLASS = "drag-selection-lock";

function lockDragSelect() {
  document.body.classList.add(DRAG_SELECTION_CLASS);
}

function unlockDragSelect() {
  document.body.classList.remove(DRAG_SELECTION_CLASS);
}

export default function MidiRoll() {
  const midiRollCount = useAppStore((s) => s.midiRollCount);
  const meter = useAppStore((s) => s.meter);
  const selectedLayer = useAppStore((s) => s.selectedLayer);
  const layers = useAppStore((s) => s.layers);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const midiViewMeasureIndex = useAppStore((s) => s.midiViewMeasureIndex);
  const midiMeasuresVisible = useAppStore((s) => s.midiMeasuresVisible);
  const midiPlayheadBeat = useAppStore((s) => s.midiPlayheadBeat);
  const setMidiPlayheadBeat = useAppStore((s) => s.setMidiPlayheadBeat);
  const scrubResumeRef = useRef(false);
  const keyName = useAppStore((s) => s.key);
  const masterLoopLength = useAppStore((s) => s.masterLoopLength);
  const midiNoteSelection = useAppStore((s) => s.midiNoteSelection);
  const applyMidiNoteTap = useAppStore((s) => s.applyMidiNoteTap);
  const midiLoopRollPlacement = useAppStore((s) => s.midiLoopRollPlacement);
  const midiLoopEditMode = useAppStore((s) => s.midiLoopEditMode);
  const setLoopNotes = useAppStore((s) => s.setLoopNotes);
  const midiRollSplitByRootOctave = useAppStore(
    (s) => s.midiRollSplitByRootOctave,
  );
  const [activeDragNoteKey, setActiveDragNoteKey] = useState(null);
  const [pendingOverlapKey, setPendingOverlapKey] = useState(null);
  const [dragPreview, setDragPreview] = useState(null);

  const rootPitchClass = useMemo(() => parseKeyRootPitchClass(keyName), [keyName]);
  const octaveView = useAppStore((s) => s.octaveView);
  const oneOctaveRows = useMemo(
    () => midiRollOctaveRows(rootPitchClass),
    [rootPitchClass],
  );
  const {
    beatsPerMeasure,
    beatLength,
    combinedNoteEvents,
    layerLoopPlacementAgreement,
    loopInstanceBounds,
    overlapRangesWithLoopNotes,
    isNoteVisibleInMeasure,
  } = useMidiRollData({
    layers,
    meter,
    masterLoopLength,
    rootPitchClass,
    midiLoopRollPlacement,
    midiRollCount,
    midiRollSplitByRootOctave,
    octaveView,
    layerIds: LAYER_ORDER,
  });

  const showStackedRoll = midiRollCount === 2;

  const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
  const visibleMeasureCount = Math.max(
    1,
    Math.min(midiMeasuresVisible, measureCount, 4),
  );

  const layerBeat = readMidiCompositionBeat(midiPlayheadBeat, beatLength);
  const { handleNotePointerDown } = useMidiNoteDrag({
    beatsPerMeasure,
    beatLength,
    visibleMeasureCount,
    midiViewMeasureIndex,
    rootPitchClass,
    loopInstanceBounds,
    overlapRangesWithLoopNotes,
    setLoopNotes,
    applyMidiNoteTap,
    setPendingOverlapKey,
    setDragPreview,
    setActiveDragNoteKey,
    lockDragSelect,
    unlockDragSelect,
    midiRollRowIndexForPitchClass,
  });
  const handlePlayheadPointerDown = useMidiPlayheadScrub({
    isPlaying,
    setPlaying,
    setMidiPlayheadBeat,
    lockDragSelect,
    unlockDragSelect,
    scrubResumeRef,
    beatsPerMeasure,
    beatLength,
    midiViewMeasureIndex,
    visibleMeasureCount,
    measureCount,
  });

  const renderCombinedRoll = (key, rollSlot) => {
    const globalMeasureIdx = Math.floor(layerBeat / beatsPerMeasure);
    const layerMeasureCol =
      measureCount > 0
        ? Math.min(measureCount - 1, Math.max(0, globalMeasureIdx))
        : 0;
    const beatInMeasure =
      ((layerBeat % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure;
    const playheadInVisibleWindow =
      layerMeasureCol >= midiViewMeasureIndex &&
      layerMeasureCol < midiViewMeasureIndex + visibleMeasureCount;
    const playheadLeft =
      playheadInVisibleWindow
        ? (beatInMeasure / beatsPerMeasure) * 100
        : null;

    const stripTranslatePct =
      measureCount > 0 ? (midiViewMeasureIndex / measureCount) * 100 : 0;
    const stripWidthPct =
      measureCount > 0 ? (measureCount / visibleMeasureCount) * 100 : 100;
    const rightmostVisibleMeasureIdx =
      midiViewMeasureIndex + visibleMeasureCount - 1;

    return (
      <div className="combined-roll-panel" key={key}>
        <div className="combined-roll-wrap">
          <div className="midi-roll-viewport">
            <div
              className="midi-roll-strip"
              style={{
                width: `${stripWidthPct}%`,
                transform: `translateX(-${stripTranslatePct}%)`,
              }}
            >
              {Array.from({ length: measureCount }).map((_, mIdx) => (
                <div
                  className="midi-roll-measure"
                  key={`${key}-m-${mIdx}`}
                  style={{
                    flex: `0 0 calc(100% / ${measureCount})`,
                  }}
                >
                  <div className="combined-roll">
                    <div className="midi-grid-overlay" aria-hidden="true">
                      {Array.from({ length: beatsPerMeasure }).map((__, slotIdx) => {
                        const absoluteBeat = mIdx * beatsPerMeasure + slotIdx;
                        const inLoop = absoluteBeat < beatLength;
                        return (
                          <div
                            key={`${key}-m-${mIdx}-slot-${slotIdx}`}
                            className={`midi-beat-slot ${inLoop ? "midi-beat-slot--in-loop" : ""}`}
                            style={{
                              left: `${(slotIdx / beatsPerMeasure) * 100}%`,
                              width: `${100 / beatsPerMeasure}%`,
                            }}
                          />
                        );
                      })}
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
                          key={`${key}-m-${mIdx}-beat-${beatIdx}`}
                          className="midi-grid-line midi-grid-line-beat"
                          style={{
                            left: `${((beatIdx + 1) / beatsPerMeasure) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    {oneOctaveRows.map((row, i) => (
                      <div
                        key={`${key}-m-${mIdx}-${row.label}-${i}`}
                        className="roll-row"
                        style={{
                          top: `${(i / 12) * 100}%`,
                          height: `${100 / 12}%`,
                        }}
                      >
                        {(visibleMeasureCount <= 1 ||
                          mIdx === rightmostVisibleMeasureIdx) && (
                          <div className="row-note-label">{row.label}</div>
                        )}
                      </div>
                    ))}

                    {buildOverlapHeightStackRects(
                      combinedNoteEvents
                        .map((note) => noteWithDragPreview(note, dragPreview))
                        .filter((note) =>
                          isNoteVisibleInMeasure(note, rollSlot, mIdx),
                        ),
                      beatsPerMeasure,
                    ).map((rect, index) => {
                      const sliceT0 = rect.sliceT0 ?? 0;
                      const sliceT1 = rect.sliceT1 ?? beatsPerMeasure;
                      const sliceGlobalStart = mIdx * beatsPerMeasure + sliceT0;
                      const sliceGlobalEnd = mIdx * beatsPerMeasure + sliceT1;
                      const noteGlobalStart =
                        typeof rect.globalStart === "number"
                          ? rect.globalStart
                          : sliceGlobalStart;
                      const noteGlobalEnd =
                        typeof rect.globalEnd === "number"
                          ? rect.globalEnd
                          : sliceGlobalEnd;
                      const placementOk =
                        layerLoopPlacementAgreement[rect.layer] !== false;
                      const inSelectedLayer = rect.layer === selectedLayer;
                      const inSelectedLoop =
                        placementOk &&
                        midiNoteSelection &&
                        rect.layer === midiNoteSelection.layerId &&
                        rect.loopId === midiNoteSelection.loopId &&
                        (!midiLoopEditMode ||
                          midiNoteSelection.noteKey ===
                            LOOP_PHRASE_PLACEHOLDER_NOTE_KEY ||
                          rect.baseNoteKey === midiNoteSelection.noteKey);
                      const inLoopEditMode =
                        midiLoopEditMode &&
                        rect.layer === midiLoopEditMode.layerId &&
                        rect.loopId === midiLoopEditMode.loopId &&
                        (rect.instanceOffset ?? 0) ===
                          midiLoopEditMode.instanceOffset;
                      const dragConflict =
                        pendingOverlapKey != null &&
                        pendingOverlapKey === rect.baseNoteKey;
                      const isDragPreviewTarget =
                        dragPreview &&
                        dragPreview.baseNoteKey === rect.baseNoteKey &&
                        (dragPreview.instanceOffset ?? 0) ===
                          (rect.instanceOffset ?? 0);
                      const dimSameLayerOtherLoop =
                        placementOk &&
                        midiNoteSelection &&
                        rect.layer === selectedLayer &&
                        rect.layer === midiNoteSelection.layerId &&
                        rect.loopId !== midiNoteSelection.loopId;
                      return (
                        <MidiRollNote
                          key={`${key}-${rect.noteKey ?? `${rect.layer}-${rect.loopId}-${rect.pitchClass}`}-${mIdx}-${index}`}
                          rect={rect}
                          inSelectedLayer={inSelectedLayer}
                          inSelectedLoop={inSelectedLoop}
                          dimSameLayerOtherLoop={dimSameLayerOtherLoop}
                          inLoopEditMode={inLoopEditMode}
                          dragConflict={dragConflict}
                          isDragging={activeDragNoteKey === rect.baseNoteKey}
                          isMuted={Boolean(layers[rect.layer]?.muted)}
                          isDragPreviewTarget={isDragPreviewTarget}
                          dragPreview={dragPreview}
                          sliceGlobalStart={sliceGlobalStart}
                          sliceGlobalEnd={sliceGlobalEnd}
                          rollSlot={rollSlot}
                          noteGlobalStart={noteGlobalStart}
                          noteGlobalEnd={noteGlobalEnd}
                          onPointerDown={handleNotePointerDown}
                          onTap={applyMidiNoteTap}
                        />
                      );
                    })}
                    {midiLoopEditMode &&
                      (() => {
                        const bounds = loopInstanceBounds(
                          midiLoopEditMode.layerId,
                          midiLoopEditMode.loopId,
                          midiLoopEditMode.instanceOffset,
                        );
                        if (!bounds) {
                          return null;
                        }
                        const measureStart = mIdx * beatsPerMeasure;
                        const measureEnd = measureStart + beatsPerMeasure;
                        if (
                          bounds.endBeat <= measureStart ||
                          bounds.startBeat >= measureEnd
                        ) {
                          return null;
                        }
                        const startPct = ((bounds.startBeat - measureStart) / beatsPerMeasure) * 100;
                        const endPct = ((bounds.endBeat - measureStart) / beatsPerMeasure) * 100;
                        return (
                          <>
                            <div className="midi-loop-boundary" style={{ left: `${startPct}%` }} />
                            <div className="midi-loop-boundary" style={{ left: `${endPct}%` }} />
                          </>
                        );
                      })()}
                    {playheadLeft !== null && mIdx === layerMeasureCol && (
                      <div
                        className="mroll-ph"
                        style={{ left: `${playheadLeft}%` }}
                        onPointerDown={handlePlayheadPointerDown}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <div className="midi-roll-area">
          <div
            className="combined-roll-stack"
          >
            {renderCombinedRoll("roll-a", 1)}
            {showStackedRoll && renderCombinedRoll("roll-b", 2)}
          </div>
        </div>
      </div>
    </div>
  );
}
