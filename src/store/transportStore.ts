import { create } from "zustand";
import type { TransportStoreState } from "../types/transport";

export const TRANSPORT_STORE_KEY = "loop-soup-transport";

/**
 * Transport store
 *
 * Owns runtime transport toggles/signals only:
 * - play/pause state
 * - add / extend toggles
 * - nonce used to retrigger transport side effects
 */
export const useTransportStore = create<TransportStoreState>()((set) => ({
  isPlaying: false,
  addOn: false,
  extendOn: false,
  transportNonce: 0,

  setPlaying: (value) => set({ isPlaying: value }),
  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),
  setAddOn: (value) => set({ addOn: value }),
  toggleAddOn: () => set((s) => ({ addOn: !s.addOn })),
  setExtendOn: (value) => set({ extendOn: value }),
  toggleExtendOn: () => set((s) => ({ extendOn: !s.extendOn })),
  bumpTransportNonce: () => set((s) => ({ transportNonce: s.transportNonce + 1 })),
}));
