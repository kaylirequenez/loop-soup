import { PolySynth, Synth } from "tone";
import { LAYER_IDS, type LayerId } from "../types/layer";
import type { OscillatorSoundId, SoundId, SoundMapping } from "../types/sound";
import { getSoundCategory } from "../sound/soundSpecs";
import { knobToEnvParam } from "./soundParams";

function oscillatorType(soundId: SoundId): OscillatorSoundId {
  return getSoundCategory(soundId) === "oscillator"
    ? (soundId as OscillatorSoundId)
    : "sawtooth";
}

export function mappingEnvelope(mapping: SoundMapping): {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
} {
  const get = (effect: keyof SoundMapping["knobsByEffect"], fallback: number) =>
    mapping.knobsByEffect[effect]?.value ?? fallback;
  return {
    attack: knobToEnvParam("attack", get("attack", 0)),
    decay: knobToEnvParam("decay", get("decay", 0.3)),
    sustain: knobToEnvParam("sustain", get("sustain", 0.5)),
    release: knobToEnvParam("release", get("release", 0.4)),
  };
}

export function applyMappingToSynth(
  synth: PolySynth<Synth>,
  mapping: SoundMapping,
): void {
  synth.set({
    oscillator: { type: oscillatorType(mapping.soundId) },
    envelope: mappingEnvelope(mapping),
  });
}

function buildPreviewSynth(
  mapping: SoundMapping,
): PolySynth<Synth> {
  return new PolySynth(Synth, {
    oscillator: { type: oscillatorType(mapping.soundId) },
    envelope: mappingEnvelope(mapping),
  });
}

/** Per-layer preview synths for softpot — always snappy regardless of knob settings. */
export function buildPreviewInstruments(
  layerSounds: Map<LayerId, SoundId>,
): Map<LayerId, PolySynth<Synth>> {
  const map = new Map<LayerId, PolySynth<Synth>>();
  for (const id of LAYER_IDS) {
    const soundId = layerSounds.get(id)!;
    map.set(
      id,
      buildPreviewSynth({
        soundId,
        mix: { volume: 0.7, pan: 0.5 },
        knobsByEffect: {},
      }),
    );
  }
  return map;
}
