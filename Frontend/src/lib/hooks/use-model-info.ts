import { useEffect, useState } from "react";
import { getModelInfo, ModelInfoResponse } from "@/lib/api/model";

export function useModelInfo() {
  const [modelInfo, setModelInfo] = useState<ModelInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getModelInfo()
      .then((data) => {
        if (isMounted) {
          setModelInfo(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    modelName: modelInfo?.model_name || "Qwen/Qwen1.5-0.5B",
    device: modelInfo?.device || "unknown",
    status: modelInfo?.status || "ready",
    loading,
    modelInfo,
  };
}
