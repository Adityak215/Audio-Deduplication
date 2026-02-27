'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import WarningList from '@/components/WarningList';
import {
  API_BASE_URL,
  checkBackendHealth,
  fetchAllWarnings,
  fetchWarningsForAudio,
  subscribeToWarnings,
  uploadAudioFile
} from '@/lib/api';

function createLiveWarning(event) {
  return {
    id: `${event.file1?.id || 'a'}-${event.file2?.id || 'b'}-${event.timestamp || Date.now()}`,
    file1: event.file1,
    file2: event.file2,
    similarityPercent: event.similarityPercent,
    detectedAt: event.timestamp
  };
}

export default function HomePage() {
  const [health, setHealth] = useState('checking');
  const [file, setFile] = useState(null);
  const [uploadState, setUploadState] = useState('idle');
  const [uploadMessage, setUploadMessage] = useState('');
  const [error, setError] = useState('');
  const [activeAudioId, setActiveAudioId] = useState('');
  const [fileWarnings, setFileWarnings] = useState([]);
  const [allWarnings, setAllWarnings] = useState([]);
  const [liveWarnings, setLiveWarnings] = useState([]);

  const hasSelectedFile = useMemo(() => Boolean(file), [file]);

  const refreshAllWarnings = useCallback(async () => {
    try {
      const warnings = await fetchAllWarnings();
      setAllWarnings(warnings);
    } catch {
      setAllWarnings([]);
    }
  }, []);

  const refreshCurrentWarnings = useCallback(async audioId => {
    if (!audioId) {
      setFileWarnings([]);
      return;
    }

    try {
      const warnings = await fetchWarningsForAudio(audioId);
      setFileWarnings(warnings);
    } catch {
      setFileWarnings([]);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function bootstrap() {
      try {
        await checkBackendHealth();
        if (!ignore) setHealth('online');
      } catch {
        if (!ignore) setHealth('offline');
      }

      if (!ignore) {
        refreshAllWarnings();
      }
    }

    bootstrap();

    return () => {
      ignore = true;
    };
  }, [refreshAllWarnings]);

  useEffect(() => {
    if (!activeAudioId) return undefined;

    const source = subscribeToWarnings(activeAudioId, {
      onMessage: event => {
        if (event.type !== 'similarity_detected') return;

        const warning = createLiveWarning(event);
        setLiveWarnings(previous => [warning, ...previous].slice(0, 20));
        refreshCurrentWarnings(activeAudioId);
        refreshAllWarnings();
      },
      onError: () => {
        setError('Realtime stream disconnected. Upload a new file to reconnect.');
      }
    });

    return () => {
      source.close();
    };
  }, [activeAudioId, refreshAllWarnings, refreshCurrentWarnings]);

  async function handleUpload(event) {
    event.preventDefault();

    if (!file) {
      setError('Choose an audio file first.');
      return;
    }

    setUploadState('uploading');
    setUploadMessage('');
    setError('');
    setLiveWarnings([]);

    try {
      const result = await uploadAudioFile(file);

      if (result?.duplicate) {
        setUploadMessage(result.message || 'Exact duplicate detected.');
        setActiveAudioId('');
        setFileWarnings([]);
      } else {
        setUploadMessage(`Upload accepted. Audio ID: ${result.audioId}`);
        setActiveAudioId(result.audioId);
        await refreshCurrentWarnings(result.audioId);
      }

      await refreshAllWarnings();
      setFile(null);
      event.target.reset();
    } catch (uploadError) {
      setError(uploadError.message || 'Upload failed.');
      setActiveAudioId('');
      setFileWarnings([]);
    } finally {
      setUploadState('idle');
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">Audio Upload Deduplication</p>
          <h1>Frontend Demo</h1>
          <p className="muted">
            Upload a file, detect exact duplicates, and monitor realtime similarity warnings.
          </p>
        </div>
        <div className={`status ${health === 'online' ? 'ok' : health === 'offline' ? 'bad' : ''}`}>
          <span>Backend</span>
          <strong>{health}</strong>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Upload Audio</h2>
          <span className="muted small">{API_BASE_URL}</span>
        </div>

        <form onSubmit={handleUpload} className="upload-form">
          <input
            type="file"
            name="audio"
            accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg"
            onChange={event => setFile(event.target.files?.[0] || null)}
          />
          <button type="submit" disabled={!hasSelectedFile || uploadState === 'uploading'}>
            {uploadState === 'uploading' ? 'Uploading...' : 'Upload'}
          </button>
        </form>

        {uploadMessage && <p className="message success">{uploadMessage}</p>}
        {error && <p className="message error">{error}</p>}
        {activeAudioId && (
          <p className="muted small">
            Listening for warnings on audio ID: <code>{activeAudioId}</code>
          </p>
        )}
      </section>

      <WarningList
        title="Live Similarity Events"
        warnings={liveWarnings}
        emptyMessage="No live similarity event yet."
      />

      <WarningList
        title="Warnings For Current Upload"
        warnings={fileWarnings}
        emptyMessage="Upload a non-duplicate file to inspect its warning history."
      />

      <WarningList
        title="Recent Warnings (Global)"
        warnings={allWarnings}
        emptyMessage="No warnings generated yet."
      />
    </main>
  );
}
