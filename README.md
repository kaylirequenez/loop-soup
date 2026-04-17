# loop soup

A browser-based ambient-electronic looping instrument. The performer builds music live using a single continuous-pitch interface — humming a melody or playing one directly — which the system analyzes to detect key, tempo, and meter. Five independent layers are then built up in real time: hook, bass, melody, harmony, and drums. Everything is performed live. There is no random generation and no pre-loaded content.

This repository contains the browser UI only. A companion physical panel (ESP32 + SoftPot resistive strip) connects via WebSocket and is documented separately. The UI is fully functional as a standalone app using mouse input on the SoftPot visualization.

---

## tech stack

- **React 18** — UI and state management
- **Vite** — dev server and build tool
- **Tone.js** — all synthesis, effects, loop scheduling, and transport
- **Essentia.js** — audio analysis during setup (key, tempo, meter, pitch extraction from microphone hum)
- **Tonal.js** — key detection from MIDI note sets when SoftPot is used to record the hook instead of microphone
- **WebSocket** — real-time communication with ESP32 physical panel (optional, UI works standalone)
- **Web Audio API** — routed through Tone.js for all audio output

---

## getting started

### prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### install

```bash
git clone https://github.com/yourusername/loop-soup.git
cd loop-soup
npm install
```

### run locally

```bash
npm run dev
```

Opens at `http://localhost:5173`. The app runs entirely in the browser — no backend required.

### build

```bash
npm run build
```

Output goes to `dist/`. Deploy to Vercel or any static host.

---

## project structure

