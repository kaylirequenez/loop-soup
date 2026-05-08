import { useEffect } from "react";
import { useTransportStore } from "../store/transportStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import { audioEngine } from "../audio/audioEngine";
import { partEngine } from "../audio/partEngine";
import {
  startPlaybackSession,
  stopPlaybackSession,
} from "../audio/transportController";
import { LAYER_IDS } from "../types/layer";
import type { LayerId } from "../types/layer";
import type { SoundId } from "../audio/types";

export function useAudioScheduler(): void {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let active = true;
    let playbackUnsub: (() => void) | undefined;
    let layerUnsub: (() => void) | undefined;

    const layers = useLayerStore.getState().layers;
    const soundMap = new Map<LayerId, SoundId>(
      LAYER_IDS.map((id) => {
        const soundId = layers[id].defaultMapping.soundId;
        return [id, soundId];
      }),
    );

    audioEngine.init(soundMap).then(() => {
      if (!active) return;
      const latestLayers = useLayerStore.getState().layers;

      const syncAudibility = () => {
        const { isLayerAudible } = useLayerPlaybackStore.getState();
        for (const id of LAYER_IDS) {
          const audible = isLayerAudible(id);
          audioEngine.setLayerMute(id, !audible);
        }
      };

      const syncLayerVolumes = () => {
        const currentLayers = useLayerStore.getState().layers;
        for (const id of LAYER_IDS) {
          audioEngine.setLayerVolume(id, currentLayers[id].volume);
          audioEngine.setLayerSendLevels(id, {
            reverb: currentLayers[id].defaultMapping.knobsByEffect.attack?.value ?? 0.12,
            delay: currentLayers[id].defaultMapping.knobsByEffect.decay?.value ?? 0.08,
          });
        }
      };

      syncLayerVolumes();
      syncAudibility();
      playbackUnsub = useLayerPlaybackStore.subscribe(syncAudibility);
      layerUnsub = useLayerStore.subscribe(syncLayerVolumes);

      partEngine.rebuildAll(
        latestLayers,
        (layerId, mapping) => audioEngine.createLoopVoice(layerId, mapping),
      );
      startPlaybackSession();
    });

    return () => {
      active = false;
      playbackUnsub?.();
      layerUnsub?.();
      partEngine.disposeAll();
      audioEngine.cancelAll();
      stopPlaybackSession();
      audioEngine.stop();
    };
  }, [isPlaying]);
}
