import { PolySynth, Synth } from "tone";
import type { SoundId } from "./types";
import type { LayerId } from "../types/layer";
import { LAYER_IDS } from "../types/layer";

const PREVIEW_ENVELOPE = { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 };

export function buildLayerSynth(soundId: NonNullable<SoundId>): PolySynth<Synth> {
  return new PolySynth(Synth, {
    oscillator: { type: soundId },
  }).toDestination();
}

/** Per-layer synths for loop playback. Envelope is set dynamically from knob values. */
export function buildInstruments(
  layerSounds: Map<LayerId, NonNullable<SoundId>>,
): Map<LayerId, PolySynth<Synth>> {
  const map = new Map<LayerId, PolySynth<Synth>>();
  for (const id of LAYER_IDS) {
    map.set(id, buildLayerSynth(layerSounds.get(id) ?? "sawtooth"));
  }
  return map;
}

/** Per-layer preview synths for softpot — always snappy regardless of knob settings. */
export function buildPreviewInstruments(
  layerSounds: Map<LayerId, NonNullable<SoundId>>,
): Map<LayerId, PolySynth<Synth>> {
  const map = new Map<LayerId, PolySynth<Synth>>();
  for (const id of LAYER_IDS) {
    map.set(id, new PolySynth(Synth, {
      oscillator: { type: layerSounds.get(id) ?? "sawtooth" },
      envelope: PREVIEW_ENVELOPE,
    }).toDestination());
  }
  return map;
}
