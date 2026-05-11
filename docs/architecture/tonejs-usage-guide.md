# Tone.js Architecture for Loop Soup

## Core Decision

- **Current**
  - Runtime playback/scheduling truth is Tone Transport + callback `time` in [`src/audio/partEngine.ts`](src/audio/partEngine.ts) and [`src/audio/transportController.ts`](src/audio/transportController.ts).
  - Editing truth (composition, loops, notes, instances) lives in Zustand stores, especially [`src/store/layerStore.ts`](src/store/layerStore.ts).
- **Target**
  - Keep strict split: Tone owns runtime graph/scheduling; stores own project/editor state.
  - Perform all beats/ticks and pitch conversion at the audio boundary only.
- **Migration**
  - Keep store actions domain-first, route runtime side effects through runtime modules (now [`src/audio/layerRuntimeSync.ts`](src/audio/layerRuntimeSync.ts), transport via [`src/audio/transportController.ts`](src/audio/transportController.ts)).

## Highest-Impact Recommendations

- **Current**
  - Part-per-instance scheduling is implemented.
  - Transport lifecycle is partly consolidated but still orchestrated by multiple hooks.
  - Sound swaps can still cut held notes in some live-edit paths.
- **Target**
  - Single transport runtime controller owns start/pause/seek/loop wiring.
  - Deterministic teardown order across all part disposal paths.
  - Explicitly documented limitation/mitigation for sound swaps.
- **Migration**
  - Keep hooks as adapters only.
  - Keep runtime sync centralized in audio modules.
  - Expand hot-swap policy after stability work.

## Project Feature -> Tone.js API Mapping

- **Current**
  - Clip scheduling: `Part` in [`src/audio/partEngine.ts`](src/audio/partEngine.ts).
  - Global playback cursor/config: `getTransport()` in [`src/audio/transportController.ts`](src/audio/transportController.ts).
  - Instruments/channels: `Synth` (via `VoicePool`, 8 voices per loop), `Channel`, `EQ3`, `Compressor` in [`src/audio/audioEngine.ts`](src/audio/audioEngine.ts).
  - UI nowbar: RAF + `transport.ticks` in [`src/hooks/useTransportClock.ts`](src/hooks/useTransportClock.ts), [`src/utils/midiTransport.ts`](src/utils/midiTransport.ts).
- **Target**
  - Use `Part` for persisted note clips.
  - Reserve raw transport scheduling APIs for coarse lifecycle markers only.
- **Migration**
  - Keep API usage stable on `tone@15.1.22`.
  - Continue avoiding deprecated singleton access.

## Runtime Audio Engine Architecture

- **Current**
  - `AudioEngine`: synth/channel lifecycle and mute/solo operations.
  - `PartEngine`: instance-level Part lifecycle and per-loop synth sharing.
  - `layerRuntimeSync`: targeted runtime sync operations invoked by store actions.
  - `transportController`: transport config, seek, loop/session control helpers.
- **Target**
  - Ownership split:
    - `TransportController` for transport lifecycle.
    - `TimelineEngine` (current `PartEngine`) for scheduling registry.
    - `LoopVoice`/node abstractions for sound + FX evolution.
    - Layer/master bus abstractions as a future phase.
- **Migration**
  - Evolve existing modules instead of introducing a large rewrite.
  - Keep behavior-preserving refactors and small slices.

## Timing Policy

- **Current**
  - Store timing is in beats (`startBeat`, `lengthInBeat`, `spanBeats`).
  - Runtime conversion to ticks occurs in scheduling and seek paths.
  - `PPQ` treated as fixed runtime policy.
- **Target**
  - Persist beats only.
  - Use ticks/transport units as runtime cursor/scheduling units only.
  - Never persist transport position strings in store state.
- **Migration**
  - Keep helper conversions in [`src/audio/toneUnits.ts`](src/audio/toneUnits.ts) and transport helpers.
  - Continue one-shot conversion at runtime boundary.

## Scheduling Strategy

- **Current**
  - Primary primitive is `Part` per loop instance keyed by `layerId:loopId:instanceId`.
  - Structure edits trigger rebuilds; note-only edits use in-place `clear/add`.
- **Target**
  - `Part` remains the canonical primitive for persisted timeline clips.
  - Optional `Loop`/`scheduleRepeat` allowed for metronome or clock-only concerns.
  - Avoid `Sequence`/`Pattern` for persisted composition timeline.
  - Constrain raw `Transport.schedule*` use to coarse lifecycle markers.
- **Migration**
  - Keep incremental updates from [`src/audio/layerRuntimeSync.ts`](src/audio/layerRuntimeSync.ts).
  - Add tests/checklists for rapid edit churn during playback.

## Sound + FX Strategy

- **Current**
  - Per-layer channels + per-loop synth mappings in [`src/audio/audioEngine.ts`](src/audio/audioEngine.ts).
  - Envelope/knob mapping applied at synth build/update time.
  - Layer bus: `Channel` → `EQ3` → `Compressor` → master gain → limiter per layer; fully implemented.
  - Master safety chain: `masterGain` (user-controlled) + `Limiter` (fixed −1 dBFS) at the output.
  - Shared sends: `Reverb` and `FeedbackDelay` with per-layer `Gain` nodes (reverb send, delay send).
- **VoicePool**
  - 8 `Synth` instances per loop instance; oldest-voice stealing when pool is exhausted.
  - Pitch drift applied at `triggerAttack` via `synth.detune.value` (±50 cents range).
  - `VoicePool.updateMapping` applies param changes to all idle + active voices in-place.
  - `VoicePool` implements the `LoopVoice` interface — swap for sampler/player voice pools via factory.
