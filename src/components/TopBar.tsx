import { useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  KEY_OPTIONS,
  matchesKeyQuery,
  normalizeKeyText,
} from "./userInput/keySearch";
import {
  musicalKeyToString,
  musicalKeyFromString,
  meterToString,
} from "../utils/format";
import { loopOctaveBoundsForKey } from "../utils/compositionState";
import { commitIntegerDraft, inputKeyHandler } from "./userInput";
import { useCompositionStore } from "../store/compositionStore";
import { useTransportStore } from "../store/transportStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import { useMasterBusStore } from "../store/masterBusStore";
import { usePointerDrag } from "../hooks/usePointerDrag";

const MIN_BPM = 40;
const MAX_BPM = 240;

export default function TopBar() {
  const {
    bpm,
    musicalKey,
    meter,
    octave,
    totalMeasures,
    setBpm,
    setKey,
    setOctave,
  } = useCompositionStore(
    useShallow((s) => ({
      bpm: s.bpm,
      musicalKey: s.key,
      meter: s.meter,
      octave: s.octave,
      totalMeasures: s.totalMeasures,
      setBpm: s.setBpm,
      setKey: s.setKey,
      setOctave: s.setOctave,
    })),
  );
  const { isPlaying, playheadBeat } = useTransportStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      playheadBeat: s.playheadBeat,
    })),
  );

  const nowMeasure = Math.min(
    totalMeasures,
    Math.floor(playheadBeat / meter.beatsPerMeasure) + 1,
  );

  const keyName = musicalKeyToString(musicalKey);
  const meterLabel = meterToString(meter);

  const { masterVolume, setMasterVolume } = useMasterBusStore();
  const masterPercent = Math.round(masterVolume * 100);

  const handleMasterFaderPointerDown = usePointerDrag<HTMLDivElement>({
    onStart: (el, event) => {
      const pct = (event.clientX - el.getBoundingClientRect().left) / el.getBoundingClientRect().width;
      setMasterVolume(pct);
    },
    onMove: (el, e) => {
      const pct = (e.clientX - el.getBoundingClientRect().left) / el.getBoundingClientRect().width;
      setMasterVolume(pct);
    },
  });

  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const [keyDraft, setKeyDraft] = useState(keyName);
  const [octaveViewDraft, setOctaveViewDraft] = useState(() =>
    String(octave + 1),
  );
  const [openMenu, setOpenMenu] = useState<"key" | null>(null);
  const octaveBounds = useMemo(
    () => loopOctaveBoundsForKey(musicalKey),
    [musicalKey],
  );

  useEffect(() => {
    setOctaveViewDraft(String(octave + 1));
  }, [octave]);

  const resetBpmDraft = () => {
    setBpmDraft(String(bpm));
  };

  const commitBpm = () => {
    const next = commitIntegerDraft({
      draft: bpmDraft,
      fallback: bpm,
      min: MIN_BPM,
      max: MAX_BPM,
    });
    setBpm(next);
    setBpmDraft(String(next));
  };

  const handleBpmKeyDown = inputKeyHandler({
    onEscape: resetBpmDraft,
  });

  const filteredKeyOptions = useMemo(() => {
    if (!normalizeKeyText(keyDraft)) return KEY_OPTIONS;
    return KEY_OPTIONS.filter((value) => matchesKeyQuery(value, keyDraft));
  }, [keyDraft]);

  const resetKeyDraft = () => {
    setKeyDraft(keyName);
    setOpenMenu(null);
  };

  const commitKeyDraft = () => {
    const typed = keyDraft.trim();
    if (!typed) {
      resetKeyDraft();
      return;
    }
    const first = filteredKeyOptions[0];
    if (!first) {
      resetKeyDraft();
      return;
    }
    setKey(musicalKeyFromString(first));
    setKeyDraft(first);
    setOpenMenu(null);
  };

  const commitOctaveView = () => {
    const next = commitIntegerDraft({
      draft: octaveViewDraft,
      fallback: octave + 1,
      min: octaveBounds.min + 1,
      max: octaveBounds.max + 1,
    });
    setOctave(next - 1);
    setOctaveViewDraft(String(next));
  };

  const handleKeyInputKeyDown = inputKeyHandler({
    onEnter: commitKeyDraft,
    onEscape: resetKeyDraft,
  });

  return (
    <div className="top-bar">
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
        </div>
        <div className="stat-block stat-block-key">
          <input
            className="stat-val stat-input stat-key-input"
            type="text"
            value={keyDraft}
            onChange={(event) => {
              setKeyDraft(event.target.value);
              if (openMenu !== "key") setOpenMenu("key");
            }}
            onFocus={() => {
              setKeyDraft("");
              setOpenMenu("key");
            }}
            onBlur={commitKeyDraft}
            onKeyDown={handleKeyInputKeyDown}
            aria-label="musical key"
          />
          {openMenu === "key" && (
            <div className="stat-menu" role="listbox" aria-label="key options">
              {filteredKeyOptions.length > 0 ? (
                filteredKeyOptions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    className={`stat-menu-item ${value === keyName ? "stat-menu-item-on" : ""}`}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setKey(musicalKeyFromString(value));
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
            {meterLabel}
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
              onClick={() => setOctave(octave - 1)}
              disabled={octave <= octaveBounds.min}
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
              onKeyDown={inputKeyHandler({
                onEscape: () => setOctaveViewDraft(String(octave + 1)),
              })}
            />
            <button
              type="button"
              className="stat-oct-btn"
              aria-label="Raise octave view"
              title="Raise displayed pitch range"
              onClick={() => setOctave(octave + 1)}
              disabled={octave >= octaveBounds.max}
            >
              +
            </button>
          </div>
          <div className="stat-label">octave</div>
        </div>
      </div>
      <div className="master-fdr-wrap">
        <span className="master-fdr-label">master</span>
        <div
          className="fdr master-fdr"
          onPointerDown={handleMasterFaderPointerDown}
        >
          <div className="fdr-fill" style={{ width: `${masterPercent}%`, background: "var(--on-surf-var)" }} />
          <div className="fdr-thumb" style={{ left: `${masterPercent}%` }} />
        </div>
      </div>
      <div className="top-right">
        <span className="loop-num">{`measure ${nowMeasure} of ${totalMeasures}`}</span>
        <div className={`live-pill ${isPlaying ? "live-pill-on" : ""}`}>
          <div className="live-dot" />
          <span>{isPlaying ? "live" : "stopped"}</span>
        </div>
      </div>
    </div>
  );
}
