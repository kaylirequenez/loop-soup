import { create } from "zustand";
import type { LayerId, LayerLoopId, LoopInstanceId } from "../types/layer";
import type { LayerEditorState } from "../types/layerEditor";

interface LayerEditorStore extends LayerEditorState {
  setSelectedLayerId: (id: LayerId) => void;
  selectLoop: (layerId: LayerId, loopId: LayerLoopId) => void;
  selectInstance: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
  ) => void;
  toggleLoopSelection: (layerId: LayerId, loopId: LayerLoopId) => void;
  toggleInstanceSelection: (
    layerId: LayerId,
    loopId: LayerLoopId,
    instanceId: LoopInstanceId,
  ) => void;
  clearLoopSelection: () => void;
  clearInstanceSelection: () => void;
}

/**
 * Layer editor store
 *
 * Owns transient editing focus only:
 * - selected layer
 * - selected loop
 * - selected instance
 */
export const useLayerEditorStore = create<LayerEditorStore>()((set) => ({
  selectedLayerId: "A",
  selectedLoopId: null,
  selectedInstanceId: null,

  setSelectedLayerId: (id) =>
    set({
      selectedLayerId: id,
      selectedLoopId: null,
      selectedInstanceId: null,
    }),

  selectLoop: (layerId, loopId) =>
    set({
      selectedLayerId: layerId,
      selectedLoopId: loopId,
      selectedInstanceId: null,
    }),

  selectInstance: (layerId, loopId, instanceId) =>
    set({
      selectedLayerId: layerId,
      selectedLoopId: loopId,
      selectedInstanceId: instanceId,
    }),

  toggleLoopSelection: (layerId, loopId) =>
    set((state) =>
      state.selectedLayerId === layerId && state.selectedLoopId === loopId
        ? { selectedLoopId: null, selectedInstanceId: null }
        : { selectedLayerId: layerId, selectedLoopId: loopId, selectedInstanceId: null },
    ),

  toggleInstanceSelection: (layerId, loopId, instanceId) =>
    set((state) =>
      state.selectedInstanceId === instanceId
        ? { selectedInstanceId: null }
        : { selectedLayerId: layerId, selectedLoopId: loopId, selectedInstanceId: instanceId },
    ),

  clearLoopSelection: () =>
    set({ selectedLoopId: null, selectedInstanceId: null }),

  clearInstanceSelection: () => set({ selectedInstanceId: null }),
}));
