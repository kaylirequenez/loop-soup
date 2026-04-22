import { useEffect, useState } from "react";
import {
  isRepeatDisabled,
  loopNotesCanShiftOctave,
  maxMeasuresCompositionLimit,
  maxRepeatEveryForUnit,
  normalizeRepeatUnit,
} from "../lib/loopModel";
import { oneBasedRange } from "../lib/range";

const MAX_MEASURE_REPEAT_OPTION = 4;

/** Shared vertical bar (flush with triangle tips at x = bar right edge). */
const RESTART_BAR = { x: 2, y: 6.5, w: 2, h: 11, rx: 0.4 };
const RESTART_BAR_RIGHT = RESTART_BAR.x + RESTART_BAR.w;

/** Bar + double left chevron; first triangle tip meets bar (no gap). */
const RESTART_DOUBLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 9 6.5 L 9 17.5 Z M 9 12 L 14 6.5 L 14 17.5 Z`;

/** Bar + single left chevron (view-scoped rewind). */
const RESTART_SINGLE_CHEVRON_LEFT = `M ${RESTART_BAR_RIGHT} 12 L 11 6.5 L 11 17.5 Z`;

/** Shift artwork so its horizontal center matches viewBox center (12). */
const RESTART_ICON_CENTER_X_COMPOSITION = 4;
const RESTART_ICON_CENTER_X_VIEW = 5.5;

function IconRestartComposition() {
  const { x, y, w, h, rx } = RESTART_BAR;
  return (
    <svg
      className="btn-restart-svg"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
    >
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
    <svg
      className="btn-restart-svg"
      viewBox="0 0 24 24"
      width={15}
      height={15}
      aria-hidden
    >
      <g transform={`translate(${RESTART_ICON_CENTER_X_VIEW}, 0)`}>
        <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" />
        <path fill="currentColor" d={RESTART_SINGLE_CHEVRON_LEFT} />
      </g>
    </svg>
  );
}

function clampInt(n, min, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) {
    return min;
  }
  return Math.min(Math.max(x, min), max);
}

/**
 * Bottom row: transport, extend, placement + transpose + repeat, octave view (far right).
 * Transpose: shift per-note stored octaves (±). Octave view: softpot + MIDI labels.
 * repeatPhraseEnabled: false until the user taps a MIDI note (targets that loop).
 */
export default function BottomControls({
  isPlaying,
  addOn,
  beatsPerMeasure,
  totalMeasures,
  activeLoop,
  repeatPhraseEnabled = true,
  repeatPlacementEnabled = true,
  /** Resets field drafts when layer/loop changes */
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
}) {
  const spanBeats = Math.max(1, Number(activeLoop?.spanBeats) || 1);
  const startMeasure = Math.max(1, Number(activeLoop?.startMeasure) || 1);
  const repeatUnit = normalizeRepeatUnit(activeLoop?.repeatUnit);
  const repeatEvery = activeLoop?.repeatEvery ?? null;
  const repeatEndMeasure = activeLoop?.repeatEndMeasure ?? null;

  const [startMeasureDraft, setStartMeasureDraft] = useState(() =>
    String(startMeasure),
  );
  const [endMeasureDraft, setEndMeasureDraft] = useState(() =>
    repeatEndMeasure == null ? "" : String(repeatEndMeasure),
  );
  const [endMeasureError, setEndMeasureError] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled draft reset from props
    setStartMeasureDraft(String(startMeasure));
  }, [phraseFieldSyncKey, startMeasure]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- controlled draft reset from props
    setEndMeasureDraft(
      repeatEndMeasure == null ? "" : String(repeatEndMeasure),
    );
  }, [phraseFieldSyncKey, repeatEndMeasure, repeatEvery, repeatUnit]);

  useEffect(() => {
    if (!endMeasureError) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setEndMeasureError("");
    }, 2500);
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
    if (repeatUnit !== "measures" || repeatEvery == null) {
      return;
    }
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
      setEndMeasureDraft(
        repeatEndMeasure == null ? "" : String(repeatEndMeasure),
      );
      return;
    }
    const minEnd = startMeasure + 1;
    const v = Math.min(Math.max(parsedRaw, minEnd), maxCap);

    if (parsedRaw > maxCap) {
      onSetRepeatEndMeasure(v);
      setEndMeasureDraft(String(v));
      setEndMeasureError(
        `End measure must be at most ${maxCap} (composition limit).`,
      );
      return;
    }

    setEndMeasureError("");
    onSetRepeatEndMeasure(v);
    setEndMeasureDraft(String(v));
  };

  const loopNotes = activeLoop?.notes ?? [];
  const legacyLoopOct = activeLoop?.octave ?? 3;
  const canTransposeDown =
    repeatPhraseEnabled &&
    loopNotesCanShiftOctave(loopNotes, -1, legacyLoopOct);
  const canTransposeUp =
    repeatPhraseEnabled &&
    loopNotesCanShiftOctave(loopNotes, 1, legacyLoopOct);

  return (
    <div className="bottom">
      <div className="bottom-bar">
        <div className="cluster">
          <div className="clbl2">transport</div>
          <div className="ctrls">
            <button
              className={`btn-play ${isPlaying ? "btn-play-on" : ""}`}
              onClick={onTogglePlay}
              aria-label={isPlaying ? "Pause transport" : "Play transport"}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              className="btn-restart"
              onClick={onRestartTransport}
              aria-label="Restart from beginning of composition"
              title="Restart composition"
            >
              <IconRestartComposition />
            </button>
            <button
              type="button"
              className="btn-restart"
              onClick={onRestartPlayheadInView}
              aria-label="Rewind playhead to start of current view"
              title="View start"
            >
              <IconRestartView />
            </button>
            <button
              className={`btn-add ${addOn ? "btn-add-on" : ""}`}
              onClick={onToggleAdd}
            >
              +
            </button>
          </div>
        </div>
        <div className="sep" />
        <div className="cluster">
          <div className="clbl2">extend</div>
          <div className="ctrls ctrls-extend">
            <button
              type="button"
              className="btn"
              onClick={onAddMeasure}
              aria-label="Add one measure to the loop"
              title="Add one measure"
            >
              + measure
            </button>
            <button
              type="button"
              className="btn"
              onClick={onRemoveLastMeasure}
              disabled={!canRemoveLastMeasure}
              aria-label="Remove the last measure from the loop"
              title="Remove last measure"
            >
              − measure
            </button>
          </div>
        </div>
        <div className="sep" />
        <div className="cluster cluster-repeat cluster-repeat-split">
          <div
            className={`repeat-split-col ${!repeatPlacementEnabled ? "cluster-repeat--locked" : ""}`}
            aria-disabled={!repeatPlacementEnabled}
          >
            <div className="clbl2">placement</div>
            <div className="repeat-meta placement-measures-row repeat-split-values">
              <label className="repeat-field">
                <span className="repeat-field-lbl">Starts measure</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="repeat-num"
                  autoComplete="off"
                  aria-label="Pattern starts on measure"
                  disabled={!repeatPlacementEnabled}
                  value={startMeasureDraft}
                  onChange={(e) => setStartMeasureDraft(e.target.value)}
                  onBlur={commitStartMeasure}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
              <label
                className={`repeat-field repeat-field--error-anchor ${repeatUnit !== "measures" || repeatEvery == null ? "repeat-field--inactive" : ""}`}
              >
                {endMeasureError ? (
                  <div className="stat-error">{endMeasureError}</div>
                ) : null}
                <span className="repeat-field-lbl">Ends measure</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="repeat-num"
                  autoComplete="off"
                  placeholder="—"
                  aria-label="Stop measure repeats after this measure; leave empty to repeat through end"
                  disabled={!repeatPlacementEnabled || repeatUnit !== "measures" || repeatEvery == null}
                  title={
                    repeatUnit !== "measures" || repeatEvery == null
                      ? "Choose an “every N measures” repeat first"
                      : undefined
                  }
                  value={endMeasureDraft}
                  onChange={(e) => {
                    setEndMeasureDraft(e.target.value);
                    setEndMeasureError("");
                  }}
                  onBlur={commitEndMeasure}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
              </label>
            </div>
          </div>
          <div className="sep" aria-hidden="true" />
          <div
            className={`repeat-split-col ${!repeatPlacementEnabled ? "cluster-repeat--locked" : ""}`}
            aria-disabled={!repeatPlacementEnabled}
          >
            <div className="repeat-header-inline">
              <div className="clbl2">repeat every n</div>
              <div className="ctrls ctrls-wrap">
                {["measures", "beats"].map((value) => {
                  const selected = repeatUnit === value;
                  return (
                    <button
                      key={`u-${value}`}
                      type="button"
                      className={`rep-btn ${selected ? "rep-on" : ""}`}
                      disabled={!repeatPlacementEnabled}
                      onClick={() => onSetRepeatUnit(value)}
                      title={`Repeat interval measured in ${value}`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="repeat-block repeat-block--toggles">
              <div className="repeat-sub">
                <div className="ctrls ctrls-wrap repeat-split-values">
                  {oneBasedRange(
                    repeatUnit === "measures"
                      ? MAX_MEASURE_REPEAT_OPTION
                      : maxBeatRepeatOption,
                  ).map((n) => {
                    const disabled =
                      !repeatPlacementEnabled ||
                      isRepeatDisabled(spanBeats, beatsPerMeasure, repeatUnit, n) ||
                      n > maxRepeatEveryForUnit(repeatUnit, beatsPerMeasure);
                    return (
                      <button
                        key={`r-${repeatUnit}-${n}`}
                        type="button"
                        className={`rep-btn ${repeatEvery === n ? "rep-on" : ""}`}
                        disabled={disabled}
                        onClick={() => onToggleRepeatEvery(n)}
                        title={
                          disabled
                            ? "Loop span is longer than this repeat interval"
                            : `Repeat every ${n} ${repeatUnit === "measures" ? `measure${n === 1 ? "" : "s"}` : `beat${n === 1 ? "" : "s"}`}`
                        }
                        aria-label={`${repeatEvery === n ? "Disable" : "Set"} repeat every ${n} ${repeatUnit}`}
                        aria-pressed={repeatEvery === n}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="sep" aria-hidden="true" />
          <div className="repeat-split-col repeat-split-col-transpose">
            <div className="clbl2">octave</div>
            <div className="transpose-block repeat-split-values">
              <div
                className={`transpose-row ${!repeatPhraseEnabled ? "cluster-repeat--locked" : ""}`}
              >
                <div className="ctrls ctrls-oct">
                  <button
                    type="button"
                    className="btn"
                    disabled={!canTransposeDown}
                    aria-label="Transpose notes down an octave"
                    title="Transpose all notes in this loop down one octave (clamped to MIDI range)"
                    onClick={() => onShiftLoopNotesOctave(-1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={!canTransposeUp}
                    aria-label="Transpose notes up an octave"
                    title="Transpose all notes in this loop up one octave (clamped to MIDI range)"
                    onClick={() => onShiftLoopNotesOctave(1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
