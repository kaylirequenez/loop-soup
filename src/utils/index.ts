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
 * Returns an `onKeyDown` handler for text inputs:
 * - Enter blurs the input, triggering its `onBlur` commit handler.
 * - Escape calls `onEscape` to reset the draft, then blurs (onBlur becomes a no-op
 *   since the draft is already back to the committed value).
 *
 * @param onEscape - Resets the input's draft state to the last committed value.
 */
export function inputKeyHandler(
  onEscape: () => void,
): (e: React.KeyboardEvent<HTMLInputElement>) => void {
  return (e) => {
    if (e.key === "Enter") e.currentTarget.blur();
    else if (e.key === "Escape") { onEscape(); e.currentTarget.blur(); }
  };
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
