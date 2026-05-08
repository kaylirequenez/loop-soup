/**
 * Ephemeral transport UI / clock fields (not persisted).
 */
export interface TransportRuntimeState {
  /** Global playback flag used by transport and UI indicators. */
  isPlaying: boolean;
  /** Extend-recording toggle for phrase length growth gestures. */
  extendOn: boolean;
  /**
   * True while the user is actively dragging/scrubbing the playhead.
   * During scrubbing we avoid letting the RAF clock overwrite the user-selected
   * playhead position, which prevents visible stutter/fighting.
   */
  isScrubbing: boolean;
  /** Current composition playhead position in beats (0-based, wraps at loop end). */
  playheadBeat: number;
  /** 0-based index of the leftmost visible measure in the MIDI roll. */
  viewMeasureIndex: number;
  /** When true, keep MIDI view anchored to playhead while playing. */
  followNowbar: boolean;
}

export type TransportStoreState = TransportRuntimeState & {
  setPlaying: (value: boolean) => void;
  togglePlaying: () => void;
  setExtendOn: (value: boolean) => void;
  toggleExtendOn: () => void;
  setScrubbing: (value: boolean) => void;
  setPlayheadBeat: (beat: number) => void;
  setViewMeasureIndex: (index: number) => void;
  setFollowNowbar: (value: boolean) => void;
};
