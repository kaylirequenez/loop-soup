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
  /** Alias for UI parity with older naming. */
  toggleLayerMute: (id: LayerId) => void;
  setSoloLayerId: (id: LayerId | null) => void;
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

    /**
     * Purpose:
     * Toggles the manual mute preference for a layer.
     *
     * Behavior:
     * - Updates only the underlying manual mute preference.
     * - Does not clear or set solo.
     *
     * Inputs:
     * - id: target layer id
     *
     * Output:
     * - Flips manualMutes[id]
     *
     * Invariants:
     * - Solo remains a separate temporary override.
     */
    toggleManualMute: (id) =>
      set((state) => ({
        manualMutes: {
          ...state.manualMutes,
          [id]: !state.manualMutes[id],
        },
      })),

    toggleLayerMute: (id) => get().toggleManualMute(id),

    toggleLayerSolo: (id) =>
      set((state) => ({
        soloLayerId: state.soloLayerId === id ? null : id,
      })),

    /**
     * Purpose:
     * Sets or clears the solo layer override.
     *
     * Behavior:
     * - If set, only that layer is audible.
     * - If cleared, audibility falls back to manual mutes.
     *
     * Inputs:
     * - id: solo target layer id or null
     *
     * Output:
     * - Updates soloLayerId
     *
     * Invariants:
     * - Solo does not overwrite manual mute preferences.
     */
    setSoloLayerId: (id) => set({ soloLayerId: id }),

    /**
     * Purpose:
     * Computes whether a layer should currently be audible.
     *
     * Behavior:
     * - If soloLayerId is null, uses manual mutes.
     * - If soloLayerId is set, only the solo layer is audible.
     *
     * Inputs:
     * - id: target layer id
     *
     * Output:
     * - true if the layer is currently audible
     *
     * Invariants:
     * - Manual mute preferences remain unchanged by solo.
     */
    isLayerAudible: (id) => {
      const { soloLayerId, manualMutes } = get();
      return soloLayerId !== null ? id === soloLayerId : !manualMutes[id];
    },
  }),
);
