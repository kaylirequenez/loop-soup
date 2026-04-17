import { REPEAT_OPTIONS } from "../lib/specs";

/**
 * Spec contract:
 * - Bottom row controls: transport, add, extend, repeat, octave.
 * - Repeat options are locked to 1/2/3/4 for v1.
 */
export default function BottomControls({
  isPlaying,
  addOn,
  extendOn,
  repeat,
  octave,
  onTogglePlay,
  onToggleAdd,
  onToggleExtend,
  onSetRepeat,
  onSetOctave,
}) {
  return (
    <div className="bottom">
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
        <div className="ctrls">
          <button
            className={`btn ${extendOn ? "btn-on" : ""}`}
            onClick={onToggleExtend}
          >
            extend
          </button>
        </div>
      </div>
      <div className="sep" />
      <div className="cluster">
        <div className="clbl2">repeat</div>
        <div className="ctrls">
          {REPEAT_OPTIONS.map((value) => (
            <button
              key={value}
              className={`rep-btn ${repeat === value ? "rep-on" : ""}`}
              onClick={() => onSetRepeat(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div className="sep" />
      <div className="cluster">
        <div className="clbl2">octave</div>
        <div className="ctrls">
          <button
            className="btn"
            onClick={() => onSetOctave(Math.max(0, octave - 1))}
          >
            −
          </button>
          <span className="oct-val">{octave}</span>
          <button
            className="btn"
            onClick={() => onSetOctave(Math.min(7, octave + 1))}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
