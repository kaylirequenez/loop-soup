export function useLoopEngine() {
  // Spec contract:
  // - Track loop boundaries from Tone.Transport.
  // - Buffer recording note events by layer.
  // - Commit at boundary when add is enabled.
  // - Respect per-layer repeat (1/2/3/4) and entry-loop offsets.
  // - Handle extend and auto-extension behavior.
  return {};
}
