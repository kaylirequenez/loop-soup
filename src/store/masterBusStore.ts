import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { clamp01 } from "../utils";
import { audioEngine } from "../audio/audioEngine";

interface MasterBusState {
  masterVolume: number;
  setMasterVolume: (v: number) => void;
}

export const useMasterBusStore = create<MasterBusState>()(
  persist(
    (set) => ({
      masterVolume: 0.85,
      setMasterVolume: (v) => {
        const clamped = clamp01(v);
        audioEngine.setMasterVolume(clamped);
        set({ masterVolume: clamped });
      },
    }),
    {
      name: "loop-soup-master-bus",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
