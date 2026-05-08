import {
  Channel,
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

class AudioEngine {
  private channels = new Map<LayerId, Channel>();
  private activePlaybackSynths = new Set<PolySynth<Synth>>();
  private previewSynths = new Map<LayerId, PolySynth<Synth>>();
  private previewFreqs = new Map<LayerId, number>();
  /** True once AudioContext has been unlocked — never reset, even after stop(). */
  private toneStarted = false;

  private get ready(): boolean {
    return this.channels.size > 0;
  }

  async init(layerSounds: Map<LayerId, SoundId>): Promise<void> {
    if (!this.toneStarted) {
      await toneStart();
      applyContextTimingConfig(getToneContext());
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

  beginPreviewNote(
    layerId: LayerId,
    mapping: SoundMapping,
    freqHz: number,
  ): void {
    if (!this.ready) return;
    const current = this.previewSynths.get(layerId);
    if (!current) return;
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
