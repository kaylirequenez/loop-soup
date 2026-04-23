import { useMemo, useRef } from "react";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import { useLoopDefinitionStore } from "../store/loopDefinitionStore";
import { useTransportStore } from "../store/transportStore";
import { midiRollOctaveRows, parseKeyRootPitchClass } from "../lib/keyLayout";
import { readMidiCompositionBeat } from "../lib/midiPlayhead";
import { buildOverlapHeightStackRects } from "../lib/midiRollLayout";
import { LAYER_ORDER } from "../lib/layers";
import type { LayerId } from "../types/layer";
import { MidiRollNote } from "./midi-roll/MidiRollNote";
import { useMidiPlayheadScrub } from "./midi-roll/useMidiPlayheadScrub";
import { useMidiRollData } from "./midi-roll/useMidiRollData";

function lockDragSelect() {
  document.body.classList.add("drag-selection-lock");
}
function unlockDragSelect() {
  document.body.classList.remove("drag-selection-lock");
}

export default function MidiRoll() {
  const midiRollCount = useMidiStore((s) => s.midiRollCount);
  const meter = useTransportStore((s) => s.meter);
  const selectedLayer = useLayerEditorStore((s) => s.selectedLayerId);
  const layers = useLayerStore((s) => s.layers);
  const definitions = useLoopDefinitionStore((s) => s.definitions);
  const manualMutes = useLayerPlaybackStore((s) => s.manualMutes);
  const isPlaying = useTransportStore((s) => s.isPlaying);
  const setPlaying = useTransportStore((s) => s.setPlaying);
  const midiViewMeasureIndex = useMidiStore((s) => s.midiViewMeasureIndex);
  const midiMeasuresVisible = useMidiStore((s) => s.midiMeasuresVisible);
  const midiPlayheadBeat = useMidiStore((s) => s.midiPlayheadBeat);
  const setMidiPlayheadBeat = useMidiStore((s) => s.setMidiPlayheadBeat);
  const scrubResumeRef = useRef(false);
  const keyName = useTransportStore((s) => s.key);
  const masterLoopLength = useTransportStore((s) => s.masterLoopLength);
  const midiNoteSelection = useMidiStore((s) => s.midiNoteSelection);
  const applyMidiNoteTap = useMidiStore((s) => s.applyMidiNoteTap);
  const midiLoopRollPlacement = useMidiStore((s) => s.midiLoopRollPlacement);
  const midiRollSplitByRootOctave = useMidiStore((s) => s.midiRollSplitByRootOctave);
  const rootPitchClass = useMemo(() => parseKeyRootPitchClass(keyName), [keyName]);
  const octaveView = useMidiStore((s) => s.octaveView);
  const oneOctaveRows = useMemo(() => midiRollOctaveRows(rootPitchClass), [rootPitchClass]);
  const { beatsPerMeasure, beatLength, combinedNoteEvents, layerLoopPlacementAgreement, isNoteVisibleInMeasure } =
    useMidiRollData({
      layers,
      definitions,
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
  const visibleMeasureCount = Math.max(1, Math.min(midiMeasuresVisible, measureCount, 4));
  const layerBeat = readMidiCompositionBeat(midiPlayheadBeat, beatLength);
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

  const renderCombinedRoll = (key: string, rollSlot: 1 | 2) => {
    const globalMeasureIdx = Math.floor(layerBeat / beatsPerMeasure);
    const layerMeasureCol = measureCount > 0 ? Math.min(measureCount - 1, Math.max(0, globalMeasureIdx)) : 0;
    const beatInMeasure = ((layerBeat % beatsPerMeasure) + beatsPerMeasure) % beatsPerMeasure;
    const playheadInVisibleWindow =
      layerMeasureCol >= midiViewMeasureIndex &&
      layerMeasureCol < midiViewMeasureIndex + visibleMeasureCount;
    const playheadLeft = playheadInVisibleWindow ? (beatInMeasure / beatsPerMeasure) * 100 : null;
    const stripTranslatePct = measureCount > 0 ? (midiViewMeasureIndex / measureCount) * 100 : 0;
    const stripWidthPct = measureCount > 0 ? (measureCount / visibleMeasureCount) * 100 : 100;
    const rightmostVisibleMeasureIdx = midiViewMeasureIndex + visibleMeasureCount - 1;

    return (
      <div className="combined-roll-panel" key={key}>
        <div className="combined-roll-wrap">
          <div className="midi-roll-viewport">
            <div
              className="midi-roll-strip"
              style={{ width: `${stripWidthPct}%`, transform: `translateX(-${stripTranslatePct}%)` }}
            >
              {Array.from({ length: measureCount }).map((_, mIdx) => (
                <div className="midi-roll-measure" key={`${key}-m-${mIdx}`} style={{ flex: `0 0 calc(100% / ${measureCount})` }}>
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
                      <div className="midi-grid-line midi-grid-line-bar" style={{ left: 0 }} />
                      <div className="midi-grid-line midi-grid-line-bar" style={{ right: 0 }} />
                      {Array.from({ length: Math.max(0, beatsPerMeasure - 1) }).map((__, beatIdx) => (
                        <div
                          key={`${key}-m-${mIdx}-beat-${beatIdx}`}
                          className="midi-grid-line midi-grid-line-beat"
                          style={{ left: `${((beatIdx + 1) / beatsPerMeasure) * 100}%` }}
                        />
                      ))}
                    </div>
                    {oneOctaveRows.map((row, i) => (
                      <div key={`${key}-m-${mIdx}-${row.label}-${i}`} className="roll-row" style={{ top: `${(i / 12) * 100}%`, height: `${100 / 12}%` }}>
                        {(visibleMeasureCount <= 1 || mIdx === rightmostVisibleMeasureIdx) && (
                          <div className="row-note-label">{row.label}</div>
                        )}
                      </div>
                    ))}
                    {buildOverlapHeightStackRects(
                      combinedNoteEvents.filter((note) => isNoteVisibleInMeasure(note, rollSlot, mIdx)),
                      beatsPerMeasure,
                    ).map((rect, index) => {
                      const layerId = rect.layer as LayerId;
                      const placementOk = layerLoopPlacementAgreement[layerId] !== false;
                      const inSelectedLayer = layerId === selectedLayer;
                      const inSelectedLoop =
                        placementOk &&
                        midiNoteSelection &&
                        layerId === midiNoteSelection.layerId &&
                        rect.loopId === midiNoteSelection.loopId;
                      const dimSameLayerOtherLoop =
                        placementOk &&
                        midiNoteSelection &&
                        layerId === selectedLayer &&
                        layerId === midiNoteSelection.layerId &&
                        rect.loopId !== midiNoteSelection.loopId;
                      return (
                        <MidiRollNote
                          key={`${key}-${rect.noteKey ?? `${rect.layer}-${rect.loopId}-${rect.pitchClass}`}-${mIdx}-${index}`}
                          rect={{ ...rect, layer: layerId }}
                          inSelectedLayer={inSelectedLayer}
                          inSelectedLoop={Boolean(inSelectedLoop)}
                          dimSameLayerOtherLoop={Boolean(dimSameLayerOtherLoop)}
                          isMuted={Boolean(manualMutes[layerId])}
                          rollSlot={rollSlot}
                          onTap={applyMidiNoteTap}
                        />
                      );
                    })}
                    {playheadLeft !== null && mIdx === layerMeasureCol && (
                      <div className="mroll-ph" style={{ left: `${playheadLeft}%` }} onPointerDown={handlePlayheadPointerDown} />
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
          <div className="combined-roll-stack">
            {renderCombinedRoll("roll-a", 1)}
            {showStackedRoll && renderCombinedRoll("roll-b", 2)}
          </div>
        </div>
      </div>
    </div>
  );
}
