import { useAppStore } from "./appStore";
import { useShallow } from "zustand/react/shallow";
import {
  selectActiveLoopContext,
  selectAppShellActions,
  selectAppShellState,
  selectCompositionViewActions,
  selectCompositionViewState,
  selectCompositionTiming,
  selectMidiViewportMetrics,
  selectViewFlags,
} from "./selectors";

export const useViewFlags = () => useAppStore(useShallow(selectViewFlags));
export const useCompositionTiming = () =>
  useAppStore(useShallow(selectCompositionTiming));
export const useMidiViewportMetrics = () =>
  useAppStore(useShallow(selectMidiViewportMetrics));
export const useActiveLoopContext = () =>
  useAppStore(useShallow(selectActiveLoopContext));
export const useAppShellState = () =>
  useAppStore(useShallow(selectAppShellState));
export const useAppShellActions = () =>
  useAppStore(useShallow(selectAppShellActions));
export const useCompositionViewState = () =>
  useAppStore(useShallow(selectCompositionViewState));
export const useCompositionViewActions = () =>
  useAppStore(useShallow(selectCompositionViewActions));
