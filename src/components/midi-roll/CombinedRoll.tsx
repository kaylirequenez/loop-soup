import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../../store/midiStore";
import { useLayerEditorStore } from "../../store/layerEditorStore";
import { useLayerPlaybackStore } from "../../store/layerPlaybackStore";
import { useCompositionStore } from "../../store/compositionStore";
import { buildOverlapHeightStackRects } from "./midiRollLayout";
import { usePlayheadDrag } from "../../hooks/usePlayheadDrag";
import { MidiRollNote } from "./MidiRollNote";
import { Nowbar } from "../Nowbar";
import { chromaticOctaveRows } from "../../utils/pitch";
import type { CombinedNoteEvent, RollSlot } from "../../types/midi";

interface CombinedRollProps {
  rollSlot: RollSlot;
  combinedNoteEvents: CombinedNoteEvent[];
  isNoteVisibleInMeasure: (
    note: CombinedNoteEvent,
    rollSlot: RollSlot,
    measureIndex: number,
  ) => boolean;
  beatsPerMeasure: number;
  beatLength: number;
}

export function CombinedRoll({
  rollSlot,
  combinedNoteEvents,
  isNoteVisibleInMeasure,
  beatsPerMeasure,
  beatLength,
}: CombinedRollProps) {
  const {
    midiViewMeasureIndex,
    midiMeasuresVisible,
    midiPlayheadBeat,
    midiLayerPlacement,
  } = useMidiStore(
    useShallow((s) => ({
      midiViewMeasureIndex: s.midiViewMeasureIndex,
      midiMeasuresVisible: s.midiMeasuresVisible,
      midiPlayheadBeat: s.midiPlayheadBeat,
      midiLayerPlacement: s.midiLayerPlacement,
    })),
  );
  const musicalKey = useCompositionStore((s) => s.key);
  const { selectedLayerId, selectedLoopId } = useLayerEditorStore(
    useShallow((s) => ({
      selectedLayerId: s.selectedLayerId,
      selectedLoopId: s.selectedLoopId,
    })),
  );
  const manualMutes = useLayerPlaybackStore((s) => s.manualMutes);
  const rowLabels = useMemo(() => chromaticOctaveRows(musicalKey), [musicalKey]);

  const measureCount = Math.max(1, Math.ceil(beatLength / beatsPerMeasure));
  const visibleMeasureCount = Math.max(
    1,
    Math.min(midiMeasuresVisible, measureCount, 4),
  );
  const stripTranslatePct =
    measureCount > 0 ? (midiViewMeasureIndex / measureCount) * 100 : 0;
  const stripWidthPct =
    measureCount > 0 ? (measureCount / visibleMeasureCount) * 100 : 100;
  const rightmostVisibleMeasureIdx = midiViewMeasureIndex + visibleMeasureCount - 1;
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
            className="midi-roll-strip"
            style={{
              width: `${stripWidthPct}%`,
              transform: `translateX(-${stripTranslatePct}%)`,
            }}
          >
            {Array.from({ length: measureCount }).map((_, mIdx) => (
              <div
                className="midi-roll-measure"
                key={`r${rollSlot}-m-${mIdx}`}
                style={{ flex: `0 0 calc(100% / ${measureCount})` }}
              >
                <div className="combined-roll">
                  <div className="midi-grid-overlay" aria-hidden="true">
                    {Array.from({ length: beatsPerMeasure }).map((__, slotIdx) => {
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
                    })}
                    <div className="midi-grid-line midi-grid-line-bar" style={{ left: 0 }} />
                    <div className="midi-grid-line midi-grid-line-bar" style={{ right: 0 }} />
                    {Array.from({ length: Math.max(0, beatsPerMeasure - 1) }).map(
                      (__, beatIdx) => (
                        <div
                          key={`r${rollSlot}-m${mIdx}-b${beatIdx}`}
                          className="midi-grid-line midi-grid-line-beat"
                          style={{ left: `${((beatIdx + 1) / beatsPerMeasure) * 100}%` }}
                        />
                      ),
                    )}
                  </div>
                  {rowLabels.map((label, i) => (
                    <div
                      key={`r${rollSlot}-m${mIdx}-row${i}`}
                      className="roll-row"
                      style={{ top: `${(i / 12) * 100}%`, height: `${100 / 12}%` }}
                    >
                      {(visibleMeasureCount <= 1 || mIdx === rightmostVisibleMeasureIdx) && (
                        <div className="row-note-label">{label}</div>
                      )}
                    </div>
                  ))}
                  {buildOverlapHeightStackRects(
                    combinedNoteEvents.filter((note) =>
                      isNoteVisibleInMeasure(note, rollSlot, mIdx),
                    ),
                    beatsPerMeasure,
                  ).map((rect, index) => {
                    const placementOk = midiLayerPlacement[rect.layer] !== null;
                    const inSelectedLayer = rect.layer === selectedLayerId;
                    const inSelectedLoop =
                      placementOk &&
                      selectedLoopId != null &&
                      inSelectedLayer &&
                      rect.layerLoopId === selectedLoopId;
                    const dimSameLayerOtherLoop =
                      placementOk &&
                      selectedLoopId != null &&
                      inSelectedLayer &&
                      rect.layerLoopId !== selectedLoopId;
                    return (
                      <MidiRollNote
                        key={`r${rollSlot}-${rect.noteKey}-${mIdx}-${index}`}
                        rect={rect}
                        inSelectedLayer={inSelectedLayer}
                        inSelectedLoop={Boolean(inSelectedLoop)}
                        dimSameLayerOtherLoop={Boolean(dimSameLayerOtherLoop)}
                        isMuted={Boolean(manualMutes[rect.layer])}
                        rollSlot={rollSlot}
                      />
                    );
                  })}
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
        </div>
      </div>
    </div>
  );
}
