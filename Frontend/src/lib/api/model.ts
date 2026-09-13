export interface ModelInfoResponse {
  model_name: string;
  device?: string;
  status?: string;
  backend?: string;
}

const API_BASE_URL =
  (import.meta as ImportMeta & {
    env: { VITE_API_URL?: string; VITE_API_BASE_URL?: string };
  }).env.VITE_API_URL ||
  (import.meta as ImportMeta & {
    env: { VITE_API_URL?: string; VITE_API_BASE_URL?: string };
  }).env.VITE_API_BASE_URL ||
  "http://127.0.0.1:8000";

let cachedModelInfo: ModelInfoResponse | null = null;
let pendingPromise: Promise<ModelInfoResponse> | null = null;

export async function getModelInfo(forceRefresh = false): Promise<ModelInfoResponse> {
  if (!forceRefresh && cachedModelInfo) {
    return cachedModelInfo;
  }

  if (pendingPromise && !forceRefresh) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    try {
      // 1. Try /engine/model
      const response = await fetch(`${API_BASE_URL}/engine/model`);
      if (response.ok) {
        const data = (await response.json()) as ModelInfoResponse;
        if (data.model_name) {
          cachedModelInfo = data;
          return data;
        }
      }
    } catch {
      // Ignore and fallback
    }

    try {
      // 2. Fallback to /model
      const altResponse = await fetch(`${API_BASE_URL}/model`);
      if (altResponse.ok) {
        const data = (await altResponse.json()) as ModelInfoResponse;
        if (data.model_name) {
          cachedModelInfo = data;
          return data;
        }
      }
    } catch {
      // Ignore and fallback
    }

    try {
      // 3. Fallback to /health
      const healthResponse = await fetch(`${API_BASE_URL}/health`);
      if (healthResponse.ok) {
        const data = (await healthResponse.json()) as { model_name?: string };
        if (data.model_name) {
          const result: ModelInfoResponse = {
            model_name: data.model_name,
            device: "cpu",
            status: "ready",
          };
          cachedModelInfo = result;
          return result;
        }
      }
    } catch {
      // Ignore and fallback
    }

    // Default fallback if backend is unreachable
    const fallback: ModelInfoResponse = {
      model_name: "Qwen/Qwen1.5-0.5B",
      device: "unknown",
      status: "offline",
    };
    return fallback;
  })().finally(() => {
    pendingPromise = null;
  });

  return pendingPromise;
}
