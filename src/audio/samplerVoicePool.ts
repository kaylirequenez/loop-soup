import { Sampler, getContext as getToneContext, type ToneAudioNode } from "tone";
import type { SoundMapping, VoiceHandle } from "../types/sound";
import type { LoopVoice } from "./audioEngine";
import { SOUND_CATALOG } from "../sound/soundSpecs";
import { mappingEnvelope } from "./instruments";

const NOOP_HANDLE: VoiceHandle = {
  frequency: { linearRampToValueAtTime: () => {} },
};

// Max seconds in the past we'll still replay a deferred note (covers scheduling jitter).
const REPLAY_WINDOW = 0.15;

export class SamplerVoicePool implements LoopVoice {
  private sampler: Sampler;
  private _loaded = false;
  private loadPromise: Promise<void>;

  constructor(connectTo: ToneAudioNode, mapping: SoundMapping) {
    const spec = SOUND_CATALOG[mapping.soundId];
    const env = mappingEnvelope(mapping);
    let resolveLoad!: () => void;
    this.loadPromise = new Promise<void>((resolve) => { resolveLoad = resolve; });
    this.sampler = new Sampler({
      urls: spec.sampleMap ?? {},
      baseUrl: spec.baseUrl,
      attack: env.attack as number,
      release: env.release as number,
      // Fixed boost per sample pack; mapping.mix.volume is handled by loopChannel.
      volume: spec.gainDb ?? 0,
      onload: () => {
        this._loaded = true;
        resolveLoad();
      },
    });
    this.sampler.connect(connectTo);
  }

  waitUntilLoaded(): Promise<void> {
    return this.loadPromise;
  }

  triggerAttackRelease(
    freqHz: number,
    duration: string | number,
    time?: string | number,
    velocity?: number,
  ): void {
    const t = (time as number) ?? getToneContext().currentTime;
    if (!this._loaded) {
      // Buffer not yet ready — replay as soon as it loads, at the original audio time
      // if it's still in the future, otherwise immediately.
      this.loadPromise.then(() => {
        const now = getToneContext().currentTime;
        if (t > now - REPLAY_WINDOW) {
          this.sampler.triggerAttackRelease(freqHz, duration, Math.max(t, now), velocity);
        }
      });
      return;
    }
    this.sampler.triggerAttackRelease(freqHz, duration, t, velocity);
  }

  triggerAttack(freqHz: number, time: number, velocity?: number): VoiceHandle {
    if (!this._loaded) {
      this.loadPromise.then(() => {
        const now = getToneContext().currentTime;
        if (time > now - REPLAY_WINDOW) {
          this.sampler.triggerAttack(freqHz, Math.max(time, now), velocity);
        }
      });
      return NOOP_HANDLE;
    }
    this.sampler.triggerAttack(freqHz, time, velocity);
    return NOOP_HANDLE;
  }

  scheduleRelease(_handle: VoiceHandle, releaseTime: number): void {
    this.sampler.releaseAll(releaseTime);
  }

  releaseAll(time?: number): void {
    this.sampler.releaseAll(time);
  }

  updateMapping(mapping: SoundMapping): void {
    const env = mappingEnvelope(mapping);
    this.sampler.set({
      attack: env.attack as number,
      release: env.release as number,
    });
    // Volume (gainDb) is fixed per spec; mapping.mix.volume is applied by loopChannel.
  }

  dispose(): void {
    try {
      this.sampler.dispose();
    } catch {
      /* Avoid surfacing Tone teardown issues when buffers never loaded. */
    }
  }
}
