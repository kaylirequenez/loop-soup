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
import { transportDebug } from "../utils/transportDebug";

export function useAudioScheduler(): void {
  const isPlaying = useTransportStore((s) => s.isPlaying);

  useEffect(() => {
    if (!isPlaying) return;
    transportDebug("audioScheduler:effectStart");
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
      transportDebug("audioScheduler:audioEngineReady", {
        channelCount: LAYER_IDS.length,
      });
      const latestLayers = useLayerStore.getState().layers;

      const syncAudibility = () => {
        const { isLayerAudible } = useLayerPlaybackStore.getState();
        for (const id of LAYER_IDS) {
          audioEngine.setLayerMute(id, !isLayerAudible(id));
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
      transportDebug("audioScheduler:transport.start()", {
        beforeState: transport.state,
        ticks: transport.ticks,
      });
      transport.start();
      transportDebug("audioScheduler:transport.started", {
        afterState: transport.state,
        ticks: transport.ticks,
      });
    });

    return () => {
      active = false;
      playbackUnsub?.();
      const transport = getTransport();
      transportDebug("audioScheduler:cleanupStopSession", {
        state: transport.state,
        ticks: transport.ticks,
      });
      partEngine.disposeAll();
      audioEngine.cancelAll();
      transport.stop();
      transport.loop = false;
      audioEngine.stop();
    };
  }, [isPlaying]);
}
