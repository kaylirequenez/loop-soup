import type { LayerId } from "../types/layer";
import { ALL_SOUND_IDS, SOUND_CATALOG } from "../audio/sounds";

interface SoundPickerProps {
  selectedLayer: LayerId;
  open: boolean;
  sampleSoundOn: boolean;
  onToggleSample: () => void;
}

export default function SoundPicker({
  selectedLayer,
  open,
  sampleSoundOn,
  onToggleSample,
}: SoundPickerProps) {
  return (
    <aside className={`sound-picker ${open ? "picker-open" : ""}`}>
      <div className="picker-hdr">
        <span className="picker-hdr-label">sounds</span>
        <span className="picker-layer">{`layer ${selectedLayer}`}</span>
      </div>

      <div className="snd-list">
        {ALL_SOUND_IDS.map((soundId, index) => (
          <div
            key={soundId}
            className={`snd-item ${index === 0 ? "snd-active" : ""} ${index === 1 ? "snd-preview" : ""}`}
          >
            <span>{SOUND_CATALOG[soundId].displayName}</span>
            {index === 1 && <span className="snd-dot" />}
          </div>
        ))}
      </div>

      <div className="picker-btns">
        <button
          className={`pbtn ${sampleSoundOn ? "pbtn-sample" : ""}`}
          onClick={onToggleSample}
        >
          {`sample · ${sampleSoundOn ? "on" : "off"}`}
        </button>
        <button className="pbtn pbtn-confirm">confirm</button>
      </div>
    </aside>
  );
}
