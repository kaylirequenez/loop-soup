import {
  Channel,
  FeedbackDelay,
  Gain,
  Limiter,
  Reverb,
  now,
  start as toneStart,
  getContext as getToneContext,
} from "tone";
import type { LayerId, SoundMapping } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type { SoundId } from "./types";
import {
  applyMappingToSynth,
  buildPreviewInstruments,
  buildLayerSynth,
} from "./instruments";
import type { PolySynth, Synth } from "tone";
import { applyContextTimingConfig } from "../utils/timingTestHarness";

function layerFader01ToDb(volume01: number): number {
  const v = Math.max(0, Math.min(1, volume01));
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}

function sendLevelsFromKnobs(mapping: SoundMapping): {
  reverb: number;
  delay: number;
} {
  const levels = {
    reverb: mapping.knobsByEffect.attack?.value ?? 0.12,
    delay: mapping.knobsByEffect.decay?.value ?? 0.08,
  };
  return {
    reverb: Math.max(0, Math.min(1, levels.reverb)),
    delay: Math.max(0, Math.min(1, levels.delay)),
  };
}

export interface LoopVoice {
  triggerAttackRelease(
    freqHz: number,
    duration: string | number,
    time?: string | number,
    velocity?: number,
  ): void;
  releaseAll(time?: number): void;
  updateMapping(mapping: SoundMapping): void;
  dispose(): void;
}

class AudioEngine {
  private channels = new Map<LayerId, Channel>();
  private reverbSends = new Map<LayerId, Gain>();
  private delaySends = new Map<LayerId, Gain>();
  private sharedReverb: Reverb | null = null;
  private sharedDelay: FeedbackDelay | null = null;
  private masterLimiter: Limiter | null = null;
  private activePlaybackSynths = new Set<PolySynth<Synth>>();
  private previewSynths = new Map<LayerId, PolySynth<Synth>>();
  private previewFreqs = new Map<LayerId, number>();
  /** True once AudioContext has been unlocked — never reset, even after stop(). */
  private toneStarted = false;

  private get ready(): boolean {
    return this.channels.size > 0 && this.masterLimiter != null;
  }

  async init(layerSounds: Map<LayerId, SoundId>): Promise<void> {
    if (!this.toneStarted) {
      await toneStart();
      applyContextTimingConfig(getToneContext());
      this.toneStarted = true;
    }
    if (this.ready) return;
    this.masterLimiter = new Limiter(-1).toDestination();
    this.sharedReverb = new Reverb({
      decay: 2.8,
      preDelay: 0.012,
      wet: 1,
    });
    await this.sharedReverb.generate();
    this.sharedDelay = new FeedbackDelay({
      delayTime: "8n",
      feedback: 0.22,
      wet: 1,
    });
    this.sharedReverb.connect(this.masterLimiter);
    this.sharedDelay.connect(this.masterLimiter);
    for (const id of LAYER_IDS) {
      const channel = new Channel();
      channel.connect(this.masterLimiter);
      const reverbSend = new Gain(0.12);
      const delaySend = new Gain(0.08);
      channel.connect(reverbSend);
      channel.connect(delaySend);
      reverbSend.connect(this.sharedReverb);
      delaySend.connect(this.sharedDelay);
      this.channels.set(id, channel);
      this.reverbSends.set(id, reverbSend);
      this.delaySends.set(id, delaySend);
    }
    for (const [id, synth] of buildPreviewInstruments(layerSounds)) {
      const channel = this.channels.get(id);
      if (channel) synth.connect(channel);
      this.previewSynths.set(id, synth);
    }
  }

  buildPlaybackSynth(
    layerId: LayerId,
    mapping: SoundMapping,
  ): PolySynth<Synth> | null {
    if (!this.ready) return null;
    const channel = this.channels.get(layerId);
    if (!channel) return null;
    const soundId = mapping.soundId;
    const newSynth = buildLayerSynth(soundId);
    applyMappingToSynth(newSynth, mapping);
    if (channel) newSynth.connect(channel);
    this.activePlaybackSynths.add(newSynth);
    return newSynth;
  }

  createLoopVoice(layerId: LayerId, mapping: SoundMapping): LoopVoice | null {
    const synth = this.buildPlaybackSynth(layerId, mapping);
    if (!synth) return null;
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    return {
      triggerAttackRelease: (freqHz, duration, time, velocity) =>
        synth.triggerAttackRelease(freqHz, duration, time, velocity),
      releaseAll: (time) => synth.releaseAll(time),
      updateMapping: (nextMapping) => {
        this.updatePlaybackSynthMapping(synth, nextMapping);
        this.setLayerSendLevels(layerId, sendLevelsFromKnobs(nextMapping));
      },
      dispose: () => this.releasePlaybackSynth(synth),
    };
  }

  updatePlaybackSynthMapping(synth: PolySynth<Synth>, mapping: SoundMapping): void {
    applyMappingToSynth(synth, mapping);
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

  setLayerVolume(layerId: LayerId, volume01: number): void {
    const channel = this.channels.get(layerId);
    if (!channel) return;
    channel.volume.value = layerFader01ToDb(volume01);
  }

  setLayerSendLevels(
    layerId: LayerId,
    levels: { reverb: number; delay: number },
  ): void {
    const reverb = this.reverbSends.get(layerId);
    const delay = this.delaySends.get(layerId);
    if (reverb) reverb.gain.value = Math.max(0, Math.min(1, levels.reverb));
    if (delay) delay.gain.value = Math.max(0, Math.min(1, levels.delay));
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
    for (const [, send] of this.reverbSends) send.dispose();
    this.reverbSends.clear();
    for (const [, send] of this.delaySends) send.dispose();
    this.delaySends.clear();
    for (const [, channel] of this.channels) channel.dispose();
    this.channels.clear();
    this.sharedReverb?.dispose();
    this.sharedReverb = null;
    this.sharedDelay?.dispose();
    this.sharedDelay = null;
    this.masterLimiter?.dispose();
    this.masterLimiter = null;
    for (const [, synth] of this.previewSynths) synth.dispose();
    this.previewSynths.clear();
  }

  // ── Softpot preview ─────────────────────────────────────────────────────

  beginPreviewNote(
    layerId: LayerId,
    mapping: SoundMapping,
    freqHz: number,
  ): void {
    if (!this.ready) return;
    const current = this.previewSynths.get(layerId);
    if (!current) return;
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    applyMappingToSynth(current, mapping);
    const audioNow = getToneContext().currentTime;
    const prevFreq = this.previewFreqs.get(layerId);
    if (prevFreq != null) current.releaseAll(audioNow);
    current.triggerAttack(freqHz, now());
    this.previewFreqs.set(layerId, freqHz);
  }

  updatePreviewNote(
    layerId: LayerId,
    mapping: SoundMapping,
    freqHz: number,
  ): void {
    if (!this.ready) return;
    const current = this.previewSynths.get(layerId);
    if (!current) return;
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    applyMappingToSynth(current, mapping);
    const audioNow = getToneContext().currentTime;
    current.releaseAll(audioNow);
    current.triggerAttack(freqHz, now());
    this.previewFreqs.set(layerId, freqHz);
  }

  endPreviewNote(layerId: LayerId): void {
    if (!this.ready) return;
    const synth = this.previewSynths.get(layerId);
    synth?.releaseAll(getToneContext().currentTime);
    this.previewFreqs.delete(layerId);
  }
}

export const audioEngine = new AudioEngine();
