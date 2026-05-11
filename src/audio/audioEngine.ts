import {
  Channel,
  Chorus,
  Phaser,
  Vibrato,
  AutoFilter,
  Tremolo,
  BitCrusher,
  EQ3,
  Compressor,
  FeedbackDelay,
  Filter,
  Distortion,
  Gain,
  Limiter,
  Reverb,
  ToneAudioBuffer,
  now,
  start as toneStart,
  getContext as getToneContext,
  type ToneAudioNode,
} from "tone";
import type { LayerId } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import type {
  LayerMixEffect,
  LayerMixKnobs,
  SoundId,
  SoundMapping,
  VoiceHandle,
} from "../types/sound";
import { applyContextTimingConfig } from "../utils/timingTestHarness";
import { clamp01 } from "../utils";
import {
  bitCrusherAmountToBits,
  knobToParam,
  mixKnobToParam,
  panToParam,
} from "./soundParams";
import { createVoicePool } from "./voicePoolFactory";
import { collectSoundSampleUrls } from "../sound/soundSpecs";

const softpotDebugEnabled = import.meta.env.DEV;

function softpotDebug(...args: unknown[]) {
  if (softpotDebugEnabled) console.debug("[softpot:audio]", ...args);
}

function softpotWarn(...args: unknown[]) {
  if (softpotDebugEnabled) console.warn("[softpot:audio]", ...args);
}

function layerFader01ToDb(volume01: number): number {
  const v = clamp01(volume01);
  if (v <= 0) return -Infinity;
  return 20 * Math.log10(v);
}

function sendLevelsFromKnobs(mapping: SoundMapping): {
  reverb: number;
  delay: number;
} {
  return {
    reverb: clamp01(mapping.knobsByEffect.reverbSend?.value ?? 0.12),
    delay: clamp01(mapping.knobsByEffect.delaySend?.value ?? 0.08),
  };
}

interface VoiceInserts {
  filter: Filter;
  loopChannel: Channel;
  dispose(): void;
  applyMapping(mapping: SoundMapping): void;
}

