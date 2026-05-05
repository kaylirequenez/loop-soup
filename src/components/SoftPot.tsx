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
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useLayerStore } from "../store/layerStore";
import { useTransportStore } from "../store/transportStore";
import { useMidiStore } from "../store/midiStore";
import { usePointerDrag } from "../hooks/usePointerDrag";

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
  const isDrums = selectedLayer === "E";
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
  const recordingTargetRef = useRef<{
    layerId: LayerId;
    loopId: LayerLoopId;
  } | null>(null);

  const captureNoteStart = (midi: number) => {
    if (isRecordingLoop && useTransportStore.getState().isPlaying) {
      const editor = useLayerEditorStore.getState();
      const loopId = editor.selectedLoopId;
      if (loopId === null) return;
      const roundedMidi = Math.round(midi);
      const startBeat = useMidiStore.getState().midiPlayheadBeat;
      noteStartBeatRef.current = startBeat;
      capturedMidiRef.current = roundedMidi;
      recordingTargetRef.current = {
        layerId: editor.selectedLayerId,
        loopId,
      };
      useLayerStore.getState().addLoopNote(
        editor.selectedLayerId,
        loopId,
        roundedMidi % 12,
        Math.floor(roundedMidi / 12) - 1,
        startBeat,
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
      const endBeat = useMidiStore.getState().midiPlayheadBeat;
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

  const beginGesture = () => {
    setGestureActive(true);
    document.body.classList.add(DRAG_SELECTION_CLASS);
  };

  const endGesture = () => {
    setGestureActive(false);
    document.body.classList.remove(DRAG_SELECTION_CLASS);
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
      beginGesture();
      updateStripFromPointer(element, event.clientY);
      const rect = element.getBoundingClientRect();
      const relative = clamp(
        (event.clientY - rect.top) / rect.height,
        allowedMinPosition,
        allowedMaxPosition,
      );
      captureNoteStart(topMidi - (relative * SOFTPOT_STEPS - 0.5));
    },
    onMove: (element, moveEvent) => {
      updateStripFromPointer(element, moveEvent.clientY);
    },
    onEnd: () => endGesture(),
  });

  const handleNoteColPointerDown = usePointerDrag<HTMLDivElement>({
    onStart: (noteCol, event) => {
      beginGesture();
      const row = rowIndexFromClientY(noteCol, event.clientY);
      setSoftpotToAllowedRow(row);
      const clampedRow = clamp(row, allowedMinRow, allowedMaxRow);
      captureNoteStart(chromoRows[clampedRow].midi);
    },
    onMove: (noteCol, moveEvent) => {
      const row = rowIndexFromClientY(noteCol, moveEvent.clientY);
      setSoftpotToAllowedRow(row);
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
        {!isDrums ? (
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
        ) : (
          <div className="note-col drum-col">
            <div className="drum-zone drum-hihat">hihat</div>
            <div className="drum-zone drum-snare">snare</div>
            <div className="drum-zone drum-kick">kick</div>
          </div>
        )}
      </div>
    </div>
  );
}
