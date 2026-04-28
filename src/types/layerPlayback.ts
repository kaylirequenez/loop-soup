import type { LayerId } from "./layer";

export interface LayerPlaybackState {
  /** Manual mute preference per layer id. true = muted by user. */
  manualMutes: Record<LayerId, boolean>;
  /** Temporary solo override; when set, only this layer is audible. */
  soloLayerId: LayerId | null;
}
