// Utility functions for the app

export function clamp(
  value: number | string,
  min: number | string,
  max: number | string,
): number {
  return Math.max(Number(min), Math.min(Number(max), Number(value)));
}
