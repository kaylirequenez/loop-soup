/**
 * Spec contract:
 * - Left column with SoftPot strip + aligned LED/note visualization.
 * - Layers A-D: 24 semitone boxes across 2 octaves.
 * - Layer E: drum zones (top 20% hihat, middle 40% snare, bottom 40% kick).
 * - Later: drag/touch gesture handling, velocity, hold/slide behavior.
 */
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const SCALE_A_MINOR = new Set(["A", "B", "C", "D", "E", "F", "G"]);

export default function SoftPot({ selectedLayer, octave }) {
  const isDrums = selectedLayer === "E";

  return (
    <div className="sp-zone">
      <div className="sp-hdr">softpot</div>

      <div className="sp-body">
        <div className="sp-strip">
          <div className="sp-dot" style={{ top: "40%" }} />
        </div>

        {!isDrums ? (
          <div className="note-col">
            {Array.from({ length: 24 }).map((_, i) => {
              const semitone = 23 - i;
              const noteName = NOTES[(9 + semitone) % 12];
              const inScale = SCALE_A_MINOR.has(noteName);
              const isC = noteName === "C";
              const cls = `nb ${inScale ? "nb-s" : "nb-c"} ${isC ? "nb-o" : ""}`;
              return (
                <div className={cls} key={i}>
                  {isC ? `${noteName}${octave}` : noteName}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="note-col drum-col">
            <div className="drum-zone drum-hihat">hihat</div>
            <div className="drum-zone drum-snare">snare</div>
            <div className="drum-zone drum-kick">kick</div>
          </div>
        )}
      </div>
    </div>
  );
}
