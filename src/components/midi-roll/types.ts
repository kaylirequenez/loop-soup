import type { LayerId } from "../../types/model";

export type RollSlot = 1 | 2;

export interface MidiRollTapParams {
  layerId: LayerId;
  loopId: string;
  rollSlot?: RollSlot;
}
