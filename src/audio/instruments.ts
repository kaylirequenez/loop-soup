import { PolySynth, Synth } from "tone";
import type { SoundId } from "./types";
import type { LayerId, SoundMapping } from "../types/layer";
import { LAYER_IDS } from "../types/layer";
import { knobToEnvParam } from "./sounds";

export function buildLayerSynth(
  soundId: SoundId,
): PolySynth<Synth> {
  return new PolySynth(Synth, {
    oscillator: { type: soundId },
  });
}

function mappingEnvelope(mapping: SoundMapping): {
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

export function applyMappingEnvelope(
  synth: PolySynth<Synth>,
  mapping: SoundMapping,
): void {
  synth.set({ envelope: mappingEnvelope(mapping) });
}

export function applyMappingToSynth(
  synth: PolySynth<Synth>,
  mapping: SoundMapping,
): void {
  synth.set({
    oscillator: { type: mapping.soundId },
    envelope: mappingEnvelope(mapping),
  });
}

export function buildPreviewSynth(
  mapping: SoundMapping,
): PolySynth<Synth> {
  const soundId = mapping.soundId;
  return new PolySynth(Synth, {
    oscillator: { type: soundId },
    envelope: mappingEnvelope(mapping),
  }).toDestination();
}

/** Per-layer synths for loop playback. Envelope is set dynamically from knob values. */
export function buildInstruments(
  layerSounds: Map<LayerId, SoundId>,
): Map<LayerId, PolySynth<Synth>> {
  const map = new Map<LayerId, PolySynth<Synth>>();
  for (const id of LAYER_IDS) {
    map.set(id, buildLayerSynth(layerSounds.get(id)!));
  }
  return map;
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
        knobsByEffect: {},
      }),
    );
  }
  return map;
}
