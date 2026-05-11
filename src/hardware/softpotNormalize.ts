const RAW_THRESHOLD = 150;
const RAW_TOP = 400;
const RAW_BOTTOM = 62000;

export function normalizeRaw(raw: number): number | null {
  if (raw < RAW_THRESHOLD) return null;
  return Math.max(0, Math.min(1, (raw - RAW_TOP) / (RAW_BOTTOM - RAW_TOP)));
}
