export const LAYER_ORDER = ["A", "B", "C", "D", "E"];

export const LAYER_COLORS = {
  A: "var(--layer-a)",
  B: "var(--layer-b)",
  C: "var(--layer-c)",
  D: "var(--layer-d)",
  E: "var(--layer-e)",
};

export const LAYER_META = {
  A: {
    role: "hook",
    fxLabel: "trsp",
    sound: "synth lead",
  },
  B: { role: "bass", fxLabel: "drv", sound: "sub bass" },
  C: {
    role: "melody",
    fxLabel: "dly",
    sound: "pluck",
  },
  D: { role: "harmony", fxLabel: "wid", sound: "pad" },
  E: {
    role: "drums",
    fxLabel: "room",
    sound: "electronic kit",
  },
};

export const SOUND_OPTIONS = {
  A: ["synth lead", "pluck", "bell", "pad lead", "organ"],
  B: ["sub bass", "reese bass", "moog bass", "808"],
  C: ["synth lead", "pluck", "bell", "pad lead", "organ"],
  D: ["pad", "strings", "choir", "Rhodes", "stab"],
  E: ["electronic kit", "acoustic kit", "lo-fi kit"],
};
