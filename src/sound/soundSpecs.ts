import type {
  KnobEffect,
  LayerMixEffect,
  LoopEffect,
  LoopEffectType,
  OscillatorSoundId,
  SoundCategory,
  SoundId,
} from "../types/sound";

export const OSCILLATOR_SOUND_IDS: OscillatorSoundId[] = [
  "sawtooth", "sine", "triangle", "square",
];

const SALAMANDER_BASE = "https://tonejs.github.io/audio/salamander/";
const CR78_BASE = "https://tonejs.github.io/audio/drum-samples/CR78/";

export const SOUND_CATALOG: Record<
  SoundId,
  {
    displayName: string;
    category: SoundCategory;
    /** Fixed dB gain applied in the voice pool to compensate for quiet sample packs. */
    gainDb?: number;
    sampleMap?: Record<string, string>;
    baseUrl?: string;
  }
> = {
  // ── Oscillators ──────────────────────────────────────────────────────────
  sawtooth: { displayName: "Saw",      category: "oscillator" },
  sine:     { displayName: "Sine",     category: "oscillator" },
  triangle: { displayName: "Triangle", category: "oscillator" },
  square:   { displayName: "Square",   category: "oscillator" },

  // ── Sampled instruments (Tone.js Sampler — polyphonic, pitched) ──────────
  piano: {
    displayName: "Piano",
    category: "sampler",
    gainDb: 12,
    baseUrl: SALAMANDER_BASE,
    sampleMap: {
      A0: "A0.mp3",  C1: "C1.mp3",  "D#1": "Ds1.mp3", "F#1": "Fs1.mp3",
      A1: "A1.mp3",  C2: "C2.mp3",  "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
      A2: "A2.mp3",  C3: "C3.mp3",  "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
      A3: "A3.mp3",  C4: "C4.mp3",  "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
      A4: "A4.mp3",  C5: "C5.mp3",  "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
      A5: "A5.mp3",  C6: "C6.mp3",  "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
      A6: "A6.mp3",  C7: "C7.mp3",  "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
      A7: "A7.mp3",  C8: "C8.mp3",
    },
  },
  casio: {
    displayName: "Casio",
    category: "sampler",
    gainDb: 12,
    baseUrl: "https://tonejs.github.io/audio/casio/",
    sampleMap: { A1: "A1.mp3", A2: "A2.mp3" },
  },

  // ── One-shot drums (Tone.js Player — trigger + plays to end) ─────────────
  kick:  { displayName: "Kick",   category: "player", sampleMap: { default: `${CR78_BASE}kick.mp3`  } },
  snare: { displayName: "Snare",  category: "player", sampleMap: { default: `${CR78_BASE}snare.mp3` } },
  hihat: { displayName: "Hi-hat", category: "player", sampleMap: { default: `${CR78_BASE}hihat.mp3` } },
};

export function getSoundCategory(soundId: SoundId): SoundCategory {
  return SOUND_CATALOG[soundId].category;
}

/** Absolute URLs for every sample file used by player/sampler sounds — preload before triggering. */
export function collectSoundSampleUrls(): string[] {
  const urls = new Set<string>();
  for (const spec of Object.values(SOUND_CATALOG)) {
    if (!spec.sampleMap) continue;
    const base = spec.baseUrl ?? "";
    for (const file of Object.values(spec.sampleMap)) {
      if (!file || typeof file !== "string") continue;
      if (file.startsWith("http://") || file.startsWith("https://")) {
        urls.add(file);
      } else {
        urls.add(base + file);
      }
    }
  }
  return [...urls];
}

export const LOOP_EFFECT_LABELS: Record<LoopEffectType, string> = {
  distortion: "Distortion",
  chorus: "Chorus",
  phaser: "Phaser",
  vibrato: "Vibrato",
  autoFilter: "Auto-filter",
  tremolo: "Tremolo",
  bitCrusher: "Bit crusher",
};

export const EFFECT_GROUP: Record<LoopEffectType, string> = {
  distortion: "Color",
  bitCrusher: "Color",
  chorus: "Modulation",
  phaser: "Modulation",
  vibrato: "Modulation",
  autoFilter: "Modulation",
  tremolo: "Modulation",
};

export const EFFECT_PAGE_KNOBS: Record<LoopEffectType, KnobEffect[]> = {
  distortion: ["drive", "driveWet"],
  chorus: ["chorusDepth", "chorusRate"],
  phaser: ["phaserDepth", "phaserRate"],
  vibrato: ["vibratoDepth", "vibratoRate"],
  autoFilter: ["autoFilterDepth", "autoFilterRate"],
  tremolo: ["tremoloDepth", "tremoloRate"],
  bitCrusher: ["bitCrusherBits"],
};

