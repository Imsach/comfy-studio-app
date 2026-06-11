import { useState, useCallback } from 'react';
import {
  submitWorkflow,
  pollUntilComplete,
  getImageUrl,
  pickBestServer,
  markServerBusy,
  markServerFree,
  waitForServerQueue,
} from '../services/comfyClient';
import { createGeneration, updateGeneration } from '../services/generationService';
import { useJobStore } from '../store/jobStore';
import { useServerStore } from '../store/serverStore';
import type { GenerationType, ComfyWorkflow, Generation } from '../types';

interface UseGenerationReturn {
  generate: (
    type: GenerationType,
    prompt: string,
    settings: Record<string, unknown>,
    buildWorkflow: () => Promise<ComfyWorkflow> | ComfyWorkflow
  ) => Promise<Generation | null>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addJob = useJobStore((s) => s.addJob);
  const updateJob = useJobStore((s) => s.updateJob);

  const generate = useCallback(
    async (
      type: GenerationType,
      prompt: string,
      settings: Record<string, unknown>,
      buildWorkflow: () => Promise<ComfyWorkflow> | ComfyWorkflow
    ): Promise<Generation | null> => {
      setLoading(true);
      setError(null);

      let gen: Generation | null = null;
      let trackedServer: string | null = null;

      const statuses = useServerStore.getState().statuses;
      const serverUrl = pickBestServer(statuses, type);

      try {
        gen = await createGeneration(type, prompt, settings);
        const genId = gen.id;
        addJob(gen);

        await waitForServerQueue(serverUrl, 120000);

        markServerBusy(serverUrl);
        trackedServer = serverUrl;

        const workflow = await buildWorkflow();
        const result = await submitWorkflow(workflow, serverUrl);

        gen = await updateGeneration(genId, {
          status: 'processing',
          comfy_job_id: result.prompt_id,
        });
        updateJob(genId, { status: 'processing', comfy_job_id: result.prompt_id });

        const history = await pollUntilComplete(result.prompt_id, (pct) => {
          updateJob(genId, { progress: pct });
        }, 600000, serverUrl);

        markServerFree(serverUrl);
        trackedServer = null;

        let outputUrl: string | null = null;
        const outputs = history.outputs;

        for (const nodeId of Object.keys(outputs)) {
          const nodeOutput = outputs[nodeId];

          if (nodeOutput.images && nodeOutput.images.length > 0) {
            const img = nodeOutput.images[0];
            outputUrl = getImageUrl(img.filename, img.subfolder, img.type, serverUrl);
            break;
          }

          if (nodeOutput.audio && nodeOutput.audio.length > 0) {
            const audio = nodeOutput.audio[0];
            outputUrl = getImageUrl(audio.filename, audio.subfolder, audio.type, serverUrl);
            break;
          }

          if (nodeOutput.gltfFiles && nodeOutput.gltfFiles.length > 0) {
            const mesh = nodeOutput.gltfFiles[0];
            outputUrl = getImageUrl(mesh.filename, mesh.subfolder, mesh.type, serverUrl);
            break;
          }

          if (nodeOutput.mesh && nodeOutput.mesh.length > 0) {
            const mesh = nodeOutput.mesh[0];
            outputUrl = getImageUrl(mesh.filename, mesh.subfolder, mesh.type, serverUrl);
            break;
          }
        }

        gen = await updateGeneration(genId, {
          status: 'completed',
          output_url: outputUrl,
          progress: 100,
          completed_at: new Date().toISOString(),
        });
        updateJob(genId, { status: 'completed', progress: 100, output_url: outputUrl });

        return gen;
      } catch (err) {
        if (trackedServer) {
          markServerFree(trackedServer);
        }
        const message = err instanceof Error ? err.message : 'Generation failed';
        setError(message);
        if (gen) {
          await updateGeneration(gen.id, { status: 'failed', error_message: message }).catch(() => {});
          updateJob(gen.id, { status: 'failed', error_message: message });
        }
        return null;
      } finally {
        setLoading(false);
      }
    },
    [addJob, updateJob]
  );

  const clearError = useCallback(() => setError(null), []);

  return { generate, loading, error, clearError };
}
