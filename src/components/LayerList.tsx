import LayerCard from "./LayerCard";
import { LAYER_ORDER } from "../lib/layers";
import type { LayerListLikeProps } from "./layers/types";

export default function LayerList({
  selectedLayer,
  onSelectLayer,
  onToggleLayerMute,
  onToggleLayerSolo,
  soloLayerId,
  layers,
}: LayerListLikeProps) {
  return (
    <div className="layers-scroll">
      {LAYER_ORDER.map((layerId) => (
        <LayerCard
          key={layerId}
          layerId={layerId}
          layer={layers[layerId]}
          selected={selectedLayer === layerId}
          solo={soloLayerId === layerId}
          onSelect={onSelectLayer}
          onToggleMute={onToggleLayerMute}
          onToggleSolo={onToggleLayerSolo}
        />
      ))}
    </div>
  );
}
