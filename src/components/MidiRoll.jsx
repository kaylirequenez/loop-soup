/**
 * Spec contract:
 * - Three normalized piano rolls for layers B/C/D.
 * - 12 semitone rows with a red playhead.
 * - Composition view remains visible in midi mode.
 */
function Roll({ label, className }) {
  return (
    <div>
      <div className={`mtrack-lbl ${className}`}>{label}</div>
      <div className="piano-roll">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className={`semi-div ${i === 0 || i === 5 ? "semi-c" : ""}`}
            style={{ top: `${(i / 12) * 100}%` }}
          />
        ))}
        <div
          className="mnote"
          style={{ left: "0%", width: "25%", top: "35%", height: "7%" }}
        />
        <div className="mroll-ph" style={{ left: "28%" }} />
      </div>
    </div>
  );
}

export default function MidiRoll() {
  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <Roll label="B — bass (normalized)" className="lbl-b" />
        <Roll label="C — melody (normalized)" className="lbl-c" />
        <Roll label="D — harmony (normalized)" className="lbl-d" />
      </div>
    </div>
  );
}
