import type {
  LayerId,
  LayerState,
  LayersState,
} from "../../types/model";

export type LayerHandler = (id: LayerId) => void;

export interface LayerListLikeProps {
  selectedLayer: LayerId;
  onSelectLayer: LayerHandler;
  onToggleLayerMute: LayerHandler;
  onToggleLayerSolo: LayerHandler;
  soloLayerId: LayerId | null;
  layers: LayersState;
}

export interface LayerCardProps {
  layerId: LayerId;
  layer: LayerState;
  selected: boolean;
  solo: boolean;
  onSelect: LayerHandler;
  onToggleMute: LayerHandler;
  onToggleSolo: LayerHandler;
}
