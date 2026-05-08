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
      syncAudibility();
      playbackUnsub = useLayerPlaybackStore.subscribe(syncAudibility);

      partEngine.rebuildAll(
        latestLayers,
        (layerId, mapping) => audioEngine.buildPlaybackSynth(layerId, mapping),
        (synth) => audioEngine.releasePlaybackSynth(synth),
      );
      startPlaybackSession();
    });

    return () => {
      active = false;
      playbackUnsub?.();
      partEngine.disposeAll();
      audioEngine.cancelAll();
      stopPlaybackSession();
      audioEngine.stop();
    };
  }, [isPlaying]);
}
