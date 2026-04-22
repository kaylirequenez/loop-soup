import type { AppView, LayerLoop } from "../../types/model";

export function maybeSwitchToMidiForLoopEdit(
  state: { currentView: AppView },
  loop: LayerLoop | null | undefined,
): { currentView?: AppView } {
  if (state.currentView !== "layers" || !loop) {
    return {};
  }
  return {
    currentView: "midi",
  };
}
