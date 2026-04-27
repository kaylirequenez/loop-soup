# MIDI Refactor Notes

Open questions and proposed structures for the MIDI refactor. Not all of these need to be resolved at once — this file is a scratchpad.

---

## 1. midiStore.ts is doing too much

Currently `midiStore` owns three distinct concerns:

| Concern                         | Examples                                                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MIDI roll UI state              | `octaveView`, `softpotPosition`, `midiRollCount`, `midiRollSplitByRootOctave`, `midiMeasuresVisible`, `midiNoteSelection`, `midiLoopEditMode`, `midiLoopRollPlacement`, `sampleSoundOn` |
| Composition timeline / playhead | `midiPlayheadBeat`, `midiViewMeasureIndex`, `advanceTransportByMs`, `seekCompositionTimelineToBeat`, `restartTransportFromStart`, `snapPlayheadToVisibleWindowStart`                    |
| Layer loop mutations            | `setLayerRepeatUnit`, `toggleLayerRepeatEvery`, `setLayerLoopStartMeasure`, `setLayerLoopRepeatEndMeasure`, `shiftLayerLoopNotesOctave`                                                 |

**Proposed split:**

- Layer loop mutations → move to `layerStore.ts`. They modify `LayerLoopInstance` / `LoopDefinition` data; they don't belong in the MIDI UI store. They currently live here because `withMutatedActiveLayerLoop` needs editor focus from `layerEditorStore`, but that's a cross-store read, not a reason to host the action here.
- Composition timeline → could stay in `midiStore` under a cleaner name (`compositionPlayheadStore`) or move into `transportStore`. The playhead is transport-adjacent; the MIDI view window offset (`midiViewMeasureIndex`) is display-adjacent.

**Questions for you:**

- Do you want the layer loop mutations in `layerStore`, or do you prefer a dedicated `loopInstanceStore`?
- Should the playhead live in `transportStore` alongside `bpm`/`meter`/`totalMeasures`?

---

## 2. `withMutatedActiveLayerLoop` side-effect pattern

`withMutatedActiveLayerLoop` (in `store/utils/layerLoopMutations.ts`) calls `useLoopDefinitionStore.setState()` directly as a side effect, then returns updated `LayersState` for the caller to commit. This means a single mutation touches two stores in two different call sites.

**Problem:** callers can't do this atomically. If something throws between the `useLoopDefinitionStore.setState()` call and `useLayerStore.setState({ layers })`, state diverges.

**Option A:** Return `{ layers, definitions }` from `withMutatedActiveLayerLoop` and let the caller commit both. This is pure and testable.

**Option B:** Have `withMutatedActiveLayerLoop` call both `setState` calls internally and return nothing. Fewer lines at call sites but still not atomic (Zustand setState is synchronous, so in practice this is fine).

**Option C:** Move all of this into a single `layerStore` action that owns the compound mutation.

---

## 3. `midiLoopEditMode` vs `midiNoteSelection`

Both track "which loop is the user editing." When is one set without the other?

- `midiNoteSelection`: `{ layerId, LayerLoopId } | null` — set when tapping a loop note in the roll; drives bottom bar phrase/repeat controls.
- `midiLoopEditMode`: `{ layerId, LayerLoopId } | null` — declared but never explicitly set in any action. Appears to be a placeholder for a future "lock to this loop for note editing" mode.

**Question:** Is `midiLoopEditMode` intended to gate something different from `midiNoteSelection`? Currently `repeatPlacementEnabled` in `App.tsx` is `repeatPhraseEnabled && midiLoopEditMode == null`, which means placement is only editable when `midiLoopEditMode` is null — but since it's always null, placement is always editable whenever a loop is selected. Is this the right behavior, or do you want to introduce an explicit note-editing lock?

---

## 4. Deprecated `kind: "instance"` in `LoopEditorFocus`

`LoopEditorFocus` still has:

```ts
| { kind: "instance"; loopInstanceId: LoopInstanceId }
```

marked `@deprecated`. The only callsite that can set it is the deprecated `selectLoopInstance` / `setSelectedLoopInstanceId` in `layerEditorStore`, and those are never called by any component. The handlers in `layerRuntime.ts` and `layerLoopMutations.ts` still branch on it for safety.

**Proposed:** once confident no persisted state has `kind: "instance"`, delete it from the type, remove the branches, and remove the deprecated store methods.

---

## 5. `selectLoopDefinition` — forward-looking, not currently called

`selectLoopDefinition(layerId, loopDefinitionId)` sets focus `kind: "definition"`. No UI component currently calls it. It exists to support the "add from definition" flow described in `docs/architecture/layer-loop-behavior.md`, where multiple `LayerLoop`s share one `LoopDefinitionId`.

Until "add from definition" is implemented, `selectLoopDefinition` is unused. Keep it or remove it, but know it's speculative.

---

## 6. Layer mutations currently in `midiStore` vs `layerStore`

`setLayerRepeatUnit`, `toggleLayerRepeatEvery`, `setLayerLoopStartMeasure`, `setLayerLoopRepeatEndMeasure`, `shiftLayerLoopNotesOctave` all live in `midiStore` but mutate `Layer` / `LoopDefinition` data. The reason they're here is `maybeSwitchToMidiForLoopEdit`, which auto-switches `currentView` to `"midi"` if you're on the layers view when editing — and `currentView` lives in `midiStore`.

**Option:** Move the pure data mutations to `layerStore`, and emit a separate event / call `useMidiStore.getState().setView("midi")` from `layerStore` when needed. This keeps store responsibilities clean at the cost of a cross-store call.

---

## 7. Proposed `repeatEndMeasure` semantics update (now implemented)

`repeatEndMeasure` was previously only respected when `repeatUnit === "measures"`. After the fix in this branch, it works for `"beats"` mode too. The meaning is uniform:

> "Do not play any repeat whose start measure is ≥ `repeatEndMeasure`."

This is computed in `midiRollExpand.ts:repeatOffsetsFromLoop` using `Math.floor((G + k * repeatStep) / bpm) + 1` regardless of unit.

The only place that should still clear `repeatEndMeasure` is when repeats are **toggled off** entirely (`toggleLayerRepeatEvery` when the current value matches).

---

## 8. `LayerLoopIdSeq` / id generation

`createDefaultLoop` (now deleted) used a module-level `LayerLoopIdSeq` counter. The real id generation for new loop instances happens in `layerStore.addLoopInstance` where the caller supplies the id. **Question:** where does the id come from when adding a new loop? Needs a clean answer before implementing the "add loop" UI flow.

Suggested: use a UUID or `${layerId}-loop-${Date.now()}-${Math.random().toString(36).slice(2)}` at the call site.
