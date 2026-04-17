import { create } from "zustand";

const LAYERS = ["A", "B", "C", "D", "E"];
const REPEAT_OPTIONS = [1, 2, 3, 4];
const MAX_EXTRA_KNOBS = 3;

const DEFAULT_LAYER = {
  sound: null,
  octave: 3,
  repeat: 1,
  mode: "loop",
  volume: 0.7,
  filter: 0.8,
  reverb: 0.2,
  layerFx: 0.0,
  extraKnobs: 1,
  extraKnobValues: [0.5, 0.5, 0.5],
  status: "idle",
  muted: false,
  hasContent: false,
  loopLength: 1,
  entryLoop: null,
};

export const useAppStore = create((set) => ({
  isPlaying: false,
  addOn: false,
  extendOn: false,
  currentLoop: 2,
  totalLoops: 4,
  masterLoopLength: 4,
  bpm: 128,
  key: "A min",
  meter: "4/4",
  selectedLayer: "A",
  currentView: "layers",
  pickerOpen: false,
  softpotPosition: 0.652173913,
  midiRollCount: 1,
  midiMenuOpen: true,
  sampleSoundOn: true,
  previewSound: null,
  soloLayerId: null,
  preSoloMutes: null,

  layers: Object.fromEntries(
    LAYERS.map((id) => [
      id,
      {
        ...DEFAULT_LAYER,
        octave: id === "B" ? 1 : id === "D" ? 2 : id === "E" ? 3 : 4,
        mode: id === "C" ? "oneshot" : "loop",
        status: id === "A" || id === "E" ? "playing" : "idle",
        sound: {
          A: "synth lead",
          B: "sub bass",
          C: "pluck",
          D: "pad",
          E: "electronic kit",
        }[id],
        repeat: id === "D" ? 2 : 1,
      },
    ]),
  ),

  recordings: { A: [], B: [], C: [], D: [], E: [] },

  setPlaying: (value) => set({ isPlaying: value }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setAddOn: (value) => set({ addOn: value }),
  toggleAddOn: () => set((state) => ({ addOn: !state.addOn })),
  setExtendOn: (value) => set({ extendOn: value }),
  toggleExtendOn: () => set((state) => ({ extendOn: !state.extendOn })),
  selectLayer: (id) => set({ selectedLayer: id }),
  setView: (value) => set({ currentView: value }),
  setPickerOpen: (value) => set({ pickerOpen: value }),
  togglePickerOpen: () => set((state) => ({ pickerOpen: !state.pickerOpen })),
  setSoftpotPosition: (value) =>
    set({ softpotPosition: Math.max(0, Math.min(1, value)) }),
  setMidiRollCount: (value) =>
    set({ midiRollCount: value >= 2 ? 2 : 1 }),
  toggleMidiMenuOpen: () =>
    set((state) => ({ midiMenuOpen: !state.midiMenuOpen })),
  setSampleSoundOn: (value) => set({ sampleSoundOn: value }),
  setPreviewSound: (value) => set({ previewSound: value }),

  updateLayer: (id, patch) =>
    set((state) => ({
      layers: { ...state.layers, [id]: { ...state.layers[id], ...patch } },
    })),

  setLayerRepeat: (id, repeat) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          repeat: REPEAT_OPTIONS.includes(repeat)
            ? repeat
            : state.layers[id].repeat,
        },
      },
    })),

  setLayerOctave: (id, octave) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          octave: Math.max(0, Math.min(7, octave)),
        },
      },
    })),

  setLayerVolume: (id, volume) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          volume: Math.max(0, Math.min(1, volume)),
        },
      },
    })),

  setLayerKnobValue: (id, knobKey, value) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          [knobKey]: Math.max(0, Math.min(1, value)),
        },
      },
    })),

  setLayerExtraKnobValue: (id, knobIndex, value) =>
    set((state) => {
      const baseValues = state.layers[id].extraKnobValues ?? [0.5, 0.5, 0.5];
      const nextValues = [...baseValues];
      if (knobIndex >= 0 && knobIndex < nextValues.length) {
        nextValues[knobIndex] = Math.max(0, Math.min(1, value));
      }
      return {
        layers: {
          ...state.layers,
          [id]: {
            ...state.layers[id],
            extraKnobValues: nextValues,
          },
        },
      };
    }),

  toggleLayerMute: (id) =>
    set((state) => {
      const nextMuted = !state.layers[id].muted;
      const nextLayers = {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          muted: nextMuted,
        },
      };

      if (!state.soloLayerId || !state.preSoloMutes) {
        return { layers: nextLayers };
      }

      return {
        layers: nextLayers,
        preSoloMutes: {
          ...state.preSoloMutes,
          [id]: nextMuted,
        },
      };
    }),

  addLayerKnob: (id) =>
    set((state) => ({
      layers: {
        ...state.layers,
        [id]: {
          ...state.layers[id],
          extraKnobs: Math.min(
            MAX_EXTRA_KNOBS,
            (state.layers[id].extraKnobs ?? 0) + 1,
          ),
        },
      },
    })),

  toggleLayerSolo: (id) =>
    set((state) => {
      if (state.soloLayerId === id) {
        if (!state.preSoloMutes) {
          return { soloLayerId: null };
        }
        const restoredLayers = Object.fromEntries(
          Object.entries(state.layers).map(([layerId, layer]) => [
            layerId,
            { ...layer, muted: Boolean(state.preSoloMutes[layerId]) },
          ]),
        );
        return {
          layers: restoredLayers,
          soloLayerId: null,
          preSoloMutes: null,
        };
      }

      const baseMutes =
        state.preSoloMutes ??
        Object.fromEntries(
          Object.entries(state.layers).map(([layerId, layer]) => [
            layerId,
            Boolean(layer.muted),
          ]),
        );

      const soloLayers = Object.fromEntries(
        Object.entries(state.layers).map(([layerId, layer]) => [
          layerId,
          { ...layer, muted: layerId !== id },
        ]),
      );

      return {
        layers: soloLayers,
        soloLayerId: id,
        preSoloMutes: baseMutes,
      };
    }),

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
