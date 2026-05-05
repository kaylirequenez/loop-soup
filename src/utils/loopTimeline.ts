import type {
  LayerId,
  LayerLoop,
  LayerLoopId,
  LayersState,
  LoopInstanceId,
  RepeatUnit,
} from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type { TimelineExpandedNote } from "../types/timeline";
import { useCompositionStore } from "../store/compositionStore";
import {
  getRepeatEveryForUnit,
  listLayerLoopInstancesSorted,
} from "./layerState";

/** Beats between phrase starts when repeating; mirrors `midiRollExpand.repeatIntervalBeats`. */
function beatsBetweenRepeats(
  repeatUnit: RepeatUnit,
  repeatEvery: number | null,
  beatsPerMeasure: number,
): number | null {
  if (repeatEvery == null) return null;
  return repeatUnit === "beats" ? repeatEvery : repeatEvery * beatsPerMeasure;
}

/**
 * Maximum repeat index `r` (inclusive) for one instance: offsets are `r * numBeatsBetween`.
 * Matches `repeatOffsetsFromLoop` length / stepping.
 */
function maxRepeatIndexInclusive(
  instanceStartBeat: number,
  repeatCount: number | null,
  spanBeats: number,
  numBeatsBetween: number,
  compositionEndBeat: number,
): number {
  const maxByComposition = Math.max(
    0,
    Math.floor(
      (compositionEndBeat - instanceStartBeat - spanBeats + 1e-6) /
        numBeatsBetween,
    ),
  );
  if (repeatCount == null) return maxByComposition;
  return Math.min(repeatCount, maxByComposition);
}

/** Precomputed phrase-local geometry per definition note (layer / loop ids fixed on the loop). */
interface PhraseNoteBase {
  noteIndexInDefinition: number;
  /** Phrase-local start: `floor(beatIndex) + startInBeat` (same as prior expand). */
  relativeStartInPhrase: number;
  lengthInBeat: number | null;
}

function cacheKey(layerId: LayerId, loopId: LayerLoopId): string {
  return `${layerId}:${loopId}`;
}

/**
 * Purpose:
 * Holds expanded absolute-beat note rows per `(layerId, loopId)` for composition / roll views.
 *
 * Behavior:
 * - In-memory only; not persisted.
 * - Composition / rehydrate: `subscribeLoopTimeline` runs `rebuildAll`. Recording uses `appendRecordingNote` / `patchRecordingNoteEnd`; otherwise `rebuildLoop`.
 * - Open notes expose `absoluteEndBeat: null`; callers interpret end beats themselves.
 * - Repeat tiling is skipped while the loop is recording (phrase open or any note duration open).
 */
export class LoopTimeline {
  private readonly map = new Map<string, TimelineExpandedNote[]>();
  private revision = 0;
  private readonly listeners = new Set<() => void>();

