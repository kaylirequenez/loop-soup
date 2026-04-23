import { initialNotesForLayerLoop } from "../../lib/initialPatternNotes";
import { listLayerLoopsOrdered } from "../../lib/layerRuntime";
import { LAYER_META, LAYER_ORDER } from "../../lib/layers";
import type {
  Layer,
  LayerId,
  LayerKnobEffect,
  LayerKnobsByEffect,
  LayerLoop,
  LayerLoopId,
  LayerLoopInstance,
  LayerState,
  LayersState,
  SoundMapping,
} from "../../types/layer";
import type { LoopDefinitionId, LoopDefinitionsState, LoopInstanceId } from "../../types/loop";
import type { MidiLoopRollPlacementMap, MidiRollPlacement, MidiNoteSelection } from "../../types/midi";
import { MIDI_LOOP_ROLL_PLACEMENTS } from "./midiPlacement";

const LAYER_KNOB_EFFECTS = ["filter", "reverb"] as const;

const LAYER_DEFAULTS: Record<LayerId, { spanBeats: number }> = {
  A: { spanBeats: 1 },
  B: { spanBeats: 2 },
  C: { spanBeats: 3 },
  D: { spanBeats: 4 },
  E: { spanBeats: 2 },
};

function buildDefaultSoundMapping(seedSound: string | null): SoundMapping {
  return {
    soundId: seedSound,
    knobsByEffect: {
      filter: { value: 0.8, label: "fltr" },
      reverb: { value: 0.2, label: "rvb" },
    },
  };
}

function buildLoopInstance(
  id: LoopInstanceId,
  startMeasure = 1,
): LayerLoopInstance {
  return {
    id,
    startMeasure: Math.max(1, Math.floor(Number(startMeasure)) || 1),
    repeatUnit: "measures",
    repeatEveryMeasuresMemory: null,
    repeatEveryBeatsMemory: null,
    repeatEndMeasure: null,
  };
}

function seedLayer(layerId: LayerId): { layer: Layer; defs: LoopDefinitionsState } {
  const defaults = LAYER_DEFAULTS[layerId];
  const spanBeats = Math.max(1, defaults.spanBeats ?? 4);
  const seedSound = LAYER_META[layerId]?.sound ?? null;
  const defaultMapping = buildDefaultSoundMapping(seedSound);
  const loopCount = layerId === "E" ? 2 : 1;
  const layerLoops: Record<LayerLoopId, LayerLoop> = {};
  const defs: LoopDefinitionsState = {};
  for (let i = 0; i < loopCount; i += 1) {
    const loopId = String(i + 1);
    const defId: LoopDefinitionId = `${layerId}-def-${loopId}`;
    const instId: LoopInstanceId = `${layerId}-loop-${loopId}-inst-1`;
    defs[defId] = {
      id: defId,
      spanBeats,
      notes: initialNotesForLayerLoop(layerId, i),
    };
    layerLoops[loopId] = {
      id: loopId,
      loopDefinitionId: defId,
      mapping: {
        soundId: defaultMapping.soundId,
        knobsByEffect: { ...defaultMapping.knobsByEffect } as LayerKnobsByEffect,
      },
      knobOrder: [...LAYER_KNOB_EFFECTS],
      loopInstances: { [instId]: buildLoopInstance(instId, 1 + i) },
    };
  }
  return {
    layer: {
      volume: 0.7,
      defaultMapping,
      knobOrder: [...LAYER_KNOB_EFFECTS],
      layerLoops,
    },
    defs,
  };
}

export function buildInitialLayer(layerId: LayerId): Layer {
  return seedLayer(layerId).layer;
}

/** Fresh project: layers plus all loop definitions referenced by those layers. */
export function buildInitialProject(): {
  layers: LayersState;
  definitions: LoopDefinitionsState;
} {
  const definitions: LoopDefinitionsState = {};
  const layers = {} as LayersState;
  for (const id of LAYER_ORDER) {
    const { layer, defs } = seedLayer(id);
    layers[id] = layer;
    Object.assign(definitions, defs);
  }
  return { layers, definitions };
}

export const buildInitialLayers = (): LayersState => buildInitialProject().layers;

export const buildInitialLayerLoopSelectionMemory = (): Record<
  LayerId,
  MidiNoteSelection
> => ({
  A: null,
  B: null,
  C: null,
  D: null,
  E: null,
});

