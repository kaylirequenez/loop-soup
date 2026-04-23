# AGENTS.md

## Purpose

This file defines architecture and implementation rules for AI coding agents working in this repository.

Applies to:

- Cursor
- Claude
- ChatGPT
- any future coding agent

Follow these rules unless the user explicitly asks for a temporary exception.

---

## High-Level Architecture

### Core entity split

- `LoopDefinition` stores reusable musical content only.
- `LayerLoopInstance` stores placed instance behavior only.
- `Layer` stores layer-level default mapping and loop instances.
- editor state is separate from project data.
- playback state is separate from project data.

### Required meaning

- `Layer.defaultMapping` is the mapping shown when no loop instance is selected.
- A new loop copies `Layer.defaultMapping` into its own `LayerLoop.mapping` when created.
- Existing loop mappings do not auto-update when the layer default changes.
- `LoopDefinition` contains shared `spanBeats` and `notes`.
- `LayerLoop` contains `loopDefinitionId` and loop-level mapping.
- `LayerLoopInstance` contains placement/repeat only.

---

## State Ownership Rules

### Project data

Keep in project/domain stores:

- loop definitions
- layers
- loop instances
- default mappings
- loop instance mappings

### Editor state

Keep in editor stores:

- selected layer id
- per-layer loop editor focus (layer default vs loop vs shared definition)
- note selection
- temporary editing state

### Playback state

Keep in playback stores:

- manual mutes
- solo layer id

### Audio engine state

Do not store in project/editor stores:

- audio nodes
- synth instances
- engine refs
- transport side effects tied to runtime objects

---

## Strict Rules

- Do not store mute state inside `Layer`.
- Do not store solo state inside `Layer`.
- Do not reintroduce `preSoloMutes`.
- Do not mix shared loop content with placed loop instance behavior.
- Do not use one type to mean both loop definition and loop instance.
- Prefer ids over indexes for selection and references.
- Keep store actions focused on state transitions.
- Move pure business/domain logic into helper functions outside Zustand stores.

---

## Mapping Rules

- If no loop instance is selected, sound/knob edits must update `Layer.defaultMapping`.
- If a loop instance is selected, sound/knob edits must update that loop instance's `mapping`.
- Creating a loop instance must copy the current `Layer.defaultMapping`.
- Existing loop instance mappings must remain unchanged after later layer default edits.

---

## Playback Rules

- `manualMutes[layerId]` stores manual mute preferences.
- `soloLayerId` temporarily overrides audibility.
- If `soloLayerId` is `null`, use manual mute preferences.
- If `soloLayerId` is not `null`, only that layer is audible.
- Clearing solo must return to manual mute behavior automatically.

---

## Documentation Rules

When changing architecture or behavior, update all relevant docs:

- `docs/architecture/audio-data-model.md`
- `docs/architecture/layer-loop-behavior.md`
- `src/types/README.md`

If a function's behavior changes materially, update the JSDoc spec above that function.

---

## Function Comment Rules

For important functions, use JSDoc-style behavior comments directly above the function.

Use this structure:

````ts
/**
 * Purpose:
 * ...
 *
 * Behavior:
 * - ...
 * - ...
 *
 * Inputs:
 * - ...
 *
 * Output:
 * - ...
 *
 * Invariants:
 * - ...
 */

## Code Quality Rules

- Prefer simple shapes over clever abstractions.
- Keep files small and responsibility-driven.
- Avoid mixing persistence migration code with UI logic.
- Avoid mixing runtime audio concerns with saved project data.
- Use clear names such as `defaultMapping`, `mapping`, `loopDefinitionId`, `selectedLoopInstanceIdByLayer`.
- Avoid ambiguous names like `loop`, `state`, or `sound` when a more precise name exists.

---

## Change Safety Rules

Before changing state shape:

- check persistence migration
- check selectors
- check UI components that read the old shape
- check any hardcoded initial/default objects

If changing saved data shape:

- add migration logic
- keep the runtime shape consistent across initial state, persisted state, and UI consumers

---

## Function Spec Rules

For important functions, write a short JSDoc spec directly above the function.

Use the exact format below unless there is a strong reason not to:

```ts
/**
 * Purpose:
 * Short statement of what the function is responsible for.
 *
 * Behavior:
 * - Main behavior rule 1
 * - Main behavior rule 2
 *
 * Inputs:
 * - paramName: short meaning
 *
 * Output:
 * - What the function returns or updates
 *
 * Invariants:
 * - Important rule that must remain true
 */
```

---

# File Header Rules

At the top of important state/domain files, include a short file header comment describing ownership.

Example patter:

/\*\*

- Layer store
-
- Owns saved layer project data only:
- - layer default mapping
- - loop instances
- - per-instance mappings
-
- Does not own:
- - selected loop instance
- - manual mutes
- - solo state
    \*/

## Persistence Rules

Persist only data that should survive refresh and belongs to saved project/editor state.

Usually persist:

- loop definitions
- layers
- loop instances
- default mappings
- loop instance mappings
- editor selections if intentionally desired

Do not persist by default:

- temporary pointer/drag state
- audio engine refs
- runtime node instances
- temporary solo override unless explicitly desired by product requirements

Any saved state shape change must include migration or merge logic.

---

## Selector and Derived State Rules

Prefer derived state for behavior that should not mutate stored project data.

Examples of good derived behavior:

- actual audibility from `manualMutes` + `soloLayerId`
- displayed mapping from selected loop instance vs layer default
- selected editor view based on selection store state

Avoid mutating saved project data just to make UI or playback logic easier.

---

## Store Design Rules

Use separate stores or slices by responsibility, not by convenience.

Recommended separation:

- loop/project data store
- layer project data store
- editor/selection store
- playback mute/solo store

Do not put everything in one store if the state has different lifecycles or ownership.

Keep stores focused on transitions.
Move reusable pure logic into helpers/selectors in domain or utility files.

---

## Migration Rules

When refactoring a data model:

- update all default builders
- update persisted merge/migration logic
- update all selectors and consumers
- update any hardcoded mock/test/default objects
- update docs
- add temporary runtime guards where useful during migration

Do not assume TypeScript alone guarantees runtime shape correctness when persisted state exists.

---

## Agent Workflow Rules

Before making non-trivial architecture changes, first inspect:

- types
- stores
- persistence/merge logic
- components reading the state
- docs describing the behavior

When changing one of these layers, check the others for consistency.

When unsure, preserve the documented behavior and architecture rather than inventing a new pattern.

---

## Non-goals

Do not add speculative complexity for:

- automation systems
- advanced inheritance systems
- collaboration systems
- engine-level abstractions
- generalized plugin systems

unless the user explicitly asks for them.

Prefer the simplest design that satisfies the documented behavior and current roadmap.
````
