# OUTDATED IGNORE!

---

# stack setup

## initialize project

```bash
npm create vite@latest loop-soup -- --template react
cd loop-soup
npm install
```

## install dependencies

```bash
npm install tone essentiajs-model essentia.js tonal
npm install zustand
npm install -D @types/react @types/react-dom
```

- `tone` — Tone.js v14, all synthesis and transport
- `essentia.js` — audio analysis (key, tempo, meter, pitch from mic)
- `tonal` — music theory utilities (key detection from MIDI note sets, scale queries)
- `zustand` — lightweight global state management

## vite config

```js
// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  optimizeDeps: {
    exclude: ["essentia.js"],
  },
});
```

Essentia.js uses WebAssembly and must be excluded from Vite pre-bundling.

---

# global state — zustand store

Create `src/store/appStore.js`. This is the single source of truth for all app state.

```js
import { create } from "zustand";

const LAYERS = ["A", "B", "C", "D", "E"];

const DEFAULT_LAYER = {
  sound: null, // string — current sound name
  octave: 3, // int 0-7
  repeat: 1, // int 1,2,3,4
  mode: "loop", // 'loop' | 'oneshot'
  volume: 0.7, // float 0-1
  filter: 0.8, // float 0-1 (maps to cutoff Hz)
  reverb: 0.2, // float 0-1 (maps to wet amount)
  layerFx: 0.0, // float 0-1 (transpose/drive/delay/width/room)
  status: "idle", // 'idle' | 'playing' | 'recording'
  hasContent: false, // whether this layer has recorded content
  loopLength: 1, // multiple of master loop (1, 2, 3, 4...)
  entryLoop: null, // which loop number this layer first entered
};

export const useAppStore = create((set, get) => ({
  // session state
  isPlaying: false,
  addOn: false,
  extendOn: false,
  currentLoop: 0,
  totalLoops: 4,
  masterLoopLength: null, // bars
  bpm: 128,
  key: null, // e.g. 'A minor'
  meter: "4/4",
  selectedLayer: "A",
  currentView: "layers", // 'layers' | 'midi'
  pickerOpen: false,
  sampleSoundOn: false,
  previewSound: null, // sound name being previewed in headphones

  // per-layer state
  layers: Object.fromEntries(
    LAYERS.map((id) => [
      id,
      {
        ...DEFAULT_LAYER,
        octave: id === "B" ? 1 : id === "D" ? 2 : id === "E" ? 3 : 4,
        mode: id === "C" ? "oneshot" : "loop",
        sound: {
          A: "synth lead",
          B: "sub bass",
          C: "pluck",
          D: "pad",
          E: "electronic kit",
        }[id],
      },
    ]),
  ),

  // recorded MIDI data per layer (array of note events)
  recordings: { A: [], B: [], C: [], D: [], E: [] },

  // actions
  setPlaying: (v) => set({ isPlaying: v }),
  setAddOn: (v) => set({ addOn: v }),
  setExtendOn: (v) => set({ extendOn: v }),
  selectLayer: (id) => set({ selectedLayer: id }),
  setView: (v) => set({ currentView: v }),
  setPickerOpen: (v) => set({ pickerOpen: v }),
  setSampleSoundOn: (v) => set({ sampleSoundOn: v }),
  setPreviewSound: (v) => set({ previewSound: v }),

  updateLayer: (id, patch) =>
    set((state) => ({
      layers: { ...state.layers, [id]: { ...state.layers[id], ...patch } },
    })),

  commitRecording: (id, notes) =>
    set((state) => ({
      recordings: { ...state.recordings, [id]: notes },
      layers: {
        ...state.layers,
        [id]: { ...state.layers[id], hasContent: true, status: "playing" },
      },
    })),

  setSessionInfo: (bpm, key, meter, loopLength) =>
    set({ bpm, key, meter, masterLoopLength: loopLength }),
}));
```

---

# audio engine — useTone.js

