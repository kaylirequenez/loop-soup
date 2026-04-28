# Types Overview

This folder is the source of truth for all store state shapes and shared domain models.

## File ownership

### `composition.ts`
Global composition settings used by `compositionStore` and pitch/timeline helpers.

Contains:
- key/meter primitives (`MusicalKey`, `Meter`, etc.)
- `CompositionStoreState`

### `layer.ts`
Saved layer project data + actions owned by `layerStore`.

Contains:
- ids and layer-domain primitives (`LayerId`, `LayerKnobEffect`, etc.)
- project structures (`Layer`, `LayerLoop`, `LayerLoopInstance`)
- `LayerStoreState`

### `layerEditor.ts`
Transient editing focus state owned by `layerEditorStore`.

Contains:
- selected layer/loop/instance pointers

### `layerPlayback.ts`
Transient playback override state owned by `layerPlaybackStore`.

Contains:
- manual mute preferences
- solo override target

### `midi.ts`
MIDI-roll data contracts used by view logic and `midiStore`.

Contains:
- roll placement/routing types
- expanded note event shape (`CombinedNoteEvent`)
- `MidiStoreState`

### `transport.ts`
Runtime transport toggles/signals used by `transportStore`.

Contains:
- `TransportRuntimeState`
- `TransportStoreState`

### `app.ts`
Top-level app-view union types.

## Consistency rules

- Every store state/action interface lives in `src/types/*` and is imported by the store file.
- `Layer.defaultMapping` is the no-selection mapping target.
- `LayerLoop.mapping` is loop-specific mapping.
- `LayerLoopInstance` stores placement/repeat only.
- Manual mute + solo state stay outside saved layer project data.
- Beat positions are 0-indexed in data structures unless a field comment says otherwise.