import { create } from "zustand";
import type { LayerId, LayerLoopId } from "../types/layer";
import type { LoopDefinitionId, LoopInstanceId } from "../types/loop";
import type { LayerEditorState } from "../types/layerEditor";

/**
 * Layer editor store
 *
 * Owns temporary editor selection state only:
 * - selected layer id
 * - per-layer focus: layer default vs loop instance vs shared loop definition
 *
 * Does not own:
 * - saved layer project data
 * - mute/solo playback state
 */
interface LayerEditorStore extends LayerEditorState {
  setSelectedLayerId: (id: LayerId) => void;
  selectLayerDefault: (layerId: LayerId) => void;
  selectLoop: (layerId: LayerId, loopId: LayerLoopId) => void;
  selectLoopInstance: (
    layerId: LayerId,
    loopInstanceId: LoopInstanceId,
  ) => void;
  selectLoopDefinition: (
    layerId: LayerId,
    loopDefinitionId: LoopDefinitionId,
  ) => void;
  clearLoopFocus: (layerId: LayerId) => void;
  /** @deprecated Use selectLoopInstance / clearLoopFocus */
  setSelectedLoopInstanceId: (
    layerId: LayerId,
    loopInstanceId: LoopInstanceId | null,
  ) => void;
  /** @deprecated Use clearLoopFocus */
  clearSelectedLoopInstanceId: (layerId: LayerId) => void;
}

const emptyFocusByLayer =
  (): LayerEditorState["selectedLoopFocusByLayer"] => ({});

export const useLayerEditorStore = create<LayerEditorStore>()((set) => ({
  selectedLayerId: "A",
  selectedLoopFocusByLayer: emptyFocusByLayer(),

  setSelectedLayerId: (id) => set({ selectedLayerId: id }),

  selectLayerDefault: (layerId) =>
    set((state) => ({
      selectedLayerId: layerId,
      selectedLoopFocusByLayer: {
        ...state.selectedLoopFocusByLayer,
        [layerId]: { kind: "layerDefault" },
      },
    })),

  selectLoopInstance: (layerId, loopInstanceId) =>
    set((state) => ({
      selectedLayerId: layerId,
      selectedLoopFocusByLayer: {
        ...state.selectedLoopFocusByLayer,
        [layerId]: { kind: "instance", loopInstanceId },
      },
    })),

  selectLoop: (layerId, loopId) =>
    set((state) => ({
      selectedLayerId: layerId,
      selectedLoopFocusByLayer: {
        ...state.selectedLoopFocusByLayer,
        [layerId]: { kind: "loop", loopId },
      },
    })),

  selectLoopDefinition: (layerId, loopDefinitionId) =>
    set((state) => ({
      selectedLayerId: layerId,
      selectedLoopFocusByLayer: {
        ...state.selectedLoopFocusByLayer,
        [layerId]: { kind: "definition", loopDefinitionId },
      },
    })),

  clearLoopFocus: (layerId) =>
    set((state) => {
      const next = { ...state.selectedLoopFocusByLayer };
      delete next[layerId];
      return { selectedLoopFocusByLayer: next };
    }),

  setSelectedLoopInstanceId: (layerId, loopInstanceId) =>
    set((state) =>
      loopInstanceId == null
        ? {
            selectedLoopFocusByLayer: {
              ...state.selectedLoopFocusByLayer,
              [layerId]: { kind: "layerDefault" },
            },
          }
        : {
            selectedLayerId: layerId,
            selectedLoopFocusByLayer: {
              ...state.selectedLoopFocusByLayer,
              [layerId]: { kind: "instance", loopInstanceId },
            },
          },
    ),

  clearSelectedLoopInstanceId: (layerId) =>
    set((state) => {
      const next = { ...state.selectedLoopFocusByLayer };
      delete next[layerId];
      return { selectedLoopFocusByLayer: next };
    }),
}));
