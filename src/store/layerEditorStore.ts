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
  startRecording: () => void;
  stopRecording: () => void;
  /** Selects the new loop instance and sets `isRecordingLoop` in a single update. */
  armNewLoopRecording: (layerId: LayerId, loopId: LayerLoopId) => void;
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
  isRecordingLoop: false,

  setSelectedLayerId: (id) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      if (state.selectedLayerId === id) return state;
      return {
        selectedLayerId: id,
        selectedLoopId: null,
        selectedInstanceId: null,
      };
    }),

  selectLoop: (layerId, loopId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceId: null,
      };
    }),

  selectInstance: (layerId, loopId, instanceId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceId: instanceId,
      };
    }),

  toggleLoopSelection: (layerId, loopId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return state.selectedLayerId === layerId &&
        state.selectedLoopId === loopId
        ? { selectedLoopId: null, selectedInstanceId: null }
        : {
            selectedLayerId: layerId,
            selectedLoopId: loopId,
            selectedInstanceId: null,
          };
    }),

  toggleInstanceSelection: (layerId, loopId, instanceId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return state.selectedLayerId === layerId &&
        state.selectedLoopId === loopId &&
        state.selectedInstanceId === instanceId
        ? { selectedInstanceId: null }
        : {
            selectedLayerId: layerId,
            selectedLoopId: loopId,
            selectedInstanceId: instanceId,
          };
    }),

  clearLoopSelection: () =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return { selectedLoopId: null, selectedInstanceId: null };
    }),

  clearInstanceSelection: () =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return { selectedInstanceId: null };
    }),

  startRecording: () => set({ isRecordingLoop: true }),

  stopRecording: () => set({ isRecordingLoop: false }),

  armNewLoopRecording: (layerId, loopId) =>
    set({
      selectedLayerId: layerId,
      selectedLoopId: loopId,
      selectedInstanceId: 0,
      isRecordingLoop: true,
    }),
}));
