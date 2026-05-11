import type { ToneAudioNode } from "tone";
import type { SoundMapping } from "../types/sound";
import type { LoopVoice } from "./audioEngine";
import { getSoundCategory } from "../sound/soundSpecs";
import { VoicePool } from "./voicePool";
import { SamplerVoicePool } from "./samplerVoicePool";
import { PlayerVoicePool } from "./playerVoicePool";

export function createVoicePool(connectTo: ToneAudioNode, mapping: SoundMapping): LoopVoice {
  const category = getSoundCategory(mapping.soundId);
  if (category === "sampler") return new SamplerVoicePool(connectTo, mapping);
  if (category === "player") return new PlayerVoicePool(connectTo, mapping);
  return new VoicePool(connectTo, mapping);
}
