import { KNOB_SPECS } from "./soundSpecs";
import type {
  KnobEffect,
  LoopEffect,
  LoopSoundState,
  SoundMapping,
} from "../types/sound";
import { clamp01 } from "../utils";

const findLoopEffect = <T extends LoopEffect["type"]>(
  loopSound: LoopSoundState,
  type: T,
): Extract<LoopEffect, { type: T }> | undefined =>
  loopSound.effects.find((effect) => effect.type === type) as
    | Extract<LoopEffect, { type: T }>
    | undefined;

export function loopSoundToMapping(loopSound: LoopSoundState): SoundMapping {
  const distortion = findLoopEffect(loopSound, "distortion");
  const chorus = findLoopEffect(loopSound, "chorus");
  const phaser = findLoopEffect(loopSound, "phaser");
  const vibrato = findLoopEffect(loopSound, "vibrato");
  const autoFilter = findLoopEffect(loopSound, "autoFilter");
  const tremolo = findLoopEffect(loopSound, "tremolo");
  const bitCrusher = findLoopEffect(loopSound, "bitCrusher");

  return {
    soundId: loopSound.soundId,
    mix: {
      volume: clamp01(loopSound.mix?.volume ?? 0.7),
      pan: clamp01(loopSound.mix?.pan ?? 0.5),
    },
    knobsByEffect: {
      attack: {
        value: clamp01(loopSound.envelope.attack),
        label: KNOB_SPECS.attack.label,
      },
      decay: {
        value: clamp01(loopSound.envelope.decay),
        label: KNOB_SPECS.decay.label,
      },
      sustain: {
        value: clamp01(loopSound.envelope.sustain),
        label: KNOB_SPECS.sustain.label,
      },
      release: {
        value: clamp01(loopSound.envelope.release),
        label: KNOB_SPECS.release.label,
      },
      filterCutoff: {
        value: clamp01(loopSound.filter.cutoff),
        label: KNOB_SPECS.filterCutoff.label,
      },
      filterResonance: {
        value: clamp01(loopSound.filter.resonance),
        label: KNOB_SPECS.filterResonance.label,
      },
      reverbSend: {
        value: clamp01(loopSound.sends.reverb),
        label: KNOB_SPECS.reverbSend.label,
      },
      delaySend: {
        value: clamp01(loopSound.sends.delay),
        label: KNOB_SPECS.delaySend.label,
      },
      portamento: {
        value: clamp01(loopSound.portamento ?? 0),
        label: KNOB_SPECS.portamento.label,
      },
      pitchDriftRange: {
        value: clamp01(loopSound.pitchDrift ?? 0),
        label: KNOB_SPECS.pitchDriftRange.label,
      },
      ...(distortion
        ? {
            drive: {
              value: clamp01(distortion.drive),
              label: KNOB_SPECS.drive.label,
            },
            driveWet: {
              value: clamp01(distortion.mix),
              label: KNOB_SPECS.driveWet.label,
            },
          }
        : {}),
      ...(chorus
        ? {
            chorusDepth: {
              value: clamp01(chorus.depth),
              label: KNOB_SPECS.chorusDepth.label,
            },
            chorusRate: {
              value: clamp01(chorus.rate),
              label: KNOB_SPECS.chorusRate.label,
            },
          }
        : {}),
      ...(phaser
        ? {
            phaserDepth: {
              value: clamp01(phaser.depth),
              label: KNOB_SPECS.phaserDepth.label,
            },
            phaserRate: {
              value: clamp01(phaser.rate),
              label: KNOB_SPECS.phaserRate.label,
            },
          }
        : {}),
      ...(vibrato
        ? {
            vibratoDepth: {
              value: clamp01(vibrato.depth),
              label: KNOB_SPECS.vibratoDepth.label,
            },
            vibratoRate: {
              value: clamp01(vibrato.rate),
              label: KNOB_SPECS.vibratoRate.label,
            },
          }
        : {}),
      ...(autoFilter
        ? {
            autoFilterDepth: {
              value: clamp01(autoFilter.depth),
              label: KNOB_SPECS.autoFilterDepth.label,
            },
            autoFilterRate: {
              value: clamp01(autoFilter.rate),
              label: KNOB_SPECS.autoFilterRate.label,
            },
          }
        : {}),
      ...(tremolo
        ? {
            tremoloDepth: {
              value: clamp01(tremolo.depth),
              label: KNOB_SPECS.tremoloDepth.label,
            },
            tremoloRate: {
              value: clamp01(tremolo.rate),
              label: KNOB_SPECS.tremoloRate.label,
            },
          }
        : {}),
      ...(bitCrusher
        ? {
            bitCrusherBits: {
              value: clamp01(bitCrusher.amount),
              label: KNOB_SPECS.bitCrusherBits.label,
            },
          }
        : {}),
    },
  };
}

export function mappingToLoopSound(mapping: SoundMapping): LoopSoundState {
  const get = (effect: KnobEffect, fallback: number) =>
    clamp01(mapping.knobsByEffect[effect]?.value ?? fallback);
  return {
    soundId: mapping.soundId,
    mix: {
      volume: clamp01(mapping.mix?.volume ?? 0.7),
      pan: clamp01(mapping.mix?.pan ?? 0.5),
    },
    envelope: {
      attack: get("attack", 0),
      decay: get("decay", 0.3),
      sustain: get("sustain", 0.5),
      release: get("release", 0.4),
    },
    filter: {
      cutoff: get("filterCutoff", 1),
      resonance: get("filterResonance", 0),
    },
    sends: {
      reverb: get("reverbSend", 0.12),
      delay: get("delaySend", 0.08),
    },
    portamento: get("portamento", 0),
    pitchDrift: get("pitchDriftRange", 0),
    effects: [],
  };
}
