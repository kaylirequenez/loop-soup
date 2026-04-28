/**
 * Clamps `value` between `min` and `max`. All inputs coerced to numbers.
 *
 * @param value - Value to clamp.
 * @param min - Lower bound (inclusive).
 * @param max - Upper bound (inclusive).
 */
export function clamp(
  value: number | string,
  min: number | string,
  max: number | string,
): number {
  return Math.max(Number(min), Math.min(Number(max), Number(value)));
}

/**
 * Generates an array [1, 2, ..., maxInclusive].
 *
 * @param maxInclusive - Largest value in the range; must be ≥ 0.
 * @returns Empty array when maxInclusive < 1.
 */
export function oneBasedRange(maxInclusive: number): number[] {
  const max = Math.max(0, Math.floor(maxInclusive));
  return Array.from({ length: max }, (_, index) => index + 1);
}
