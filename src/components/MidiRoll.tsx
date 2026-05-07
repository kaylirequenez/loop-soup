import { useMemo, useSyncExternalStore } from "react";
import { useMidiStore } from "../store/midiStore";
import { useLayerStore } from "../store/layerStore";
import { CombinedRoll } from "./CombinedRoll";
import { LAYER_IDS } from "../types/layer";
import type { RawRollNote } from "../types/timeline";
import { loopTimeline } from "../utils/loopTimeline";
import { findInstanceIndex } from "../utils/loopInstanceUtils";

export default function MidiRoll() {
  const midiRollCount = useMidiStore((s) => s.midiRollCount);
  const timelineRevision = useSyncExternalStore(
    (onStoreChange) => loopTimeline.subscribe(onStoreChange),
    () => loopTimeline.getRevision(),
    () => loopTimeline.getRevision(),
  );
  const layers = useLayerStore((s) => s.layers);

  const allNotes = useMemo(() => {
    const notes: RawRollNote[] = [];
    for (const layerId of LAYER_IDS) {
      const layerLoops = layers[layerId].layerLoops;
      for (let loopIndex = 0; loopIndex < layerLoops.length; loopIndex++) {
        const loop = layerLoops[loopIndex];
        const rows = loopTimeline.getNotesForLoop(layerId, loopIndex);
        if (!rows) continue;
        for (const row of rows) {
          const ln = loop.definition.notes[row.noteIndexInDefinition];
          if (!ln) continue;
          const instanceIndex = findInstanceIndex(
            row.absoluteStartBeat - row.repeatOffsetBeats,
            loop.loopInstances,
          );
          notes.push({
            ...row,
            loopNote: ln,
            loopIndex,
            instanceIndex,
            reactKey: `${layerId}-${loopIndex}-${instanceIndex}-${row.repeatOffsetBeats}-${row.noteIndexInDefinition}-${row.absoluteStartBeat}`,
          });
        }
      }
    }
    return notes;
  }, [timelineRevision, layers]);

  return (
    <div className="midi-view midi-view-on">
      <div className="midi-content">
        <div className="midi-roll-area">
          <div className="combined-roll-stack">
            <CombinedRoll rollSlot={1} notes={allNotes} />
            {midiRollCount === 2 && <CombinedRoll rollSlot={2} notes={allNotes} />}
          </div>
        </div>
      </div>
    </div>
  );
}
