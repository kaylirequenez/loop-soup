import { LAYER_COLORS, LAYER_ORDER } from "../lib/specs";

/**
 * Spec contract:
 * - Five lane composition timeline.
 * - Blocks show layer content length and spacing (repeat gaps).
 * - Shared red playhead across all lanes.
 */
export default function CompositionView({ currentLoop, totalLoops }) {
  return (
    <div className="comp-zone">
      <div className="comp-hdr">
        <span>composition</span>
        <span>{`loop ${currentLoop} of ${totalLoops}`}</span>
      </div>
      {LAYER_ORDER.map((layer) => (
        <div className="crow" key={layer}>
          <div className="clbl" style={{ color: LAYER_COLORS[layer] }}>
            {layer}
          </div>
          <div className="ctrack">
            <div
              className="cblock"
              style={{
                left: "0%",
                width: "100%",
                background: LAYER_COLORS[layer],
              }}
            />
            <div className="ph" style={{ left: "28%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
