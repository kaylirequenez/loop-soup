import { useMemo } from "react";
import { getMidiLoopRollPlacement, useAppStore } from "../store/appStore";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
} from "../lib/midiPlayhead";
import {
  phraseGlobalStartBeat,
  repeatOffsetsFromLoop,
} from "../lib/midiRollExpand";

const MAX_VISIBLE_ROWS = 6;

const LOOP_ROLL_PLACEMENT_UI = [
  { key: "1", value: "1", label: "1", title: "Show on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show on roll 2 only" },
  { key: "both", value: "both", label: "1+2", title: "Show on both rolls" },
];

function rowHeightForLoopCount(loopCount) {
  if (loopCount <= 1) {
    return 24;
  }
  if (loopCount === 2) {
    return 20;
  }
  if (loopCount === 3) {
    return 17;
  }
  return 14;
}

function loopSegments(loop, beatsPerMeasure, compositionBeats) {
  const span = Math.max(1, Math.floor(loop?.spanBeats) || 1);
  const baseStart = phraseGlobalStartBeat(loop, beatsPerMeasure);
  return repeatOffsetsFromLoop(loop, beatsPerMeasure, compositionBeats)
    .map((offset) => {
      const startBeat = baseStart + offset;
      const endBeat = Math.min(compositionBeats, startBeat + span);
      if (
        endBeat <= 0 ||
        startBeat >= compositionBeats ||
        endBeat <= startBeat
      ) {
        return null;
      }
      return {
        startBeat: Math.max(0, startBeat),
        endBeat,
      };
    })
    .filter(Boolean);
}

