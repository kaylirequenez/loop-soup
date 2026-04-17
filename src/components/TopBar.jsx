import { useEffect, useMemo, useRef, useState } from "react";

const MIN_BPM = 40;
const MAX_BPM = 240;
const KEY_OPTIONS = [
  "C maj",
  "C min",
  "C# maj",
  "C# min",
  "D maj",
  "D min",
  "D# maj",
  "D# min",
  "E maj",
  "E min",
  "F maj",
  "F min",
  "F# maj",
  "F# min",
  "G maj",
  "G min",
  "G# maj",
  "G# min",
  "A maj",
  "A min",
  "A# maj",
  "A# min",
  "B maj",
  "B min",
];
const METER_OPTIONS = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8"];

const normalizeKeyText = (value) => value.toLowerCase().replace(/\s+/g, "");
const ROOT_CHARS = new Set(["a", "b", "c", "d", "e", "f", "g"]);

const parseKeyQuery = (rawQuery) => {
  let working = normalizeKeyText(rawQuery);
  if (!working) {
    return null;
  }

  let quality = null;
  if (working.includes("maj")) {
    quality = "maj";
    working = working.replace("maj", "");
  } else if (working.includes("min")) {
    quality = "min";
    working = working.replace("min", "");
  } else if (working.includes("ma")) {
    quality = "maj";
    working = working.replace("ma", "");
  } else if (working.includes("mi")) {
    quality = "min";
    working = working.replace("mi", "");
  } else if (working.includes("m")) {
    quality = "either";
    working = working.replace("m", "");
  }

  const needsSharp = working.includes("#") || rawQuery.includes("#");
  working = working.replaceAll("#", "");

  let root = null;
  for (const char of working) {
    if (ROOT_CHARS.has(char)) {
      root = char;
      break;
    }
  }

  return { quality, needsSharp, root };
};

const matchesKeyQuery = (keyLabel, query) => {
  const parsed = parseKeyQuery(query);
  if (!parsed) {
    return true;
  }

  const [rootLabel, qualityLabel] = keyLabel.toLowerCase().split(" ");
  const keyRoot = rootLabel.replace("#", "");
  const keyIsSharp = rootLabel.includes("#");

  if (parsed.quality === "maj" && qualityLabel !== "maj") {
    return false;
  }
  if (parsed.quality === "min" && qualityLabel !== "min") {
    return false;
  }

  if (parsed.needsSharp && !keyIsSharp) {
    return false;
  }

  if (parsed.root) {
    if (keyRoot !== parsed.root) {
      return false;
    }
    if (!parsed.needsSharp && keyIsSharp) {
      return false;
    }
  }

  return true;
};

/**
 * Spec contract:
 * - Always show BPM, key, meter, loop length.
 * - Center "+ make hook" control.
 * - Right side shows loop index and live/stopped transport state.
 * - Later: BPM/key/meter inline overrides and real store wiring.
 */
export default function TopBar({
  isPlaying,
  bpm,
  keyName,
  meter,
  loopLength,
  onOpenHook,
  currentLoop,
  totalLoops,
  onSetBpm,
  onSetKey,
  onSetMeter,
}) {
  const containerRef = useRef(null);
  const [bpmDraft, setBpmDraft] = useState(String(bpm));
  const [bpmError, setBpmError] = useState("");
  const [keyDraft, setKeyDraft] = useState(keyName);
  const [openMenu, setOpenMenu] = useState(null);
  const bpmErrorText = useMemo(
    () => `Tempo must be ${MIN_BPM}-${MAX_BPM} BPM`,
    [],
  );

  useEffect(() => {
    if (!bpmError) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setBpmError("");
    }, 2500);
    return () => window.clearTimeout(timeoutId);
  }, [bpmError]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setKeyDraft(keyName);
        setOpenMenu(null);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [keyName]);

  const commitBpm = () => {
    const parsed = Number.parseInt(bpmDraft.trim(), 10);
    if (Number.isFinite(parsed) && parsed >= MIN_BPM && parsed <= MAX_BPM) {
      onSetBpm(parsed);
      setBpmError("");
      return;
    }
    setBpmDraft(String(bpm));
    setBpmError(bpmErrorText);
  };

  const handleBpmKeyDown = (event) => {
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

  return (
    <div className="top-bar" ref={containerRef}>
      <div className="stats">
        <div className="stat-block stat-block-bpm">
          <input
            className="stat-val stat-input"
            type="text"
            inputMode="numeric"
            value={bpmDraft}
            onChange={(event) => {
              setBpmDraft(event.target.value);
            }}
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
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setKeyDraft(keyName);
                setOpenMenu(null);
                event.currentTarget.blur();
              }
            }}
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
            onClick={() =>
              setOpenMenu((current) => (current === "meter" ? null : "meter"))
            }
            aria-label="time signature"
            aria-haspopup="listbox"
            aria-expanded={openMenu === "meter"}
          >
            {meter}
          </button>
          {openMenu === "meter" && (
            <div className="stat-menu" role="listbox" aria-label="meter options">
              {METER_OPTIONS.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={`stat-menu-item ${value === meter ? "stat-menu-item-on" : ""}`}
                  onClick={() => {
                    onSetMeter(value);
                    setOpenMenu(null);
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          )}
          <div className="stat-label">meter</div>
        </div>
        <div className="stat-block stat-block-loop">
          <div className="stat-val">{`${loopLength} bars`}</div>
          <div className="stat-label">loop</div>
        </div>
      </div>

      <button className="hook-btn" onClick={onOpenHook}>
        + make hook
      </button>

      <div className="top-right">
        <span className="loop-num">{`loop ${currentLoop} of ${totalLoops}`}</span>
        <div className={`live-pill ${isPlaying ? "live-pill-on" : ""}`}>
          <div className="live-dot" />
          <span>{isPlaying ? "live" : "stopped"}</span>
        </div>
      </div>
    </div>
  );
}
