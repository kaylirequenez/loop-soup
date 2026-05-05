# Layer/Loop Behavior Spec

## Scope

Defines expected behavior for mapping edits, loop placement/repeat state, duplication, and mute/solo playback overrides.

## Current structure

- `Layer` owns layer defaults and a map of numbered `LayerLoop`s.
- `LayerLoop` owns one shared `definition` + one loop-level `mapping`.
- `LayerLoopInstance` rows own placement (`startBeat`) and per-instance `repeatCount` only.
- Shared repeat spacing (`repeatUnit`, repeat-every memories) lives on `LoopDefinition` for all instances of that loop.

## Mapping behavior

- With no selected loop, edits apply to `Layer.defaultMapping`.
- With a selected loop, edits apply to `LayerLoop.mapping`.
- New loops start from current `defaultMapping`.
- Existing loop mappings remain unchanged when defaults change later.

## Placement and repeat behavior

- `startBeat` is always 0-indexed composition beat.
- `repeatUnit` and repeat-every memories live on `LoopDefinition` (same for every instance of that loop).
- Per-instance `repeatCount`: `null` means "repeat to composition boundary" for that instance’s tiling.
- Turning repeat frequency off clears active repeat memory on the definition for that unit and clears `repeatCount` on **all** instances of the loop.

## Duplicate vs create

- Duplicate loop instance:
  - keeps same loop definition and mapping (including shared repeat spacing)
  - copies `repeatCount` from source instance
  - assigns new instance id/start beat
- Add new loop instance:
  - creates a new instance row (`repeatCount` default null)
  - uses shared repeat spacing from `LoopDefinition`
  - starts from layer defaults/mapping policy

## Playback override behavior

- `manualMutes` stores user mute preferences.
- `soloLayerId` is a temporary override.
- Solo never rewrites `manualMutes`; clearing solo reveals prior mute state.
