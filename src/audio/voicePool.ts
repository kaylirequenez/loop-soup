import { Synth, getTransport, getContext as getToneContext, type ToneAudioNode } from "tone";
import type { OscillatorSoundId, SoundMapping, VoiceHandle } from "../types/sound";
import { mappingEnvelope } from "./instruments";
import { knobToParam } from "./soundParams";

const POOL_SIZE = 8;
const MAX_DRIFT_CENTS = 50;

interface ActiveVoice {
  synth: Synth;
  allocatedAt: number; // audio context time, for voice stealing
}

function makeSynth(connectTo: ToneAudioNode, mapping: SoundMapping): Synth {
  const s = new Synth({
    oscillator: { type: mapping.soundId as OscillatorSoundId },
    envelope: mappingEnvelope(mapping),
    portamento: knobToParam("portamento", mapping.knobsByEffect.portamento?.value ?? 0),
  });
  s.connect(connectTo);
  return s;
}

export class VoicePool {
  private idle: Synth[];
  private active: ActiveVoice[] = [];
  private destination: ToneAudioNode;
  private pitchDriftRange: number;

  constructor(connectTo: ToneAudioNode, mapping: SoundMapping) {
    this.destination = connectTo;
    this.pitchDriftRange = mapping.knobsByEffect.pitchDriftRange?.value ?? 0;
    this.idle = Array.from({ length: POOL_SIZE }, () => makeSynth(connectTo, mapping));
  }

  private allocate(time: number): Synth {
    if (this.idle.length > 0) return this.idle.pop()!;
    // Steal the voice that has been held the longest.
    let oldestIdx = 0;
    for (let i = 1; i < this.active.length; i++) {
      if (this.active[i].allocatedAt < this.active[oldestIdx].allocatedAt) oldestIdx = i;
    }
    const stolen = this.active.splice(oldestIdx, 1)[0];
    stolen.synth.detune.value = 0;
    stolen.synth.triggerRelease();
    return stolen.synth;
  }

  private applyDrift(synth: Synth): void {
    if (this.pitchDriftRange <= 0) return;
    synth.detune.value = (Math.random() * 2 - 1) * this.pitchDriftRange * MAX_DRIFT_CENTS;
  }

  private returnToIdle(synth: Synth): void {
    synth.detune.value = 0;
    this.active = this.active.filter((v) => v.synth !== synth);
    this.idle.push(synth);
  }

  triggerAttackRelease(
    freq: number,
    duration: string | number,
    time: number,
    velocity?: number,
  ): void {
    const synth = this.allocate(time);
    this.active.push({ synth, allocatedAt: time });
    this.applyDrift(synth);
    synth.triggerAttackRelease(freq, duration, time, velocity);

    const durationSec = typeof duration === "number"
      ? duration
      : getTransport().toSeconds(duration as `${number}i`);
    const releaseSec = (synth.get().envelope.release as number) || 0.4;
    const startOffset = Math.max(0, time - getToneContext().currentTime);
    window.setTimeout(
      () => this.returnToIdle(synth),
      (startOffset + durationSec + releaseSec + 0.15) * 1000,
    );
  }

  /** Returns the allocated Synth as a VoiceHandle so the caller can schedule pitch-curve ramps. */
  triggerAttack(freq: number, time: number, velocity?: number): VoiceHandle {
    const synth = this.allocate(time);
    this.active.push({ synth, allocatedAt: time });
    this.applyDrift(synth);
    synth.triggerAttack(freq, time, velocity);
    return synth;
  }

  scheduleRelease(handle: VoiceHandle, releaseTime: number): void {
    const synth = handle as Synth;
    synth.triggerRelease(releaseTime);
    const releaseSec = (synth.get().envelope.release as number) || 0.4;
    const delay = Math.max(0, releaseTime - getToneContext().currentTime) + releaseSec + 0.15;
    window.setTimeout(() => this.returnToIdle(synth), delay * 1000);
  }

  releaseAll(time?: number): void {
    const snapshot = [...this.active];
    for (const { synth } of snapshot) synth.triggerRelease(time);
    window.setTimeout(() => {
      for (const { synth } of snapshot) this.idle.push(synth);
      this.active = this.active.filter((v) => !snapshot.includes(v));
    }, 600);
  }

  updateMapping(mapping: SoundMapping): void {
    this.pitchDriftRange = mapping.knobsByEffect.pitchDriftRange?.value ?? 0;
    const params = {
      oscillator: { type: mapping.soundId as OscillatorSoundId } as Parameters<Synth["set"]>[0]["oscillator"],
      envelope: mappingEnvelope(mapping),
      portamento: knobToParam("portamento", mapping.knobsByEffect.portamento?.value ?? 0),
    };
    for (const s of [...this.idle, ...this.active.map((v) => v.synth)]) {
      s.set(params);
    }
  }

  waitUntilLoaded(): Promise<void> {
    return Promise.resolve();
  }

  dispose(): void {
    for (const s of [...this.idle, ...this.active.map((v) => v.synth)]) {
      s.dispose();
    }
    this.idle = [];
    this.active = [];
  }
}
