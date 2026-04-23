import { SOUND_OPTIONS } from "../lib/layers";
import type { LayerId } from "../types/layer";

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
  const sounds = SOUND_OPTIONS[selectedLayer] ?? [];

  return (
    <aside className={`sound-picker ${open ? "picker-open" : ""}`}>
      <div className="picker-hdr">
        <span className="picker-hdr-label">sounds</span>
        <span className="picker-layer">{`layer ${selectedLayer}`}</span>
      </div>

      <div className="snd-list">
        {sounds.map((sound, index) => (
          <div
            key={sound}
            className={`snd-item ${index === 0 ? "snd-active" : ""} ${index === 1 ? "snd-preview" : ""}`}
          >
            <span>{sound}</span>
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
