/**
 * Ephemeral transport UI / clock fields (not persisted).
 */
export interface TransportRuntimeState {
  /** Global playback flag used by transport and UI indicators. */
  isPlaying: boolean;
  /** Extend-recording toggle for phrase length growth gestures. */
  extendOn: boolean;
  /** Monotonic counter used to force transport-side effects/restarts. */
  transportNonce: number;
  /** Current composition playhead position in beats (0-based, wraps at loop end). */
  playheadBeat: number;
  /** 0-based index of the leftmost visible measure in the MIDI roll. */
  viewMeasureIndex: number;
}

export type TransportStoreState = TransportRuntimeState & {
  setPlaying: (value: boolean) => void;
  togglePlaying: () => void;
  setExtendOn: (value: boolean) => void;
  toggleExtendOn: () => void;
  bumpTransportNonce: () => void;
  setPlayheadBeat: (beat: number) => void;
  setViewMeasureIndex: (index: number) => void;
};