function buildVoiceInserts(
  mapping: SoundMapping,
  destination: Channel,
): VoiceInserts {
  const get = (k: keyof SoundMapping["knobsByEffect"]) =>
    mapping.knobsByEffect[k]?.value ?? 0;
  const has = (k: keyof SoundMapping["knobsByEffect"]) =>
    mapping.knobsByEffect[k] != null;
  const loopChannel = new Channel({
    volume: layerFader01ToDb(mapping.mix.volume),
    pan: panToParam(mapping.mix.pan),
  }).connect(destination);

  const filter = new Filter({
    type: "lowpass",
    frequency: knobToParam(
      "filterCutoff",
      get("filterCutoff") === 0 ? 1 : get("filterCutoff"),
    ),
    Q: knobToParam("filterResonance", get("filterResonance")),
  });
  const distortion =
    has("drive") || has("driveWet")
      ? new Distortion({
          distortion: knobToParam("drive", get("drive")),
          wet: get("driveWet"),
        })
      : null;
  const chorus =
    has("chorusDepth") || has("chorusRate")
      ? new Chorus({
          frequency: knobToParam("chorusRate", get("chorusRate")),
          depth: get("chorusDepth"),
          delayTime: 3.5,
          wet: 1,
        })
      : null;
  const phaser =
    has("phaserDepth") || has("phaserRate")
      ? new Phaser({
          frequency: knobToParam("phaserRate", get("phaserRate")),
          octaves: knobToParam("phaserDepth", get("phaserDepth")),
          baseFrequency: 350,
          wet: 1,
        })
      : null;
  const vibrato =
    has("vibratoDepth") || has("vibratoRate")
      ? new Vibrato({
          frequency: knobToParam("vibratoRate", get("vibratoRate")),
          depth: knobToParam("vibratoDepth", get("vibratoDepth")),
          wet: 1,
        })
      : null;
  const autoFilter =
    has("autoFilterDepth") || has("autoFilterRate")
      ? new AutoFilter({
          frequency: knobToParam("autoFilterRate", get("autoFilterRate")),
          depth: get("autoFilterDepth"),
          wet: 1,
        })
      : null;
  const tremolo =
    has("tremoloDepth") || has("tremoloRate")
      ? new Tremolo({
          frequency: knobToParam("tremoloRate", get("tremoloRate")),
          depth: get("tremoloDepth"),
          wet: 1,
        })
      : null;
  const bitCrusher = has("bitCrusherBits")
    ? new BitCrusher({
        bits: bitCrusherAmountToBits(get("bitCrusherBits")),
      })
    : null;
  if (bitCrusher) bitCrusher.wet.value = get("bitCrusherBits") > 0 ? 1 : 0;

  const chain: ToneAudioNode[] = [
    distortion,
    chorus,
    phaser,
    vibrato,
    autoFilter,
    tremolo,
    bitCrusher,
  ].filter((node) => node != null);
  let previous: ToneAudioNode = filter;
  for (const node of chain) {
    previous.connect(node);
    previous = node;
  }
  previous.connect(loopChannel);

  chorus?.start();
  autoFilter?.start();
  tremolo?.start();

  return {
    filter,
    loopChannel,
    dispose() {
      filter.dispose();
      loopChannel.dispose();
      distortion?.dispose();
      chorus?.dispose();
      phaser?.dispose();
      vibrato?.dispose();
      autoFilter?.dispose();
      tremolo?.dispose();
      bitCrusher?.dispose();
    },
    applyMapping(m: SoundMapping) {
      const g = (k: keyof SoundMapping["knobsByEffect"]) =>
        m.knobsByEffect[k]?.value ?? 0;
      filter.frequency.value = knobToParam(
        "filterCutoff",
        g("filterCutoff") === 0 ? 1 : g("filterCutoff"),
      );
      filter.Q.value = knobToParam("filterResonance", g("filterResonance"));
      loopChannel.volume.value = layerFader01ToDb(m.mix.volume);
      loopChannel.pan.value = panToParam(m.mix.pan);
      if (distortion) {
        distortion.distortion = knobToParam("drive", g("drive"));
        distortion.wet.value = g("driveWet");
      }
      chorus?.set({
        depth: g("chorusDepth"),
        frequency: knobToParam("chorusRate", g("chorusRate")),
      });
      phaser?.set({
        octaves: knobToParam("phaserDepth", g("phaserDepth")),
        frequency: knobToParam("phaserRate", g("phaserRate")),
      });
      vibrato?.set({
        depth: knobToParam("vibratoDepth", g("vibratoDepth")),
        frequency: knobToParam("vibratoRate", g("vibratoRate")),
      });
      autoFilter?.set({
        depth: g("autoFilterDepth"),
        frequency: knobToParam("autoFilterRate", g("autoFilterRate")),
      });
      tremolo?.set({
        depth: g("tremoloDepth"),
        frequency: knobToParam("tremoloRate", g("tremoloRate")),
      });
      const crush = g("bitCrusherBits");
      bitCrusher?.set({
        bits: bitCrusherAmountToBits(crush),
        wet: crush > 0 ? 1 : 0,
      });
    },
  };
}

export interface LoopVoice {
  triggerAttackRelease(
    freqHz: number,
    duration: string | number,
    time?: string | number,
    velocity?: number,
  ): void;
  /** Used for notes with pitch curves — returns a VoiceHandle so the caller can ramp its frequency. */
  triggerAttack(freqHz: number, time: number, velocity?: number): VoiceHandle;
  scheduleRelease(handle: VoiceHandle, releaseTime: number): void;
  releaseAll(time?: number): void;
  updateMapping(mapping: SoundMapping): void;
  waitUntilLoaded?(): Promise<void>;
  dispose(): void;
}

class AudioEngine {
  private channels = new Map<LayerId, Channel>();
  private layerEQs = new Map<LayerId, EQ3>();
  private layerComps = new Map<LayerId, Compressor>();
  private reverbSends = new Map<LayerId, Gain>();
  private delaySends = new Map<LayerId, Gain>();
  private sharedReverb: Reverb | null = null;
  private sharedDelay: FeedbackDelay | null = null;
  private masterGain: Gain | null = null;
  private masterLimiter: Limiter | null = null;
  private activeVoicePools = new Set<LoopVoice>();
  private previewVoices = new Map<LayerId, { voice: LoopVoice; soundId: SoundId; handle: VoiceHandle | null }>();
  private previewFreqs = new Map<LayerId, number>();
  /** True once AudioContext has been unlocked — never reset, even after stop(). */
  private toneStarted = false;

  private get ready(): boolean {
    return this.channels.size > 0 && this.masterLimiter != null;
  }

  get isReady(): boolean {
    return this.ready;
  }

