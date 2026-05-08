import { useEffect } from "react";
import { getTransport } from "tone";
import { useTransportStore } from "../store/transportStore";
import { useLayerStore } from "../store/layerStore";
import { useLayerPlaybackStore } from "../store/layerPlaybackStore";
import { audioEngine } from "../audio/audioEngine";
import { partEngine } from "../audio/partEngine";
import { LAYER_IDS } from "../types/layer";
import type { LayerId } from "../types/layer";
import type { SoundId } from "../audio/types";
import { defaultSoundForLayer } from "../audio/sounds";

export function useAudioScheduler(): void {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    let active = true;
    let playbackUnsub: (() => void) | undefined;

    const layers = useLayerStore.getState().layers;
    const soundMap = new Map<LayerId, NonNullable<SoundId>>(
      LAYER_IDS.map((id) => {
        const soundId = layers[id].defaultMapping.soundId;
        return [id, soundId ?? defaultSoundForLayer(id)];
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
      const transport = getTransport();
      transport.start();
    });

    return () => {
      active = false;
      playbackUnsub?.();
      const transport = getTransport();
      partEngine.disposeAll();
      audioEngine.cancelAll();
      // pause() preserves current transport position; stop() resets to 0 and
      // can cause a transient nowbar flash at the origin on next resume.
      transport.pause();
      transport.loop = false;
      audioEngine.stop();
    };
  }, [isPlaying]);
}
