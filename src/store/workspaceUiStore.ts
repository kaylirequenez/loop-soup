import { create } from "zustand";
import type { AppView } from "../types/app";

interface WorkspaceUiStore {
  currentView: AppView;
  pickerOpen: boolean;
  effectsOpen: boolean;
  setCurrentView: (view: AppView) => void;
  togglePickerOpen: () => void;
  toggleEffectsOpen: () => void;
}

export const useWorkspaceUiStore = create<WorkspaceUiStore>()((set) => ({
  currentView: "layers",
  pickerOpen: false,
  effectsOpen: false,

  setCurrentView: (view) => set({ currentView: view }),
  togglePickerOpen: () =>
    set((state) => ({
      pickerOpen: !state.pickerOpen,
      effectsOpen: false,
    })),
  toggleEffectsOpen: () =>
    set((state) => ({
      effectsOpen: !state.effectsOpen,
      pickerOpen: false,
    })),
}));
