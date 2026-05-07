import type {
  LayerId,
  LayerLoop,
  LayerLoopId,
  LayersState,
} from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type { TimelineExpandedNote } from "../types/timeline";
import { useCompositionStore } from "../store/compositionStore";
import { repeatStrideBeats } from "./loopInstanceUtils";

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
    const beatsPerMeasure =
      useCompositionStore.getState().meter.beatsPerMeasure;
    this.map.clear();
    for (const layerId of LAYER_IDS) {
      const layer = layers[layerId];
      if (!layer || !Array.isArray(layer.layerLoops)) continue;
      layer.layerLoops.forEach((loop, loopId) => {
        this.map.set(
          cacheKey(layerId, loopId),
          this.expandLoop(layerId, loop, beatsPerMeasure),
        );
      });
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
    const beatsPerMeasure =
      useCompositionStore.getState().meter.beatsPerMeasure;
    const loop = layers[layerId]?.layerLoops[loopId];
    const key = cacheKey(layerId, loopId);
    if (!loop) {
      this.map.delete(key);
      this.notify();
      return;
    }
    this.map.set(key, this.expandLoop(layerId, loop, beatsPerMeasure));
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
    noteIndexInDefinition: number,
    absoluteStartBeat: number,
  ): void {
    const row: TimelineExpandedNote = {
      layerId,
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
  ): TimelineExpandedNote[] {
    const def = loop.definition;
    const { notes: rawNotes } = def;

    const spanBeats = def.spanBeats;
    const loopIsRecording = spanBeats == null;

    const phraseNoteBases: PhraseNoteBase[] = rawNotes.map((note, i) => ({
      noteIndexInDefinition: i,
      relativeStartInPhrase: note.beatIndex + note.startInBeat,
      lengthInBeat: note.lengthInBeat,
    }));

    const out: TimelineExpandedNote[] = [];

    for (const instance of loop.loopInstances) {
      let repeatOffsets = [0];
      if (!loopIsRecording) {
        const step = repeatStrideBeats(def, beatsPerMeasure);
        if (step > 0 && instance.endBeat != null) {
          repeatOffsets = [];
          let repeatOffsetBeats = 0;
          while (
            instance.startBeat + repeatOffsetBeats + spanBeats <=
            instance.endBeat + 1e-6
          ) {
            repeatOffsets.push(repeatOffsetBeats);
            repeatOffsetBeats += step;
          }
          // Guard against malformed persisted data where endBeat is too short.
          if (repeatOffsets.length === 0) repeatOffsets = [0];
        }
      }

      repeatOffsets.forEach((repeatOffsetBeats, r) => {
        for (const base of phraseNoteBases) {
          const absoluteStartBeat =
            instance.startBeat + repeatOffsetBeats + base.relativeStartInPhrase;

          const absoluteEndBeat: number | null =
            base.lengthInBeat != null
              ? absoluteStartBeat + base.lengthInBeat
              : null;

          out.push({
            layerId,
            repeatIndex: r,
            repeatOffsetBeats,
            noteIndexInDefinition: base.noteIndexInDefinition,
            absoluteStartBeat,
            absoluteEndBeat,
            isActiveRecordingNote: base.lengthInBeat == null,
          });
        }
      });
    }

    return out;
  }
}

/** Shared timeline expansion (not persisted). */
export const loopTimeline = new LoopTimeline();
