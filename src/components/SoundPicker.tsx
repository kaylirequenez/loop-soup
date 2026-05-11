import { useShallow } from "zustand/react/shallow";
import { SOUND_CATALOG } from "../sound/soundSpecs";
import { useSoundStore } from "../store/soundStore";
import { useLayerEditorStore } from "../store/layerEditorStore";
import type { LayerId } from "../types/layer";
import type { SoundCategory, SoundId } from "../types/sound";

interface SoundPickerProps {
  selectedLayer: LayerId;
  open: boolean;
}

const CATEGORY_LABELS: Record<SoundCategory, string> = {
  oscillator: "Oscillators",
  sampler: "Sampled",
  player: "One-shot",
};

const CATEGORY_ORDER: SoundCategory[] = ["oscillator", "sampler", "player"];

const SOUND_GROUPS: { category: SoundCategory; sounds: SoundId[] }[] = CATEGORY_ORDER.map(
  (category) => ({
    category,
    sounds: (Object.keys(SOUND_CATALOG) as SoundId[]).filter(
      (id) => SOUND_CATALOG[id].category === category,
    ),
  }),
).filter((g) => g.sounds.length > 0);

export default function SoundPicker({ selectedLayer, open }: SoundPickerProps) {
  const { setLayerSoundId, setLoopSoundId } = useSoundStore(
    useShallow((s) => ({
      setLayerSoundId: s.setLayerSoundId,
      setLoopSoundId: s.setLoopSoundId,
    })),
  );

  const activeLoopId = useLayerEditorStore((s) =>
    s.selectedLayerId === selectedLayer ? s.selectedLoopId : null,
  );

  const currentSoundId = useSoundStore((s) =>
    activeLoopId != null
      ? s.getLoopSound(selectedLayer, activeLoopId).soundId
      : s.getLayerDefaultSound(selectedLayer).soundId,
  );

  const selectSound = (soundId: SoundId) => {
    if (activeLoopId != null) {
      setLoopSoundId(selectedLayer, activeLoopId, soundId);
    } else {
      setLayerSoundId(selectedLayer, soundId);
    }
  };

  const scope = activeLoopId != null ? `loop ${activeLoopId + 1}` : "default";

  return (
    <aside className={`sound-picker ${open ? "picker-open" : ""}`}>
      <div className="picker-hdr">
        <span className="picker-hdr-label">sounds</span>
        <span className="picker-layer">{`${selectedLayer} · ${scope}`}</span>
      </div>

      <div className="snd-list">
        {SOUND_GROUPS.map(({ category, sounds }) => (
          <div key={category} className="snd-group">
            <div className="snd-group-label">{CATEGORY_LABELS[category]}</div>
            {sounds.map((soundId) => (
              <div
                key={soundId}
                className={`snd-item ${soundId === currentSoundId ? "snd-active" : ""}`}
                role="button"
                tabIndex={0}
                onClick={() => selectSound(soundId)}
                onKeyDown={(e) => e.key === "Enter" && selectSound(soundId)}
              >
                <span>{SOUND_CATALOG[soundId].displayName}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}