```
loop-soup/
├── src/
│   ├── components/
│   │   ├── TopBar.jsx          # BPM, key, meter, loop length, make hook button, live status
│   │   ├── SoftPot.jsx         # vertical strip with draggable dot, note boxes, LED visualization
│   │   ├── LayerCard.jsx       # single layer card with name, pills, fader, 3 knobs
│   │   ├── LayerList.jsx       # all 5 layer cards, handles selection
│   │   ├── SoundPicker.jsx     # slide-in panel with sound list, sample toggle, confirm
│   │   ├── CompositionView.jsx # 5-lane loop timeline with playhead
│   │   ├── MidiRoll.jsx        # piano roll for B/C/D normalized to 1 octave
│   │   ├── BottomControls.jsx  # play, add, extend, repeat, octave controls
│   │   └── MakeHookModal.jsx   # modal for recording hook via mic or SoftPot
│   ├── hooks/
│   │   ├── useTone.js          # Tone.js setup, synths, effects, transport
│   │   ├── useEssentia.js      # Essentia.js audio analysis
│   │   ├── useWebSocket.js     # ESP32 WebSocket connection (optional)
│   │   └── useLoopEngine.js    # loop recording, commit, repeat scheduling
│   ├── lib/
│   │   ├── synths.js           # all Tone.js synth patch definitions per layer
│   │   ├── scales.js           # scale/key utilities, note position helpers
│   │   ├── midiConvert.js      # pitch contour → MIDI note sequence conversion
│   │   └── drumZones.js        # SoftPot drum zone mapping and velocity detection
│   ├── store/
│   │   └── appStore.js         # global state (selected layer, transport, loop data)
│   ├── App.jsx
│   └── main.jsx
├── public/
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## how the app works

### overview

Loop Soup has two phases: **setup** and **performance**. Setup happens before the audience arrives. Performance is the live show. The UI loads directly into performance view — setup is triggered by the "make hook" button.

### setup — make hook

Clicking **+ make hook** opens a modal with two options:

**microphone (hum):**

- User clicks record and hums a melody (4-8 seconds) into the laptop mic
- `getUserMedia` captures the audio stream
- Essentia.js processes the recording and extracts:
  - BPM — from onset timing
  - Key — from pitch content (e.g. A minor)
  - Meter — from rhythmic pattern (e.g. 4/4)
  - Pitch contour — sequence of frequencies over time
- Pitch contour is converted to MIDI note numbers, quantized to the detected meter grid, and velocity is extracted from amplitude
- The resulting MIDI sequence becomes Layer A (the hook) and loops via Tone.js

**SoftPot (instrument):**

- User plays on the SoftPot strip in the UI (or physical panel) while record is active
- Position data streams in as MIDI note events with velocity from press speed
- Tonal.js derives key from the resulting note set
- Essentia.js analyzes timing for BPM and meter
- Same quantization and packaging as the microphone path

After recording, the modal shows detected key/tempo/meter with override dropdowns. User confirms and setup is complete. Layer A immediately begins looping in the performance view.

### performance — layers

There are five layers, each independently controllable:

| layer | role    | default mode | layer-specific knob |
| ----- | ------- | ------------ | ------------------- |
| A     | hook    | loop ×1      | transpose           |
| B     | bass    | loop ×1      | drive               |
| C     | melody  | one-shot     | delay feedback      |
| D     | harmony | loop ×1      | stereo width        |
| E     | drums   | loop ×1      | reverb tail         |

**selecting a layer:** clicking a layer card selects it. The selected layer receives SoftPot input, and the repeat/octave controls in the bottom bar apply to it.

**layer cards show:**

- name and role
- status pill (playing / one-shot / idle)
- sound name pill (e.g. synth lead) — updates when sound changes
- octave pill
- repeat rate pill (×1, ×2, etc.)
- horizontal volume fader
- 3 knobs: filter cutoff, reverb wet/dry, layer-specific effect

### performance — softpot

The SoftPot is a vertical strip on the left of the screen. It can be controlled with the mouse (click and drag) or by the physical ESP32 panel via WebSocket.

**for layers A-D (pitch mode):**

- vertical position maps to pitch across a 2-octave chromatic range
- contact under ~100ms = short tap note with velocity from press speed
- contact over ~100ms = sustained note
- sliding while held = continuous pitch glide
- note boxes alongside the strip show all 12 semitones per octave
- scale notes glow in the detected key color; chromatic notes are dim
- C notes have a thicker border as octave markers

**for layer E (drum mode):**

- strip divides into 3 colored zones:
  - bottom 40% — kick (amber)
  - middle 40% — snare (teal)
  - top 20% — hihat (purple)
- only taps are registered; holds are ignored
- tap velocity from delta-voltage rate of change

### performance — the loop engine

**master loop length** is set from the hook recording — snapped to the nearest bar at the detected tempo. Maximum 32 bars. All layers lock to this via Tone.js Transport.

**add button (+):** a circular button in the bottom controls. When on (glowing), whatever is currently being played will be committed to the selected layer at the next loop boundary. When off, playing happens but nothing is saved. The performer can toggle add on and off during a loop — the state at the moment the loop boundary is crossed determines whether the content commits.

**repeat rates:** each layer can be set to play every 1, 2, 3, or 4 master loop cycles (4 is the maximum). The offset is relative to when the layer first entered — not a global counter. If the chosen repeat rate is larger than the current number of loops, the piece automatically extends until X loops exist.

**extend:** pressing extend tells the instrument to capture one additional loop cycle for the selected layer. The recording continues past the current loop boundary, allowing a layer to be 2x, 3x, or 4x the master loop length. The composition view block grows accordingly.

**no overwriting:** if a layer already has content, it cannot be recorded over in the same pass. The performer must work with what exists or re-record the hook (Layer A only has this option currently).

### performance — sound selection

The sounds toggle button (top right of the layers area) slides in the sound picker panel from the right.

**sound picker:**

- shows all available sounds for the currently selected layer as a clickable list
- **sample sound toggle:** when on, whatever sound is highlighted in the list plays through headphones continuously so the performer can audition while the loop runs
- clicking a sound highlights it and (if sample sound is on) begins previewing it
- **confirm button:** commits the highlighted sound to the selected layer on the next loop boundary — never mid-loop

**available sounds:**

- Layer A/C: synth lead, pluck, bell, pad lead, organ
- Layer B: sub bass, reese bass, moog bass, 808
- Layer D: pad, strings, choir, Rhodes, stab
- Layer E: electronic kit, acoustic kit, lo-fi kit

All sounds are Tone.js synthesized — no audio files.

### performance — views

**layers view (default):** shows all 5 layer cards + composition view below.

**midi roll view:** shows a piano roll for layers B, C, and D for the current loop. All notes are normalized to a single octave (shifted so the highest note sits near the top of the 12-semitone roll). A red playhead moves across all three rolls simultaneously. The composition view is also shown below for context.

### composition view

A 5-lane timeline always visible at the bottom of the layers area. One lane per layer (A-E). Filled colored blocks show recorded content. Block width is proportional to loop length — a 2x recording occupies twice the width. Gaps between blocks show when a layer is silent due to repeat rate > 1. A red playhead moves across all lanes simultaneously.

### bottom controls

All centered, grouped by function:

| cluster   | controls                                              |
| --------- | ----------------------------------------------------- |
| transport | play/pause (circular icon), add (circular + icon)     |
| extend    | extend button                                         |
| repeat    | 1 / 2 / 3 / 4 buttons — applies to selected layer     |
| octave    | − / number / + — applies to selected layer            |

### websocket (ESP32 integration)

The app listens for WebSocket connections from an ESP32 physical panel. Messages are JSON:

```json
{ "type": "softpot", "position": 0.42, "velocity": 87, "contact": true }
{ "type": "button", "id": "add", "state": true }
{ "type": "knob", "id": "filter", "value": 0.75 }
{ "type": "layer_select", "layer": "C" }
```

When no WebSocket is connected, the UI operates in standalone mouse mode with no degradation in functionality.

---

## synthesis

All audio is synthesized via Tone.js. No external audio files are loaded at runtime.

**synth patches are defined in `src/lib/synths.js`** as factory functions that return configured Tone.js instruments with effects chains. Each layer maintains its own synth instance. Effects per layer:

- filter: `Tone.Filter` (low-pass, cutoff controlled by knob 1)
- reverb: `Tone.Reverb` (wet/dry controlled by knob 2)
- layer fx: varies by layer (transpose via `Tone.PitchShift`, drive via `Tone.Distortion`, delay via `Tone.FeedbackDelay`, width via `Tone.StereoWidener`, reverb tail via reverb decay time)

---

## license

MIT — see LICENSE file.
