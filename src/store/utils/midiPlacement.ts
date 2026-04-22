import type {
  LayerId,
  LayersState,
  LoopId,
  MidiLoopRollPlacementMap,
  MidiRollPlacement,
} from "../../types/model";

export const LAYERS: LayerId[] = ["A", "B", "C", "D", "E"];
export const MIDI_LOOP_ROLL_PLACEMENTS: MidiRollPlacement[] = ["both", "1", "2"];

export function getMidiLoopRollPlacement(
  map: MidiLoopRollPlacementMap,
  layerId: LayerId,
  loopId: LoopId,
): MidiRollPlacement {
  const v = map[layerId][loopId];
  if (v === "1" || v === "2" || v === "both") {
    return v;
  }
  return "both";
}

export function deriveMidiLayerRollMenuFromLoops(
  layers: LayersState,
  midiLoopRollPlacement: MidiLoopRollPlacementMap,
  layerId: LayerId,
): MidiRollPlacement | null {
  const layer = layers[layerId];
  const loops = layer.loops;
  if (loops.length === 0) {
    return null;
  }
  const placements = loops.map((l) =>
    getMidiLoopRollPlacement(midiLoopRollPlacement, layerId, l.id),
  );
  const first = placements[0];
  if (loops.length === 1) {
    return first;
  }
  return placements.every((p) => p === first) ? first : null;
}

export function getEffectiveLayerRollPlacementForNotes(
  layers: LayersState,
  midiLoopRollPlacement: MidiLoopRollPlacementMap,
  layerId: LayerId,
): MidiRollPlacement {
  const d = deriveMidiLayerRollMenuFromLoops(
    layers,
    midiLoopRollPlacement,
    layerId,
  );
  return d === null ? "both" : d;
}

export function layerLoopsAgreeOnMidiRollPlacement(
  layers: LayersState,
  midiLoopRollPlacement: MidiLoopRollPlacementMap,
  layerId: LayerId,
): boolean {
  const layer = layers[layerId];
  const loops = layer?.loops ?? [];
  if (loops.length <= 1) {
    return true;
  }
  const placements = loops.map((loop) =>
    getMidiLoopRollPlacement(midiLoopRollPlacement, layerId, loop.id),
  );
  const first = placements[0];
  return placements.every((p) => p === first);
}

export function loopPlacementVisibleOnRoll(
  placement: MidiRollPlacement,
  rollSlot: 1 | 2,
  midiRollCount: number,
): boolean {
  if (midiRollCount < 2) {
    return true;
  }
  if (placement === "both") {
    return true;
  }
  if (placement === "1") {
    return rollSlot === 1;
  }
  if (placement === "2") {
    return rollSlot === 2;
  }
  return true;
}
