/**
 * Ephemeral transport UI / clock fields (not persisted).
 */
export interface TransportRuntimeState {
  /** Global playback flag used by transport and UI indicators. */
  isPlaying: boolean;
  /** Commit-on-boundary toggle for recording/appending gestures. */
  addOn: boolean;
  /** Extend-recording toggle for phrase length growth gestures. */
  extendOn: boolean;
  /** Monotonic counter used to force transport-side effects/restarts. */
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
