/**
 * Transport / timeline fields persisted across sessions (tempo, key, meter, composition length).
 */
export interface TransportPersistedState {
  bpm: number;
  key: string;
  meter: string;
  masterLoopLength: number;
}

/**
 * Ephemeral transport UI / clock fields (not persisted by default).
 */
export interface TransportRuntimeState {
  /** True while transport runner should advance timeline clocks. */
  isPlaying: boolean;
  /** UI toggle for add mode (non-persisted interaction state). */
  addOn: boolean;
  /** UI toggle for extend mode (non-persisted interaction state). */
  extendOn: boolean;
  /** Normalized composition phase [0,1] used by transport UI indicators. */
  playheadPhase: number; // TODO: revisit
  /** Monotonic counter used to force transport-reactive effects/restarts. */
  transportNonce: number; // TODO: revisit
}

/** Full Zustand transport slice = persisted + runtime + actions (see store file). */
export type TransportStoreState = TransportPersistedState &
  TransportRuntimeState & {
    setPlaying: (value: boolean) => void;
    togglePlaying: () => void;
    setAddOn: (value: boolean) => void;
    toggleAddOn: () => void;
    setExtendOn: (value: boolean) => void;
    toggleExtendOn: () => void;
    setBpm: (value: number) => void;
    setKey: (value: string) => void;
    setMeter: (value: string) => void;
    setPlayheadPhase: (value: number) => void;
    bumpTransportNonce: () => void;
  };
