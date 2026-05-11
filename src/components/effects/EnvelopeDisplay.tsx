import { useRef } from "react";
import type { KnobEffect, SoundMapping } from "../../types/sound";
import { clamp01 } from "../../utils";

interface Props {
  mapping: SoundMapping;
  color: string;
  onKnobChange: (effect: KnobEffect, value: number) => void;
}

// Fixed coordinate space — each ADSR stage owns a quarter of the display.
const X0 = 6;
const TY = 8;
const BY = 48;
const MAX_X = 154;
const USABLE = MAX_X - X0; // 148
const ZONE_W = USABLE / 4; // 37

const D_START = X0 + ZONE_W;      // 43 — decay zone start
const S_END = X0 + ZONE_W * 3;    // 117 — sustain zone end = release zone start
const ZONE_DIVS = [D_START, X0 + ZONE_W * 2, S_END]; // vertical zone guides

const ZONE_LABELS: { label: string; x: number }[] = [
  { label: "A", x: X0 + ZONE_W * 0.5 },
  { label: "D", x: X0 + ZONE_W * 1.5 },
  { label: "S", x: X0 + ZONE_W * 2.5 },
  { label: "R", x: X0 + ZONE_W * 3.5 },
];

const SENS_H = 0.007;
const SENS_V = 0.01;

type Handle = "attack" | "decay-sustain" | "release";

interface DragState {
  handle: Handle;
  startX: number;
  startY: number;
  startAttack: number;
  startDecay: number;
  startSustain: number;
  startRelease: number;
}

export default function EnvelopeDisplay({ mapping, color, onKnobChange }: Props) {
  const get = (k: "attack" | "decay" | "sustain" | "release") => {
    const defaults: Record<string, number> = {
      attack: 0, decay: 0.3, sustain: 0.5, release: 0.4,
    };
    return mapping.knobsByEffect[k]?.value ?? defaults[k];
  };

  const attack = get("attack");
  const decay = get("decay");
  const sustain = get("sustain");
  const release = get("release");

  // Each handle sits within its fixed zone — always visible, always spread.
  const xA  = X0 + attack * ZONE_W;              // 6..43
  const xD  = D_START + decay * ZONE_W;           // 43..80
  const xSS = S_END;                              // 117 fixed
  const xR  = S_END + release * ZONE_W;           // 117..154
  const yS  = TY + (1 - sustain) * (BY - TY);

  const curvePath = `M ${X0} ${BY} L ${xA} ${TY} L ${xD} ${yS} L ${xSS} ${yS} L ${xR} ${BY}`;

  const dragRef = useRef<DragState | null>(null);
  const onKnobChangeRef = useRef(onKnobChange);
  onKnobChangeRef.current = onKnobChange;

  function startDrag(handle: Handle, e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const el = e.currentTarget as Element;
    el.setPointerCapture(e.pointerId);
    document.body.classList.add("drag-selection-lock");

    dragRef.current = {
      handle, startX: e.clientX, startY: e.clientY,
      startAttack: attack, startDecay: decay, startSustain: sustain, startRelease: release,
    };

    const moveH: EventListener = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      (ev as Event).preventDefault?.();
      const pe = ev as PointerEvent;
      const dx = pe.clientX - d.startX;
      const dy = pe.clientY - d.startY;
      if (d.handle === "attack") {
        onKnobChangeRef.current("attack", clamp01(d.startAttack + dx * SENS_H));
      } else if (d.handle === "decay-sustain") {
        onKnobChangeRef.current("decay", clamp01(d.startDecay + dx * SENS_H));
        onKnobChangeRef.current("sustain", clamp01(d.startSustain - dy * SENS_V));
      } else {
        onKnobChangeRef.current("release", clamp01(d.startRelease + dx * SENS_H));
      }
    };

    const endH: EventListener = () => {
      el.removeEventListener("pointermove", moveH);
      el.removeEventListener("pointerup", endH);
      el.removeEventListener("pointercancel", endH);
      document.body.classList.remove("drag-selection-lock");
      dragRef.current = null;
    };

    el.addEventListener("pointermove", moveH);
    el.addEventListener("pointerup", endH);
    el.addEventListener("pointercancel", endH);
  }

  const handleBase = {
    r: 4.5,
    fill: color,
    stroke: "var(--surf-high)",
    strokeWidth: 1.5,
    style: { pointerEvents: "all" as const },
  };

  return (
    <svg
      viewBox="0 0 160 62"
      width="100%"
      height="100%"
      style={{ display: "block", pointerEvents: "none", overflow: "visible" }}
      aria-label="ADSR envelope"
    >
      {/* Zone guide lines */}
      {ZONE_DIVS.map((x) => (
        <line
          key={x}
          x1={x} y1={TY} x2={x} y2={BY}
          stroke={color}
          strokeWidth={0.5}
          strokeDasharray="2 3"
          opacity={0.15}
        />
      ))}

      {/* Envelope fill + stroke */}
      <path d={`${curvePath} Z`} fill={color} fillOpacity={0.07} />
      <path
        d={curvePath}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.75}
      />

      {/* Drag handles */}
      <circle
        {...handleBase}
        cx={xA} cy={TY}
        style={{ ...handleBase.style, cursor: "ew-resize" }}
        onPointerDown={(e) => startDrag("attack", e)}
      />
      <circle
        {...handleBase}
        cx={xD} cy={yS}
        style={{ ...handleBase.style, cursor: "move" }}
        onPointerDown={(e) => startDrag("decay-sustain", e)}
      />
      <circle
        {...handleBase}
        cx={xR} cy={BY}
        style={{ ...handleBase.style, cursor: "ew-resize" }}
        onPointerDown={(e) => startDrag("release", e)}
      />

      {/* Fixed zone labels — always in the same position */}
      {ZONE_LABELS.map(({ label, x }) => (
        <text
          key={label}
          x={x} y={BY + 10}
          textAnchor="middle"
          fontSize={6}
          fill={color}
          opacity={0.4}
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
