import LayerCard from "./LayerCard";
import { LAYER_ORDER } from "../lib/specs";

/**
 * Spec contract:
 * - Render five layer cards A-E.
 * - Clicking a card sets active layer for SoftPot input routing.
 */
export default function LayerList({ selectedLayer, onSelectLayer }) {
  return (
    <div className="layers-scroll">
      {LAYER_ORDER.map((layerId) => (
        <LayerCard
          key={layerId}
          layerId={layerId}
          selected={selectedLayer === layerId}
          onSelect={onSelectLayer}
        />
      ))}
    </div>
  );
}