export default function CompositionView() {
  const selectedLayer = useAppStore((s) => s.selectedLayer);
  const layers = useAppStore((s) => s.layers);
  const meter = useAppStore((s) => s.meter);
  const masterLoopLength = useAppStore((s) => s.masterLoopLength);
  const midiPlayheadBeat = useAppStore((s) => s.midiPlayheadBeat);
  const midiNoteSelection = useAppStore((s) => s.midiNoteSelection);
  const setLayerLoopPhraseSelection = useAppStore(
    (s) => s.setLayerLoopPhraseSelection,
  );
  const seekCompositionTimelineToBeat = useAppStore(
    (s) => s.seekCompositionTimelineToBeat,
  );
  const midiRollCount = useAppStore((s) => s.midiRollCount);
  const midiRollSplitByRootOctave = useAppStore(
    (s) => s.midiRollSplitByRootOctave,
  );
  const midiLoopRollPlacement = useAppStore((s) => s.midiLoopRollPlacement);
  const setMidiLoopRollPlacement = useAppStore(
    (s) => s.setMidiLoopRollPlacement,
  );
  const midiLoopEditMode = useAppStore((s) => s.midiLoopEditMode);
  const toggleMidiLoopEditFromComposition = useAppStore(
    (s) => s.toggleMidiLoopEditFromComposition,
  );

  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const compositionBeats = compositionLoopBeatLength(
    masterLoopLength,
    beatsPerMeasure,
  );
  const measureCount = Math.max(
    1,
    Math.ceil(compositionBeats / beatsPerMeasure),
  );
  const nowBeat = Math.min(
    Math.max(0, midiPlayheadBeat ?? 0),
    compositionBeats - 1e-6,
  );
  const playheadLeftPct = (nowBeat / compositionBeats) * 100;
  const loops = useMemo(
    () => layers[selectedLayer]?.loops ?? [],
    [layers, selectedLayer],
  );
  const visibleRows = Math.min(MAX_VISIBLE_ROWS, Math.max(1, loops.length));
  const rowHeight = rowHeightForLoopCount(loops.length);
  const showRollPlacement = midiRollCount >= 2 && !midiRollSplitByRootOctave;
  const loopSelectDisabled = midiRollSplitByRootOctave;

  const selectedLoopIndex = useMemo(() => {
    if (
      !midiNoteSelection ||
      midiNoteSelection.layerId !== selectedLayer ||
      loops.length === 0
    ) {
      return -1;
    }
    return loops.findIndex((loop) => loop.id === midiNoteSelection.loopId);
  }, [midiNoteSelection, selectedLayer, loops]);

  const onCompositionTrackPointerDown = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    if (w <= 0) {
      return;
    }
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / w));
    seekCompositionTimelineToBeat(frac * compositionBeats);
  };

  const loopOfLabel = `loop ${selectedLoopIndex >= 0 ? selectedLoopIndex + 1 : "_"} of ${loops.length}`;

  return (
    <div className="comp-zone">
      <div
        className={`comp-hdr ${showRollPlacement ? "comp-hdr--roll-pick" : ""}`}
      >
        <div className="comp-hdr-spacer" aria-hidden="true" />
        <div className="comp-hdr-track-band">
          <span className="comp-hdr-layer">{`Layer ${selectedLayer}`}</span>
          <span className="comp-hdr-loop-of" aria-live="polite">
            {loopOfLabel}
          </span>
        </div>
        {showRollPlacement ? (
          <div
            className="comp-hdr-midi-roll-label"
            title="Which MIDI roll shows each loop when two rolls are stacked"
          >
            MIDI view
          </div>
        ) : null}
      </div>
      <div
        className={`comp-rows ${showRollPlacement ? "comp-rows--roll-pick" : ""}`}
        style={{
          "--visible-comp-rows": String(visibleRows),
          "--comp-row-height": `${rowHeight}px`,
        }}
      >
        <div className="comp-nowbar-wrap">
          <div
            className="comp-nowbar"
            style={{ left: `${playheadLeftPct}%` }}
          />
        </div>
        {loops.map((loop, idx) => {
          const bars = loopSegments(loop, beatsPerMeasure, compositionBeats);
          const isSelected = idx === selectedLoopIndex;
          const toggleLoopFromComposition = () => {
            if (loopSelectDisabled) {
              return;
            }
            setLayerLoopPhraseSelection(selectedLayer, isSelected ? null : idx);
          };
          const rollPlacement = getMidiLoopRollPlacement(
            midiLoopRollPlacement,
            selectedLayer,
            loop.id,
          );
          return (
            <div
              className={`crow ${showRollPlacement ? "crow--roll-pick" : ""}`}
              key={loop.id}
            >
              <button
                type="button"
                className={`clbl clbl-loop-select ${isSelected ? "clbl-loop-select--on" : ""}`}
                disabled={loopSelectDisabled}
                onClick={toggleLoopFromComposition}
                aria-pressed={isSelected}
                title={
                  loopSelectDisabled
                    ? "Loop selection is disabled while MIDI rolls use root/octave split"
                    : isSelected
                      ? `Editing loop ${idx + 1} — click to stop editing`
                      : `Select loop ${idx + 1} for editing in the MIDI roll`
                }
              >
                <span className="clbl-loop-select-mark" aria-hidden="true">
                  {idx + 1}
                </span>
              </button>
              <button
                type="button"
                className={`ctrack ${isSelected ? "ctrack-selected" : ""}`}
                onPointerDown={onCompositionTrackPointerDown}
                aria-label="Seek playhead on composition timeline"
              >
                {Array.from({ length: Math.max(0, measureCount - 1) }).map(
                  (_, measureIdx) => (
                    <div
                      key={`m-${loop.id}-${measureIdx}`}
                      className="comp-measure-divider"
                      style={{
                        left: `${(((measureIdx + 1) * beatsPerMeasure) / compositionBeats) * 100}%`,
                      }}
                    />
                  ),
                )}
                {bars.map((bar, barIdx) => (
                  <div
                    key={`b-${loop.id}-${barIdx}`}
                    className={`cblock mnote-${selectedLayer.toLowerCase()} mnote-loop-${idx % 4} ${isSelected ? "mnote-focus mnote-layer-selected" : "mnote-layer-unselected"}`}
                    style={{
                      left: `${(bar.startBeat / compositionBeats) * 100}%`,
                      width: `${((bar.endBeat - bar.startBeat) / compositionBeats) * 100}%`,
                    }}
                  />
                ))}
              </button>
              <button
                type="button"
                className={`comp-loop-edit-btn ${
                  midiLoopEditMode?.layerId === selectedLayer &&
                  midiLoopEditMode?.loopId === loop.id
                    ? "comp-loop-edit-btn--on"
                    : ""
                }`}
                disabled={loopSelectDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMidiLoopEditFromComposition(selectedLayer, idx);
                }}
                title={
                  loopSelectDisabled
                    ? "Unavailable while rolls use root/octave split"
                    : midiLoopEditMode?.layerId === selectedLayer &&
                        midiLoopEditMode?.loopId === loop.id
                      ? "Exit MIDI pattern edit"
                      : "Edit MIDI pattern for this loop"
                }
              >
                edit
              </button>
              {showRollPlacement && (
                <div
                  className="comp-roll-placement"
                  role="group"
                  aria-label={`MIDI roll assignment for loop ${idx + 1}`}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  {LOOP_ROLL_PLACEMENT_UI.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`comp-roll-placement-btn ${
                        rollPlacement === opt.value
                          ? "comp-roll-placement-btn--on"
                          : ""
                      }`}
                      title={opt.title}
                      aria-pressed={rollPlacement === opt.value}
                      onClick={() =>
                        setMidiLoopRollPlacement(
                          selectedLayer,
                          loop.id,
                          opt.value,
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
