import { useMemo } from "react";
import type { CSSProperties, PointerEvent } from "react";
import {
  useCompositionViewActions,
  useCompositionViewState,
} from "../store/hooks";
import { getMidiLoopRollPlacement } from "../store/utils/midiPlacement";
import { beatsPerMeasureFromMeter, compositionLoopBeatLength } from "../lib/midiPlayhead";
import { phraseGlobalStartBeat, repeatOffsetsFromLoop } from "../lib/midiRollExpand";
import type { LayerLoop, MidiRollPlacement } from "../types/model";

const MAX_VISIBLE_ROWS = 6;
const LOOP_ROLL_PLACEMENT_UI: Array<{ key: string; value: MidiRollPlacement; label: string; title: string }> = [
  { key: "1", value: "1", label: "1", title: "Show on roll 1 only" },
  { key: "2", value: "2", label: "2", title: "Show on roll 2 only" },
  { key: "both", value: "both", label: "1+2", title: "Show on both rolls" },
];

function rowHeightForLoopCount(loopCount: number) {
  if (loopCount <= 1) return 24;
  if (loopCount === 2) return 20;
  if (loopCount === 3) return 17;
  return 14;
}

function loopSegments(loop: LayerLoop, beatsPerMeasure: number, compositionBeats: number) {
  const span = Math.max(1, Math.floor(loop?.spanBeats) || 1);
  const baseStart = phraseGlobalStartBeat(loop, beatsPerMeasure);
  return repeatOffsetsFromLoop(loop, beatsPerMeasure, compositionBeats)
    .map((offset) => {
      const startBeat = baseStart + offset;
      const endBeat = Math.min(compositionBeats, startBeat + span);
      if (endBeat <= 0 || startBeat >= compositionBeats || endBeat <= startBeat) {
        return null;
      }
      return { startBeat: Math.max(0, startBeat), endBeat };
    })
    .filter((v): v is { startBeat: number; endBeat: number } => v !== null);
}

export default function CompositionView() {
  const {
    selectedLayer,
    layers,
    meter,
    masterLoopLength,
    midiPlayheadBeat,
    midiNoteSelection,
    midiRollCount,
    midiRollSplitByRootOctave,
    midiLoopRollPlacement,
  } = useCompositionViewState();
  const {
    setLayerLoopPhraseSelection,
    seekCompositionTimelineToBeat,
    setMidiLoopRollPlacement,
  } = useCompositionViewActions();
  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const compositionBeats = compositionLoopBeatLength(masterLoopLength, beatsPerMeasure);
  const measureCount = Math.max(1, Math.ceil(compositionBeats / beatsPerMeasure));
  const nowBeat = Math.min(Math.max(0, midiPlayheadBeat ?? 0), compositionBeats - 1e-6);
  const playheadLeftPct = (nowBeat / compositionBeats) * 100;
  const loops = useMemo(() => layers[selectedLayer].loops, [layers, selectedLayer]);
  const visibleRows = Math.min(MAX_VISIBLE_ROWS, Math.max(1, loops.length));
  const rowHeight = rowHeightForLoopCount(loops.length);
  const showRollPlacement = midiRollCount >= 2 && !midiRollSplitByRootOctave;

  const selectedLoopIndex = useMemo(() => {
    if (!midiNoteSelection || midiNoteSelection.layerId !== selectedLayer || loops.length === 0) {
      return -1;
    }
    return loops.findIndex((loop) => loop.id === midiNoteSelection.loopId);
  }, [midiNoteSelection, selectedLayer, loops]);

  const onCompositionTrackPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) {
      return;
    }
    const frac = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    seekCompositionTimelineToBeat(frac * compositionBeats);
  };

  const loopOfLabel = `loop ${selectedLoopIndex >= 0 ? selectedLoopIndex + 1 : "_"} of ${loops.length}`;
  const compRowsStyle = {
    "--visible-comp-rows": String(visibleRows),
    "--comp-row-height": `${rowHeight}px`,
  } as CSSProperties;

  return (
    <div className="comp-zone">
      <div className={`comp-hdr ${showRollPlacement ? "comp-hdr--roll-pick" : ""}`}>
        <div className="comp-hdr-spacer" aria-hidden="true" />
        <div className="comp-hdr-track-band">
          <span className="comp-hdr-layer">{`Layer ${selectedLayer}`}</span>
          <span className="comp-hdr-loop-of" aria-live="polite">{loopOfLabel}</span>
        </div>
        {showRollPlacement ? (
          <div className="comp-hdr-midi-roll-label" title="Which MIDI roll shows each loop when two rolls are stacked">
            MIDI view
          </div>
        ) : null}
      </div>
      <div className={`comp-rows ${showRollPlacement ? "comp-rows--roll-pick" : ""}`} style={compRowsStyle}>
        <div className="comp-nowbar-wrap">
          <div className="comp-nowbar" style={{ left: `${playheadLeftPct}%` }} />
        </div>
        {loops.map((loop, idx) => {
          const bars = loopSegments(loop, beatsPerMeasure, compositionBeats);
          const isSelected = idx === selectedLoopIndex;
          const rollPlacement = getMidiLoopRollPlacement(midiLoopRollPlacement, selectedLayer, loop.id);
          return (
            <div className={`crow ${showRollPlacement ? "crow--roll-pick" : ""}`} key={loop.id}>
              <button
                type="button"
                className={`clbl clbl-loop-select ${isSelected ? "clbl-loop-select--on" : ""}`}
                onClick={() => setLayerLoopPhraseSelection(selectedLayer, isSelected ? null : idx)}
                aria-pressed={isSelected}
              >
                <span className="clbl-loop-select-mark" aria-hidden="true">{idx + 1}</span>
              </button>
              <button
                type="button"
                className={`ctrack ${isSelected ? "ctrack-selected" : ""}`}
                onPointerDown={onCompositionTrackPointerDown}
                aria-label="Seek playhead on composition timeline"
              >
                {Array.from({ length: Math.max(0, measureCount - 1) }).map((_, measureIdx) => (
                  <div
                    key={`m-${loop.id}-${measureIdx}`}
                    className="comp-measure-divider"
                    style={{ left: `${(((measureIdx + 1) * beatsPerMeasure) / compositionBeats) * 100}%` }}
                  />
                ))}
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
              {showRollPlacement && (
                <div
                  className="comp-roll-placement"
                  role="group"
                  aria-label={`MIDI roll assignment for loop ${idx + 1}`}
                  onClick={(event) => event.stopPropagation()}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  {LOOP_ROLL_PLACEMENT_UI.map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      className={`comp-roll-placement-btn ${rollPlacement === opt.value ? "comp-roll-placement-btn--on" : ""}`}
                      title={opt.title}
                      aria-pressed={rollPlacement === opt.value}
                      onClick={() => setMidiLoopRollPlacement(selectedLayer, loop.id, opt.value)}
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