  async init(): Promise<void> {
    if (!this.toneStarted) {
      await toneStart();
      applyContextTimingConfig(getToneContext());
      this.toneStarted = true;
    }
    if (this.ready) return;
    this.masterLimiter = new Limiter(-1).toDestination();
    this.masterGain = new Gain(0.85);
    this.masterGain.connect(this.masterLimiter);
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
    this.sharedReverb.connect(this.masterGain);
    this.sharedDelay.connect(this.masterGain);

    for (const id of LAYER_IDS) {
      const channel = new Channel();
      const eq3 = new EQ3();
      const comp = new Compressor({
        threshold: 0,
        ratio: 1,
        attack: 0.01,
        release: 0.2,
      });

      // Channel → EQ3 → Compressor → masterGain → masterLimiter → Destination
      channel.connect(eq3);
      eq3.connect(comp);
      comp.connect(this.masterGain);

      const reverbSend = new Gain(0.12);
      const delaySend = new Gain(0.08);
      comp.connect(reverbSend);
      comp.connect(delaySend);
      reverbSend.connect(this.sharedReverb);
      delaySend.connect(this.sharedDelay);

      this.channels.set(id, channel);
      this.layerEQs.set(id, eq3);
      this.layerComps.set(id, comp);
      this.reverbSends.set(id, reverbSend);
      this.delaySends.set(id, delaySend);
    }

    const sampleUrls = collectSoundSampleUrls();
    if (sampleUrls.length > 0) {
      await Promise.all(
        sampleUrls.map((url) =>
          ToneAudioBuffer.fromUrl(url).catch(() => undefined),
        ),
      );
    }
  }

  createLoopVoice(layerId: LayerId, mapping: SoundMapping): LoopVoice | null {
    if (!this.ready) return null;
    const channel = this.channels.get(layerId);
    if (!channel) return null;
    const inserts = buildVoiceInserts(mapping, channel);
    const pool = createVoicePool(inserts.filter, mapping);
    this.activeVoicePools.add(pool);
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    return {
      triggerAttackRelease: (freqHz, duration, time, velocity) =>
        pool.triggerAttackRelease(freqHz, duration, time as number, velocity),
      triggerAttack: (freqHz, time, velocity) =>
        pool.triggerAttack(freqHz, time, velocity),
      scheduleRelease: (handle, releaseTime) =>
        pool.scheduleRelease(handle, releaseTime),
      releaseAll: (time) => pool.releaseAll(time),
      updateMapping: (nextMapping) => {
        pool.updateMapping(nextMapping);
        inserts.applyMapping(nextMapping);
        this.setLayerSendLevels(layerId, sendLevelsFromKnobs(nextMapping));
      },
      dispose: () => {
        if (!this.activeVoicePools.has(pool)) return;
        this.activeVoicePools.delete(pool);
        pool.releaseAll(getToneContext().currentTime);
        window.setTimeout(() => {
          pool.dispose();
          inserts.dispose();
        }, 600);
      },
    };
  }

  setMasterVolume(volume01: number): void {
    if (this.masterGain) this.masterGain.gain.value = clamp01(volume01);
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
    if (reverb) reverb.gain.value = clamp01(levels.reverb);
    if (delay) delay.gain.value = clamp01(levels.delay);
  }

  updateLayerMix(layerId: LayerId, mixKnobs: LayerMixKnobs): void {
    const channel = this.channels.get(layerId);
    const eq3 = this.layerEQs.get(layerId);
    const comp = this.layerComps.get(layerId);
    const get = (effect: LayerMixEffect, fallback: number) =>
      mixKnobs?.[effect]?.value ?? fallback;

    if (channel) {
      channel.pan.value = 0;
    }
    if (eq3) {
      eq3.set({
        low: mixKnobToParam("eqLow", get("eqLow", 0.5)),
        mid: mixKnobToParam("eqMid", get("eqMid", 0.5)),
        high: mixKnobToParam("eqHigh", get("eqHigh", 0.5)),
      });
    }
    if (comp) {
      comp.threshold.value = mixKnobToParam("compThreshold", get("compThreshold", 1));
      comp.ratio.value = mixKnobToParam("compRatio", get("compRatio", 0));
      comp.attack.value = mixKnobToParam("compAttack", get("compAttack", 0.2));
      comp.release.value = mixKnobToParam("compRelease", get("compRelease", 0.3));
    }
  }

  /** Silence all held notes immediately (e.g. on seek). */
  cancelAll(): void {
    for (const pool of this.activeVoicePools) {
      pool.releaseAll();
    }
  }

  /** Dispose only active voice pools — keeps channels, preview voices, and master graph alive for preview. */
  stopPlayback(): void {
    for (const pool of this.activeVoicePools) pool.dispose();
    this.activeVoicePools.clear();
    // Reset mute state so all layers are available for softpot preview after stopping.
    for (const [, channel] of this.channels) channel.mute = false;
  }

