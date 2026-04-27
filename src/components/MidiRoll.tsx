import { useShallow } from "zustand/react/shallow";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { useCompositionStore } from "../store/compositionStore";
import { useMidiRollData } from "./midi-roll/useMidiRollData";
import { CombinedRoll } from "./midi-roll/CombinedRoll";
import type { LayerId } from "../types/layer";

export default function MidiRoll() {
  const midiRollCount = useMidiStore((s) => s.midiRollCount);
  const { meter, musicalKey, totalMeasures } = useCompositionStore(
    useShallow((s) => ({
      meter: s.meter,
      musicalKey: s.key,
      totalMeasures: s.totalMeasures,
    })),
  );
  const layers = useLayerStore((s) => s.layers);

  const { beatsPerMeasure, beatLength, combinedNoteEvents, isNoteVisibleInMeasure } =
    useMidiRollData({
      layers,
      meter,
      totalMeasures,
      musicalKey,
      layerIds: Object.keys(layers) as LayerId[],
    });

  const rollProps = { combinedNoteEvents, isNoteVisibleInMeasure, beatsPerMeasure, beatLength };

  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <div className="midi-roll-area">
          <div className="combined-roll-stack">
            <CombinedRoll rollSlot={1} {...rollProps} />
            {midiRollCount === 2 && <CombinedRoll rollSlot={2} {...rollProps} />}
          </div>
        </div>
      </div>
    </div>
  );
}
