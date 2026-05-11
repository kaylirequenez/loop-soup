import { useEffect } from "react";
import { useTransportStore } from "../store/transportStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import { useSoundStore } from "../store/soundStore";
import { useMasterBusStore } from "../store/masterBusStore";
import { audioEngine } from "../audio/audioEngine";
import { partEngine } from "../audio/partEngine";
import {
  startPlaybackSession,
  stopPlaybackSession,
} from "../audio/transportController";
import { LAYER_IDS } from "../types/layer";
import type { LayerId } from "../types/layer";

export function useAudioScheduler(): void {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let active = true;
    let playbackUnsub: (() => void) | undefined;

    audioEngine.init().then(() => {
      if (!active) return;
      const latestLayers = useLayerStore.getState().layers;

      const syncAudibility = () => {
        const { isLayerAudible } = useLayerPlaybackStore.getState();
        for (const id of LAYER_IDS) {
          const audible = isLayerAudible(id);
          audioEngine.setLayerMute(id, !audible);
        }
      };

      const syncLayerState = () => {
        const currentSound = useSoundStore.getState();
        for (const id of LAYER_IDS) {
          audioEngine.setLayerVolume(id, currentSound.getLayerVolume(id));
          audioEngine.updateLayerMix(id, currentSound.getLayerMixKnobs(id));
        }
      };

      syncLayerState();
      syncAudibility();
      audioEngine.setMasterVolume(useMasterBusStore.getState().masterVolume);
      playbackUnsub = useLayerPlaybackStore.subscribe(syncAudibility);

      partEngine.rebuildAll(
        latestLayers,
        (layerId, loopId) =>
          useSoundStore.getState().getLoopMapping(layerId, loopId),
        (layerId, mapping) => audioEngine.createLoopVoice(layerId, mapping),
      );
      startPlaybackSession();
    });

    return () => {
      active = false;
      playbackUnsub?.();
      partEngine.disposeAll();
      audioEngine.cancelAll();
      stopPlaybackSession();
      audioEngine.stopPlayback();
    };
  }, [isPlaying]);
}
