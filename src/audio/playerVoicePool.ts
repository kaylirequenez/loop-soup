import { Player, ToneAudioBuffer, getContext as getToneContext, type ToneAudioNode } from "tone";
import type { SoundMapping, VoiceHandle } from "../types/sound";
import type { LoopVoice } from "./audioEngine";
import { SOUND_CATALOG } from "../sound/soundSpecs";

const BASE_FREQ = 440; // A4 — reference pitch

const NOOP_HANDLE: VoiceHandle = {
  frequency: { linearRampToValueAtTime: () => {} },
};

// Max seconds in the past we'll still replay a deferred trigger.
const REPLAY_WINDOW = 0.15;

export class PlayerVoicePool implements LoopVoice {
  private buffer: ToneAudioBuffer | null = null;
  private loadPromise: Promise<void>;
  private destination: ToneAudioNode;
  private boost: number;
  private activePlayers: Player[] = [];

  constructor(connectTo: ToneAudioNode, mapping: SoundMapping) {
    const spec = SOUND_CATALOG[mapping.soundId];
    const url = spec.sampleMap?.["default"] ?? "";
    // Fixed boost per sample pack; mapping.mix.volume is handled by loopChannel.
    this.boost = spec.gainDb ?? 0;
    this.destination = connectTo;
    this.loadPromise = ToneAudioBuffer.fromUrl(url)
      .then((buf) => { this.buffer = buf; })
      .catch(() => {});
  }

  waitUntilLoaded(): Promise<void> {
    return this.loadPromise;
  }

  private play(freqHz: number, time: number): void {
    if (!this.buffer) return;
    const rate = freqHz / BASE_FREQ;
    const p = new Player(this.buffer);
    p.connect(this.destination);
    p.volume.value = this.boost;
    p.playbackRate = rate;
    this.activePlayers.push(p);
    p.start(time);
    const duration = this.buffer.duration / rate;
    const startOffset = Math.max(0, time - getToneContext().currentTime);
    window.setTimeout(() => {
      try { p.dispose(); } catch {}
      this.activePlayers = this.activePlayers.filter((x) => x !== p);
    }, (startOffset + duration + 0.5) * 1000);
  }

  triggerAttackRelease(
    freqHz: number,
    _duration: string | number,
    time?: string | number,
    _velocity?: number,
  ): void {
    const t = (time as number) ?? getToneContext().currentTime;
    if (!this.buffer) {
      this.loadPromise.then(() => {
        const now = getToneContext().currentTime;
        if (t > now - REPLAY_WINDOW) this.play(freqHz, Math.max(t, now));
      });
      return;
    }
    this.play(freqHz, t);
  }

  triggerAttack(freqHz: number, time: number, _velocity?: number): VoiceHandle {
    if (!this.buffer) {
      this.loadPromise.then(() => {
        const now = getToneContext().currentTime;
        if (time > now - REPLAY_WINDOW) this.play(freqHz, Math.max(time, now));
      });
      return NOOP_HANDLE;
    }
    this.play(freqHz, time);
    return NOOP_HANDLE;
  }

  scheduleRelease(_handle: VoiceHandle, _releaseTime: number): void {
    // One-shot — plays to end automatically.
  }

  releaseAll(_time?: number): void {
    // One-shot — do not interrupt active playback.
  }

  updateMapping(_mapping: SoundMapping): void {
    // Volume is fixed per spec gainDb; one-shots have no envelope to update.
  }

  dispose(): void {
    for (const p of this.activePlayers) {
      try { p.dispose(); } catch {}
    }
    this.activePlayers = [];
    this.buffer = null;
  }
}
