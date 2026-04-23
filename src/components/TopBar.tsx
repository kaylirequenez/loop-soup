import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { KEY_OPTIONS, matchesKeyQuery, normalizeKeyText } from "../lib/musicKeys";
import { LOOP_OCTAVE_MAX, LOOP_OCTAVE_MIN } from "../lib/loopModel";
import type { LayerId } from "../types/layer";

const MIN_BPM = 40;
const MAX_BPM = 240;
const OCTAVE_DISPLAY_MIN = LOOP_OCTAVE_MIN + 1;
const OCTAVE_DISPLAY_MAX = LOOP_OCTAVE_MAX + 1;

interface TopBarProps {
  isPlaying: boolean;
  bpm: number;
  keyName: string;
  meter: string;
  octaveView: number;
  nowMeasure: number;
  nowMeasureCount: number;
  selectedLayerId: LayerId;
  onOpenHook: () => void;
  onSetBpm: (value: number) => void;
  onSetKey: (value: string) => void;
  onSetOctaveView: (value: number) => void;
}

export default function TopBar({
  isPlaying,
  bpm,
  keyName,
  meter,
  octaveView,
  nowMeasure,
  nowMeasureCount,
  selectedLayerId,
  onOpenHook,
  onSetBpm,
  onSetKey,
  onSetOctaveView,
}: TopBarProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const [bpmError, setBpmError] = useState("");
  const [keyDraft, setKeyDraft] = useState(keyName);
  const [octaveViewDraft, setOctaveViewDraft] = useState(() =>
    String(octaveView + 1),
  );
  const [openMenu, setOpenMenu] = useState<"key" | null>(null);
  const bpmErrorText = useMemo(() => `Tempo must be ${MIN_BPM}-${MAX_BPM} BPM`, []);
  const bpmIntErrorText = "Tempo must be a whole number";

  useEffect(() => {
    if (!bpmError) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setBpmError(""), 2500);
    return () => window.clearTimeout(timeoutId);
  }, [bpmError]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setKeyDraft(keyName);
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [keyName]);

  useEffect(() => {
    setOpenMenu(null);
  }, [selectedLayerId]);

  useEffect(() => {
    setOctaveViewDraft(String(octaveView + 1));
  }, [octaveView]);

  const commitBpm = () => {
    const trimmed = bpmDraft.trim();
    if (!/^\d+$/.test(trimmed)) {
      setBpmDraft(String(bpm));
      setBpmError(bpmIntErrorText);
      return;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (parsed >= MIN_BPM && parsed <= MAX_BPM) {
      onSetBpm(parsed);
      setBpmError("");
      return;
    }
    setBpmDraft(String(bpm));
    setBpmError(bpmErrorText);
  };

  const handleBpmKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commitBpm();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      setBpmDraft(String(bpm));
      setBpmError("");
      event.currentTarget.blur();
    }
  };

  const filteredKeyOptions = useMemo(() => {
    if (!normalizeKeyText(keyDraft)) {
      return KEY_OPTIONS;
    }
    return KEY_OPTIONS.filter((value) => matchesKeyQuery(value, keyDraft));
  }, [keyDraft]);

  const commitOctaveView = () => {
    const trimmed = String(octaveViewDraft ?? "").trim();
    if (!/^-?\d+$/.test(trimmed)) {
      setOctaveViewDraft(String(octaveView + 1));
      return;
    }
    const displayVal = Number.parseInt(trimmed, 10);
    const clampedDisplay = Math.max(
      OCTAVE_DISPLAY_MIN,
      Math.min(OCTAVE_DISPLAY_MAX, displayVal),
    );
    onSetOctaveView(clampedDisplay - 1);
    setOctaveViewDraft(String(clampedDisplay));
  };

  const stopEscapeKeyInput = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setKeyDraft(keyName);
      setOpenMenu(null);
      event.currentTarget.blur();
    }
  };

  const stopPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <div className="top-bar" ref={containerRef}>
      <div className="stats">
        <div className="stat-block stat-block-bpm">
          <input
            className="stat-val stat-input"
            type="text"
            inputMode="numeric"
            value={bpmDraft}
            onChange={(event) => setBpmDraft(event.target.value)}
            onBlur={commitBpm}
            onKeyDown={handleBpmKeyDown}
            aria-label="tempo in beats per minute"
          />
          <div className="stat-label">BPM</div>
          {bpmError && <div className="stat-error">{bpmError}</div>}
        </div>
        <div className="stat-block stat-block-key">
          <input
            className="stat-val stat-input stat-key-input"
            type="text"
            value={keyDraft}
            onChange={(event) => {
              setKeyDraft(event.target.value);
              if (openMenu !== "key") {
                setOpenMenu("key");
              }
            }}
            onFocus={() => {
              setKeyDraft("");
              setOpenMenu("key");
            }}
            onKeyDown={stopEscapeKeyInput}
            aria-label="musical key"
          />
          {openMenu === "key" && (
            <div className="stat-menu" role="listbox" aria-label="key options" onPointerDown={stopPointer}>
              {filteredKeyOptions.length > 0 ? (
                filteredKeyOptions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`stat-menu-item ${value === keyName ? "stat-menu-item-on" : ""}`}
                    onClick={() => {
                      onSetKey(value);
                      setKeyDraft(value);
                      setOpenMenu(null);
                    }}
                  >
                    {value}
                  </button>
                ))
              ) : (
                <div className="stat-menu-empty">No matching keys</div>
              )}
            </div>
          )}
          <div className="stat-label">key</div>
        </div>
        <div className="stat-block stat-block-meter">
          <button
            className="stat-val stat-menu-trigger"
            type="button"
            onClick={() => setOpenMenu(null)}
            aria-label="time signature"
            aria-haspopup="listbox"
            aria-expanded={false}
            disabled
            title="Meter is locked after hook creation"
          >
            {meter}
          </button>
          <div className="stat-label">meter</div>
        </div>
        <div className="stat-block stat-block-octave">
          <div className="stat-octave-controls">
            <button
              type="button"
              className="stat-oct-btn"
              aria-label="Lower octave view"
              title="Lower displayed pitch range"
              onClick={() => onSetOctaveView(Math.max(LOOP_OCTAVE_MIN, octaveView - 1))}
            >
              -
            </button>
            <input
              type="text"
              inputMode="numeric"
              className="stat-val stat-input stat-oct-input"
              aria-label="Octave view index"
              value={octaveViewDraft}
              onChange={(event) => setOctaveViewDraft(event.target.value)}
              onBlur={commitOctaveView}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitOctaveView();
                  event.currentTarget.blur();
                  return;
                }
                if (event.key === "Escape") {
                  setOctaveViewDraft(String(octaveView + 1));
                  event.currentTarget.blur();
                }
              }}
            />
            <button
              type="button"
              className="stat-oct-btn"
              aria-label="Raise octave view"
              title="Raise displayed pitch range"
              onClick={() => onSetOctaveView(Math.min(LOOP_OCTAVE_MAX, octaveView + 1))}
            >
              +
            </button>
          </div>
          <div className="stat-label">octave</div>
        </div>
      </div>
      <button className="hook-btn" onClick={onOpenHook}>
        + make hook
      </button>
      <div className="top-right">
        <span className="loop-num">{`measure ${nowMeasure} of ${nowMeasureCount}`}</span>
        <div className={`live-pill ${isPlaying ? "live-pill-on" : ""}`}>
          <div className="live-dot" />
          <span>{isPlaying ? "live" : "stopped"}</span>
        </div>
      </div>
    </div>
  );
}
