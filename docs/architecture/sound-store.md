# Sound Store Ownership

Sound and mix state is persisted separately from layer composition state.

## Stores

- `layerStore` owns musical structure only:
  - layer roles
  - loop definitions and notes
  - loop instances, placement, repeat state
- `soundStore` owns saved audio configuration:
  - per-layer volume
  - per-layer mix controls: pan, EQ, compressor
  - per-layer default loop sound template
  - per-loop sound mapping/effect knobs
- `layerPlaybackStore` owns temporary playback overrides:
  - mute
  - solo

## Loop Sound Model

Loop sound state is now structured into core controls and optional effects:

- core loop controls: instrument, envelope, filter, loop sends
- optional loop effects: distortion, chorus, phaser, vibrato, auto-filter,
  tremolo, bitcrusher
- optional effect pages follow the order in which effects are added

The audio engine receives a derived `SoundMapping` for compatibility with the
current playback code. Optional insert effects are only instantiated when they
exist in the loop sound state.

The UI does not yet expose add/remove controls for optional effects.
