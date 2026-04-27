# Types Overview - OUTDATED

## File ownership

### `loop.ts`
Reusable musical content only.

Contains:
- `LoopDefinition`
- `LoopNote`
- loop ids

Does not contain:
- placement
- repeat behavior
- sound mapping
- mute/solo state

### `layer.ts`
Saved layer project data.

Contains:
- `Layer`
- `LayerLoop`
- `LayerLoopInstance`
- `SoundMapping`
- knob-related types

Does not contain:
- selected layer
- selected loop id / selection focus
- manual mute state
- solo state

### `layerEditor.ts`
Temporary editor state.

Contains:
- selected layer id
- per-layer editor focus: layer default mapping vs one loop instance vs shared loop definition (`LoopEditorFocus` in `selectedLoopFocusByLayer`)

### `layerPlayback.ts`
Temporary playback state.

Contains:
- manual mutes
- solo layer id

### `transport.ts`
Transport / timeline types used by `transportStore` (persisted fields vs runtime clock UI).

## Important rules

- `Layer.defaultMapping` is shown when no loop is selected.
- `LayerLoop.mapping` is the editable mapping when that loop is selected.
- `LayerLoop` references exactly one shared `LoopDefinition`.
- `LayerLoopInstance` stores placement/repeat only and never stores sound mapping.
- Mute and solo state are not stored inside saved layer project data.