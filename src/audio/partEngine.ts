import { Part, getTransport } from "tone";
import type { PolySynth, Synth } from "tone";
import type {
  LayerId,
  LayerLoop,
  LayerLoopInstance,
  LoopDefinition,
  LayersState,
  SoundMapping,
} from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import { repeatStrideBeats } from "../utils/loopInstanceUtils";
import { useCompositionStore } from "../store/compositionStore";
import { beatsToTicks, midiToFrequency, ticksToTicksTime } from "./toneUnits";

interface NotePayload {
  freq: number;
  durationTicks: number;
  velocity: number;
}

function definitionEvents(definition: LoopDefinition, ppq: number) {
  return definition.notes
    .filter((n) => n.lengthInBeat != null)
    .map((n) => ({
      time: ticksToTicksTime(beatsToTicks(n.beatIndex + n.startInBeat, ppq)),
      freq: midiToFrequency((n.octave + 1) * 12 + n.pitchClass),
      durationTicks: beatsToTicks(n.lengthInBeat!, ppq),
      velocity: n.velocity ?? 1,
    }));
}

function buildPart(
  definition: LoopDefinition,
  instrument: PolySynth<Synth>,
  instance: LayerLoopInstance,
): Part<NotePayload> | null {
  if (instance.endBeat == null || instance.endBeat < 0) return null;
  if (definition.spanBeats == null) return null;

  const PPQ = getTransport().PPQ;

  const events = definitionEvents(definition, PPQ);

  if (events.length === 0) return null;

  const part = new Part<NotePayload>(
    (time, { freq, durationTicks, velocity }) => {
      instrument.triggerAttackRelease(
        freq,
        ticksToTicksTime(durationTicks),
        time,
        velocity,
      );
    },
    events,
  );

  const { beatsPerMeasure } = useCompositionStore.getState().meter;
  const stride = repeatStrideBeats(definition, beatsPerMeasure);
  const loopSpanBeats = stride > 0 ? stride : definition.spanBeats;
  part.loop = true;
  part.loopStart = 0;
  part.loopEnd = ticksToTicksTime(beatsToTicks(loopSpanBeats, PPQ));

  part.start(ticksToTicksTime(beatsToTicks(instance.startBeat, PPQ)));
  part.stop(ticksToTicksTime(beatsToTicks(instance.endBeat, PPQ)));

  return part;
}

class PartEngine {
  private parts = new Map<
    string,
    {
      part: Part<NotePayload>;
      synth: PolySynth<Synth>;
      loopSynthKey: string;
      releaseSynth: (synth: PolySynth<Synth>) => void;
    }
  >();
  private loopSynths = new Map<string, PolySynth<Synth>>();
  private loopSynthRefs = new Map<string, number>();

  private key(layerId: LayerId, loopId: number, instanceId: number): string {
    return `${layerId}:${loopId}:${instanceId}`;
  }

  private loopKey(layerId: LayerId, loopId: number): string {
    return `${layerId}:${loopId}`;
  }

  private retainLoopSynth(key: string): void {
    this.loopSynthRefs.set(key, (this.loopSynthRefs.get(key) ?? 0) + 1);
  }

  private releaseLoopSynthRef(
    key: string,
    releaseSynth: (synth: PolySynth<Synth>) => void,
  ): void {
    const next = (this.loopSynthRefs.get(key) ?? 1) - 1;
    if (next > 0) {
      this.loopSynthRefs.set(key, next);
      return;
    }
    this.loopSynthRefs.delete(key);
    const synth = this.loopSynths.get(key);
    if (!synth) return;
    this.loopSynths.delete(key);
    releaseSynth(synth);
  }

  private ensureLoopSynth(
    layerId: LayerId,
    loopId: number,
    mapping: SoundMapping,
    buildSynth: (
      layerId: LayerId,
      mapping: SoundMapping,
    ) => PolySynth<Synth> | null,
  ): PolySynth<Synth> | null {
    const key = this.loopKey(layerId, loopId);
    const existing = this.loopSynths.get(key);
    if (existing) return existing;
    const synth = buildSynth(layerId, mapping);
    if (!synth) return null;
    this.loopSynths.set(key, synth);
    return synth;
  }

  private disposeByKey(key: string): void {
    const entry = this.parts.get(key);
    if (entry) {
      // Stop first so scheduled callbacks detach cleanly before releasing synth refs.
      // (Helps robustness during rapid edits + play/pause/seek churn.)
      entry.part.stop(0);
      entry.part.dispose();
      this.releaseLoopSynthRef(entry.loopSynthKey, entry.releaseSynth);
      this.parts.delete(key);
    }
  }

