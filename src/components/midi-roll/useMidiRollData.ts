import { useMemo } from "react";
import { pitchClassRowIndex } from "../../utils/pitch";
import { compositionLoopBeatLength } from "../../utils/compositionState";
import { repeatOffsetsFromLoop } from "../../utils/midiRollExpand";
import { listLayerLoopInstancesSorted } from "../../utils/layerState";
import type { LayerId, LayersState } from "../../types/layer";
import type { CombinedNoteEvent } from "../../types/midi";
import type { MusicalKey } from "../../types/composition";

interface MidiRollDataParams {
  layers: LayersState;
  beatsPerMeasure: number;
  totalMeasures: number;
  musicalKey: MusicalKey;
  layerIds: LayerId[];
}

export function useMidiRollData({
  layers,
  beatsPerMeasure,
  totalMeasures,
  musicalKey,
  layerIds,
}: MidiRollDataParams) {
  const beatLength = compositionLoopBeatLength(totalMeasures, beatsPerMeasure);

  const combinedNoteEvents = useMemo<CombinedNoteEvent[]>(() => {
    const out: CombinedNoteEvent[] = [];
    for (const layer of layerIds) {
      const layerRow = layers[layer];
      const loops = Object.values(layerRow.layerLoops);
      for (let loopIndex = 0; loopIndex < loops.length; loopIndex += 1) {
        const loop = loops[loopIndex];
        const layerLoopId = loop.id;
        const { notes: rawNotes, spanBeats } = loop.definition;
        const instances = listLayerLoopInstancesSorted(loop);
        for (const instance of instances) {
          const offsets = repeatOffsetsFromLoop(
            instance,
            spanBeats,
            beatsPerMeasure,
            beatLength,
          );
          const G = instance.startBeat;
          const loopInstanceId = instance.id;

          for (let noteIndex = 0; noteIndex < rawNotes.length; noteIndex += 1) {
            const note = rawNotes[noteIndex];
            const lb = Math.max(0, Math.floor(note.beatIndex) || 0);
            const s0 = note.startInBeat;
            const len = note.lengthInBeat;

            for (const off of offsets) {
              const rawGlobalStart = G + off + lb + s0;
              if (rawGlobalStart >= beatLength - 1e-9) continue;
              const rawGlobalEnd = Math.min(G + off + lb + len, beatLength);
              if (rawGlobalEnd <= rawGlobalStart + 1e-9) continue;

              const beatIndex = Math.floor(rawGlobalStart);
              const startInBeat = rawGlobalStart - beatIndex;
              const lengthInBeat = rawGlobalEnd - rawGlobalStart;

              const storedOctave = note.octave;
              const globalStart = beatIndex + startInBeat;
              const globalEnd = globalStart + lengthInBeat;

              out.push({
                ...note,
                beatIndex,
                startInBeat,
                lengthInBeat,
                noteIndex,
                layer: layer as LayerId,
                loopIndex,
                layerLoopId,
                loopInstanceId,
                storedOctave,
                noteKey: `${layer}-${layerLoopId}-${instance.id}-${note.pitchClass}-${storedOctave}-${beatIndex}-${startInBeat}-${lengthInBeat}-${off}`,
                instanceOffset: off,
                globalStart,
                globalEnd,
                rowIndex: pitchClassRowIndex(note.pitchClass, musicalKey),
              });
            }
          }
        }
      }
    }
    return out;
  }, [beatLength, beatsPerMeasure, layerIds, layers, musicalKey]);

  return combinedNoteEvents;
}