Create `src/hooks/useTone.js`. This hook owns all Tone.js objects. It initializes once and never re-initializes.

## structure

```js
import { useEffect, useRef } from "react";
import * as Tone from "tone";
import { useAppStore } from "../store/appStore";
import { createSynth } from "../lib/synths";

export function useTone() {
  const synths = useRef({}); // { A: ToneSynth, B: ..., ... }
  const players = useRef({}); // Tone.Players for sample playback if needed
  const transport = Tone.getTransport();
  const store = useAppStore();

  useEffect(() => {
    // create one synth per layer on mount
    ["A", "B", "C", "D", "E"].forEach((id) => {
      synths.current[id] = createSynth(id, store.layers[id].sound);
    });

    return () => {
      Object.values(synths.current).forEach((s) => s.dispose());
    };
  }, []);

  function startTransport(bpm) {
    Tone.start(); // must be called after user gesture
    transport.bpm.value = bpm;
    transport.start();
  }

  function stopTransport() {
    transport.stop();
  }

  function triggerNote(layerId, midiNote, velocity, duration) {
    const synth = synths.current[layerId];
    if (!synth) return;
    const freq = Tone.Frequency(midiNote, "midi").toFrequency();
    const vol = velocity / 127;
    if (duration === "hold") {
      synth.triggerAttack(freq, Tone.now(), vol);
    } else {
      synth.triggerAttackRelease(freq, duration, Tone.now(), vol);
    }
  }

  function releaseNote(layerId) {
    synths.current[layerId]?.triggerRelease();
  }

  function scheduleLoop(layerId, notes, loopLength) {
    // schedule a Tone.Part to play back recorded notes
    const part = new Tone.Part((time, note) => {
      triggerNote(layerId, note.midi, note.velocity, note.duration);
    }, notes);
    part.loop = true;
    part.loopEnd = loopLength + "n"; // bars in note notation
    part.start(0);
    return part;
  }

  function updateFilter(layerId, value) {
    // value 0-1 → cutoff 200Hz-18000Hz (log scale)
    const hz = 200 * Math.pow(90, value);
    synths.current[layerId]?.filter?.set({ frequency: hz });
  }

  function updateReverb(layerId, value) {
    synths.current[layerId]?.reverb?.set({ wet: value });
  }

  function updateLayerFx(layerId, value) {
    // each layer has a different fx — see synths.js
    synths.current[layerId]?.layerFx?.update(value);
  }

  return {
    startTransport,
    stopTransport,
    triggerNote,
    releaseNote,
    scheduleLoop,
    updateFilter,
    updateReverb,
    updateLayerFx,
  };
}
```

---

# synth patches — synths.js

Create `src/lib/synths.js`. Each layer gets a synth factory. All effects are chained and connected to `Tone.Destination`.

## structure per layer

Each synth object returned by `createSynth` must expose:

- `.triggerAttack(freq, time, vel)`
- `.triggerRelease(time)`
- `.triggerAttackRelease(freq, dur, time, vel)`
- `.filter` — the `Tone.Filter` instance
- `.reverb` — the `Tone.Reverb` instance
- `.layerFx` — the layer-specific effect with `.update(value)` method
- `.dispose()` — tears down all nodes

## sound definitions per layer

**Layer A / C — synth lead:**

```js
// Tone.Synth → Tone.Filter → Tone.Reverb → Destination
// oscillator: sawtooth, envelope: fast attack, moderate release
```

**Layer A / C — pluck:**

```js
// Tone.PluckSynth → Tone.Filter → Tone.Reverb → Destination
// PluckSynth has no triggerAttack — use triggerAttackRelease only
```

**Layer A / C — bell:**

```js
// Tone.FMSynth → Tone.Filter → Tone.Reverb → Destination
// harmonicity: 3, modulationIndex: 10, envelope: fast attack, long release
```

**Layer A / C — pad lead:**

