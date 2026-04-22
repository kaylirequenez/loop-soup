import { useEffect, useState } from "react";
import {
  isRepeatDisabled,
  loopNotesCanShiftOctave,
  maxMeasuresCompositionLimit,
  maxRepeatEveryForUnit,
  normalizeRepeatUnit,
  repeatEveryForUnit,
} from "../lib/loopModel";
import { oneBasedRange } from "../lib/range";
import type { BottomControlsProps } from "./bottom-controls/types";

const MAX_MEASURE_REPEAT_OPTION = 4;
const RESTART_BAR = { x: 2, y: 6.5, w: 2, h: 11, rx: 0.4 };
const RESTART_BAR_RIGHT = RESTART_BAR.x + RESTART_BAR.w;
const RESTART_DOUBLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 9 6.5 L 9 17.5 Z M 9 12 L 14 6.5 L 14 17.5 Z`;
const RESTART_SINGLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 11 6.5 L 11 17.5 Z`;
const RESTART_ICON_CENTER_X_COMPOSITION = 4;
const RESTART_ICON_CENTER_X_VIEW = 5.5;

function IconRestartComposition() {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg className="btn-restart-svg" viewBox="0 0 24 24" width={15} height={15} aria-hidden>
      <g transform={`translate(${RESTART_ICON_CENTER_X_COMPOSITION}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={RESTART_DOUBLE_CHEVRON_LEFT} />
      </g>
    </svg>
  );
}

function IconRestartView() {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg className="btn-restart-svg" viewBox="0 0 24 24" width={15} height={15} aria-hidden>
      <g transform={`translate(${RESTART_ICON_CENTER_X_VIEW}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={RESTART_SINGLE_CHEVRON_LEFT} />
      </g>
    </svg>
  );
}

function clampInt(n: string | number, min: number, max: number) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

export default function BottomControls({
  isPlaying,
  addOn,
  beatsPerMeasure,
  totalMeasures,
  activeLoop,
  repeatPhraseEnabled = true,
  repeatPlacementEnabled = true,
  phraseFieldSyncKey = "",
  onTogglePlay,
  onRestartTransport,
  onRestartPlayheadInView,
  onToggleAdd,
  onShiftLoopNotesOctave,
  onAddMeasure,
  onRemoveLastMeasure,
  canRemoveLastMeasure,
  onSetRepeatUnit,
  onToggleRepeatEvery,
  onSetStartMeasure,
  onSetRepeatEndMeasure,
}: BottomControlsProps) {
  const spanBeats = Math.max(1, Number(activeLoop?.spanBeats) || 1);
  const startMeasure = Math.max(1, Number(activeLoop?.startMeasure) || 1);
  const repeatUnit = normalizeRepeatUnit(activeLoop?.repeatUnit);
  const repeatEvery = repeatEveryForUnit(
    activeLoop ?? {
      repeatUnit: "measures",
      repeatEveryMeasuresMemory: null,
      repeatEveryBeatsMemory: null,
    },
  );
  const repeatEndMeasure = activeLoop?.repeatEndMeasure ?? null;
  const [startMeasureDraft, setStartMeasureDraft] = useState(() => String(startMeasure));
  const [endMeasureDraft, setEndMeasureDraft] = useState(() =>
    repeatEndMeasure == null ? "" : String(repeatEndMeasure),
  );
  const [endMeasureError, setEndMeasureError] = useState("");

  useEffect(() => setStartMeasureDraft(String(startMeasure)), [phraseFieldSyncKey, startMeasure]);
  useEffect(
    () => setEndMeasureDraft(repeatEndMeasure == null ? "" : String(repeatEndMeasure)),
    [phraseFieldSyncKey, repeatEndMeasure, repeatEvery, repeatUnit],
  );
  useEffect(() => {
    if (!endMeasureError) return undefined;
    const timeoutId = window.setTimeout(() => setEndMeasureError(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [endMeasureError]);

  const maxBeatRepeatOption = Math.max(0, beatsPerMeasure - 1);
  const commitStartMeasure = () => {
    const t = startMeasureDraft.trim();
    if (t === "") {
      onSetStartMeasure(1);
      setStartMeasureDraft("1");
      return;
    }
    const v = clampInt(t, 1, totalMeasures);
    onSetStartMeasure(v);
    setStartMeasureDraft(String(v));
  };

  const commitEndMeasure = () => {
    if (repeatUnit !== "measures" || repeatEvery == null) return;
    const t = endMeasureDraft.trim();
    if (t === "") {
      onSetRepeatEndMeasure(null);
      setEndMeasureDraft("");
      setEndMeasureError("");
      return;
    }
    const maxCap = maxMeasuresCompositionLimit(beatsPerMeasure);
    const parsedRaw = Number.parseInt(t, 10);
    if (!Number.isFinite(parsedRaw)) {
      setEndMeasureDraft(repeatEndMeasure == null ? "" : String(repeatEndMeasure));
      return;
    }
    const minEnd = startMeasure + 1;
    const v = Math.min(Math.max(parsedRaw, minEnd), maxCap);
    if (parsedRaw > maxCap) {
      onSetRepeatEndMeasure(v);
      setEndMeasureDraft(String(v));
      setEndMeasureError(`End measure must be at most ${maxCap} (composition limit).`);
      return;
    }
    setEndMeasureError("");
    onSetRepeatEndMeasure(v);
    setEndMeasureDraft(String(v));
  };

  const loopNotes = activeLoop?.notes ?? [];
  const canTransposeDown = repeatPhraseEnabled && loopNotesCanShiftOctave(loopNotes, -1);
  const canTransposeUp = repeatPhraseEnabled && loopNotesCanShiftOctave(loopNotes, 1);

  return (
    <div className="bottom"><div className="bottom-bar">{/* existing markup retained */}
      {/* transport */}
      <div className="cluster"><div className="clbl2">transport</div><div className="ctrls">
        <button className={`btn-play ${isPlaying ? "btn-play-on" : ""}`} onClick={onTogglePlay}>{isPlaying ? "⏸" : "▶"}</button>
        <button type="button" className="btn-restart" onClick={onRestartTransport}><IconRestartComposition /></button>
        <button type="button" className="btn-restart" onClick={onRestartPlayheadInView}><IconRestartView /></button>
        <button className={`btn-add ${addOn ? "btn-add-on" : ""}`} onClick={onToggleAdd}>+</button>
      </div></div>
      <div className="sep" />
      <div className="cluster"><div className="clbl2">extend</div><div className="ctrls ctrls-extend">
        <button type="button" className="btn" onClick={onAddMeasure}>+ measure</button>
        <button type="button" className="btn" onClick={onRemoveLastMeasure} disabled={!canRemoveLastMeasure}>- measure</button>
      </div></div>
      <div className="sep" />
      <div className="cluster cluster-repeat cluster-repeat-split">
        <div className={`repeat-split-col ${!repeatPlacementEnabled ? "cluster-repeat--locked" : ""}`}>
          <div className="clbl2">placement</div>
          <div className="repeat-meta placement-measures-row repeat-split-values">
            <label className="repeat-field">
              <span className="repeat-field-lbl">Starts measure</span>
              <input
                type="text"
                inputMode="numeric"
                className="repeat-num"
                value={startMeasureDraft}
                disabled={!repeatPlacementEnabled}
                onChange={(e) => setStartMeasureDraft(e.target.value)}
                onBlur={commitStartMeasure}
              />
            </label>
            <label className={`repeat-field repeat-field--error-anchor ${repeatUnit !== "measures" || repeatEvery == null ? "repeat-field--inactive" : ""}`}>
              {endMeasureError ? <div className="stat-error">{endMeasureError}</div> : null}
              <span className="repeat-field-lbl">Ends measure</span>
              <input
                type="text"
                inputMode="numeric"
                className="repeat-num"
                value={endMeasureDraft}
                disabled={!repeatPlacementEnabled || repeatUnit !== "measures" || repeatEvery == null}
                onChange={(e) => {
                  setEndMeasureDraft(e.target.value);
                  setEndMeasureError("");
                }}
                onBlur={commitEndMeasure}
              />
            </label>
          </div>
        </div>
        <div className="sep" />
        <div className={`repeat-split-col ${!repeatPlacementEnabled ? "cluster-repeat--locked" : ""}`}>
          <div className="repeat-header-inline">
            <div className="clbl2">repeat every n</div>
            <div className="ctrls ctrls-wrap">
              {["measures", "beats"].map((value) => (
                <button
                  key={`u-${value}`}
                  type="button"
                  className={`rep-btn ${repeatUnit === value ? "rep-on" : ""}`}
                  disabled={!repeatPlacementEnabled}
                  onClick={() => onSetRepeatUnit(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="repeat-block repeat-block--toggles"><div className="repeat-sub"><div className="ctrls ctrls-wrap repeat-split-values">
            {oneBasedRange(repeatUnit === "measures" ? MAX_MEASURE_REPEAT_OPTION : maxBeatRepeatOption).map((n) => {
              const disabled = !repeatPlacementEnabled || isRepeatDisabled(spanBeats, beatsPerMeasure, repeatUnit, n) || n > maxRepeatEveryForUnit(repeatUnit, beatsPerMeasure);
              return (
                <button key={`r-${repeatUnit}-${n}`} type="button" className={`rep-btn ${repeatEvery === n ? "rep-on" : ""}`} disabled={disabled} onClick={() => onToggleRepeatEvery(n)}>{n}</button>
              );
            })}
          </div></div></div>
        </div>
        <div className="sep" />
        <div className="repeat-split-col repeat-split-col-transpose">
          <div className="clbl2">octave</div>
          <div className="transpose-block repeat-split-values">
            <div className={`transpose-row ${!repeatPhraseEnabled ? "cluster-repeat--locked" : ""}`}>
              <div className="ctrls ctrls-oct">
                <button type="button" className="btn" disabled={!canTransposeDown} onClick={() => onShiftLoopNotesOctave(-1)}>-</button>
                <button type="button" className="btn" disabled={!canTransposeUp} onClick={() => onShiftLoopNotesOctave(1)}>+</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div></div>
  );
}
