import { SOUND_OPTIONS } from "../lib/specs";

/**
 * Spec contract:
 * - Right slide-in sound picker.
 * - Show list for selected layer and sample/confirm controls.
 * - Later: headphone preview and boundary-quantized confirm.
 */
export default function SoundPicker({ selectedLayer, open }) {
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
        <button className="pbtn pbtn-sample">sample · on</button>
        <button className="pbtn pbtn-confirm">confirm</button>
      </div>
    </aside>
  );
}
