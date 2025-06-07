import { useState } from 'react';

interface VizImages {
  [channel: string]: string;
}

export function useVisualization() {
  const [images, setImages] = useState<VizImages>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (type: string, data: any[], channels: string[]) => {
    setError(null);
    setImages({});
    setLoading(true);
    try {
      const payload = { data, channels };
      const res = await fetch(`http://localhost:8003/viz?type=${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.images) {
        setImages(json.images);
      } else {
        throw new Error(json.error || 'Visualization failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { images, loading, error, run };
}
