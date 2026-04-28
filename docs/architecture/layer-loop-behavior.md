# Layer/Loop Behavior Spec

## Scope

Defines expected behavior for mapping edits, loop placement/repeat state, duplication, and mute/solo playback overrides.

## Current structure

- `Layer` owns layer defaults and a map of numbered `LayerLoop`s.
- `LayerLoop` owns one shared `definition` + one loop-level `mapping`.
- `LayerLoopInstance` rows (inside `LayerLoop`) own placement/repeat only.

## Mapping behavior

- With no selected loop, edits apply to `Layer.defaultMapping`.
- With a selected loop, edits apply to `LayerLoop.mapping`.
- New loops start from current `defaultMapping`.
- Existing loop mappings remain unchanged when defaults change later.

## Placement and repeat behavior

- `startBeat` is always 0-indexed composition beat.
- `repeatUnit` determines whether repeat memory is interpreted in beats or measures.
- `repeatCount: null` means "repeat to composition boundary".
- Turning repeat off clears active repeat memory for that unit and clears `repeatCount`.

## Duplicate vs create

- Duplicate loop instance:
  - keeps same loop definition and mapping
  - copies repeat settings
  - assigns new instance id/start beat
- Add new loop instance:
  - creates a new instance row
  - defaults repeat to off
  - starts from layer defaults/mapping policy

## Playback override behavior

- `manualMutes` stores user mute preferences.
- `soloLayerId` is a temporary override.
- Solo never rewrites `manualMutes`; clearing solo reveals prior mute state.
