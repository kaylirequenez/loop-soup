import { useAppStore } from "../store/appStore";

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
  const softpotPosition = useAppStore((s) => s.softpotPosition);
  const setSoftpotPosition = useAppStore((s) => s.setSoftpotPosition);
  const activeIndex = Math.max(0, Math.min(23, Math.round((1 - softpotPosition) * 23)));

  const updateFromPointer = (element, clientY) => {
    const rect = element.getBoundingClientRect();
    const relative = (clientY - rect.top) / rect.height;
    setSoftpotPosition(relative);
  };

  const handleStripPointerDown = (event) => {
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    updateFromPointer(element, event.clientY);

    const onMove = (moveEvent) => {
      updateFromPointer(element, moveEvent.clientY);
    };

    const onEnd = () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onEnd);
      element.removeEventListener("pointercancel", onEnd);
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
  };

  return (
    <div className="sp-zone">
      <div className="sp-hdr">softpot</div>

      <div className="sp-body">
        <div className="sp-strip" onPointerDown={handleStripPointerDown}>
          <div className="sp-dot" style={{ top: `${softpotPosition * 100}%` }} />
        </div>

        {!isDrums ? (
          <div className="note-col">
            {Array.from({ length: 24 }).map((_, i) => {
              const semitone = 23 - i;
              const noteName = NOTES[(9 + semitone) % 12];
              const inScale = SCALE_A_MINOR.has(noteName);
              const isC = noteName === "C";
              const cls = `nb ${inScale ? "nb-s" : "nb-c"} ${isC ? "nb-o" : ""} ${i === activeIndex ? "nb-a" : ""}`;
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
