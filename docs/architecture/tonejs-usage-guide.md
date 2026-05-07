# Tone.js Usage Guide (v15.1.22)

## Purpose

Defines the Tone.js runtime contract for loop-soup so transport/audio behavior stays predictable while editing loops live.

## Version pin

- Runtime target: `tone@15.1.22`.
- Access transport/context via `getTransport()`, `getContext()`, `getDraw()`.
- Do not use deprecated singleton references (`Tone.Transport`, `Tone.Draw`, `Tone.Destination`).

## Transport contract

- Configure transport in `useTransportClock`:
  - `bpm.value`
  - `timeSignature`
  - `loopStart = "0:0:0"`
  - `loopEnd = "${totalMeasures}:0:0"`
- Start/stop session ownership lives in `useAudioScheduler`:
  - start after `partEngine.rebuildAll(...)`
  - on cleanup: dispose parts -> release held notes -> `transport.stop()` -> `transport.loop = false` -> dispose audio nodes
- On loop wrap, call `audioEngine.cancelAll()` to prevent note tails crossing the seam.

## Units policy

- Persist musical timing in beats (`startBeat`, `lengthInBeat`, `spanBeats`).
- Convert to ticks at scheduling boundaries via one-shot rounding:
  - `Math.round(beat * transport.PPQ)`
  - Tone tick strings: `` `${ticks}i` ``
- Use seconds only for absolute synth envelope shape/tails.
- Keep `PPQ` fixed for app lifetime.
- Standardized helper coverage in codebase (`src/audio/toneUnits.ts`):
  - Functions: `Midi`/`Frequency` conversion + beat/tick boundary helpers
  - Unit types represented: `Frequency`, `Midi`, `Ticks`, `Time`, `TransportTime`, `TimeBase`, `Note`

## Part lifecycle rules

- One `Part` per loop instance, keyed by `(layerId, loopId, instanceId)`.
- Use full rebuild when structure changes:
  - instance add/delete
  - instance bounds/repeat changes
  - loop span/repeat stride changes
- Use in-place note updates when only note contents change:
  - `part.clear()`
  - `part.add(...)` per note event
  - do not dispose/recreate part just to edit note payloads

## Scheduling callback rules

- Inside Tone callbacks, always pass callback `time` to trigger methods.
- Do not call `now()` inside scheduled callbacks.
- Use `transport.getTicksAtTime(immediate() - outputLatency)` for visual playhead estimation.

## Instrument/sound swap rules

- For live layer sound changes:
  - build/connect new synth first
  - swap references
  - `releaseAll(now)` old synth
  - dispose old synth after short tail window
- Preview synths can be replaced immediately after gesture release.

## Cleanup checklist

For play-session teardown:

1. `partEngine.disposeAll()`
2. `audioEngine.cancelAll()`
3. `transport.stop()`
4. `transport.loop = false`
5. `audioEngine.stop()`

Do not dispose global Tone context/transport between sessions.

## Known doc gaps

- `TransportClass` and `DrawClass` landing pages can be missing for `15.1.22`; use `getTransport/getDraw` docs and source behavior.
- `PPQ` mutation semantics are not well documented in v15; treat PPQ as immutable after startup.

## References

- [Tone.js 15.1.22 index](https://tonejs.github.io/docs/15.1.22/index.html)
- [getTransport](https://tonejs.github.io/docs/15.1.22/functions/getTransport.html)
- [getDraw](https://tonejs.github.io/docs/15.1.22/functions/getDraw.html)
- [Context](https://tonejs.github.io/docs/15.1.22/classes/Context.html)
- [Part](https://tonejs.github.io/docs/15.1.22/classes/Part.html)
- [PolySynth](https://tonejs.github.io/docs/15.1.22/classes/PolySynth.html)
