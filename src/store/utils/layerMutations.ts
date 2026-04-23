import type { LayerLoopInstanceRow } from "../../types/layer";
import type { AppView } from "../../types/app";

export function maybeSwitchToMidiForLoopEdit(
  state: { currentView: AppView },
  loop: LayerLoopInstanceRow | null | undefined,
): { currentView?: AppView } {
  if (state.currentView !== "layers" || !loop) {
    return {};
  }
  return {
    currentView: "midi",
  };
}