  /** Dispose the Part for one loop instance id. Safe no-op if no Part exists. */
  disposeForInstance(
    layerId: LayerId,
    loopId: number,
    instanceId: number,
  ): void {
    this.disposeByKey(this.key(layerId, loopId, instanceId));
  }

  /** Build (or replace) the Part for a single instance, keyed by stable instance index. */
  buildForInstance(
    layerId: LayerId,
    loopId: number,
    instanceId: number,
    definition: LoopDefinition,
    instance: LayerLoopInstance,
    mapping: SoundMapping,
    buildSynth: (
      layerId: LayerId,
      mapping: SoundMapping,
    ) => PolySynth<Synth> | null,
    releaseSynth: (synth: PolySynth<Synth>) => void,
  ): void {
    const k = this.key(layerId, loopId, instanceId);
    this.disposeByKey(k);
    const loopSynthKey = this.loopKey(layerId, loopId);
    const instrument = this.ensureLoopSynth(
      layerId,
      loopId,
      mapping,
      buildSynth,
    );
    if (!instrument) return;
    const part = buildPart(definition, instrument, instance);
    if (part) {
      this.retainLoopSynth(loopSynthKey);
      this.parts.set(k, {
        part,
        synth: instrument,
        loopSynthKey,
        releaseSynth,
      });
      return;
    }
  }

  disposeAllForLoop(layerId: LayerId, loopId: number): void {
    const prefix = `${layerId}:${loopId}:`;
    for (const key of [...this.parts.keys()]) {
      if (key.startsWith(prefix)) this.disposeByKey(key);
    }
  }

  rebuildAllForLoop(
    layerId: LayerId,
    loopId: number,
    loop: LayerLoop,
    buildSynth: (
      layerId: LayerId,
      mapping: SoundMapping,
    ) => PolySynth<Synth> | null,
    releaseSynth: (synth: PolySynth<Synth>) => void,
  ): void {
    this.disposeAllForLoop(layerId, loopId);
    const loopSynthKey = this.loopKey(layerId, loopId);
    const instrument = this.ensureLoopSynth(
      layerId,
      loopId,
      loop.mapping,
      buildSynth,
    );
    if (!instrument) return;
    for (
      let instanceId = 0;
      instanceId < loop.loopInstances.length;
      instanceId++
    ) {
      const instance = loop.loopInstances[instanceId];
      const part = buildPart(loop.definition, instrument, instance);
      if (part) {
        this.retainLoopSynth(loopSynthKey);
        this.parts.set(this.key(layerId, loopId, instanceId), {
          part,
          synth: instrument,
          loopSynthKey,
          releaseSynth,
        });
      }
    }
    if ((this.loopSynthRefs.get(loopSynthKey) ?? 0) === 0) {
      this.releaseLoopSynthRef(loopSynthKey, releaseSynth);
    }
  }

  updateLoopNotesInPlace(
    layerId: LayerId,
    loopId: number,
    definition: LoopDefinition,
  ): void {
    const PPQ = getTransport().PPQ;
    const events = definitionEvents(definition, PPQ);
    const prefix = `${layerId}:${loopId}:`;
    for (const [key, entry] of this.parts.entries()) {
      if (!key.startsWith(prefix)) continue;
      entry.part.clear();
      for (const event of events) {
        entry.part.add(event);
      }
    }
  }

  updateLoopSynthMapping(
    layerId: LayerId,
    loopId: number,
    mapping: SoundMapping,
    updateSynth: (synth: PolySynth<Synth>, mapping: SoundMapping) => void,
  ): void {
    const synth = this.loopSynths.get(this.loopKey(layerId, loopId));
    if (!synth) return;
    updateSynth(synth, mapping);
  }

  rebuildAll(
    layers: LayersState,
    buildSynth: (
      layerId: LayerId,
      mapping: SoundMapping,
    ) => PolySynth<Synth> | null,
    releaseSynth: (synth: PolySynth<Synth>) => void,
  ): void {
    this.disposeAll();
    for (const id of LAYER_IDS) {
      const layer = layers[id];
      for (let loopId = 0; loopId < layer.layerLoops.length; loopId++) {
        this.rebuildAllForLoop(
          id,
          loopId,
          layer.layerLoops[loopId],
          buildSynth,
          releaseSynth,
        );
      }
    }
  }

  disposeAll(): void {
    for (const { part } of this.parts.values()) {
      // Keep disposal order consistent with single-key teardown.
      // Stop first so callbacks are detached before node disposal.
      part.stop(0);
      part.dispose();
    }
    this.parts.clear();
    this.loopSynthRefs.clear();
    for (const synth of this.loopSynths.values()) synth.dispose();
    this.loopSynths.clear();
  }
}

export const partEngine = new PartEngine();