```js
// Tone.Synth → Tone.Filter → Tone.Reverb → Destination
// oscillator: sine, envelope: slow attack (2s), slow release (4s)
```

**Layer A / C — organ:**

```js
// Tone.PolySynth(Tone.Synth) → Tone.Filter → Tone.Reverb → Destination
// oscillator: square, fast attack and release, slight detune
```

**Layer B — sub bass:**

```js
// Tone.Synth → Tone.Filter → Destination
// oscillator: sine, very low cutoff (150Hz), no reverb
```

**Layer B — reese bass:**

```js
// two Tone.Synth instances detuned ±15 cents, mixed → Tone.Filter → Tone.Distortion → Destination
// oscillator: sawtooth
```

**Layer B — moog bass:**

```js
// Tone.MonoSynth → Tone.Filter → Destination
// filter type: lowpass, resonance: 8, envelope drives cutoff
```

**Layer B — 808:**

```js
// Tone.MembraneSynth → Tone.Filter → Destination
// pitchDecay: 0.5, octaves: 6, low pitch (36-48 MIDI)
```

**Layer D — pad:**

```js
// Tone.PolySynth → Tone.Filter → Tone.Reverb → Tone.StereoWidener → Destination
// slow attack (3s), long release (6s), heavy reverb
```

**Layer D — strings:**

```js
// Tone.PolySynth(Tone.Synth) → Tone.Filter → Tone.Vibrato → Tone.Reverb → Destination
// sawtooth, vibrato frequency 5Hz depth 0.1, medium reverb
```

**Layer D — choir:**

```js
// Tone.PolySynth → Tone.Filter → Tone.Chorus → Tone.Reverb → Destination
// sine oscillator, slow attack, chorus for formant-like spread
```

**Layer D — Rhodes:**

```js
// Tone.FMSynth → Tone.Filter → Tone.Reverb → Destination
// harmonicity: 0.5, modulationIndex: 2, electric piano character
```

**Layer D — stab:**

```js
// Tone.PolySynth → Tone.Filter → Tone.Reverb → Destination
// fast attack and release (<0.05s), punchy
```

**Layer E — drums:**
Drums are always three fixed synths regardless of kit selection. Kit selection changes their parameters:

```js
// kick: Tone.MembraneSynth — pitchDecay, octaves, release vary by kit
// snare: Tone.NoiseSynth — noise type, envelope vary by kit
// hihat: Tone.MetalSynth — frequency, decay, resonance vary by kit
```

Kit presets:

- electronic kit: tight kick, sharp snare, bright closed hihat
- acoustic kit: rounder kick, snappier snare, softer hihat
- lo-fi kit: short kick, lo-fi noise snare, very short hihat with bit crushing

---

# audio analysis — useEssentia.js

Create `src/hooks/useEssentia.js`.

Essentia.js loads via WebAssembly and takes a few seconds to initialize. Show a loading state until ready.

## initialization

```js
import EssentiaWASM from "essentia.js/dist/essentia-wasm.module.js";
import { Essentia } from "essentia.js";

// initialize once on mount
const essentia = new Essentia(await EssentiaWASM());
```

## pipeline: microphone → analysis

```js
async function analyzeRecording(audioBuffer) {
  // audioBuffer: Web Audio API AudioBuffer from getUserMedia recording

  const signal = essentia.arrayToVector(audioBuffer.getChannelData(0));

  // 1. key detection
  const keyData = essentia.KeyExtractor(signal);
  // keyData.key → e.g. 'A', keyData.scale → 'minor'
  const key = `${keyData.key} ${keyData.scale}`;

  // 2. tempo
  const tempoData = essentia.PercivalBpmEstimator(
    signal,
    audioBuffer.sampleRate,
  );
  const bpm = Math.round(tempoData.bpm);

  // 3. beat tracking / meter
  const beats = essentia.BeatTrackerMultiFeature(signal);
  // derive meter from beat regularity — default to 4/4 if unclear

  // 4. pitch contour (melody extraction)
  const pitchData = essentia.PitchMelodia(signal, audioBuffer.sampleRate);
  // pitchData.pitch: Float32Array of Hz values over time
  // pitchData.pitchConfidence: Float32Array of confidence values

  return {
    key,
    bpm,
    meter: "4/4",
    pitchContour: pitchData.pitch,
    confidence: pitchData.pitchConfidence,
  };
}
```

