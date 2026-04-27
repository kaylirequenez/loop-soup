import { Fragment, useCallback, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  listLayerLoopInstancesSorted,
} from "../lib/layerRuntime";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useCompositionStore } from "../store/compositionStore";
import { useTransportStore } from "../store/transportStore";
import { repeatOffsetsFromLoop } from "../utils/midiRollExpand";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { Nowbar } from "./Nowbar";
import type { LayerLoop, LayerLoopInstance } from "../types/layer";
import type { MidiRollPlacement } from "../types/midi";
import { compositionLoopBeatLength } from "../utils/compositionState";

const MAX_VISIBLE_ROWS = 6;
const LOOP_ROLL_PLACEMENT_UI: Array<{
  key: string;
  value: MidiRollPlacement;
  label: string;
  title: string;
}> = [
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

function loopSegments(
  loop: LayerLoop,
  instance: LayerLoopInstance,
  beatsPerMeasure: number,
  compositionBeats: number,
) {
  const span = loop.definition.spanBeats;
  return repeatOffsetsFromLoop(
    instance,
    span,
    beatsPerMeasure,
    compositionBeats,
  )
    .map((offset) => {
      const startBeat = instance.startBeat + offset;
      const endBeat = Math.min(compositionBeats, startBeat + span);
      if (
        endBeat <= 0 ||
        startBeat >= compositionBeats ||
        endBeat <= startBeat
      ) {
        return null;
      }
      return { startBeat: Math.max(0, startBeat), endBeat };
    })
    .filter((v): v is { startBeat: number; endBeat: number } => v !== null);
}

export default function CompositionView() {
  const { selectedLayerId, selectedLoopId, selectedInstanceId } =
    useLayerEditorStore(
      useShallow((s) => ({
        selectedLayerId: s.selectedLayerId,
        selectedLoopId: s.selectedLoopId,
        selectedInstanceId: s.selectedInstanceId,
      })),
    );
  const { toggleLoopSelection, toggleInstanceSelection } = useLayerEditorStore(
    useShallow((s) => ({
      toggleLoopSelection: s.toggleLoopSelection,
      toggleInstanceSelection: s.toggleInstanceSelection,
    })),
  );
  const layers = useLayerStore((s) => s.layers);
  const { meter, totalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      totalMeasures: s.totalMeasures,
    })),
  );
  const {
    midiPlayheadBeat,
    midiRollCount,
    midiRollSplitByRootOctave,
    midiLoopRollPlacement,
    setMidiLoopRollPlacement,
    setMidiPlayheadBeat,
    setMidiViewMeasureIndex,
    midiMeasuresVisible,
  } = useMidiStore(
    useShallow((s) => ({
      midiPlayheadBeat: s.midiPlayheadBeat,
      midiRollCount: s.midiRollCount,
      midiRollSplitByRootOctave: s.midiRollSplitByRootOctave,
      midiLoopRollPlacement: s.midiLoopRollPlacement,
      setMidiLoopRollPlacement: s.setMidiLoopRollPlacement,
      setMidiPlayheadBeat: s.setMidiPlayheadBeat,
      setMidiViewMeasureIndex: s.setMidiViewMeasureIndex,
      midiMeasuresVisible: s.midiMeasuresVisible,
    })),
  );

  const beatsPerMeasure = meter.beatsPerMeasure;
  const compositionBeats = compositionLoopBeatLength(
    totalMeasures,
    beatsPerMeasure,
  );
  const measureCount = Math.max(
    1,
    Math.ceil(compositionBeats / beatsPerMeasure),
  );

  const loops = useMemo(
    () => Object.values(layers[selectedLayerId].layerLoops),
    [layers, selectedLayerId],
  );
  const visibleRows = Math.min(MAX_VISIBLE_ROWS, Math.max(1, loops.length));
  const rowHeight = rowHeightForLoopCount(loops.length);
  const showRollPlacement = midiRollCount >= 2 && !midiRollSplitByRootOctave;

  const selectedLoopIndex = useMemo(() => {
    if (selectedLoopId == null || loops.length === 0) return -1;
    return loops.findIndex((loop) => loop.id === selectedLoopId);
  }, [selectedLoopId, loops]);

  const rulerWasPlayingRef = useRef(false);

  const getBeat = useCallback(
    (el: HTMLElement, clientX: number) => {
      const rect = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.min(frac * compositionBeats, compositionBeats - 1e-6);
    },
    [compositionBeats],
  );

  const handleRulerDrag = usePointerDrag<HTMLDivElement>({
    onStart: (el, event) => {
      const t = useTransportStore.getState();
      rulerWasPlayingRef.current = t.isPlaying;
      if (t.isPlaying) t.setPlaying(false);
      setMidiPlayheadBeat(getBeat(el, event.clientX));
    },
    onMove: (el, event) => {
      setMidiPlayheadBeat(getBeat(el, event.clientX));
    },
    onEnd: () => {
      const beat = useMidiStore.getState().midiPlayheadBeat;
      const targetMeasure = Math.floor(beat / beatsPerMeasure);
      const maxStart = Math.max(0, totalMeasures - midiMeasuresVisible);
      setMidiViewMeasureIndex(Math.max(0, Math.min(maxStart, targetMeasure)));
      if (rulerWasPlayingRef.current) {
        const t = useTransportStore.getState();
        t.setPlaying(true);
        t.bumpTransportNonce();
      }
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
      {/* Ruler row */}
      <div className="comp-layer-lbl">{`Layer ${selectedLayerId}`}</div>
      <div
        className="comp-ruler-track"
        onPointerDown={handleRulerDrag}
        aria-label="Seek playhead"
      >
        {Array.from({ length: measureCount }).map((_, mIdx) => (
          <div
            key={`ruler-m-${mIdx}`}
            className="comp-ruler-measure"
            style={{
              left: `${(mIdx / measureCount) * 100}%`,
              width: `${100 / measureCount}%`,
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

      {/* Loop rows */}
      {loops.map((loop, idx) => {
        const instances = listLayerLoopInstancesSorted(loop);
        const isLoopSelected = idx === selectedLoopIndex;
        const rollPlacement =
          midiLoopRollPlacement[selectedLayerId]?.[loop.id] ?? "both";
        return (
          <Fragment key={loop.id}>
            <button
              type="button"
              className={`clbl clbl-loop-select ${isLoopSelected ? "clbl-loop-select--on" : ""}`}
              onClick={() => toggleLoopSelection(selectedLayerId, loop.id)}
              aria-pressed={isLoopSelected}
            >
              <span className="clbl-loop-select-mark" aria-hidden="true">
                {idx + 1}
              </span>
            </button>
            <div
              className={`ctrack ${isLoopSelected ? "ctrack-selected" : ""}`}
              onClick={() => toggleLoopSelection(selectedLayerId, loop.id)}
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
              {instances.flatMap((instance) =>
                loopSegments(
                  loop,
                  instance,
                  beatsPerMeasure,
                  compositionBeats,
                ).map((bar, barIdx) => {
                  const isInstanceSelected = selectedInstanceId === instance.id;
                  return (
                    <button
                      key={`b-${loop.id}-${instance.id}-${barIdx}`}
                      type="button"
                      className={`cblock mnote-${selectedLayerId.toLowerCase()} mnote-loop-${idx % 4} ${
                        isLoopSelected
                          ? isInstanceSelected
                            ? "cblock--instance-selected"
                            : "cblock--instance-unselected"
                          : "mnote-layer-unselected"
                      }`}
                      style={{
                        left: `${(bar.startBeat / compositionBeats) * 100}%`,
                        width: `${((bar.endBeat - bar.startBeat) / compositionBeats) * 100}%`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleInstanceSelection(selectedLayerId, loop.id, instance.id);
                      }}
                      aria-pressed={isInstanceSelected}
                    />
                  );
                }),
              )}
            </div>
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
                    className={`comp-roll-placement-btn ${rollPlacement === opt.value ? "comp-roll-placement-btn--on" : ""}`}
                    title={opt.title}
                    aria-pressed={rollPlacement === opt.value}
                    onClick={() =>
                      setMidiLoopRollPlacement(
                        selectedLayerId,
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
          </Fragment>
        );
      })}

      {/* Nowbar spanning the full track column */}
      <div
        className={`comp-nowbar-wrap ${showRollPlacement ? "comp-nowbar-wrap--roll-pick" : ""}`}
      >
        <Nowbar
          beat={midiPlayheadBeat}
          startBeat={0}
          endBeat={compositionBeats}
          className="comp-nowbar"
        />
      </div>
    </div>
  );
}
