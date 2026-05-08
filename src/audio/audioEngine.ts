import {
  Channel,
  start as toneStart,
  getContext as getToneContext,
} from "tone";
import type { LayerId, LayerKnobsByEffect, SoundMapping } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type { SoundId, KnobEffect } from "./types";
import { buildPreviewInstruments, buildLayerSynth } from "./instruments";
import { knobToEnvParam } from "./sounds";
import type { PolySynth, Synth } from "tone";

class AudioEngine {
  private channels = new Map<LayerId, Channel>();
  private activePlaybackSynths = new Set<PolySynth<Synth>>();
  private previewSynths = new Map<LayerId, PolySynth<Synth>>();
  private previewFreqs = new Map<LayerId, number>();
  private previewSoundIds = new Map<LayerId, NonNullable<SoundId>>();
  /** True once AudioContext has been unlocked — never reset, even after stop(). */
  private toneStarted = false;

  private get ready(): boolean {
    return this.channels.size > 0;
  }

  async init(layerSounds: Map<LayerId, NonNullable<SoundId>>): Promise<void> {
    if (!this.toneStarted) {
      await toneStart();
      this.toneStarted = true;
    }
    if (this.ready) return;
    for (const id of LAYER_IDS) {
      const channel = new Channel().toDestination();
      this.channels.set(id, channel);
    }
    for (const [id, synth] of buildPreviewInstruments(layerSounds)) {
      this.previewSynths.set(id, synth);
    }
  }

  private applyEnvelope(
    instrument: PolySynth<Synth>,
    knobsByEffect: LayerKnobsByEffect,
  ): void {
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

  buildPlaybackSynth(layerId: LayerId, mapping: SoundMapping): PolySynth<Synth> | null {
    if (!this.ready) return null;
    const channel = this.channels.get(layerId);
    if (!channel) return null;
    const soundId = mapping.soundId ?? "sawtooth";
    const newSynth = buildLayerSynth(soundId);
    this.applyEnvelope(newSynth, mapping.knobsByEffect);
    if (channel) newSynth.connect(channel);
    this.activePlaybackSynths.add(newSynth);
    return newSynth;
  }

  releasePlaybackSynth(synth: PolySynth<Synth>): void {
    if (!this.activePlaybackSynths.has(synth)) return;
    this.activePlaybackSynths.delete(synth);
    const now = getToneContext().currentTime;
    synth.releaseAll(now);
    window.setTimeout(() => synth.dispose(), 450);
  }

  setLayerMute(layerId: LayerId, muted: boolean): void {
    const channel = this.channels.get(layerId);
    if (channel) channel.mute = muted;
  }

  setLayerSolo(layerId: LayerId, solo: boolean): void {
    const channel = this.channels.get(layerId);
    if (channel) channel.solo = solo;
  }

  /** Silence all held notes immediately (e.g. on seek). */
  cancelAll(): void {
    for (const instrument of this.activePlaybackSynths) {
      instrument.releaseAll();
    }
  }

  /**
   * Dispose all instrument and channel nodes.
   * toneStarted is preserved so the next init() skips the async AudioContext
   * unlock and rebuilds instruments synchronously.
   */
  stop(): void {
    for (const synth of this.activePlaybackSynths) synth.dispose();
    this.activePlaybackSynths.clear();
    for (const [, channel] of this.channels) channel.dispose();
    this.channels.clear();
    for (const [, synth] of this.previewSynths) synth.dispose();
    this.previewSynths.clear();
  }

  // ── Softpot preview ─────────────────────────────────────────────────────

  beginPreviewNote(layerId: LayerId, soundId: NonNullable<SoundId>, freqHz: number): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    if (!synth) return;
    if (this.previewSoundIds.get(layerId) !== soundId) {
      synth.dispose();
      const replacement = buildLayerSynth(soundId).toDestination();
      this.previewSynths.set(layerId, replacement);
    }
    const current = this.previewSynths.get(layerId);
    if (!current) return;
    const audioNow = getToneContext().currentTime;
    const prevFreq = this.previewFreqs.get(layerId);
    if (prevFreq != null) current.releaseAll(audioNow);
    current.triggerAttack(freqHz, audioNow + 0.005);
    this.previewFreqs.set(layerId, freqHz);
    this.previewSoundIds.set(layerId, soundId);
  }

  updatePreviewNote(layerId: LayerId, soundId: NonNullable<SoundId>, freqHz: number): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    if (!synth) return;
    const audioNow = getToneContext().currentTime;
    synth.releaseAll(audioNow);
    synth.triggerAttack(freqHz, audioNow + 0.005);
    this.previewFreqs.set(layerId, freqHz);
    this.previewSoundIds.set(layerId, soundId);
  }

  endPreviewNote(layerId: LayerId): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    synth?.releaseAll(getToneContext().currentTime);
    this.previewFreqs.delete(layerId);
    this.previewSoundIds.delete(layerId);
  }
}

export const audioEngine = new AudioEngine();