## pitch contour → MIDI notes

Create `src/lib/midiConvert.js`:

```js
export function contourToMidi(
  pitchHz,
  confidence,
  sampleRate,
  hopSize,
  bpm,
  meter,
) {
  const notes = [];
  let currentNote = null;
  const beatsPerSec = bpm / 60;
  const hopDuration = hopSize / sampleRate;

  pitchHz.forEach((hz, i) => {
    const conf = confidence[i];
    if (conf < 0.5 || hz < 50) {
      // no pitch detected — end current note
      if (currentNote) {
        currentNote.endTime = i * hopDuration;
        currentNote.duration = currentNote.endTime - currentNote.startTime;
        notes.push(currentNote);
        currentNote = null;
      }
      return;
    }

    const midi = Math.round(12 * Math.log2(hz / 440) + 69);

    if (!currentNote || midi !== currentNote.midi) {
      if (currentNote) {
        currentNote.endTime = i * hopDuration;
        currentNote.duration = currentNote.endTime - currentNote.startTime;
        notes.push(currentNote);
      }
      currentNote = { midi, startTime: i * hopDuration, velocity: 80 };
    }
  });

  // quantize startTime and duration to 16th notes
  const sixteenth = 60 / bpm / 4;
  return notes.map((n) => ({
    ...n,
    startTime: Math.round(n.startTime / sixteenth) * sixteenth,
    duration: Math.max(
      sixteenth,
      Math.round(n.duration / sixteenth) * sixteenth,
    ),
  }));
}
```

---

# softpot component

Create `src/components/SoftPot.jsx`.

## props

```js
// SoftPot receives no props — reads selectedLayer from store
// emits note events to the audio engine via callback
```

## note boxes

Build 24 note boxes (2 octaves chromatic) stacked vertically. For each semitone position:

- calculate which note it is based on selectedLayer octave and position
- check if it is in the detected key (from store)
- apply class: `in-scale` (glowing), `chromatic` (dim), `active` (current finger position), `octave-c` (thicker border)
- note name shown inside: just letter for most, letter+octave number for C notes

## pitch mode (layers A-D)

```js
// map mouse Y position to pitch
function yToPitch(y, stripHeight, octave) {
  const pct = y / stripHeight;
  const semitone = Math.round((1 - pct) * 23); // 0 = bottom, 23 = top
  const rootMidi = (octave + 1) * 12; // C of the selected octave
  return rootMidi + semitone;
}
```

Contact detection (mouse):

- `mousedown` → note on, record start time
- `mousemove` while down → update pitch (glide)
- `mouseup` → note off, check duration for tap vs hold

## drum mode (layer E)

```js
function yToDrum(y, stripHeight) {
  const pct = y / stripHeight;
  if (pct < 0.2) return "hihat"; // top 20%
  if (pct < 0.6) return "snare"; // middle 40%
  return "kick"; // bottom 40%
}
```

Show colored zones on the LED strip instead of note boxes:

- bottom 40%: amber background (kick)
- middle 40%: teal background (snare)
- top 20%: purple background (hihat)

## velocity

```js
// track how fast the mouse moves on initial contact
// high delta-Y speed on mousedown = high velocity
// map delta speed to velocity 20-127
```

---

# loop engine — useLoopEngine.js

Create `src/hooks/useLoopEngine.js`. This is the most complex hook.

## responsibilities

- track current loop position via Tone.Transport
- manage per-layer recording buffers
- commit recordings at loop boundaries when add is on
- schedule committed loops to play back at correct repeat rates
- handle extend (capture additional loop cycle)
- auto-extend piece when repeat > total loops