export const DEFAULT_EFFECT_VALUES: Record<LoopEffectType, LoopEffect> = {
  distortion: { type: "distortion", drive: 0.5, mix: 0.5 },
  chorus: { type: "chorus", depth: 0.5, rate: 0.4 },
  phaser: { type: "phaser", depth: 0.5, rate: 0.4 },
  vibrato: { type: "vibrato", depth: 0.3, rate: 0.5 },
  autoFilter: { type: "autoFilter", depth: 0.5, rate: 0.3 },
  tremolo: { type: "tremolo", depth: 0.5, rate: 0.5 },
  bitCrusher: { type: "bitCrusher", amount: 0.4 },
};

export type KnobRange = { min: number; max: number; linear?: true };

export const KNOB_SPECS: Record<
  KnobEffect,
  {
    label: string;
    name: string;
    range: KnobRange;
  }
> = {
  attack: { label: "Attack", name: "Attack", range: { min: 0, max: 2.0 } },
  decay: { label: "Decay", name: "Decay", range: { min: 0.05, max: 2.0 } },
  sustain: {
    label: "Sustain",
    name: "Sustain",
    range: { min: 0, max: 1, linear: true },
  },
  release: { label: "Release", name: "Release", range: { min: 0.05, max: 4.0 } },
  filterCutoff: {
    label: "Cutoff",
    name: "Filter cutoff",
    range: { min: 80, max: 18000 },
  },
  filterResonance: {
    label: "Resonance",
    name: "Filter resonance",
    range: { min: 0.5, max: 20, linear: true },
  },
  drive: {
    label: "Drive",
    name: "Drive",
    range: { min: 0, max: 1, linear: true },
  },
  driveWet: {
    label: "Wet",
    name: "Drive wet",
    range: { min: 0, max: 1, linear: true },
  },
  reverbSend: {
    label: "Reverb",
    name: "Reverb send",
    range: { min: 0, max: 1, linear: true },
  },
  delaySend: {
    label: "Delay",
    name: "Delay send",
    range: { min: 0, max: 1, linear: true },
  },
  chorusDepth: {
    label: "Depth",
    name: "Chorus depth",
    range: { min: 0, max: 1, linear: true },
  },
  chorusRate: {
    label: "Rate",
    name: "Chorus rate",
    range: { min: 0.1, max: 8 },
  },
  phaserDepth: {
    label: "Depth",
    name: "Phaser depth",
    range: { min: 0, max: 8, linear: true },
  },
  phaserRate: {
    label: "Rate",
    name: "Phaser rate",
    range: { min: 0.1, max: 8 },
  },
  vibratoDepth: {
    label: "Depth",
    name: "Vibrato depth",
    range: { min: 0, max: 0.5, linear: true },
  },
  vibratoRate: {
    label: "Rate",
    name: "Vibrato rate",
    range: { min: 0.5, max: 12 },
  },
  autoFilterRate: {
    label: "Rate",
    name: "Auto-filter rate",
    range: { min: 0.1, max: 8 },
  },
  autoFilterDepth: {
    label: "Depth",
    name: "Auto-filter depth",
    range: { min: 0, max: 1, linear: true },
  },
  tremoloDepth: {
    label: "Depth",
    name: "Tremolo depth",
    range: { min: 0, max: 1, linear: true },
  },
  tremoloRate: {
    label: "Rate",
    name: "Tremolo rate",
    range: { min: 0.1, max: 8 },
  },
  bitCrusherBits: {
    label: "Amount",
    name: "Bit crusher",
    range: { min: 0, max: 1, linear: true },
  },
  pitchDriftRange: {
    label: "Pitch drift",
    name: "Pitch drift",
    range: { min: 0, max: 1, linear: true },
  },
  portamento: {
    label: "Portamento",
    name: "Portamento",
    range: { min: 0, max: 0.5, linear: true },
  },
};

export const MIX_KNOB_SPECS: Record<
  LayerMixEffect,
  {
    label: string;
    name: string;
  }
> = {
  eqLow: { label: "Low", name: "EQ low" },
  eqMid: { label: "Mid", name: "EQ mid" },
  eqHigh: { label: "High", name: "EQ high" },
  compThreshold: { label: "Threshold", name: "Comp threshold" },
  compRatio: { label: "Ratio", name: "Comp ratio" },
  compAttack: { label: "Attack", name: "Comp attack" },
  compRelease: { label: "Release", name: "Comp release" },
};
