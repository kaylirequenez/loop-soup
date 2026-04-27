/**
 * Sound catalog placeholder.
 * When real sounds exist, this becomes a catalog of { id, displayName, ... }.
 * For now, values are display strings that also serve as ids.
 */

import type { LayerId } from "../types/layer";

export const SOUND_OPTIONS: Record<LayerId, string[]> = {
  A: ["synth lead", "pluck", "bell", "pad lead", "organ"],
  B: ["sub bass", "reese bass", "moog bass", "808"],
  C: ["synth lead", "pluck", "bell", "pad lead", "organ"],
  D: ["pad", "strings", "choir", "Rhodes", "stab"],
  E: ["electronic kit", "acoustic kit", "lo-fi kit"],
};

export function defaultSoundForLayer(layerId: LayerId): string | null {
  return SOUND_OPTIONS[layerId]?.[0] ?? null;
}