## loop boundary scheduling

```js
// use Tone.Transport.scheduleRepeat to fire at every loop boundary
Tone.Transport.scheduleRepeat((time) => {
  onLoopBoundary(time);
}, masterLoopLength + "m"); // masterLoopLength in bars, 'm' = measures

function onLoopBoundary(time) {
  const store = useAppStore.getState();

  // increment current loop counter
  incrementLoop();

  // check each layer
  ["A", "B", "C", "D", "E"].forEach((layerId) => {
    const layer = store.layers[layerId];

    // commit recording if add is on and layer is being recorded
    if (store.addOn && layer.status === "recording") {
      commitLayer(layerId, time);
    }

    // check if this layer should play on this loop number
    if (layer.hasContent && shouldPlay(layerId)) {
      scheduleLayerPlayback(layerId, time);
    }
  });

  // auto-extend if any layer has repeat > totalLoops
  checkAutoExtend();
}

function shouldPlay(layerId) {
  const { layers, currentLoop } = useAppStore.getState();
  const layer = layers[layerId];
  if (!layer.hasContent) return false;
  const loopsSinceEntry = currentLoop - layer.entryLoop;
  return loopsSinceEntry % layer.repeat === 0;
}
```

## recording buffer

```js
// while recording, accumulate note events with timestamps relative to loop start
const recordingBuffer = useRef({ A: [], B: [], C: [], D: [], E: [] });

function startRecording(layerId) {
  recordingBuffer.current[layerId] = [];
  const startTime = Tone.Transport.seconds;
  // store startTime for offset calculation
}

function addNoteToBuffer(layerId, noteEvent) {
  // noteEvent: { midi, startTime, duration, velocity }
  const relativeStart =
    noteEvent.startTime - recordingStartTime.current[layerId];
  recordingBuffer.current[layerId].push({
    ...noteEvent,
    startTime: relativeStart,
  });
}
```

---

# component implementation

## App.jsx

```jsx
// top-level layout
// <TopBar /> — always visible
// <div main> — horizontal split
//   <SoftPot /> — left column, always visible
//   <div right> — flex column
//     <ViewBar /> — layers / midi toggle + sounds toggle
//     <MidArea> — layers view or midi view + sound picker overlay
//     <CompositionView /> — always visible below
// <BottomControls /> — always visible
```

## TopBar.jsx

Displays BPM, key, meter, loop length from store. "+ make hook" button centered. Live status pill and loop counter on the right. Key/meter/BPM should be editable — clicking them opens a small inline input to override the detected value.

## LayerCard.jsx

```jsx
// props: layerId
// reads layer state from store via useAppStore
// onClick: store.selectLayer(layerId)
// selected state: add 'selected' class (thicker colored border)
// fader: drag horizontally, updates layer.volume in store + audio engine
// knobs: click and drag vertically (up = increase), updates filter/reverb/layerFx
// pills: show current sound, octave, repeat, status
```

Knob drag interaction:

```js
// mousedown on knob → record starting Y position and current value
// mousemove → delta Y → new value = clamp(currentValue - deltaY * 0.005, 0, 1)
// mouseup → stop
```

## SoundPicker.jsx

Slides in from the right using CSS transform transition. Width: 155px. Overlays the right edge of the layers area.

```jsx
// reads selectedLayer from store
// sound list: maps soundsPerLayer[selectedLayer] to clickable items
// clicking an item: if sampleSoundOn → preview in headphones, if not → just highlight
// sample sound toggle: toggles store.sampleSoundOn
// confirm button: commits previewSound to layer.sound on next loop boundary
```

Sound list items have three visual states:

- **active**: currently committed sound (teal tinted background)
- **previewing**: highlighted and playing in headphones (blue tinted background + small dot)
- **default**: available but not selected (dim)

## CompositionView.jsx

