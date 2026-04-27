/**
 * Ephemeral transport UI / clock fields (not persisted).
 */
export interface TransportRuntimeState {
  isPlaying: boolean;
  addOn: boolean;
  extendOn: boolean;
  transportNonce: number;
}

export type TransportStoreState = TransportRuntimeState & {
  setPlaying: (value: boolean) => void;
  togglePlaying: () => void;
  setAddOn: (value: boolean) => void;
  toggleAddOn: () => void;
  setExtendOn: (value: boolean) => void;
  toggleExtendOn: () => void;
  bumpTransportNonce: () => void;
};