  private notify(): void {
    this.revision += 1;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private compositionGeometry(): {
    beatsPerMeasure: number;
    compositionEndBeat: number;
  } {
    const { meter, totalMeasures } = useCompositionStore.getState();
    const beatsPerMeasure = meter.beatsPerMeasure;
    return {
      beatsPerMeasure,
      compositionEndBeat: totalMeasures * beatsPerMeasure,
    };
  }

  /** Removes one loop’s expansion (e.g. after delete). */
  invalidateLoop(layerId: LayerId, loopId: LayerLoopId): void {
    this.map.delete(cacheKey(layerId, loopId));
    this.notify();
  }

  /** Drops all expansions. */
  clear(): void {
    this.map.clear();
    this.notify();
  }

  /**
   * Purpose:
   * Recompute every loop’s expansion from current `layers` and composition bounds.
   */
  rebuildAll(layers: LayersState): void {
    const { beatsPerMeasure, compositionEndBeat } = this.compositionGeometry();
    this.map.clear();
    for (const layerId of LAYER_IDS) {
      const layer = layers[layerId];
      for (const loopIdStr of Object.keys(layer.layerLoops)) {
        const loopId = Number(loopIdStr) as LayerLoopId;
        const loop = layer.layerLoops[loopId];
        this.map.set(
          cacheKey(layerId, loopId),
          this.expandLoop(layerId, loop, beatsPerMeasure, compositionEndBeat),
        );
      }
    }
    this.notify();
  }

  /**
   * Purpose:
   * Recompute a single loop; removes the cache entry if the loop no longer exists.
   */
  rebuildLoop(
    layerId: LayerId,
    loopId: LayerLoopId,
    layers: LayersState,
  ): void {
    const { beatsPerMeasure, compositionEndBeat } = this.compositionGeometry();
    const loop = layers[layerId]?.layerLoops[loopId];
    const key = cacheKey(layerId, loopId);
    if (!loop) {
      this.map.delete(key);
      this.notify();
      return;
    }
    this.map.set(
      key,
      this.expandLoop(layerId, loop, beatsPerMeasure, compositionEndBeat),
    );
    this.notify();
  }

  getNotesForLoop(
    layerId: LayerId,
    loopId: LayerLoopId,
  ): TimelineExpandedNote[] | undefined {
    return this.map.get(cacheKey(layerId, loopId));
  }

  /**
   * Purpose:
   * Append one open timeline row while recording (single instance, no repeats).
   */
  appendRecordingNote(
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
    noteIndexInDefinition: number,
    absoluteStartBeat: number,
  ): void {
    const row: TimelineExpandedNote = {
      layerId,
      loopId,
      instanceId,
      repeatIndex: 0,
      repeatOffsetBeats: 0,
      noteIndexInDefinition,
      absoluteStartBeat,
      absoluteEndBeat: null,
      isActiveRecordingNote: true,
    };
    const key = cacheKey(layerId, loopId);
    const prev = this.map.get(key) ?? [];
    this.map.set(key, [...prev, row]);
    this.notify();
  }

  /**
   * Purpose:
   * Close the last timeline row for this loop (the note just ended in recording order).
   */
  patchRecordingNoteEnd(
    layerId: LayerId,
    loopId: LayerLoopId,
    absoluteEndBeat: number,
  ): void {
    const key = cacheKey(layerId, loopId);
    const arr = this.map.get(key);
    if (!arr?.length) return;
    const last = arr.length - 1;
    const patched: TimelineExpandedNote = {
      ...arr[last],
      absoluteEndBeat,
      isActiveRecordingNote: false,
    };
    this.map.set(key, [...arr.slice(0, last), patched]);
    this.notify();
  }

  getRevision(): number {
    return this.revision;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private expandLoop(
    layerId: LayerId,
    loop: LayerLoop,
    beatsPerMeasure: number,
    compositionEndBeat: number,
  ): TimelineExpandedNote[] {
    const loopId = loop.id;
    const def = loop.definition;
    const { notes: rawNotes } = def;

    const spanBeats = def.spanBeats;
    const loopIsRecording = spanBeats == null;

    const phraseNoteBases: PhraseNoteBase[] = rawNotes.map((note, i) => {
      return {
        noteIndexInDefinition: i,
        relativeStartInPhrase: note.beatIndex + note.startInBeat,
        lengthInBeat: note.lengthInBeat,
      };
    });

    const instances = listLayerLoopInstancesSorted(loop);
    const out: TimelineExpandedNote[] = [];

    for (const instance of instances) {
      if (instance.startBeat < 0) continue;

      let maxR = 0;
      let numBeatsBetween = 0;

      if (!loopIsRecording) {
        const step = beatsBetweenRepeats(
          def.repeatUnit,
          getRepeatEveryForUnit(def.repeatUnit, def),
          beatsPerMeasure,
        );
        if (step != null) {
          numBeatsBetween = step;
          maxR = maxRepeatIndexInclusive(
            instance.startBeat,
            instance.repeatCount,
            spanBeats,
            step,
            compositionEndBeat,
          );
        }
      }

      for (let r = 0; r <= maxR; r += 1) {
        const repeatOffsetBeats = numBeatsBetween * r;

        for (const base of phraseNoteBases) {
          const absoluteStartBeat =
            instance.startBeat + repeatOffsetBeats + base.relativeStartInPhrase;

          const absoluteEndBeat: number | null =
            base.lengthInBeat != null
              ? absoluteStartBeat + base.lengthInBeat
              : null;

          out.push({
            layerId,
            loopId,
            instanceId: instance.id,
            repeatIndex: r,
            repeatOffsetBeats,
            noteIndexInDefinition: base.noteIndexInDefinition,
            absoluteStartBeat,
            absoluteEndBeat,
            isActiveRecordingNote: base.lengthInBeat == null,
          });
        }
      }
    }

    return out;
  }
}

/** Shared timeline expansion (not persisted). */
export const loopTimeline = new LoopTimeline();