- **Target**
  - Expand `LoopVoice` implementations beyond oscillator: `SamplerVoicePool`, `PlayerVoicePool`.
  - Factory `createVoicePool(mapping)` dispatches on sound category (oscillator / sampler / player).
- **Migration**
  - Keep current synth/channel model as stable base.
  - Add new voice pool implementations behind the existing `LoopVoice` interface.

## Pitch Strategy

- **Current**
  - Project model stores pitch class + octave in loop notes.
  - Conversion to runtime frequency happens in scheduler event creation.
- **Target**
  - Keep domain-friendly pitch model in store.
  - Convert once at Tone boundary per scheduled event.
  - Do not persist raw frequency values.
- **Migration**
  - Maintain conversion path in [`src/audio/partEngine.ts`](src/audio/partEngine.ts) and [`src/audio/toneUnits.ts`](src/audio/toneUnits.ts).

## Recording Strategy

- **Current**
  - Recording state is store/editor-driven; finalize logic runs from transport loop and controls.
  - Note timing is captured in beat-domain model.
- **Target**
  - Runtime capture timing remains in engine/transport path.
  - Commit exact beat-domain notes to store.
  - Keep quantization as optional post-capture transform (not low-level callback path).
- **Migration**
  - Preserve current behavior; introduce optional quantization as utility-layer step later.

## UI Sync Strategy

- **Current**
  - RAF drives continuous playhead updates from transport ticks.
  - Scrub guard (`isScrubbing`) prevents UI/playback clock fighting.
  - No `Draw.schedule` event-pulse integration yet.
- **Target**
  - Keep RAF for continuous nowbar.
  - Use `getDraw().schedule` only for event-accurate visual pulses (note flashes/hits), not as a replacement playhead clock.
- **Migration**
  - Document two-clock policy and keep explicit conversion boundaries.
  - Add Draw-based pulses only when UI events require sample-accurate alignment.

## Cleanup Rules

- **Current**
  - `disposeByKey()` stops parts before dispose.
  - `disposeAll()` now also uses stop-first ordering before disposal.
  - Session teardown order in scheduler path: dispose parts -> cancel held notes -> pause transport/disable loop -> stop audio nodes.
- **Target**
  - Enforce one teardown ordering principle everywhere:
    1. unschedule/stop callbacks
    2. release voices
    3. dispose nodes
    4. clear registries and handlers
  - Ensure single owner per disposable resource.
- **Migration**
  - Keep applying stop-first semantics to any new disposal path.
  - Validate via churn scenarios (rapid seek/stop/edit/restart).

## Disposal Regression Checklist

Use this smoke checklist whenever transport/scheduling/voice disposal logic changes:

- [ ] Start playback, perform rapid seek while notes are held, confirm no hanging notes.
- [ ] Play -> stop -> play repeatedly, confirm no stale Parts replay old events.
- [ ] Edit loop notes during playback (add/delete/resize), confirm no duplicate triggers.
- [ ] Delete a loop while playing, confirm no tail from disposed loop synth.
- [ ] Toggle mute/solo across layers during playback, confirm no orphaned audible voices.
- [ ] Change BPM/meter while paused/playing, confirm transport resumes cleanly.

## Known Sound-Swap Limitation and Mitigation

- **Current limitation**
  - Layer default sound changes do not hot-swap already-built loop synths for
    existing loop instances.
  - Existing loops keep their current mapping/sound until that loop mapping is
    updated or the loop is rebuilt.
- **Why this is acceptable today**
  - Preserves predictable playback during active scheduling and avoids abrupt
    graph churn while notes may still be releasing.
- **Mitigation policy**
  - Keep current behavior explicit in UX/docs: layer default edits affect new loops
    (and selected target mapping), not retroactive mass replacement.
  - Route explicit per-loop mapping changes through runtime sync paths that can
    update/rebuild deterministicly.
  - Revisit true live hot-swap after LoopVoice ownership is in place.

## Refactor Suggestions for My Existing Stores

- **Current**
  - `layerStore` remains action-triggered for runtime sync, with engine operations isolated behind [`src/audio/layerRuntimeSync.ts`](src/audio/layerRuntimeSync.ts).
  - Transport concerns are invoked from hooks and utilities.
- **Target**
  - Keep action-triggered pattern (no mandatory global subscriber diff engine now).
  - Avoid direct disposable Tone resource ownership in stores.
  - Keep runtime entry points in audio runtime modules.
- **Migration**
  - Continue extracting any remaining direct runtime operations from stores/components into runtime modules.
  - Keep store functions focused on domain transitions.

## Cursor Implementation Checklist

- [x] Introduce clear runtime sync boundary for layer-driven audio scheduling (`layerRuntimeSync`).
- [x] Start transport lifecycle consolidation (`transportController`).
- [x] Normalize part teardown ordering (`disposeAll` parity with stop-first).
- [x] Finish migrating remaining transport call sites to runtime controller entry points.
- [x] Add disposal regression checklist for stale parts/nodes/hanging notes.
- [ ] Verify and document two-clock invariants (RAF nowbar vs optional Draw pulses).
- [x] Document known sound-swap limitation and mitigation with explicit follow-up.
- [ ] Add future extension points (quantize/swing/humanize/probability) after boundary hardening.

---

Tone version policy: `tone@15.1.22` with `getTransport()`, `getContext()`, and `getDraw()` APIs.
