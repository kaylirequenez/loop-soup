import { useMemo } from "react";
import { useMidiStore } from "../../store/midiStore";
import { pitchClassFromKey, pitchClassRowIndex } from "../../utils/pitch";
import { compositionLoopBeatLength } from "../../utils/compositionState";
import { expandBaseNotesToComposition } from "../../utils/midiRollExpand";
import { listLayerLoopInstancesSorted } from "../../lib/layerRuntime";
import type { LayerId, LayerLoopId, LayersState } from "../../types/layer";
import type { CombinedNoteEvent, RollSlot } from "../../types/midi";
import type { Meter, MusicalKey } from "../../types/composition";

interface MidiRollDataParams {
  layers: LayersState;
  meter: Meter;
  totalMeasures: number;
  musicalKey: MusicalKey;
  layerIds: LayerId[];
}

export function useMidiRollData({
  layers,
  meter,
  totalMeasures,
  musicalKey,
  layerIds,
}: MidiRollDataParams) {
  const rootPitchClass = pitchClassFromKey(musicalKey);
  const beatsPerMeasure = meter.beatsPerMeasure;
  const beatLength = compositionLoopBeatLength(totalMeasures, beatsPerMeasure);

  const combinedNoteEvents = useMemo<CombinedNoteEvent[]>(() => {
    const out: CombinedNoteEvent[] = [];
    for (const layer of layerIds) {
      const layerRow = layers[layer];
      if (!layerRow) continue;
      const loops = Object.values(layerRow.layerLoops);
      for (let loopIndex = 0; loopIndex < loops.length; loopIndex += 1) {
        const loop = loops[loopIndex];
        const LayerLoopId: LayerLoopId = loop.id;
        const { notes: rawNotes, spanBeats } = loop.definition;
        const instances = listLayerLoopInstancesSorted(loop);
        for (const instance of instances) {
          rawNotes.forEach((note, noteIndex) => {
            const expanded = expandBaseNotesToComposition(
              [{ ...note, layer: layer as LayerId, loopIndex }],
              instance,
              spanBeats,
              beatsPerMeasure,
              beatLength,
            );
            for (const expandedNote of expanded) {
              const { _off, octave, ...rest } = expandedNote;
              const storedOctave = octave ?? 3;
              const globalStart = expandedNote.beatIndex + expandedNote.startInBeat;
              const globalEnd = globalStart + expandedNote.lengthInBeat;
              out.push({
                ...rest,
                layer: layer as LayerId,
                loopIndex,
                LayerLoopId,
                noteIndex,
                storedOctave,
                noteKey: `${layer}-${LayerLoopId}-${instance.id}-${expandedNote.pitchClass}-${storedOctave}-${expandedNote.beatIndex}-${expandedNote.startInBeat}-${expandedNote.lengthInBeat}-${_off}`,
                instanceOffset: _off,
                globalStart,
                globalEnd,
                rowIndex: pitchClassRowIndex(expandedNote.pitchClass, musicalKey),
              });
            }
          });
        }
      }
    }
    return out;
  }, [beatLength, beatsPerMeasure, layerIds, layers, rootPitchClass]);

  const isNoteVisibleInMeasure = useMemo(
    () =>
      (note: CombinedNoteEvent, rollSlot: RollSlot, measureIndex: number) => {
        if (note.beatIndex >= beatLength) return false;
        if (!useMidiStore.getState().isNoteOnRoll(note.layer, note.LayerLoopId, note.storedOctave, rollSlot)) return false;
        return Math.floor(note.beatIndex / beatsPerMeasure) === measureIndex;
      },
    [beatLength, beatsPerMeasure],
  );

  return { beatsPerMeasure, beatLength, combinedNoteEvents, isNoteVisibleInMeasure };
}