```jsx
// 5 lane timeline
// each lane: colored block(s) showing recorded content
// block left%: (entryLoop / totalLoops) * 100
// block width%: (loopLength / totalLoops) * 100
// gaps between blocks for repeat > 1
// red playhead: left% = (currentLoopPosition / totalLoops) * 100
// updates every animation frame via requestAnimationFrame
```

## MidiRoll.jsx

```jsx
// shown when currentView === 'midi'
// 3 piano rolls: B, C, D
// each roll: 12 rows (one per semitone), spanning full loop width
// notes: left% = (startTime / loopDuration) * 100
//        width% = (duration / loopDuration) * 100
//        top% = ((11 - semitone) / 12) * 100
// semitone = note.midi % 12 (normalize to one octave)
// divider lines between semitones, thicker at C and F
// red playhead matching main comp view position
```

## BottomControls.jsx

```jsx
// play button: circular icon, toggles isPlaying
//   → calls Tone.Transport.start() / stop()
// add button: circular + icon, toggles addOn
//   → glows when on, dim when off
// extend button: text button, toggles extendOn
// repeat buttons: 1/2/3/4, sets layers[selectedLayer].repeat
// octave buttons: −/+, sets layers[selectedLayer].octave, rebuilds note boxes in SoftPot
```

## MakeHookModal.jsx

```jsx
// triggered by clicking "+ make hook" in TopBar
// two options: microphone, softpot
// microphone flow:
//   1. request getUserMedia
//   2. record via MediaRecorder for 4-8 seconds (manual stop or auto at 8s)
//   3. show waveform visualization while recording
//   4. on stop: run essentia analysis (show loading state)
//   5. show detected key/bpm/meter with override dropdowns
//   6. show MIDI preview (play back detected notes)
//   7. confirm → commit Layer A, close modal
// softpot flow:
//   1. UI enters recording mode for Layer A
//   2. SoftPot input goes to recording buffer instead of live playback
//   3. same analysis and confirm flow
```

---

# websocket integration — useWebSocket.js

Create `src/hooks/useWebSocket.js`. This is entirely optional — the UI works without it.

```js
export function useWebSocket(onMessage) {
  useEffect(() => {
    let ws;
    try {
      // ESP32 serves at its IP address on port 81
      ws = new WebSocket("ws://192.168.1.XXX:81");
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        onMessage(msg);
      };
      ws.onerror = () =>
        console.log("WebSocket not available — running standalone");
    } catch {
      // silent fail — standalone mode
    }
    return () => ws?.close();
  }, []);
}
```

Message handler in App.jsx maps incoming messages to store actions:

```js
function handleWsMessage(msg) {
  switch (msg.type) {
    case "softpot":
      // msg.position (0-1), msg.velocity (0-127), msg.contact (bool)
      // trigger note event same as mouse interaction
      break;
    case "button":
      // msg.id: 'add' | 'play' | 'extend' | 'layer_A' | ... | 'oct_up' | 'oct_down'
      break;
    case "knob":
      // msg.id: 'filter' | 'reverb' | 'layer_fx'
      // msg.value: 0-1
      break;
  }
}
```

---

# scales utility — scales.js

Create `src/lib/scales.js`.

```js
import { Scale, Note } from "tonal";

// given a key string like 'A minor', return array of note names in that scale
export function getScaleNotes(keyString) {
  const [root, quality] = keyString.split(" ");
  const type = quality === "minor" ? "minor" : "major";
  return Scale.get(`${root} ${type}`).notes;
}

// given a MIDI note number and scale notes, return whether it is in the scale
export function isInScale(midiNote, scaleNotes) {
  const noteName = Note.fromMidi(midiNote).replace(/\d/, "");
  return scaleNotes.includes(noteName);
}

// given an array of MIDI notes, detect the most likely key using Tonal
export function detectKeyFromMidi(midiNotes) {
  const noteNames = midiNotes.map((m) => Note.fromMidi(m).replace(/\d/, ""));
  // use tonal key detection — compare against all major/minor scales
  // return best match as 'A minor' format string
}

// map SoftPot Y position (0-1) to MIDI note
export function positionToMidi(position, octave, totalSemitones = 24) {
  const semitone = Math.round((1 - position) * (totalSemitones - 1));
  const rootMidi = (octave + 1) * 12; // C of selected octave
  return rootMidi + semitone;
}
```

