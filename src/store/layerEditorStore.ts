import { create } from "zustand";
import type {
  LayerId,
  LayerLoopId,
  LayerLoopInstance,
  LoopInstanceId,
} from "../types/layer";
import type {
  LayerEditorState,
  PendingPlacement,
  InstanceEditMode,
} from "../types/layerEditor";

interface LayerEditorStore extends LayerEditorState {
  setSelectedLayerId: (id: LayerId) => void;
  setSelectedKnobPage: (page: number) => void;
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
  toggleAddInstanceSelection: (
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
  /** Sets pending placement and clears instance selection. */
  setPendingPlacement: (placement: PendingPlacement) => void;
  clearPendingPlacement: () => void;
  /** Begins a keyboard-driven instance edit session. */
  beginInstanceEdit: (
    mode: InstanceEditMode,
    sortedIds: LoopInstanceId[],
    instances: LayerLoopInstance[],
  ) => void;
  /** Switches the active edit mode without touching proposedInstances. */
  setInstanceEditMode: (mode: InstanceEditMode) => void;
  /** Replaces the running proposed instance array. */
  updateProposedInstances: (instances: LayerLoopInstance[]) => void;
  /** Cancels the edit session, reverting to idle (caller handles restore). */
  cancelInstanceEdit: () => void;
}

/** Merge into `set(...)` updates whenever leaving keyboard instance edit. */
function clearedInstanceEdit(): Pick<LayerEditorState, "instanceEditState"> {
  return { instanceEditState: null };
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
  selectedInstanceIds: [],
  isRecordingLoop: false,
  pendingPlacement: null,
  selectedKnobPage: 0,
  ...clearedInstanceEdit(),

  setSelectedKnobPage: (page) => set({ selectedKnobPage: page }),

  setSelectedLayerId: (id) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      if (state.selectedLayerId === id) return state;
      return {
        selectedLayerId: id,
        selectedLoopId: null,
        selectedInstanceIds: [],
        selectedKnobPage: 0,
        ...clearedInstanceEdit(),
      };
    }),

  selectLoop: (layerId, loopId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceIds: [],
        ...clearedInstanceEdit(),
      };
    }),

  selectInstance: (layerId, loopId, instanceId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceIds: [instanceId],
        ...clearedInstanceEdit(),
      };
    }),

  toggleLoopSelection: (layerId, loopId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return state.selectedLayerId === layerId &&
        state.selectedLoopId === loopId
        ? {
            selectedLoopId: null,
            selectedInstanceIds: [],
            ...clearedInstanceEdit(),
          }
        : {
            selectedLayerId: layerId,
            selectedLoopId: loopId,
            selectedInstanceIds: [],
            ...clearedInstanceEdit(),
          };
    }),

  toggleInstanceSelection: (layerId, loopId, instanceId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      const onlyThisOne =
        state.selectedLayerId === layerId &&
        state.selectedLoopId === loopId &&
        state.selectedInstanceIds.length === 1 &&
        state.selectedInstanceIds[0] === instanceId;
      if (onlyThisOne) {
        return { selectedInstanceIds: [], ...clearedInstanceEdit() };
      }
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceIds: [instanceId],
        ...clearedInstanceEdit(),
      };
    }),

  toggleAddInstanceSelection: (layerId, loopId, instanceId) =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      if (
        state.selectedLayerId === layerId &&
        state.selectedLoopId === loopId &&
        state.selectedInstanceIds.includes(instanceId)
      ) {
        return {
          selectedInstanceIds: state.selectedInstanceIds.filter(
            (id) => id !== instanceId,
          ),
          ...clearedInstanceEdit(),
        };
      }
      return {
        selectedLayerId: layerId,
        selectedLoopId: loopId,
        selectedInstanceIds: [...state.selectedInstanceIds, instanceId],
        ...clearedInstanceEdit(),
      };
    }),

  clearLoopSelection: () =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return {
        selectedLoopId: null,
        selectedInstanceIds: [],
        ...clearedInstanceEdit(),
      };
    }),

  clearInstanceSelection: () =>
    set((state) => {
      if (state.isRecordingLoop) return state;
      return { selectedInstanceIds: [], ...clearedInstanceEdit() };
    }),

  startRecording: () => set({ isRecordingLoop: true }),

  stopRecording: () => set({ isRecordingLoop: false }),

  armNewLoopRecording: (layerId, loopId) =>
    set({
      selectedLayerId: layerId,
      selectedLoopId: loopId,
      selectedInstanceIds: [0],
      isRecordingLoop: true,
      ...clearedInstanceEdit(),
    }),

  setPendingPlacement: (placement) =>
    set({
      pendingPlacement: placement,
      selectedInstanceIds: [],
      ...clearedInstanceEdit(),
    }),

  clearPendingPlacement: () => set({ pendingPlacement: null }),

  beginInstanceEdit: (mode, sortedIds, instances) =>
    set((state) => {
      if (sortedIds.length === 0) return state;
      const selected = new Set(sortedIds);
      return {
        instanceEditState: {
          activeMode: mode,
          sortedIds,
          originalInstances: instances,
          originalInstancesSansSelection: instances.filter(
            (_, idx) => !selected.has(idx),
          ),
          proposedInstances: instances.map((inst) => ({ ...inst })),
        },
      };
    }),

  setInstanceEditMode: (mode) =>
    set((state) =>
      state.instanceEditState
        ? {
            instanceEditState: { ...state.instanceEditState, activeMode: mode },
          }
        : state,
    ),

  updateProposedInstances: (instances) =>
    set((state) =>
      state.instanceEditState
        ? {
            instanceEditState: {
              ...state.instanceEditState,
              proposedInstances: instances,
            },
          }
        : state,
    ),

  cancelInstanceEdit: () => set(clearedInstanceEdit()),
}));
