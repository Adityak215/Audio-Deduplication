export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

async function parseJson(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Health check failed (${response.status})`);
  }

  return response.json();
}

export async function uploadAudioFile(file) {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData
  });

  const payload = await parseJson(response);

  if (response.status === 409) {
    return payload || { duplicate: true, message: 'Exact duplicate detected' };
  }

  if (!response.ok) {
    const details = payload?.error || payload?.message || 'Upload failed';
    throw new Error(details);
  }

  return payload;
}

export async function fetchAllWarnings() {
  const response = await fetch(`${API_BASE_URL}/upload/warnings`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch warnings (${response.status})`);
  }

  const payload = await response.json();
  return payload?.warnings || [];
}

export async function fetchWarningsForAudio(audioId) {
  const response = await fetch(`${API_BASE_URL}/upload/${audioId}/warnings`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch warnings for ${audioId}`);
  }

  const payload = await response.json();
  return payload?.warnings || [];
}

export function subscribeToWarnings(audioId, handlers = {}) {
  const source = new EventSource(`${API_BASE_URL}/upload/${audioId}/subscribe`);

  source.onmessage = event => {
    try {
      const data = JSON.parse(event.data);
      handlers.onMessage?.(data);
    } catch (error) {
      handlers.onError?.(error);
    }
  };

  source.onerror = () => {
    handlers.onError?.(new Error('SSE connection dropped'));
  };

  return source;
}
