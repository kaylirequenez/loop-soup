import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { clamp } from "../utils";
import { useCompositionStore } from "../store/compositionStore";
import {
  isMidiInLoopNoteRange,
  LOOP_NOTE_MIDI_MAX,
  LOOP_NOTE_MIDI_MIN,
  softpotChromoRows,
} from "../utils/pitch";
import type { LayerId, LayerLoopId } from "../types/layer";
import type { SoundMapping } from "../types/sound";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import { useSoundStore } from "../store/soundStore";
import { useTransportStore } from "../store/transportStore";
import { usePointerDrag } from "../hooks/usePointerDrag";
import { audioEngine } from "../audio/audioEngine";
import { midiToFrequency } from "../audio/toneUnits";
import { getNowbarBeat } from "../audio/transportController";
import { getSoundCategory } from "../sound/soundSpecs";

const DRAG_SELECTION_CLASS = "drag-selection-lock";
const SOFTPOT_STEPS = 24;
const DEFAULT_SOFTPOT_POSITION = 11.5 / SOFTPOT_STEPS;

function rowCenterPosition01(rowIndex: number) {
  return Math.max(0, Math.min(1, (rowIndex + 0.5) / SOFTPOT_STEPS));
}

function rowIndexFromPosition(position01: number) {
  return Math.max(
    0,
    Math.min(SOFTPOT_STEPS - 1, Math.round(position01 * SOFTPOT_STEPS - 0.5)),
  );
}

function rowIndexFromClientY(noteColEl: HTMLDivElement, clientY: number) {
  const rect = noteColEl.getBoundingClientRect();
  const h = rect.height;
  if (h <= 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(1, (clientY - rect.top) / h));
  return rowIndexFromPosition(t);
}

