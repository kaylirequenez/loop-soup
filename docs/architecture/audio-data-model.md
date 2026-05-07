# Audio Data Model

## Purpose

Defines current data ownership for project state, editor state, playback state, and transport-adjacent MIDI view state.

## Core entities

### `Layer` (`src/types/layer.ts`)
Saved project container per layer id.

Contains:
- `role`, `volume`
- `defaultMapping`
- `layerLoops`

### `LayerLoop`
Numbered phrase unit inside one layer.

Contains:
- `definition` (notes + span + shared repeat spacing: `repeatUnit`, repeat-every memories)
- loop-level `mapping`
- `loopInstances` (placements)

### `LayerLoopInstance`
Placement row for one `LayerLoop`.

Contains:
- 0-indexed `startBeat`
- `repeatCount` (`null` = repeat through composition end for that instance’s repeats)

## Store ownership

- `layerStore`: persisted layer project data (`LayerStoreState`)
- `compositionStore`: persisted composition settings (`CompositionStoreState`)
- `midiStore`: persisted roll layout/playhead UI state (`MidiStoreState`)
- `layerEditorStore`: transient selection/focus state
- `layerPlaybackStore`: transient manual mute + solo state
- `transportStore`: transient transport toggles + playhead/view runtime state

## Mapping rules

- No loop selection -> edit `Layer.defaultMapping`.
- Loop selection -> edit that loop's `LayerLoop.mapping`.
- New loop creation copies current `defaultMapping` into loop mapping.
- Existing loop mappings never auto-sync when defaults change later.

## Playback audibility rules

- If `soloLayerId === null`, audibility comes from `manualMutes[layerId]`.
- If `soloLayerId !== null`, only the soloed layer is audible.
- Clearing solo restores manual mute behavior without rewriting mutes.

## Persistence guidance

Persist:
- composition settings
- layer project data
- midi layout/playhead view state

Do not persist by default:
- editor selection
- playback override state (mute/solo)
- transport runtime toggles and playhead/view state
