import { useMemo } from "react";
import {
  getEffectiveLayerRollPlacementForNotes,
  getMidiLoopRollPlacement,
  layerLoopsAgreeOnMidiRollPlacement,
  loopPlacementVisibleOnRoll,
} from "../../store/utils/midiPlacement";
import { midiRollRowIndexForPitchClass, midiRollSplitRollSlot } from "../../lib/keyLayout";
import {
  beatsPerMeasureFromMeter,
  compositionLoopBeatLength,
} from "../../lib/midiPlayhead";
import { expandBaseNotesToComposition } from "../../lib/midiRollExpand";
import { layerLoopsForUi } from "../../lib/layerRuntime";
import type { LayerId, LayersState } from "../../types/layer";
import type { LoopDefinitionsState } from "../../types/loop";
import type { MidiLoopRollPlacementMap } from "../../types/midi";
import type { RollSlot } from "./types";

interface MidiRollDataParams {
  layers: LayersState;
  definitions: LoopDefinitionsState;
  meter: string;
  masterLoopLength: number;
  rootPitchClass: number;
  midiLoopRollPlacement: MidiLoopRollPlacementMap;
  midiRollCount: number;
  midiRollSplitByRootOctave: boolean;
  octaveView: number;
  layerIds: LayerId[];
}

export interface CombinedNoteEvent {
  layer: LayerId;
  loopIndex: number;
  loopId: string;
  noteIndex: number;
  storedOctave: number;
  noteKey: string;
  instanceOffset: number;
  globalStart: number;
  globalEnd: number;
  rowIndex: number;
  pitchClass: number;
  beatIndex: number;
  startInBeat?: number;
  lengthInBeat?: number;
}

export function useMidiRollData({
  layers,
  definitions,
  meter,
  masterLoopLength,
  rootPitchClass,
  midiLoopRollPlacement,
  midiRollCount,
  midiRollSplitByRootOctave,
  octaveView,
  layerIds,
}: MidiRollDataParams) {
  const beatsPerMeasure = beatsPerMeasureFromMeter(meter);
  const beatLength = compositionLoopBeatLength(masterLoopLength, beatsPerMeasure);

  const combinedNoteEvents = useMemo<CombinedNoteEvent[]>(() => {
    const out: CombinedNoteEvent[] = [];
    for (const layer of layerIds) {
      const layerRow = layers[layer];
      if (!layerRow) {
        continue;
      }
      const layerLoops = layerLoopsForUi(layerRow, definitions);
      for (let loopIndex = 0; loopIndex < layerLoops.length; loopIndex += 1) {
        const loop = layerLoops[loopIndex];
        if (!loop) {
          continue;
        }
        const rawNotes = loop.notes ?? [];
        rawNotes.forEach((note, noteIndex) => {
          const base = {
            layer: layer as LayerId,
            loopIndex,
            pitchClass: note.pitchClass,
            octave: note.octave,
            localBeatIndex: note.localBeatIndex,
            startInBeat: note.startInBeat ?? 0,
            lengthInBeat: note.lengthInBeat ?? 1,
          };
          const expanded = expandBaseNotesToComposition(
            [base],
            loop,
            beatsPerMeasure,
            beatLength,
          );
          for (const expandedNote of expanded) {
            const { _off, ...rest } = expandedNote;
            const loopId = loop.loopId;
            const noteOct = expandedNote.octave ?? 3;
            const globalStart = expandedNote.beatIndex + (expandedNote.startInBeat ?? 0);
            const globalEnd = globalStart + (expandedNote.lengthInBeat ?? 1);
            out.push({
              ...rest,
              layer: layer as LayerId,
              pitchClass: expandedNote.pitchClass,
              loopIndex,
              loopId,
              noteIndex,
              storedOctave: noteOct,
              noteKey: `${layer}-${loopId}-${expandedNote.pitchClass}-${noteOct}-${expandedNote.beatIndex}-${expandedNote.startInBeat}-${expandedNote.lengthInBeat}-${_off ?? 0}`,
              instanceOffset: _off ?? 0,
              globalStart,
              globalEnd,
              rowIndex: midiRollRowIndexForPitchClass(
                expandedNote.pitchClass,
                rootPitchClass,
              ),
            });
          }
        });
      }
    }
    return out;
  }, [beatLength, beatsPerMeasure, definitions, layerIds, layers, rootPitchClass]);

  const layerLoopPlacementAgreement = useMemo(() => {
    const out: Partial<Record<LayerId, boolean>> = {};
    for (const id of layerIds) {
      out[id] = layerLoopsAgreeOnMidiRollPlacement(layers, midiLoopRollPlacement, id);
    }
    return out;
  }, [layerIds, layers, midiLoopRollPlacement]);

  const isNoteVisibleInMeasure = useMemo(
    () => (note: CombinedNoteEvent, rollSlot: RollSlot, measureIndex: number) => {
      if (midiRollSplitByRootOctave && midiRollCount >= 2) {
        const splitSlot = midiRollSplitRollSlot(note.storedOctave ?? 3, octaveView);
        if (rollSlot !== splitSlot) {
          return false;
        }
      } else {
        const layerPlacement = getEffectiveLayerRollPlacementForNotes(
          layers,
          midiLoopRollPlacement,
          note.layer,
        );
        if (!loopPlacementVisibleOnRoll(layerPlacement, rollSlot, midiRollCount)) {
          return false;
        }
        const loopPlacement = getMidiLoopRollPlacement(
          midiLoopRollPlacement,
          note.layer,
          note.loopId,
        );
        if (!loopPlacementVisibleOnRoll(loopPlacement, rollSlot, midiRollCount)) {
          return false;
        }
      }
      if (note.beatIndex >= beatLength) {
        return false;
      }
      return Math.floor(note.beatIndex / beatsPerMeasure) === measureIndex;
    },
    [
      beatLength,
      beatsPerMeasure,
      layers,
      midiLoopRollPlacement,
      midiRollCount,
      midiRollSplitByRootOctave,
      octaveView,
    ],
  );

  return {
    beatsPerMeasure,
    beatLength,
    combinedNoteEvents,
    layerLoopPlacementAgreement,
    isNoteVisibleInMeasure,
  };
}