export function buildDefaultMidiLoopRollPlacement(): MidiLoopRollPlacementMap {
  return {
    A: {},
    B: {},
    C: {},
    D: {},
    E: {},
  };
}

function legacyLayerRollPlacementFromPersist(
  legacyLayerMap: unknown,
  legacyRoll1Visibility: unknown,
  legacyRoll2Visibility: unknown,
): Record<LayerId, MidiRollPlacement> | null {
  if (legacyLayerMap && typeof legacyLayerMap === "object") {
    const per: Record<LayerId, MidiRollPlacement> = {
      A: "both",
      B: "both",
      C: "both",
      D: "both",
      E: "both",
    };
    const map = legacyLayerMap as Record<string, unknown>;
    let any = false;
    for (const id of LAYER_ORDER) {
      const v = map[id];
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(v as MidiRollPlacement)) {
        per[id] = v as MidiRollPlacement;
        any = true;
      }
    }
    if (any) {
      return per;
    }
  }
  const r1 =
    legacyRoll1Visibility && typeof legacyRoll1Visibility === "object"
      ? (legacyRoll1Visibility as Record<string, unknown>)
      : null;
  const r2 =
    legacyRoll2Visibility && typeof legacyRoll2Visibility === "object"
      ? (legacyRoll2Visibility as Record<string, unknown>)
      : null;
  if (!r1 || !r2) {
    return null;
  }
  const per: Record<LayerId, MidiRollPlacement> = {
    A: "both",
    B: "both",
    C: "both",
    D: "both",
    E: "both",
  };
  for (const id of LAYER_ORDER) {
    const a = r1[id] !== false;
    const b = r2[id] !== false;
    if (a && b) per[id] = "both";
    else if (a) per[id] = "1";
    else if (b) per[id] = "2";
    else per[id] = "both";
  }
  return per;
}

export function mergePersistedMidiLoopRollPlacement(
  stored: unknown,
): MidiLoopRollPlacementMap {
  const base = buildDefaultMidiLoopRollPlacement();
  if (!stored || typeof stored !== "object") {
    return base;
  }
  const storedMap = stored as Record<string, unknown>;
  for (const id of LAYER_ORDER) {
    const inner = storedMap[id];
    if (!inner || typeof inner !== "object") {
      continue;
    }
    const next: Record<string, MidiRollPlacement> = {};
    for (const [loopId, raw] of Object.entries(
      inner as Record<string, unknown>,
    )) {
      if (!loopId) continue;
      if (MIDI_LOOP_ROLL_PLACEMENTS.includes(raw as MidiRollPlacement)) {
        next[loopId] = raw as MidiRollPlacement;
      }
    }
    base[id] = next;
  }
  return base;
}

export function mergePersistedMidiLoopRollPlacementWithLegacy(
  persistedRaw: unknown,
  layers: LayersState,
  legacyLayerMap: unknown,
  legacyRoll1: unknown,
  legacyRoll2: unknown,
): MidiLoopRollPlacementMap {
  const fromSaved = mergePersistedMidiLoopRollPlacement(persistedRaw);
  const legacy = legacyLayerRollPlacementFromPersist(
    legacyLayerMap,
    legacyRoll1,
    legacyRoll2,
  );
  if (!legacy) {
    return fromSaved;
  }
  const out = { ...fromSaved };
  for (const id of LAYER_ORDER) {
    const v = legacy[id];
    if (!MIDI_LOOP_ROLL_PLACEMENTS.includes(v)) {
      continue;
    }
    const loops = listLayerLoopsOrdered(layers[id]);
    const inner = { ...(out[id] ?? {}) };
    for (const loop of loops) {
      inner[loop.id] = v;
    }
    out[id] = inner;
  }
  for (const id of LAYER_ORDER) {
    const savedInner = fromSaved[id];
    if (!savedInner || typeof savedInner !== "object") {
      continue;
    }
    out[id] = { ...(out[id] ?? {}), ...savedInner };
  }
  return out;
}

export function clampPersistedMidiPlayheadBeat(
  raw: unknown,
  beatLength: number,
): number {
  const len = Math.max(1e-6, beatLength);
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.min(Math.max(0, raw), len - 1e-6);
}

