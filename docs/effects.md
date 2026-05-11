# Effects Reference

Tone.js 15.1.22 effects used in loop-soup, their parameters, ranges, and implementation status.

Legend: ✅ implemented · 🔲 planned · ❌ skipped

---

## Per-loop inserts

These live in the voice insert chain (per loop, disposed with the voice).

| Effect | What it does | Parameters | Range | Status |
|--------|-------------|------------|-------|--------|
| Filter | Lowpass filter — cuts or opens brightness | cutoff | 80–18 000 Hz (exp) | ✅ |
| | | resonance (Q) | 0.5–20 (linear) | ✅ |
| Distortion | Waveshaping saturation / grit | drive | 0–1 (linear) | ✅ |
| | | wet | 0–1 (linear) | ✅ |
| Chorus | Detuned copies — thickens, widens | depth | 0–1 (linear) | ✅ |
| | | rate | 0.1–8 Hz (exp) | ✅ |
| Phaser | Sweeping comb filter — swirling, airy | octaves | 0–8 (linear) | ✅ |
| | | rate | 0.1–8 Hz (exp) | ✅ |
| Tremolo | Volume wobble at a rate — rhythmic pulse | depth | 0–1 (linear) | ✅ |
| | | rate | 0.1–8 Hz (exp) | ✅ |
| Vibrato | Pitch wobble at a rate — singer's vibrato | depth | 0–0.5 (linear) | ✅ |
| | | rate | 0.5–12 Hz (exp) | ✅ |
| AutoFilter | LFO drives filter cutoff — rhythmic sweep | depth | 0–1 (linear) | ✅ |
| | | rate | 0.1–8 Hz (exp) | ✅ |
| BitCrusher | Reduces bit depth — lo-fi, crunchy | crush amount | 0–1 → bits 16→1 | ✅ |

---

## Per-layer bus

These live on the layer channel, shared across all loops in that layer.

| Effect | What it does | Parameters | Range | Status |
|--------|-------------|------------|-------|--------|
| Channel | Gain + mute + solo | volume | 0–1 → dB (log) | ✅ |
| Pan | Left/right stereo placement | pan | 0→L, 0.5→C, 1→R | ✅ |
| EQ3 | 3-band tonal shaping | low | 0→−10 dB, 0.5→0 dB, 1→+10 dB | ✅ |
| | | mid | same | ✅ |
| | | high | same | ✅ |
| Compressor | Evens out dynamics, adds glue | threshold | 0→−40 dB, 1→0 dB | ✅ |
| | | ratio | 0→1:1, 1→20:1 | ✅ |
| | | attack | 0→1 ms, 1→300 ms (exp) | ✅ |
| | | release | 0→10 ms, 1→1 s (exp) | ✅ |

---

## Shared sends

One instance each, fed by per-layer gain nodes.

| Effect | What it does | Parameters | Range | Status |
|--------|-------------|------------|-------|--------|
| Reverb | Convolution space | send level | 0–1 (linear) | ✅ |
| | | decay | 2.8 s fixed | ✅ |
| FeedbackDelay | Echo with repeats | send level | 0–1 (linear) | ✅ |
| | | feedback | 0.22 fixed | ✅ |
| | | delayTime | "8n" fixed | ✅ |

---

## Synth / envelope (special control)

ADSR is shown as an envelope shape visualizer in the left column of the LayerCard (always visible
when a loop is selected; hidden in the layer mix view). Portamento and pitch drift appear in the
"Synth" page section in the middle column.

| Parameter | What it does | Range | Status |
|-----------|-------------|-------|--------|
| Attack | Time to reach peak amplitude | 0–2 s (exp) | ✅ |
| Decay | Time to fall from peak to sustain | 0.05–2 s (exp) | ✅ |
| Sustain | Amplitude held while note is on | 0–1 (linear) | ✅ |
| Release | Time to silence after note off | 0.05–4 s (exp) | ✅ |
| Portamento | Glide time between notes | 0–0.5 s (linear) | ✅ |
| Pitch drift | Random pitch variance per note trigger (±50 cents) | 0–1 (linear) | ✅ |

## Optional effects — UI

Optional effects (chorus, phaser, vibrato, auto-filter, tremolo, distortion, bit crusher) are added
and removed via the **EffectsPanel** — a slide-in panel opened with the "effects ▸" button in the
view bar. Active effects appear as individual labeled sections in the LayerCard middle column, each
with a `×` button to remove them.

---

## Skipped effects

| Effect | Reason skipped |
|--------|---------------|
| PingPongDelay | Flavor of delay already covered by FeedbackDelay |
| JCReverb / Freeverb | Different algorithms for same result as Reverb |
| AutoPanner | AutoFilter + pan cover this use case |
| AutoWah | Too unpredictable for a knob-first UI |
| Chebyshev | Niche, hard to use musically |
| PitchShift | Redundant — softpot + pitchOffset cover pitch |
| FrequencyShifter | Inharmonic/ring-mod; too easy to break the sound |
| StereoWidener | Mastering tool, not expressive enough for a knob slot |
| Gate | Too niche for current scope |
