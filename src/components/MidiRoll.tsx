import { useMidiStore } from "../store/midiStore";
import { CombinedRoll } from "./CombinedRoll";

export default function MidiRoll() {
  const midiRollCount = useMidiStore((s) => s.midiRollCount);

  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <div className="midi-roll-area">
          <div className="combined-roll-stack">
            <CombinedRoll rollSlot={1} />
            {midiRollCount === 2 && <CombinedRoll rollSlot={2} />}
          </div>
        </div>
      </div>
    </div>
  );
}