function migrateLegacyLoopsArray(
  legacyLoops: unknown[],
  layerId: LayerId,
  baseDefaultMapping: SoundMapping,
): {
  layerLoops: Record<LayerLoopId, LayerLoop>;
  defs: LoopDefinitionsState;
} {
  const layerLoops: Record<LayerLoopId, LayerLoop> = {};
  const defs: LoopDefinitionsState = {};
  const rows = legacyLoops.filter((l) => l && typeof l === "object");
  rows.forEach((raw, i) => {
    const row = raw as Record<string, unknown>;
    const loopId = typeof row.id === "string" && row.id.length > 0 ? row.id : String(i + 1);
    const defId: LoopDefinitionId = `${layerId}-def-${loopId}`;
    const instId: LoopInstanceId = `${layerId}-loop-${loopId}-inst-1`;
    defs[defId] = {
      id: defId,
      spanBeats: Math.max(1, Number(row.spanBeats) || 1),
      notes: Array.isArray(row.notes) ? (row.notes as never[]) : [],
    };
    layerLoops[loopId] = {
      id: loopId,
      loopDefinitionId: defId,
      mapping: {
        soundId:
          typeof row.sound === "string" || row.sound === null
            ? (row.sound as string | null)
            : baseDefaultMapping.soundId,
        knobsByEffect: { ...baseDefaultMapping.knobsByEffect } as LayerKnobsByEffect,
      },
      knobOrder: [...LAYER_KNOB_EFFECTS],
      loopInstances: {
        [instId]: {
          id: instId,
          startMeasure: Math.max(1, Math.floor(Number(row.startMeasure)) || 1),
          repeatUnit: row.repeatUnit === "beats" ? "beats" : "measures",
          repeatEveryMeasuresMemory:
            typeof row.repeatEveryMeasuresMemory === "number"
              ? row.repeatEveryMeasuresMemory
              : null,
          repeatEveryBeatsMemory:
            typeof row.repeatEveryBeatsMemory === "number"
              ? row.repeatEveryBeatsMemory
              : null,
          repeatEndMeasure:
            typeof row.repeatEndMeasure === "number" ? row.repeatEndMeasure : null,
        },
      },
    };
  });
  return { layerLoops, defs };
}

