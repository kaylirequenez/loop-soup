import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTransportStore } from "../store/transportStore";
import { useLayerStore } from "../store/layerStore";
import { audioEngine } from "../audio/audioEngine";
import { LAYER_IDS } from "../types/layer";
import { defaultSoundForLayer } from "../audio/sounds";
import type { LayerId } from "../types/layer";
import type { SoundId } from "../audio/types";

export function useAudioScheduler(): void {
  const { isPlaying, transportNonce } = useTransportStore(
    useShallow((s) => ({
      isPlaying: s.isPlaying,
      transportNonce: s.transportNonce,
    })),
  );

  // Initialize (or reinitialize) audio engine when playback starts.
  useEffect(() => {
    if (!isPlaying) return;
    let active = true;

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
      for (const id of LAYER_IDS) {
        audioEngine.setLayerEnvelope(id, latestLayers[id].defaultMapping.knobsByEffect);
      }
      audioEngine.cancelAll();
    });

    return () => {
      active = false;
    };
  }, [isPlaying, transportNonce]);

  // Dispose instruments when playback stops, cancelling any pending scheduled notes.
  useEffect(() => {
    if (isPlaying) return;
    audioEngine.stop();
  }, [isPlaying]);
}
