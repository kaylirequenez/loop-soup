# Layer and Loop Behavior Spec

## Purpose

This document defines the expected product behavior for layer defaults, loop definitions, loop instances, placement, repeat behavior, duplication, placement-from-definition, and mute/solo logic.

---

## Core Model

### Layer

A layer can contain many loop instances.

A layer stores:

- `defaultMapping`
- `knobOrder`
- `loopInstances`

A layer does not store:

- mute state
- solo state
- selected loop instance
- shared note content for loops

### LoopDefinition

A `LoopDefinition` stores reusable musical content only.

It contains:

- `id`
- `spanBeats`
- `notes`

It does not contain:

- placement
- repeat configuration
- `startMeasure`
- `endMeasure`
- sound mapping
- knob values

### LayerLoopInstance

A `LayerLoopInstance` is a placed loop inside a layer.

It contains:

- its own instance id / loop number
- `loopDefinitionId`
- `startMeasure`
- repeat configuration
- `mapping`

A layer may contain multiple loop instances that reference the same loop definition.

---

## Mapping Display Behavior

### When no loop instance is selected

The UI displays the layer's `defaultMapping`.

This includes:

- sound selection
- knob values
- knob labels/order as supported by the UI

### When a loop instance is selected

The UI displays that selected loop instance's `mapping`.

This includes:

- the loop instance sound
- the loop instance knob values

### When selection is cleared

The UI returns to displaying the layer's `defaultMapping`.

This happens because the layer default is stored independently from loop instance mappings.

---

## Mapping Edit Behavior

### Editing with no loop instance selected

When the user edits sound or knobs while no loop instance is selected:

- update `Layer.defaultMapping`

This affects:

- the no-selection view
- future loop instances created from the layer default

This does not affect:

- already existing loop instance mappings

### Editing with a loop instance selected

When the user edits sound or knobs while a loop instance is selected:

- update that loop instance's `mapping`

This does not affect:

- the layer default mapping
- other loop instances

---

## Initial Loop Creation by Playing / Recording Notes

When a user first adds notes to a loop by playing them in:

- create a new `LoopDefinition`
- notes are stored according to what was played
- note timing is stored according to where played
- create a new `LayerLoopInstance` pointing to that new loop definition
- set `startMeasure` according to where the loop was placed / created
- initialize the new loop instance with no repeats
- initialize the new loop instance with no `endMeasure`
- copy the current `Layer.defaultMapping` into the new loop instance's `mapping`

Important rules:

- `endMeasure` only exists when repeats exist
- a non-repeating loop instance should not have an `endMeasure`
- repeat info belongs to the loop instance, not the loop definition
- after creation, user edits are saved to the loop definition and/or loop instance as appropriate

---

## Repeat Behavior

Repeat settings belong only to the loop instance.

The loop definition never stores repeat behavior.

### No-repeat state

A loop instance with no repeats:

- has a `startMeasure`
- has no `endMeasure`
- has no active repeat behavior

### Repeating state

If repeats are added to a loop instance:

- repeat configuration is stored on that loop instance
- `endMeasure` may exist and is only meaningful when repeats exist

Important rule:

- `endMeasure` should only exist when repeat behavior exists

---

## Loop Instance Actions

There are two distinct actions after a loop already exists.

### 1. Duplicate whole selected loop instance

This action duplicates the currently selected loop instance.

Behavior:

- create a new `LayerLoopInstance`
- copy the selected loop instance's `loopDefinitionId`
- copy the selected loop instance's `mapping`
- copy the selected loop instance's repeat configuration
- copy the selected loop instance's other instance-specific values
- set `startMeasure` based on where the duplicated instance is placed
- if the source loop instance has an `endMeasure`, calculate the new duplicated instance's `endMeasure` accordingly relative to the new `startMeasure`

Important:

- this is a whole loop instance copy
- it keeps the same shared `loopDefinitionId`
- it does not create a new loop definition
- it does create a new loop instance id / loop number
- all instance-specific values are copied except for placement-derived values that must be recalculated from the new placement

### 2. Add a new loop instance from an existing loop definition

This action creates a new loop instance from an existing shared loop definition.

Behavior:

- create a new `LayerLoopInstance`
- reference the existing shared `loopDefinitionId`
- set `startMeasure` based on where the new instance is placed
- set the new loop instance to have no repeats
- set the new loop instance to have no `endMeasure`
- initialize the new loop instance's `mapping` from the current `Layer.defaultMapping`

Important:

- this action uses shared note content from the referenced loop definition
- this action does not copy repeat behavior from another loop instance
- this action creates a fresh placed instance from shared musical content
- this action creates a new loop instance id / loop number

---

## Difference Between Duplicate and Add From Definition

### Duplicate whole loop instance

Use when the user wants:

- the same musical content
- the same mapping
- the same repeat behavior
- a different placement

Summary:

- same `loopDefinitionId`
- same instance values copied
- new loop instance id
- new `startMeasure`
- recalculated `endMeasure` if needed

### Add from shared loop definition

Use when the user wants:

- the same musical content only
- a fresh placed loop
- no repeats
- default mapping behavior for the new placement

Summary:

