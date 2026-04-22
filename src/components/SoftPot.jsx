import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { softpotChromoRows } from "../lib/keyLayout";

const DRAG_SELECTION_CLASS = "drag-selection-lock";

const SOFTPOT_STEPS = 24;

/** Row index 0…23 → normalized strip value so `round(pos * 23) === index` (exact semitone). */
function discretePosition01(rowIndex) {
  return Math.max(0, Math.min(1, rowIndex / (SOFTPOT_STEPS - 1)));
}

function rowIndexFromClientY(noteColEl, clientY) {
  const rect = noteColEl.getBoundingClientRect();
  const h = rect.height;
  if (h <= 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(1, (clientY - rect.top) / h));
  return Math.min(SOFTPOT_STEPS - 1, Math.floor(t * SOFTPOT_STEPS));
}

/**
 * Spec contract:
 * - Left column with SoftPot strip + aligned LED/note visualization.
 * - Layers A-D: 24 semitone boxes across 2 octaves (chromatic; selected octave matches midline root).
 * - Layer E: drum zones (top 20% hihat, middle 40% snare, bottom 40% kick).
 * - Strip: continuous Y → position (smooth pitch between rows).
 * - Note column: click / drag snaps to discrete semitone rows (clear target pitch).
 */

export default function SoftPot({ selectedLayer, octave }) {
  const isDrums = selectedLayer === "E";
  const softpotPosition = useAppStore((s) => s.softpotPosition);
  const setSoftpotPosition = useAppStore((s) => s.setSoftpotPosition);
  const keyName = useAppStore((s) => s.key);
  const activeIndex = Math.max(
    0,
    Math.min(23, Math.round(softpotPosition * (SOFTPOT_STEPS - 1))),
  );
  const baseOctave = typeof octave === "number" ? octave : 3;
  const chromoRows = useMemo(
    () => softpotChromoRows(keyName, baseOctave),
    [keyName, baseOctave],
  );

  const [gestureActive, setGestureActive] = useState(false);

  const beginGesture = () => {
    setGestureActive(true);
    document.body.classList.add(DRAG_SELECTION_CLASS);
  };

  const endGesture = () => {
    setGestureActive(false);
    document.body.classList.remove(DRAG_SELECTION_CLASS);
  };

  const updateStripFromPointer = (element, clientY) => {
    const rect = element.getBoundingClientRect();
    const relative = (clientY - rect.top) / rect.height;
    setSoftpotPosition(relative);
  };

  const handleStripPointerDown = (event) => {
    event.preventDefault();
    const element = event.currentTarget;
    const pointerId = event.pointerId;
    element.setPointerCapture(pointerId);
    beginGesture();
    updateStripFromPointer(element, event.clientY);

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      updateStripFromPointer(element, moveEvent.clientY);
    };

    const onEnd = () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerup", onEnd);
      element.removeEventListener("pointercancel", onEnd);
      if (element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
      endGesture();
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerup", onEnd);
    element.addEventListener("pointercancel", onEnd);
  };

  const handleNoteColPointerDown = (event) => {
    event.preventDefault();
    const noteCol = event.currentTarget;
    const pointerId = event.pointerId;
    noteCol.setPointerCapture(pointerId);
    beginGesture();

    const applyDiscreteFromClientY = (clientY) => {
      const row = rowIndexFromClientY(noteCol, clientY);
      setSoftpotPosition(discretePosition01(row));
    };

    applyDiscreteFromClientY(event.clientY);

    const onMove = (moveEvent) => {
      moveEvent.preventDefault();
      applyDiscreteFromClientY(moveEvent.clientY);
    };

    const onEnd = () => {
      noteCol.removeEventListener("pointermove", onMove);
      noteCol.removeEventListener("pointerup", onEnd);
      noteCol.removeEventListener("pointercancel", onEnd);
      if (noteCol.hasPointerCapture(pointerId)) {
        noteCol.releasePointerCapture(pointerId);
      }
      endGesture();
    };

    noteCol.addEventListener("pointermove", onMove);
    noteCol.addEventListener("pointerup", onEnd);
    noteCol.addEventListener("pointercancel", onEnd);
  };

  return (
    <div className="sp-zone">
      <div className="sp-hdr">softpot</div>

      <div className="sp-body">
        <div
          className="sp-strip"
          onPointerDown={handleStripPointerDown}
        >
          <div className="sp-dot" style={{ top: `${softpotPosition * 100}%` }} />
        </div>

        {!isDrums ? (
          <div
            className="note-col note-col--interactive"
            onPointerDown={handleNoteColPointerDown}
          >
            {chromoRows.map((row) => {
              const isActiveRow =
                gestureActive && row.index === activeIndex;
              const cls = `nb ${row.inKey ? "nb-s" : "nb-c"} ${row.isRoot ? "nb-o" : ""} ${isActiveRow ? "nb-a" : ""}`;
              return (
                <div className={cls} key={row.index}>
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
