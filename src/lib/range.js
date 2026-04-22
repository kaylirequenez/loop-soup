export function oneBasedRange(maxInclusive) {
  const max = Math.max(0, Math.floor(Number(maxInclusive) || 0));
  return Array.from({ length: max }, (_, index) => index + 1);
}