  stop(): void {
    this.stopPlayback();
    for (const [, send] of this.reverbSends) send.dispose();
    this.reverbSends.clear();
    for (const [, send] of this.delaySends) send.dispose();
    this.delaySends.clear();
    for (const [, eq3] of this.layerEQs) eq3.dispose();
    this.layerEQs.clear();
    for (const [, comp] of this.layerComps) comp.dispose();
    this.layerComps.clear();
    for (const [, channel] of this.channels) channel.dispose();
    this.channels.clear();
    this.sharedReverb?.dispose();
    this.sharedReverb = null;
    this.sharedDelay?.dispose();
    this.sharedDelay = null;
    this.masterGain?.dispose();
    this.masterGain = null;
    this.masterLimiter?.dispose();
    this.masterLimiter = null;
    for (const [, pv] of this.previewVoices) pv.voice.dispose();
    this.previewVoices.clear();
  }

  // ── Softpot preview ─────────────────────────────────────────────────────

  private getOrCreatePreviewVoice(
    layerId: LayerId,
    mapping: SoundMapping,
  ): { voice: LoopVoice; soundId: SoundId; handle: VoiceHandle | null } | null {
    const channel = this.channels.get(layerId);
    if (!channel) {
      softpotWarn("cannot create preview voice; missing layer channel", { layerId });
      return null;
    }
    const existing = this.previewVoices.get(layerId);
    if (existing && existing.soundId === mapping.soundId) return existing;
    existing?.voice.dispose();
    const pv = { voice: createVoicePool(channel, mapping), soundId: mapping.soundId, handle: null };
    this.previewVoices.set(layerId, pv);
    return pv;
  }

  async beginPreviewNote(layerId: LayerId, mapping: SoundMapping, freqHz: number): Promise<void> {
    if (!this.ready) {
      softpotWarn("beginPreviewNote ignored; audio engine is not ready", {
        layerId,
        soundId: mapping.soundId,
        freqHz,
      });
      return;
    }
    const pv = this.getOrCreatePreviewVoice(layerId, mapping);
    if (!pv) return;
    await pv.voice.waitUntilLoaded?.();
    if (pv.handle != null) {
      pv.voice.releaseAll(getToneContext().currentTime);
      pv.handle = null;
    }
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    pv.voice.updateMapping(mapping);
    pv.handle = pv.voice.triggerAttack(freqHz, now());
    this.previewFreqs.set(layerId, freqHz);
    softpotDebug("preview note started", { layerId, soundId: mapping.soundId, freqHz });
  }

  /** Ramp the held preview note's frequency without retriggering the envelope. */
  slidePreviewNote(layerId: LayerId, freqHz: number): void {
    if (!this.ready) return;
    const pv = this.previewVoices.get(layerId);
    if (!pv?.handle) return;
    pv.handle.frequency.linearRampToValueAtTime(freqHz, getToneContext().currentTime + 0.03);
  }

  async updatePreviewNote(layerId: LayerId, mapping: SoundMapping, freqHz: number): Promise<void> {
    if (!this.ready) {
      softpotWarn("updatePreviewNote ignored; audio engine is not ready", {
        layerId,
        soundId: mapping.soundId,
        freqHz,
      });
      return;
    }
    const pv = this.getOrCreatePreviewVoice(layerId, mapping);
    if (!pv) return;
    await pv.voice.waitUntilLoaded?.();
    if (pv.handle != null) {
      pv.voice.releaseAll(getToneContext().currentTime);
      pv.handle = null;
    }
    this.setLayerSendLevels(layerId, sendLevelsFromKnobs(mapping));
    pv.voice.updateMapping(mapping);
    pv.handle = pv.voice.triggerAttack(freqHz, now());
    this.previewFreqs.set(layerId, freqHz);
    softpotDebug("preview note updated", { layerId, soundId: mapping.soundId, freqHz });
  }

  endPreviewNote(layerId: LayerId): void {
    if (!this.ready) {
      softpotWarn("endPreviewNote ignored; audio engine is not ready", { layerId });
      return;
    }
    const pv = this.previewVoices.get(layerId);
    if (pv) {
      pv.voice.releaseAll(getToneContext().currentTime);
      pv.handle = null;
      softpotDebug("preview note ended", { layerId });
    }
    this.previewFreqs.delete(layerId);
  }
}

export const audioEngine = new AudioEngine();
