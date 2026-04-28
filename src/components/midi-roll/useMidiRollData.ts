import { useMemo } from "react";
import { useMidiStore } from "../../store/midiStore";
import { pitchClassRowIndex } from "../../utils/pitch";
import { compositionLoopBeatLength } from "../../utils/compositionState";
import { expandBaseNotesToComposition } from "../../utils/midiRollExpand";
import { listLayerLoopInstancesSorted } from "../../utils/layerState";
import type { LayerId, LayersState } from "../../types/layer";
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
  const beatsPerMeasure = meter.beatsPerMeasure;
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
          const baseNotes = rawNotes.map((note, noteIndex) => ({
            ...note,
            noteIndex,
            layer: layer as LayerId,
            loopIndex,
          }));
          const expanded = expandBaseNotesToComposition(
            baseNotes,
            instance,
            spanBeats,
            beatsPerMeasure,
            beatLength,
          );
          for (const expandedNote of expanded) {
            const { _off, ...rest } = expandedNote;
            const storedOctave = expandedNote.octave ?? 3;
            const globalStart =
              expandedNote.beatIndex + expandedNote.startInBeat;
            const globalEnd = globalStart + expandedNote.lengthInBeat;
            out.push({
              ...rest,
              layer: layer as LayerId,
              loopIndex,
              layerLoopId,
              storedOctave,
              noteKey: `${layer}-${layerLoopId}-${instance.id}-${expandedNote.pitchClass}-${storedOctave}-${expandedNote.beatIndex}-${expandedNote.startInBeat}-${expandedNote.lengthInBeat}-${_off}`,
              instanceOffset: _off,
              globalStart,
              globalEnd,
              rowIndex: pitchClassRowIndex(expandedNote.pitchClass, musicalKey),
            });
          }
        }
      }
    }
    return out;
  }, [beatLength, beatsPerMeasure, layerIds, layers, musicalKey]);

  const isNoteVisibleInMeasure = useMemo(
    () =>
      (note: CombinedNoteEvent, rollSlot: RollSlot, measureIndex: number) => {
        if (note.beatIndex >= beatLength) return false;
        if (
          !useMidiStore
            .getState()
            .isNoteOnRoll(
              note.layer,
              note.layerLoopId,
              note.storedOctave,
              rollSlot,
            )
        )
          return false;
        return Math.floor(note.beatIndex / beatsPerMeasure) === measureIndex;
      },
    [beatLength, beatsPerMeasure],
  );

  return {
    beatsPerMeasure,
    beatLength,
    combinedNoteEvents,
    isNoteVisibleInMeasure,
  };
}
