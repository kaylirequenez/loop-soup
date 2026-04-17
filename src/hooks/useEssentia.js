export function useEssentia() {
  // Spec contract:
  // - Lazy-load Essentia WASM only for setup/hook flow.
  // - Analyze recording for bpm, key, meter, and pitch contour.
  // - Convert contour to quantized MIDI note events for Layer A.
  return {};
}