---

# drum zones — drumZones.js

Create `src/lib/drumZones.js`.

```js
export const DRUM_ZONES = [
  { name: "kick", top: 0.6, bottom: 1.0, color: "#EF9F27" }, // bottom 40%
  { name: "snare", top: 0.2, bottom: 0.6, color: "#1D9E75" }, // middle 40%
  { name: "hihat", top: 0.0, bottom: 0.2, color: "#7F77DD" }, // top 20%
];

export function getZone(position) {
  return (
    DRUM_ZONES.find((z) => position >= z.top && position < z.bottom)?.name ??
    "kick"
  );
}

// kit parameter presets
export const DRUM_KITS = {
  "electronic kit": {
    kick: { pitchDecay: 0.08, octaves: 6, release: 0.5, note: "C1" },
    snare: {
      noise: "white",
      attack: 0.001,
      decay: 0.15,
      sustain: 0,
      release: 0.1,
    },
    hihat: { frequency: 400, decay: 0.05, resonance: 0.5, release: 0.01 },
  },
  "acoustic kit": {
    kick: { pitchDecay: 0.12, octaves: 5, release: 0.8, note: "C1" },
    snare: {
      noise: "pink",
      attack: 0.001,
      decay: 0.25,
      sustain: 0,
      release: 0.15,
    },
    hihat: { frequency: 300, decay: 0.1, resonance: 0.4, release: 0.03 },
  },
  "lo-fi kit": {
    kick: { pitchDecay: 0.05, octaves: 4, release: 0.3, note: "D1" },
    snare: {
      noise: "brown",
      attack: 0.005,
      decay: 0.2,
      sustain: 0,
      release: 0.1,
    },
    hihat: { frequency: 600, decay: 0.03, resonance: 0.8, release: 0.005 },
  },
};
```

---

# implementation order

Build in this order. Each step should be testable before moving to the next.

1. **project scaffold** — Vite + React + Tone.js installed, empty App.jsx renders
2. **zustand store** — all state defined, verify with React DevTools
3. **static UI shell** — all components rendered with hardcoded data, no audio
4. **SoftPot mouse interaction** — dragging works, note boxes highlight correctly
5. **Tone.js synths** — `createSynth` for Layer A, trigger a note on SoftPot click, hear sound
6. **all 5 synth layers** — all patches implemented, switchable via sound picker
7. **loop engine basics** — Transport starts/stops, loop counter increments, single layer records and plays back
8. **add button logic** — commit at loop boundary, composition view updates
9. **all 5 layers in loop engine** — repeat rates, entryLoop offset, auto-extend
10. **extend button** — captures extra loop cycle
11. **sound picker** — slide-in panel, sample sound toggle, confirm on next loop boundary
12. **Essentia.js** — mic recording, analysis pipeline, hook recording modal
13. **SoftPot hook recording** — SoftPot path for hook recording
14. **MIDI roll view** — piano roll renders correctly for B/C/D
15. **WebSocket** — optional, add last so it doesn't block core functionality
16. **polish** — loading states for Essentia init, error handling, edge cases

---

# known constraints

- `Tone.start()` must be called inside a user gesture handler (click, keydown) — not on mount
- Essentia.js WASM takes 5-10 seconds to load — show a loading indicator
- `getUserMedia` requires HTTPS in production — localhost is exempt
- Tone.js Transport time is in seconds; bar/beat positions need conversion via `Tone.Time`
- SoftPot note box heights must be calculated dynamically based on strip height — use ResizeObserver
- WebSocket will fail silently in standalone mode — always check connection state before sending
