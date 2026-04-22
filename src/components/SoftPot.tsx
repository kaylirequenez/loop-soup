import { useMemo, useState } from "react";
import { useAppStore } from "../store/appStore";
import { softpotChromoRows } from "../lib/keyLayout";
import type { LayerId } from "../types/model";
import { usePointerDrag } from "../hooks/usePointerDrag";

const DRAG_SELECTION_CLASS = "drag-selection-lock";
const SOFTPOT_STEPS = 24;

function discretePosition01(rowIndex: number) {
  return Math.max(0, Math.min(1, rowIndex / (SOFTPOT_STEPS - 1)));
}

function rowIndexFromClientY(noteColEl: HTMLDivElement, clientY: number) {
  const rect = noteColEl.getBoundingClientRect();
  const h = rect.height;
  if (h <= 0) {
    return 0;
  }
  const t = Math.max(0, Math.min(1, (clientY - rect.top) / h));
  return Math.min(SOFTPOT_STEPS - 1, Math.floor(t * SOFTPOT_STEPS));
}

interface SoftPotProps {
  selectedLayer: LayerId;
  octave: number;
}

export default function SoftPot({ selectedLayer, octave }: SoftPotProps) {
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

  const updateStripFromPointer = (element: HTMLDivElement, clientY: number) => {
    const rect = element.getBoundingClientRect();
    const relative = (clientY - rect.top) / rect.height;
    setSoftpotPosition(relative);
  };

  const handleStripPointerDown = usePointerDrag<HTMLDivElement>({
    onStart: (element, event) => {
      beginGesture();
      updateStripFromPointer(element, event.clientY);
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
      setSoftpotPosition(discretePosition01(row));
    },
    onMove: (noteCol, moveEvent) => {
      const row = rowIndexFromClientY(noteCol, moveEvent.clientY);
      setSoftpotPosition(discretePosition01(row));
    },
    onEnd: () => endGesture(),
  });

  return (
    <div className="sp-zone">
      <div className="sp-hdr">softpot</div>
      <div className="sp-body">
        <div className="sp-strip" onPointerDown={handleStripPointerDown}>
          <div className="sp-dot" style={{ top: `${softpotPosition * 100}%` }} />
        </div>
        {!isDrums ? (
          <div
            className="note-col note-col--interactive"
            onPointerDown={handleNoteColPointerDown}
          >
            {chromoRows.map((row) => {
              const isActiveRow = gestureActive && row.index === activeIndex;
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
