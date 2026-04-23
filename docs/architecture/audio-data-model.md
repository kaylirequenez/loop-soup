# Audio Data Model

## Purpose

This document defines the long-term data architecture for layers, loop definitions, loop instances, mapping behavior, and playback/editor state.

The goal is to keep:

- reusable musical content separate from placed instances
- project data separate from editor state
- project data separate from playback-only mute/solo state
- sound/knob behavior predictable for both users and future code changes

---

## Core Concepts

### LoopDefinition

A `LoopDefinition` stores reusable musical content only.

It contains:

- `id`
- `spanBeats`
- `notes`

It does **not** contain:

- placement on the timeline
- repeat settings
- mute/solo state
- sound mapping
- knob mapping

Reason:
Multiple loop instances may reuse the same musical pattern.

---

### LayerLoop

A `LayerLoop` is the numbered loop unit inside a layer.

It contains:

- `id`
- `loopDefinitionId`
- loop-level mapping / knob order
- ordered map of `LayerLoopInstance` rows

It does **not** contain:

- per-instance placement/repeat values

Reason:
A loop's mapping + definition are shared across its own instances.

---

### LayerLoopInstance

A `LayerLoopInstance` is a placement/repeat row inside a specific `LayerLoop`.

It contains:

- `id`
- placement data
- repeat data

It does **not** contain:

- `loopDefinitionId`
- sound/knob mapping
- note content

Reason:
Instances are timeline placements only; musical content and mapping are owned by the parent `LayerLoop`.

---

### Layer

A `Layer` stores layer-level project data.

It contains:

- `defaultMapping`
- `knobOrder`
- `layerLoops`

The `defaultMapping` is:

- the mapping shown when no loop instance is selected
- the template copied into new loop instances when created

Changing `Layer.defaultMapping` does **not** retroactively update existing loop instance mappings.

---

## Mapping Model

### Layer default mapping

Each layer has a `defaultMapping`.

This is used for:

- the mapping shown in the UI when no loop is selected
- the template copied when creating a new loop

### Loop mapping

Each `LayerLoop` stores its own `mapping`.

This mapping is copied from the layer's `defaultMapping` when the loop is created.

After creation:

- the loop mapping is independent
- changing the layer default does not change old loops
- changing a loop mapping does not change the layer default

---

## Selection Model

Selection is editor state, not project data.

Selection includes:

- selected layer (editing context)
- per-layer focus: **layer default** (`defaultMapping` only), **one loop** (mapping + definition), or **shared loop definition** (notes / span affecting each loop that references that definition)

Selection does **not** belong in `layer.ts`.

Reason:
Selection is temporary UI/editor state, not part of the saved musical structure.

---

## Playback Model

Mute and solo state are playback/editor state, not project data.

Playback state includes:

- `manualMutes`
- `soloLayerId`

These do **not** belong in `layer.ts`.

Reason:
Mute and solo are temporary playback behaviors and should not modify saved project structure.

---

## Audibility Rules

Actual layer audibility is derived.

- If `soloLayerId` is `null`, use `manualMutes`
- If `soloLayerId` is not `null`, only that layer is audible

Solo does not overwrite manual mute preferences.

Clearing solo returns to the underlying manual mute behavior automatically.

---

## State Ownership

### Project data

Owned by project/domain stores:

- loop definitions
- layers
- layer loops
- layer loop instances
- default mappings
- loop mappings

### Editor state

Owned by editor stores:

- selected layer
- selected loop
- note selection
- temporary editing state

### Playback state

Owned by playback stores:

- manual mutes
- solo layer

### Audio engine state

Owned outside these project/editor stores:

- Web Audio nodes
- synth instances
- runtime engine refs

---

## Persistence Guidance

Persist:

- loop definitions
- layers
- loop instances
- layer default mappings
- loop instance mappings

Do not persist unless product explicitly wants it:

- solo layer
- temporary pointer drag state
- transient editor interaction state

---

## Naming Guidance

Prefer:

- `LoopDefinition`
- `LayerLoopInstance`
- `defaultMapping`
- `mapping`
- `selectedLoopInstanceIdByLayer`

Avoid ambiguous names like:

- `loop` for both shared pattern and placed instance
- `sound` when it really means `soundId`
- `state` when a more specific entity name is available

---

## Non-goals

This architecture does not yet define:

- advanced automation envelopes
- partial per-knob inheritance
- real audio engine implementation details
- collaborative editing behavior

Those can be added later without changing the core model.
