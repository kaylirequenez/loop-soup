import { immediate, now } from "tone";
import type { BaseContext } from "tone";

type LatencyHintOption = "interactive" | "balanced" | "playback" | "fastest";
type NowbarMode = "transportTicks" | "toneNow" | "immediateMinusOutput";

const FIXED_LOOKAHEAD_SEC = 0.005;
const FIXED_LATENCY_HINT: LatencyHintOption = "fastest";
const FIXED_NOWBAR_MODE: NowbarMode = "toneNow";

export interface TimingConfig {
  lookAheadSec: number;
  latencyHint: LatencyHintOption;
  nowbarMode: NowbarMode;
}

function toContextLatencyHint(
  hint: LatencyHintOption,
): number | AudioContextLatencyCategory {
  if (hint === "fastest") return 0.001;
  return hint;
}

export function getTimingConfig(): TimingConfig {
  return {
    lookAheadSec: FIXED_LOOKAHEAD_SEC,
    latencyHint: FIXED_LATENCY_HINT,
    nowbarMode: FIXED_NOWBAR_MODE,
  };
}

export function applyContextTimingConfig(context: BaseContext): TimingConfig {
  const config = getTimingConfig();
  context.lookAhead = config.lookAheadSec;
  const latencyHintValue = toContextLatencyHint(config.latencyHint);
  try {
    context.latencyHint = latencyHintValue;
  } catch {
    // Some contexts expose latencyHint as readonly.
  }
  return config;
}

interface TransportLike {
  ticks: number;
  PPQ: number;
  context: BaseContext;
  getTicksAtTime: (time: number) => number;
}

export function computeNowbarBeat(transport: TransportLike): {
  beat: number;
  mode: NowbarMode;
} {
  const { nowbarMode } = getTimingConfig();
  if (nowbarMode === "toneNow") {
    return {
      beat: transport.getTicksAtTime(now()) / transport.PPQ,
      mode: nowbarMode,
    };
  }
  if (nowbarMode === "immediateMinusOutput") {
    const rawContext = transport.context.rawContext as {
      outputLatency?: number;
    };
    const outputLatencySec = Math.max(0, rawContext.outputLatency ?? 0);
    const audibleTime = Math.max(0, immediate() - outputLatencySec);
    return {
      beat: transport.getTicksAtTime(audibleTime) / transport.PPQ,
      mode: nowbarMode,
    };
  }
  return {
    beat: transport.ticks / transport.PPQ,
    mode: nowbarMode,
  };
}
