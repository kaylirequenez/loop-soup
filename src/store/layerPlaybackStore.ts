import { create } from "zustand";
import type { LayerId } from "../types/layer";
import type { LayerPlaybackState } from "../types/layerPlayback";

/**
 * Layer playback store
 *
 * Owns temporary playback control state only:
 * - manual mutes
 * - solo layer id
 *
 * Does not own:
 * - saved layer project data
 * - editor selection state
 */
interface LayerPlaybackStore extends LayerPlaybackState {
  toggleManualMute: (id: LayerId) => void;
  /** Toggle solo: pass layer id to solo it, or same id to clear if already soloed. */
  toggleLayerSolo: (id: LayerId) => void;
  isLayerAudible: (id: LayerId) => boolean;
}

const buildDefaultManualMutes = (): Record<LayerId, boolean> => ({
  A: false,
  B: false,
  C: false,
  D: false,
  E: false,
});

export const useLayerPlaybackStore = create<LayerPlaybackStore>()(
  (set, get) => ({
    manualMutes: buildDefaultManualMutes(),
    soloLayerId: null,
    toggleManualMute: (id) =>
      set((state) => ({
        manualMutes: {
          ...state.manualMutes,
          [id]: !state.manualMutes[id],
        },
        soloLayerId: null,
      })),
    toggleLayerSolo: (id) =>
      set((state) => ({
        soloLayerId: state.soloLayerId === id ? null : id,
        manualMutes: {
          ...state.manualMutes,
          [id]: false,
        },
      })),
    isLayerAudible: (id) => {
      const { soloLayerId, manualMutes } = get();
      return soloLayerId !== null ? id === soloLayerId : !manualMutes[id];
    },
  }),
);