export default function SoftPot() {
  const selectedLayer = useLayerEditorStore((s) => s.selectedLayerId);
  const isRecordingLoop = useLayerEditorStore((s) => s.isRecordingLoop);
  const { octave, musicalKey } = useCompositionStore(
    useShallow((s) => ({
      octave: s.octave,
      musicalKey: s.key,
    })),
  );
  const [softpotPosition, setSoftpotPosition] = useState(
    DEFAULT_SOFTPOT_POSITION,
  );
  const activeIndex = rowIndexFromPosition(softpotPosition);
  const chromoRows = useMemo(
    () => softpotChromoRows(musicalKey, octave),
    [musicalKey, octave],
  );
  const allowedRows = useMemo(
    () => chromoRows.filter((row) => isMidiInLoopNoteRange(row.midi)),
    [chromoRows],
  );
  const allowedMinRow = allowedRows[0]?.index ?? 0;
  const allowedMaxRow =
    allowedRows[allowedRows.length - 1]?.index ?? SOFTPOT_STEPS - 1;
  const topMidi = chromoRows[0]?.midi ?? LOOP_NOTE_MIDI_MAX;
  const allowedMinPosition = Math.max(0, (topMidi - 126.5) / SOFTPOT_STEPS);
  const allowedMaxPosition = 1;
  const currentMidiExact = useMemo(() => {
    const midiFloat = topMidi - (softpotPosition * SOFTPOT_STEPS - 0.5);
    return clamp(midiFloat, LOOP_NOTE_MIDI_MIN, LOOP_NOTE_MIDI_MAX);
  }, [topMidi, softpotPosition]);
  const [gestureActive, setGestureActive] = useState(false);

  const noteStartBeatRef = useRef<number | null>(null);
  const capturedMidiRef = useRef<number | null>(null);
  const initialPitchOffsetRef = useRef<number>(0);
  const recordingTargetRef = useRef<{
    layerId: LayerId;
    loopId: LayerLoopId;
  } | null>(null);
  /** Last preview row index sounded during a drag, used to detect row changes. */
  const lastPreviewRowRef = useRef<number | null>(null);

  function currentPreviewMapping(layerId: LayerId): SoundMapping {
    const editor = useLayerEditorStore.getState();
    const selectedLoopId = editor.selectedLayerId === layerId ? editor.selectedLoopId : null;
    if (selectedLoopId != null) {
      return useSoundStore.getState().getLoopMapping(layerId, selectedLoopId);
    }
    return useSoundStore.getState().getLayerDefaultMapping(layerId);
  }

  const captureNoteStart = (midi: number, useContinuousPitch = false) => {
    if (isRecordingLoop && useTransportStore.getState().isPlaying) {
      const editor = useLayerEditorStore.getState();
      const loopId = editor.selectedLoopId;
      if (loopId === null) return;
      const roundedMidi = Math.round(midi);
      const startBeat = getNowbarBeat();
      noteStartBeatRef.current = startBeat;
      capturedMidiRef.current = roundedMidi;
      recordingTargetRef.current = {
        layerId: editor.selectedLayerId,
        loopId,
      };
      let pitchOffset: number | undefined;
      if (useContinuousPitch) {
        const mapping = currentPreviewMapping(editor.selectedLayerId);
        const driftRange = mapping.knobsByEffect.pitchDriftRange?.value ?? 0;
        const raw = midi - roundedMidi;
        if (driftRange > 0 && Math.abs(raw) > 0.001) {
          pitchOffset = raw * driftRange;
        }
      }
      initialPitchOffsetRef.current = pitchOffset ?? 0;
      useLayerStore.getState().addLoopNote(
        editor.selectedLayerId,
        loopId,
        roundedMidi % 12,
        Math.floor(roundedMidi / 12) - 1,
        startBeat,
        pitchOffset,
      );
    }
  };

  const commitNote = () => {
    const target = recordingTargetRef.current;
    if (
      target &&
      noteStartBeatRef.current !== null &&
      capturedMidiRef.current !== null
    ) {
      const endBeat = getNowbarBeat();
      useLayerStore.getState().endLoopNote(
        target.layerId,
        target.loopId,
        endBeat,
      );
    }
    noteStartBeatRef.current = null;
    capturedMidiRef.current = null;
    recordingTargetRef.current = null;
  };

  const setSoftpotToAllowedRow = (targetRow: number) => {
    const clampedRow = clamp(targetRow, allowedMinRow, allowedMaxRow);
    setSoftpotPosition(rowCenterPosition01(clampedRow));
  };

  useEffect(() => {
    const nextPosition = clamp(
      softpotPosition,
      allowedMinPosition,
      allowedMaxPosition,
    );
    if (nextPosition !== softpotPosition) {
      setSoftpotPosition(nextPosition);
    }
  }, [allowedMaxPosition, allowedMinPosition, softpotPosition]);

  const beginGesture = (freqHz: number) => {
    const mapping = currentPreviewMapping(selectedLayer);
    setGestureActive(true);
    document.body.classList.add(DRAG_SELECTION_CLASS);
    if (!audioEngine.isReady) {
      audioEngine.init().then(() => {
        audioEngine.beginPreviewNote(selectedLayer, mapping, freqHz);
      });
    } else {
      audioEngine.beginPreviewNote(selectedLayer, mapping, freqHz);
    }
  };

  const endGesture = () => {
    setGestureActive(false);
    document.body.classList.remove(DRAG_SELECTION_CLASS);
    audioEngine.endPreviewNote(selectedLayer);
    lastPreviewRowRef.current = null;
    commitNote();
  };

  const updateStripFromPointer = (element: HTMLDivElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    if (rect.height <= 0) return;
    const relative = (clientY - rect.top) / rect.height;
    const nextPosition = clamp(
      relative,
      allowedMinPosition,
      allowedMaxPosition,
    );
    setSoftpotPosition(nextPosition);
  };

  const handleStripPointerDown = usePointerDrag<HTMLDivElement>({
    onStart: (element, event) => {
      const rect = element.getBoundingClientRect();
      const relative = clamp(
        (event.clientY - rect.top) / rect.height,
        allowedMinPosition,
        allowedMaxPosition,
      );
      const midi = topMidi - (relative * SOFTPOT_STEPS - 0.5);
      lastPreviewRowRef.current = clamp(rowIndexFromPosition(relative), allowedMinRow, allowedMaxRow);
      updateStripFromPointer(element, event.clientY);
      beginGesture(midiToFrequency(midi));
      captureNoteStart(midi, true);
    },
    onMove: (element, moveEvent) => {
      updateStripFromPointer(element, moveEvent.clientY);
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0) return;
      const relative = clamp(
        (moveEvent.clientY - rect.top) / rect.height,
        allowedMinPosition,
        allowedMaxPosition,
      );
      const currentMidi = topMidi - (relative * SOFTPOT_STEPS - 0.5);

      // Audio preview always follows current position, regardless of recording state.
      const previewMapping = currentPreviewMapping(selectedLayer);
      const category = getSoundCategory(previewMapping.soundId);
      const newRow = rowIndexFromPosition(relative);
      const clampedRow = clamp(newRow, allowedMinRow, allowedMaxRow);
      if (category !== "oscillator" && clampedRow !== lastPreviewRowRef.current) {
        lastPreviewRowRef.current = clampedRow;
        void audioEngine.updatePreviewNote(selectedLayer, previewMapping, midiToFrequency(chromoRows[clampedRow].midi));
      } else {
        audioEngine.slidePreviewNote(selectedLayer, midiToFrequency(currentMidi));
      }

      // Recording: capture pitch movement into the loop.
      const target = recordingTargetRef.current;
      if (target && noteStartBeatRef.current !== null && capturedMidiRef.current !== null) {
        if (category === "oscillator") {
          // Record actual pitch offset as a curve point so playback glides with the drag.
          const offset = currentMidi - capturedMidiRef.current;
          const beatOffset = getNowbarBeat() - noteStartBeatRef.current;
          if (beatOffset > 0) {
            useLayerStore.getState().appendLoopNotePitchPoint(
              target.layerId,
              target.loopId,
              beatOffset,
              offset,
            );
          }
        } else {
          // Sampler/player: end current note and start a new one on each semitone crossing.
          const rowMidi = chromoRows[clampedRow].midi;
          if (rowMidi !== capturedMidiRef.current) {
            commitNote();
            captureNoteStart(rowMidi);
          }
        }
      }
    },
    onEnd: () => endGesture(),
  });

  const handleNoteColPointerDown = usePointerDrag<HTMLDivElement>({
    onStart: (noteCol, event) => {
      const row = rowIndexFromClientY(noteCol, event.clientY);
      const clampedRow = clamp(row, allowedMinRow, allowedMaxRow);
      setSoftpotToAllowedRow(row);
      lastPreviewRowRef.current = clampedRow;
      beginGesture(midiToFrequency(chromoRows[clampedRow].midi));
      captureNoteStart(chromoRows[clampedRow].midi);
    },
    onMove: (noteCol, moveEvent) => {
      const row = rowIndexFromClientY(noteCol, moveEvent.clientY);
      setSoftpotToAllowedRow(row);
      const clampedRow = clamp(row, allowedMinRow, allowedMaxRow);
      if (clampedRow !== lastPreviewRowRef.current) {
        lastPreviewRowRef.current = clampedRow;
        void audioEngine.updatePreviewNote(
          selectedLayer,
          currentPreviewMapping(selectedLayer),
          midiToFrequency(chromoRows[clampedRow].midi),
        );
        // During recording: commit the current note and start a new one at the new pitch.
        const wasRecording = noteStartBeatRef.current !== null;
        if (wasRecording) {
          commitNote();
          captureNoteStart(chromoRows[clampedRow].midi);
        }
      }
    },
    onEnd: () => endGesture(),
  });

  return (
    <div className="sp-zone">
      <div className="sp-hdr">
        <div className="sp-badge">{`${currentMidiExact.toFixed(2)}`}</div>
      </div>
      <div className="sp-body">
        <div className="sp-strip" onPointerDown={handleStripPointerDown}>
          <div
            className="sp-dot"
            style={{ top: `${softpotPosition * 100}%` }}
          />
        </div>
        <div
          className="note-col note-col--interactive"
          onPointerDown={handleNoteColPointerDown}
        >
          {chromoRows.map((row) => {
            const isActiveRow = gestureActive && row.index === activeIndex;
            const rowAllowed = isMidiInLoopNoteRange(row.midi);
            const cls = `nb ${row.inKey ? "nb-s" : "nb-c"} ${row.isRoot ? "nb-o" : ""} ${isActiveRow ? "nb-a" : ""} ${rowAllowed ? "" : "nb-r"}`;
            return (
              <div
                className={cls}
                key={row.index}
                title={
                  rowAllowed
                    ? undefined
                    : `MIDI ${row.midi} is outside allowed ${LOOP_NOTE_MIDI_MIN}-${LOOP_NOTE_MIDI_MAX}`
                }
              >
                {row.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
