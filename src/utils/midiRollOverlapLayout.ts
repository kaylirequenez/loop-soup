import type { MusicalKey } from "../types/composition";
import type { RollSlot } from "../types/midi";
import {
  LAYER_IDS,
  type LayerId,
  type LayerLoopId,
  type LoopInstanceId,
  type LoopNote,
  type LayersState,
} from "../types/layer";
import {
  resolveTimelineNoteEndBeat,
  timelineNoteFractionRect,
} from "./timelineNoteLayout";
import { pitchClassRowIndex } from "./pitch";
import { loopTimeline } from "./loopTimeline";

const BEAT_EPS = 1e-5;

export interface MidiRollStripNoteInput {
  layerId: LayerId;
  loopId: LayerLoopId;
  loopIdx: number;
  instanceId: LoopInstanceId;
  rowIndex: number;
  absoluteStartBeat: number;
  resolvedEndBeat: number;
  note: LoopNote;
  reactKey: string;
}

export interface MidiRollStripNoteLayout extends MidiRollStripNoteInput {
  leftFract: number;
  widthFract: number;
  /** Notes that overlap in time on this row stack vertically in N slices. */
  overlapClusterSize: number;
  /** 0 .. overlapClusterSize - 1 within the pitch row band. */
  verticalSlot: number;
}

function beatsOverlap(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): boolean {
  return a0 < b1 - BEAT_EPS && b0 < a1 - BEAT_EPS;
}

/** Undirected connected components via pairwise interval overlap (transitive closure). */
function overlapClusters(intervals: { start: number; end: number }[]): number[][] {
  const n = intervals.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const a = intervals[i];
      const b = intervals[j];
      if (beatsOverlap(a.start, a.end, b.start, b.end)) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  const visited = new Set<number>();
  const clusters: number[][] = [];
  for (let i = 0; i < n; i += 1) {
    if (visited.has(i)) continue;
    const stack = [i];
    visited.add(i);
    const comp: number[] = [];
    while (stack.length > 0) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of adj[u]) {
        if (!visited.has(v)) {
          visited.add(v);
          stack.push(v);
        }
      }
    }
    clusters.push(comp);
  }
  return clusters;
}

function sortStableClusterIndices(
  rowItems: MidiRollStripNoteInput[],
  cluster: number[],
): number[] {
  return [...cluster].sort((ai, bi) => {
    const a = rowItems[ai];
    const b = rowItems[bi];
    if (a.layerId !== b.layerId) return a.layerId.localeCompare(b.layerId);
    if (a.loopId !== b.loopId) return a.loopId - b.loopId;
    return a.absoluteStartBeat - b.absoluteStartBeat;
  });
}

const ROW_FRACT = 1 / 12;

export type IsNoteOnRollFn = (
  layerId: LayerId,
  loopId: LayerLoopId,
  octave: number,
  rollSlot: RollSlot,
) => boolean;

/**
 * Collect all strip notes visible on a MIDI roll in one pass over layers × loops × expanded rows.
 */
export function collectMidiRollStripNoteInputs(params: {
  layers: LayersState;
  musicalKey: MusicalKey;
  rollSlot: RollSlot;
  beatLength: number;
  midiPlayheadBeat: number;
  reactKeyPrefix: string;
  isNoteOnRoll: IsNoteOnRollFn;
}): MidiRollStripNoteInput[] {
  const {
    layers,
    musicalKey,
    rollSlot,
    beatLength,
    midiPlayheadBeat,
    reactKeyPrefix,
    isNoteOnRoll,
  } = params;

  const inputs: MidiRollStripNoteInput[] = [];

  for (const layerId of LAYER_IDS) {
    const loopsRecord = layers[layerId].layerLoops;
    const loops = Object.values(loopsRecord).sort((a, b) => a.id - b.id);

    for (let loopIdx = 0; loopIdx < loops.length; loopIdx += 1) {
      const loop = loops[loopIdx]!;
      const rows = loopTimeline.getNotesForLoop(layerId, loop.id);
      if (!rows) continue;

      for (const row of rows) {
        if (row.absoluteEndBeat == null) continue;
        const ln = loop.definition.notes[row.noteIndexInDefinition];
        if (!ln) continue;
        if (!isNoteOnRoll(layerId, loop.id, ln.octave, rollSlot))
          continue;

        const rowIndex = pitchClassRowIndex(ln.pitchClass, musicalKey);
        const resolvedEnd = resolveTimelineNoteEndBeat(
          row.absoluteStartBeat,
          row.absoluteEndBeat,
          midiPlayheadBeat,
          beatLength,
        );

        inputs.push({
          layerId,
          loopId: loop.id,
          loopIdx,
          instanceId: row.instanceId,
          rowIndex,
          absoluteStartBeat: row.absoluteStartBeat,
          resolvedEndBeat: resolvedEnd,
          note: ln,
          reactKey: `${reactKeyPrefix}-${layerId}-${loop.id}-${row.instanceId}-${row.repeatOffsetBeats}-${row.noteIndexInDefinition}-${row.absoluteStartBeat}`,
        });
      }
    }
  }

  return inputs;
}

/**
 * Purpose:
 * Notes on the same chromatic row that overlap in time **share vertical space**
 * inside that row (horizontal timing unchanged).
 */
export function layoutMidiRollStripNotes(
  inputs: MidiRollStripNoteInput[],
  compositionEndBeat: number,
): MidiRollStripNoteLayout[] {
  const byRow = new Map<number, MidiRollStripNoteInput[]>();
  for (const inp of inputs) {
    const arr = byRow.get(inp.rowIndex) ?? [];
    arr.push(inp);
    byRow.set(inp.rowIndex, arr);
  }

  const out: MidiRollStripNoteLayout[] = [];

  for (const rowItems of byRow.values()) {
    const intervals = rowItems.map((r) => ({
      start: r.absoluteStartBeat,
      end: r.resolvedEndBeat,
    }));
    const clusters = overlapClusters(intervals);

    for (const cluster of clusters) {
      const n = cluster.length;
      const sortedIdx = sortStableClusterIndices(rowItems, cluster);

      sortedIdx.forEach((originalIdx, verticalSlot) => {
        const item = rowItems[originalIdx]!;
        const { leftFract, widthFract } = timelineNoteFractionRect(
          item.absoluteStartBeat,
          item.resolvedEndBeat,
          compositionEndBeat,
        );
        out.push({
          ...item,
          leftFract,
          widthFract,
          overlapClusterSize: n,
          verticalSlot,
        });
      });
    }
  }

  return out;
}

/** Top / height as fractions of full roll height (12 chromatic rows). */
export function midiRollNoteVerticalFractions(
  rowIndex: number,
  verticalSlot: number,
  overlapClusterSize: number,
): { topFract: number; heightFract: number } {
  const slice = ROW_FRACT / Math.max(overlapClusterSize, 1);
  return {
    topFract: rowIndex * ROW_FRACT + verticalSlot * slice,
    heightFract: slice,
  };
}