- same `loopDefinitionId`
- fresh instance behavior
- new loop instance id
- new `startMeasure`
- no repeats
- no `endMeasure`
- mapping copied from `Layer.defaultMapping`

---

## Placement Rules

A loop instance may only be placed if its occupied region does not overlap with another existing loop instance in the same layer.

This rule applies to:

- duplicating a whole loop instance
- adding a new loop instance from an existing loop definition
- first creating a loop by playing / recording if placement would conflict

### Occupied region

The occupied region is determined by the loop instance's placement and behavior.

At minimum this includes:

- `startMeasure`
- the loop definition span / duration
- repeat behavior if repeats are active
- `endMeasure` when repeats exist

### Overlap rule

If placing the loop instance at the requested position would cause an overlap with another loop instance in that layer:

- the placement is invalid
- the new loop instance must not be created there
- the paste/add operation must fail or be rejected by the UI

Important:

- overlap checks happen before placement is committed
- overlap checks apply even when the musical content comes from the same shared loop definition

---

## Loop Definition Sharing

A single `LoopDefinition` may be shared by many loop instances in the same layer.

Shared across those loop instances:

- `id`
- `spanBeats`
- `notes`

Not shared:

- `startMeasure`
- repeat configuration
- `endMeasure`
- `mapping`
- instance id / loop number

This is intentional.

The same musical pattern can appear multiple times in the layer while behaving differently as an instance.

---

## Saved Edit Behavior

After a loop is created, user edits are saved.

### Edits to shared musical content

Edits that change the loop definition should affect all loop instances referencing that same `loopDefinitionId`.

Examples:

- changing notes
- changing timing inside the loop definition
- changing `spanBeats`

### Edits to instance behavior

Edits that change loop instance behavior should only affect that loop instance.

Examples:

- changing `startMeasure`
- changing repeats
- changing `endMeasure`
- changing `mapping`

---

## Mute Behavior

`manualMutes[layerId]` stores the user's manual mute preference for each layer.

If `soloLayerId` is `null`:

- a layer is audible when `manualMutes[layerId] === false`

If `manualMutes[layerId] === true`:

- that layer is not audible unless solo temporarily overrides playback output

---

## Solo Behavior

`soloLayerId` is either:

- `null`
- a single layer id

If `soloLayerId !== null`:

- only that layer is audible

Solo does not overwrite `manualMutes`.

When solo is cleared:

- playback returns to the manual mute configuration automatically

---

## Selection vs Solo

Layer selection and solo are separate concepts.

### Selected layer

Used for:

- editing focus
- showing layer controls
- determining where actions apply

### Selected loop instance

Used for:

- deciding whether the UI shows the layer default mapping or the loop instance mapping
- deciding whether edits apply to the layer default or the selected loop instance
- determining which loop instance is the source for duplication

### Solo layer

Used for:

- temporary audibility override

Selecting a layer or loop instance should not automatically:

- mute other layers
- solo that layer
- change manual mute preferences

---

## Expected User Experience Examples

### Example 1: No loop selected

- Layer A default mapping is piano + filter 0.8 + reverb 0.2
- No loop instance is selected
- UI shows piano + filter 0.8 + reverb 0.2
- User changes reverb to 0.5
- Layer A default mapping becomes reverb 0.5

### Example 2: First creation by playing

- User plays notes into a new loop at measure 8
- A new loop definition is created from the played notes and timing
- A new loop instance is created at measure 8
- The loop instance has no repeats
- The loop instance has no end measure
- The loop instance mapping is copied from Layer A default mapping

### Example 3: Duplicate selected loop instance

- User selects loop instance A-2
- A-2 references loop definition D-7
- A-2 has repeats and has an end measure
- A-2 uses pad + filter 0.3 + reverb 0.7
- User duplicates A-2 at measure 16
- A new loop instance is created
- The new instance references the same loop definition D-7
- The new instance copies A-2 mapping
- The new instance copies A-2 repeat behavior
- The new instance gets a new start measure of 16
- The new instance end measure is recalculated accordingly

### Example 4: Add new loop instance from shared definition

- User chooses to add a new loop instance from existing loop definition D-7 at measure 24
- A new loop instance is created
- It references D-7
- It gets a new start measure of 24
- It has no repeats
- It has no end measure
- Its mapping is copied from Layer A default mapping

### Example 5: Placement conflict

- User tries to duplicate or add a loop instance at a measure where it would overlap another loop instance in the same layer
- The placement is rejected
- The new loop instance is not created there

### Example 6: Edit selected loop instance mapping

- User selects loop instance A-2
- UI shows that loop instance mapping
- User changes sound to pad
- Only loop instance A-2 changes
- Layer A default mapping remains unchanged

### Example 7: Deselect loop instance

- User deselects loop instance A-2
- UI returns to Layer A default mapping

### Example 8: Solo behavior

- Manual mutes: B muted, others unmuted
- User solos B
- Only B is audible
- User clears solo
- B returns to its previous manual mute state automatically

---

## Non-goals

This spec does not yet define:

- linked editing rules across different loop definitions
- automation curves
- per-note mapping changes
- advanced engine-level audio routing
