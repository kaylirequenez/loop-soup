import { now as toneNow, start as toneStart } from "tone";
import type { LayerId, LayerLoopId, LayersState, LayerKnobsByEffect } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type { SoundId, KnobEffect } from "./types";
import type { TimelineExpandedNote } from "../types/timeline";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import { buildInstruments, buildPreviewInstruments, buildLayerSynth } from "./instruments";
import { knobToEnvParam } from "./sounds";
import type { PolySynth, Synth } from "tone";

type GetNotesForLoop = (
  layerId: LayerId,
  loopId: LayerLoopId,
) => TimelineExpandedNote[] | undefined;

const LOOKAHEAD_SECONDS = 0.15;

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class AudioEngine {
  private instruments = new Map<LayerId, PolySynth<Synth>>();
  private previewSynths = new Map<LayerId, PolySynth<Synth>>();
  private previewFreqs = new Map<LayerId, number>();
  private previewSoundIds = new Map<LayerId, NonNullable<SoundId>>();
  private scheduledKeys = new Set<string>();
  /** True once AudioContext has been unlocked — never reset, even after stop(). */
  private toneStarted = false;

  private get ready(): boolean {
    return this.instruments.size > 0;
  }

  async init(layerSounds: Map<LayerId, NonNullable<SoundId>>): Promise<void> {
    if (!this.toneStarted) {
      await toneStart();
      this.toneStarted = true;
    }
    if (this.ready) return;
    for (const [id, synth] of buildInstruments(layerSounds)) {
      this.instruments.set(id, synth);
    }
    for (const [id, synth] of buildPreviewInstruments(layerSounds)) {
      this.previewSynths.set(id, synth);
    }
  }

  /** Apply ADSR knob values to a layer's synth. Call after init and on knob changes. */
  setLayerEnvelope(layerId: LayerId, knobsByEffect: LayerKnobsByEffect): void {
    if (!this.ready) return;
    const instrument = this.instruments.get(layerId);
    if (!instrument) return;
    const get = (e: KnobEffect, def: number) => knobsByEffect[e]?.value ?? def;
    instrument.set({
      envelope: {
        attack:  knobToEnvParam("attack",  get("attack",  0.1)),
        decay:   knobToEnvParam("decay",   get("decay",   0.3)),
        sustain: knobToEnvParam("sustain", get("sustain", 0.5)),
        release: knobToEnvParam("release", get("release", 0.4)),
      },
    });
  }

  /** Call when the user changes a layer's soundId — rebuilds that layer's synth. */
  updateLayerSound(layerId: LayerId, soundId: NonNullable<SoundId>): void {
    if (!this.ready) return;
    this.instruments.get(layerId)?.dispose();
    this.instruments.set(layerId, buildLayerSynth(soundId));
    this.previewSynths.get(layerId)?.dispose();
    this.previewSynths.set(layerId, buildLayerSynth(soundId));
  }

  scheduleLookahead(
    currentBeat: number,
    audioNow: number,
    beatsPerSecond: number,
    layers: LayersState,
    getNotesForLoop: GetNotesForLoop,
  ): void {
    if (!this.ready) return;

    const lookaheadBeats = LOOKAHEAD_SECONDS * beatsPerSecond;
    const windowEnd = currentBeat + lookaheadBeats;
    const playbackStore = useLayerPlaybackStore.getState();

    for (const layerId of LAYER_IDS) {
      if (!playbackStore.isLayerAudible(layerId)) continue;

      const layer = layers[layerId];
      const instrument = this.instruments.get(layerId);
      if (!instrument) continue;

      for (let loopId = 0; loopId < layer.layerLoops.length; loopId++) {
        const loop = layer.layerLoops[loopId];
        const soundId = loop.mapping.soundId ?? layer.defaultMapping.soundId;
        if (soundId === null) continue;

        const notes = getNotesForLoop(layerId, loopId);
        if (!notes) continue;

        for (const note of notes) {
          if (note.absoluteEndBeat == null) continue;
          if (note.absoluteStartBeat < currentBeat - lookaheadBeats) continue;
          if (note.absoluteStartBeat >= windowEnd) continue;

          const key = `${layerId}:${loopId}:${note.noteIndexInDefinition}:${note.absoluteStartBeat}`;
          if (this.scheduledKeys.has(key)) continue;

          const rawNote = loop.definition.notes[note.noteIndexInDefinition];
          if (!rawNote) continue;

          const midi = (rawNote.octave + 1) * 12 + rawNote.pitchClass;
          const freq = midiToFreq(midi);
          const durationSec =
            (note.absoluteEndBeat - note.absoluteStartBeat) / beatsPerSecond;
          const offsetSec = Math.max(
            0,
            (note.absoluteStartBeat - currentBeat) / beatsPerSecond,
          );

          instrument.triggerAttackRelease(freq, durationSec, audioNow + offsetSec);
          this.scheduledKeys.add(key);
        }
      }
    }
  }

  invalidateLoop(layerId: LayerId, loopId: number): void {
    const prefix = `${layerId}:${loopId}:`;
    for (const key of this.scheduledKeys) {
      if (key.startsWith(prefix)) this.scheduledKeys.delete(key);
    }
  }

  cancelAll(): void {
    this.scheduledKeys.clear();
  }

  /**
   * Dispose all instrument nodes, cancelling any pending scheduled notes.
   * toneStarted is preserved so the next init() skips the async AudioContext
   * unlock and rebuilds instruments synchronously — no race with the RAF loop.
   */
  stop(): void {
    for (const [, synth] of this.instruments) synth.dispose();
    this.instruments.clear();
    for (const [, synth] of this.previewSynths) synth.dispose();
    this.previewSynths.clear();
    this.scheduledKeys.clear();
  }

  // ── Softpot preview ─────────────────────────────────────────────────────

  beginPreviewNote(layerId: LayerId, soundId: NonNullable<SoundId>, freqHz: number): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    if (!synth) return;
    const prevFreq = this.previewFreqs.get(layerId);
    if (prevFreq != null) synth.releaseAll(toneNow());
    synth.triggerAttack(freqHz, toneNow() + 0.01);
    this.previewFreqs.set(layerId, freqHz);
    this.previewSoundIds.set(layerId, soundId);
  }

  updatePreviewNote(layerId: LayerId, soundId: NonNullable<SoundId>, freqHz: number): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    if (!synth) return;
    synth.releaseAll(toneNow());
    synth.triggerAttack(freqHz, toneNow() + 0.02);
    this.previewFreqs.set(layerId, freqHz);
    this.previewSoundIds.set(layerId, soundId);
  }

  endPreviewNote(layerId: LayerId): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    synth?.releaseAll(toneNow());
    this.previewFreqs.delete(layerId);
    this.previewSoundIds.delete(layerId);
  }
}

export const audioEngine = new AudioEngine();