export function mergePersistedLayer(
  base: LayerState,
  layerId: LayerId,
  stored: unknown,
): { layer: LayerState; definitions: LoopDefinitionsState } {
  if (!stored || typeof stored !== "object") {
    return { layer: base, definitions: {} };
  }
  const storedObj = stored as Record<string, unknown>;
  const definitions: LoopDefinitionsState = {};

  const volume =
    typeof storedObj.volume === "number" && Number.isFinite(storedObj.volume)
      ? Math.max(0, Math.min(1, storedObj.volume))
      : base.volume;

  const soundFromLegacy =
    typeof storedObj.sound === "string" || storedObj.sound === null
      ? (storedObj.sound as string | null)
      : base.defaultMapping.soundId;

  const baseMapping = base.defaultMapping;
  const mergedDefault: SoundMapping = {
    soundId:
      storedObj.defaultMapping &&
      typeof storedObj.defaultMapping === "object" &&
      "soundId" in (storedObj.defaultMapping as object)
        ? ((storedObj.defaultMapping as SoundMapping).soundId ?? null)
        : soundFromLegacy,
    knobsByEffect: { ...baseMapping.knobsByEffect },
  };

  const legacyKnobValues: Partial<Record<LayerKnobEffect, number>> = {};
  if (typeof storedObj.filter === "number" && Number.isFinite(storedObj.filter)) {
    legacyKnobValues.filter = Math.max(0, Math.min(1, storedObj.filter));
  }
  if (typeof storedObj.reverb === "number" && Number.isFinite(storedObj.reverb)) {
    legacyKnobValues.reverb = Math.max(0, Math.min(1, storedObj.reverb));
  }

  const storedKnobsByEffect =
    storedObj.knobsByEffect && typeof storedObj.knobsByEffect === "object"
      ? (storedObj.knobsByEffect as Record<string, unknown>)
      : storedObj.defaultMapping &&
          typeof storedObj.defaultMapping === "object" &&
          (storedObj.defaultMapping as SoundMapping).knobsByEffect
        ? ((storedObj.defaultMapping as SoundMapping).knobsByEffect as unknown as Record<
            string,
            unknown
          >)
        : null;

  const legacyKnobArray = Array.isArray(storedObj.knobs)
    ? (storedObj.knobs as Array<{ effect?: unknown; value?: unknown }>)
    : [];

  for (const effect of LAYER_KNOB_EFFECTS) {
    const baseKnob = baseMapping.knobsByEffect[effect];
    const fromObject =
      storedKnobsByEffect?.[effect] &&
      typeof storedKnobsByEffect[effect] === "object"
        ? (storedKnobsByEffect[effect] as Record<string, unknown>)
        : null;
    const fromLegacyArray = legacyKnobArray.find((k) => k?.effect === effect);
    const rawValue =
      typeof fromObject?.value === "number" && Number.isFinite(fromObject.value)
        ? fromObject.value
        : typeof fromLegacyArray?.value === "number" &&
            Number.isFinite(fromLegacyArray.value)
          ? fromLegacyArray.value
          : legacyKnobValues[effect];

    const rawLabel =
      typeof fromObject?.label === "string" && fromObject.label.trim().length > 0
        ? fromObject.label
        : (baseKnob?.label ?? effect);

    mergedDefault.knobsByEffect[effect] = {
      value:
        typeof rawValue === "number"
          ? Math.max(0, Math.min(1, rawValue))
          : (baseKnob?.value ?? 0.5),
      label: rawLabel,
    };
  }

  const storedKnobOrder = Array.isArray(storedObj.knobOrder)
    ? storedObj.knobOrder.filter(
        (value): value is LayerKnobEffect =>
          typeof value === "string" &&
          (LAYER_KNOB_EFFECTS as readonly string[]).includes(value),
      )
    : [];
  const knobOrder =
    storedKnobOrder.length > 0 ? storedKnobOrder : [...base.knobOrder];

  let layerLoops: Record<LayerLoopId, LayerLoop> = { ...base.layerLoops };

  if (Array.isArray(storedObj.loops)) {
    const { layerLoops: migrated, defs } = migrateLegacyLoopsArray(
      storedObj.loops as unknown[],
      layerId,
      mergedDefault,
    );
    layerLoops = migrated;
    Object.assign(definitions, defs);
  } else if (
    storedObj.layerLoops &&
    typeof storedObj.layerLoops === "object" &&
    !Array.isArray(storedObj.layerLoops)
  ) {
    const rawLoops = storedObj.layerLoops as Record<string, unknown>;
    const nextLayerLoops: Record<LayerLoopId, LayerLoop> = {};
    for (const [loopId, rawLoop] of Object.entries(rawLoops)) {
      if (!rawLoop || typeof rawLoop !== "object") continue;
      const loopObj = rawLoop as Record<string, unknown>;
      const defId =
        typeof loopObj.loopDefinitionId === "string" && loopObj.loopDefinitionId.length > 0
          ? (loopObj.loopDefinitionId as LoopDefinitionId)
          : (`${layerId}-def-${loopId}` as LoopDefinitionId);
      const mapping: SoundMapping =
        loopObj.mapping && typeof loopObj.mapping === "object"
          ? ({
              soundId:
                (loopObj.mapping as Record<string, unknown>).soundId === null ||
                typeof (loopObj.mapping as Record<string, unknown>).soundId === "string"
                  ? ((loopObj.mapping as Record<string, unknown>).soundId as string | null)
                  : mergedDefault.soundId,
              knobsByEffect: {
                ...mergedDefault.knobsByEffect,
                ...(((loopObj.mapping as Record<string, unknown>).knobsByEffect ??
                  {}) as LayerKnobsByEffect),
              },
            } as SoundMapping)
          : {
              soundId: mergedDefault.soundId,
              knobsByEffect: { ...mergedDefault.knobsByEffect },
            };
      const loopKnobOrder = Array.isArray(loopObj.knobOrder)
        ? loopObj.knobOrder.filter((value): value is LayerKnobEffect =>
            (LAYER_KNOB_EFFECTS as readonly string[]).includes(String(value)),
          )
        : [];
      const rawInstances =
        loopObj.loopInstances && typeof loopObj.loopInstances === "object"
          ? (loopObj.loopInstances as Record<string, unknown>)
          : {};
      const loopInstances: Record<LoopInstanceId, LayerLoopInstance> = {};
      for (const [instId, rawInst] of Object.entries(rawInstances)) {
        if (!rawInst || typeof rawInst !== "object") continue;
        const instObj = rawInst as Record<string, unknown>;
        loopInstances[instId] = {
          id: instId,
          startMeasure: Math.max(1, Math.floor(Number(instObj.startMeasure)) || 1),
          repeatUnit: instObj.repeatUnit === "beats" ? "beats" : "measures",
          repeatEveryMeasuresMemory:
            typeof instObj.repeatEveryMeasuresMemory === "number"
              ? instObj.repeatEveryMeasuresMemory
              : null,
          repeatEveryBeatsMemory:
            typeof instObj.repeatEveryBeatsMemory === "number"
              ? instObj.repeatEveryBeatsMemory
              : null,
          repeatEndMeasure:
            typeof instObj.repeatEndMeasure === "number" ? instObj.repeatEndMeasure : null,
        };
      }
      if (Object.keys(loopInstances).length === 0) {
        const fallbackId = `${layerId}-loop-${loopId}-inst-1`;
        loopInstances[fallbackId] = buildLoopInstance(fallbackId, 1);
      }
      nextLayerLoops[loopId] = {
        id: loopId,
        loopDefinitionId: defId,
        mapping,
        knobOrder: loopKnobOrder.length > 0 ? loopKnobOrder : [...knobOrder],
        loopInstances,
      };
    }
    if (Object.keys(nextLayerLoops).length > 0) {
      layerLoops = nextLayerLoops;
    }
  } else if (
    storedObj.loopInstances &&
    typeof storedObj.loopInstances === "object"
  ) {
    const loopId = "1";
    const defId: LoopDefinitionId = `${layerId}-def-${loopId}`;
    const instancesRaw = storedObj.loopInstances as Record<string, unknown>;
    const loopInstances: Record<LoopInstanceId, LayerLoopInstance> = {};
    for (const [instId, rawInst] of Object.entries(instancesRaw)) {
      if (!rawInst || typeof rawInst !== "object") continue;
      const instObj = rawInst as Record<string, unknown>;
      loopInstances[instId] = {
        id: instId,
        startMeasure: Math.max(1, Math.floor(Number(instObj.startMeasure)) || 1),
        repeatUnit: instObj.repeatUnit === "beats" ? "beats" : "measures",
        repeatEveryMeasuresMemory:
          typeof instObj.repeatEveryMeasuresMemory === "number"
            ? instObj.repeatEveryMeasuresMemory
            : null,
        repeatEveryBeatsMemory:
          typeof instObj.repeatEveryBeatsMemory === "number"
            ? instObj.repeatEveryBeatsMemory
            : null,
        repeatEndMeasure:
          typeof instObj.repeatEndMeasure === "number" ? instObj.repeatEndMeasure : null,
      };
    }
    const firstInstance = Object.values(loopInstances)[0];
    definitions[defId] = {
      id: defId,
      spanBeats: 1,
      notes: [],
    };
    layerLoops = {
      [loopId]: {
        id: loopId,
        loopDefinitionId: defId,
        mapping: {
          soundId: mergedDefault.soundId,
          knobsByEffect: { ...mergedDefault.knobsByEffect },
        },
        knobOrder: [...knobOrder],
        loopInstances:
          Object.keys(loopInstances).length > 0
            ? loopInstances
            : {
                [`${layerId}-loop-${loopId}-inst-1`]: buildLoopInstance(
                  `${layerId}-loop-${loopId}-inst-1`,
                  firstInstance?.startMeasure ?? 1,
                ),
              },
      },
    };
  }
  if (Object.keys(layerLoops).length === 0) {
    layerLoops = { ...base.layerLoops };
  }
  for (const loop of Object.values(layerLoops)) {
    if (!definitions[loop.loopDefinitionId]) {
      definitions[loop.loopDefinitionId] = {
        id: loop.loopDefinitionId,
        spanBeats: 1,
        notes: [],
      };
    }
  }

  return {
    layer: {
      volume,
      defaultMapping: mergedDefault,
      knobOrder,
      layerLoops,
    },
    definitions,
  };
}

export function mergePersistedLayers(stored: unknown): {
  layers: LayersState;
  definitions: LoopDefinitionsState;
} {
  const base = buildInitialLayers();
  if (!stored || typeof stored !== "object") {
    const { definitions } = buildInitialProject();
    return { layers: base, definitions };
  }
  const storedObj = stored as Record<string, unknown>;
  const definitions: LoopDefinitionsState = {};
  const layers = {} as LayersState;
  for (const id of LAYER_ORDER) {
    const { layer, definitions: d } = mergePersistedLayer(base[id], id, storedObj[id]);
    layers[id] = layer;
    Object.assign(definitions, d);
  }
  return { layers, definitions };
}
