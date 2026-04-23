import type { LayerId } from "./layer";

export interface LayerPlaybackState {
  manualMutes: Record<LayerId, boolean>;
  soloLayerId: LayerId | null;
}
