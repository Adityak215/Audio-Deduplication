# Audio Upload Deduplication System - Frontend

## Overview

This is a Next.js frontend for the Audio Upload Deduplication System. It provides a user-friendly interface for uploading audio files and receiving real-time notifications about duplicate and similar audio.

---

## Features

### 1. Audio Upload
- Drag-and-drop file upload
- Support for MP3, FLAC, WAV, OGG, M4A, AAC formats
- Progress indication during upload
- Instant feedback for duplicate detection

### 2. Real-Time Notifications
- Server-Sent Events (SSE) for push notifications
- Instant alerts when similar audio detected
- Shows both filenames and similarity percentage
- No polling required

### 3. History and Warnings
- View all uploaded audio files
- Check similarity warnings
- See which files match which other files
- Track similarity score (0-100%)

---

## Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn
- Backend API running on `http://localhost:5000` (configurable)

### Installation
```bash
cd frontend
npm install
```

### Environment Variables
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Running Development Server
```bash
npm run dev
# Visit http://localhost:3000
```

### Building for Production
```bash
npm run build
npm start
```

---

## Architecture

### Components
```
app/
  upload/
    page.tsx              # Main upload page
    UploadForm.tsx        # File upload form
    SimilarityAlert.tsx   # Real-time notification display
    WarningsList.tsx      # History of warnings
  layout.tsx              # Root layout
lib/
  api.ts                  # API client
  useSSE.ts               # SSE hook for real-time updates
```

### Key Hooks

#### `useSSE(audioId)`
Subscribes to real-time similarity warnings:
```typescript
const { warnings, isConnected, error } = useSSE(audioId);

// warnings: Array<SimilarityWarning>
// isConnected: boolean
// error: string | null
```

#### `useUpload(onSuccess, onError)`
Handles file upload with progress:
```typescript
const { upload, loading, progress, error } = useUpload(
  () => { /* on success */ },
  () => { /* on error */ }
);

// upload(file): Promise
// loading: boolean
// progress: 0-100
// error: string | null
```

---

## Real-Time Updates Flow

### 1. User Uploads File
```
User → [Upload Form] → Backend: POST /upload
```

### 2. Get AudioId
```
Backend → [Frontend] → { "audioId": "uuid" }
```

### 3. Subscribe to Warnings
```
Frontend: GET /upload/:audioId/subscribe (EventSource)
Connection stays open, waiting for notifications
```

### 4. Fingerprinting Happens (Backend)
```
Backend: Computes fingerprint (~100-200ms)
Backend: Checks similarity
```

### 5. Similarity Detected
```
Backend → [SSE Push]:
{
  "type": "similarity_detected",
  "file1": { "id": "uuid1", "filename": "Song.flac" },
  "file2": { "id": "uuid2", "filename": "Song.mp3" },
  "similarityPercent": 76.24,
  "timestamp": "2026-02-27T..."
}
```

### 6. Frontend Displays Alert
```
[Alert Component]:
⚠️ Similar File Detected
"Song.flac" is 76% similar to "Song.mp3"
[View Details] [Dismiss]
```

---

## Component Examples

### Basic Upload Form
```typescript
import { useState } from 'react';
import { useUpload } from '@/lib/useUpload';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const { upload, loading, progress } = useUpload(
    () => alert('Uploaded successfully'),
    () => alert('Upload failed')
  );

  const handleUpload = async () => {
    if (file) {
      const { audioId } = await upload(file);
      // Subscribe to warnings for this audioId
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept="audio/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? `${progress}%` : 'Upload'}
      </button>
    </div>
  );
}
```

### Real-Time Warning Display
```typescript
import { useSSE } from '@/lib/useSSE';

export default function SimilarityAlert({ audioId }: { audioId: string }) {
  const { warnings, isConnected } = useSSE(audioId);

  return (
    <div>
      {!isConnected && <p>Waiting for notifications...</p>}
      {warnings.map((warning) => (
        <div key={warning.id} className="alert alert-warning">
          <strong>{warning.file1.filename}</strong>
          {' is '}
          <strong>{warning.similarityPercent}%</strong>
          {' similar to '}
          <strong>{warning.file2.filename}</strong>
        </div>
      ))}
    </div>
  );
}
```

---

## API Integration

### Upload File
```typescript
// lib/api.ts
export async function uploadAudio(file: File): Promise<{
  duplicate: boolean;
  audioId: string;
  message?: string;
}> {
  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    body: formData
  });

  return response.json();
}
```

### Subscribe to Warnings
```typescript
export function subscribeToWarnings(
  audioId: string,
  onMessage: (warning: SimilarityWarning) => void,
  onError: (error: string) => void
): () => void {
  const eventSource = new EventSource(
    `${API_URL}/upload/${audioId}/subscribe`
  );

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'similarity_detected') {
      onMessage(data);
    }
  };

  eventSource.onerror = () => {
    onError('Connection lost');
    eventSource.close();
  };

  // Return cleanup function
  return () => eventSource.close();
}
```

### Get Warnings
```typescript
export async function getWarnings(
  audioId: string
): Promise<SimilarityWarning[]> {
  const response = await fetch(`${API_URL}/upload/${audioId}/warnings`);
  const { warnings } = await response.json();
  return warnings;
}
```

---

## Error Handling

### Upload Errors
```typescript
const handleUpload = async (file: File) => {
  try {
    const result = await uploadAudio(file);
    
    if (result.duplicate) {
      // File already exists
      showAlert('This file was already uploaded', 'warning');
    } else {
      // New file, subscribe to warnings
      subscribeToWarnings(result.audioId, ...);
    }
  } catch (error) {
    showAlert('Upload failed: ' + error.message, 'error');
  }
};
```

### SSE Connection Errors
```typescript
const unsubscribe = subscribeToWarnings(
  audioId,
  (warning) => {
    // Handle warning
  },
  (error) => {
    // Handle connection error
    console.error('Lost connection to server:', error);
    // Offer retry or fallback to polling
  }
);

// Cleanup on component unmount
return () => unsubscribe();
```

---

## Styling and UI

### Recommended Libraries
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Pre-built components
- **React Hot Toast** - Toast notifications
- **React DropZone** - Drag-and-drop uploads

### Key Screens

#### 1. Upload Screen
```
┌─────────────────────────────────────┐
│          Audio Upload               │
├─────────────────────────────────────┤
│                                     │
│   Drag files here or click browse   │
│                                     │
│              [Choose File]          │
│                                     │
│  [Upload] [Cancel]                  │
└─────────────────────────────────────┘
```

#### 2. Upload Success Screen
```
┌─────────────────────────────────────┐
│     ✓ Upload Successful             │
├─────────────────────────────────────┤
│                                     │
│  File: Song.mp3                     │
│  Size: 5.2 MB                       │
│  Status: Processing...              │
│                                     │
│  Waiting for similarity check...    │
│                                     │
└─────────────────────────────────────┘
```

#### 3. Warning Notification Screen
```
┌─────────────────────────────────────┐
│  ⚠ Similar File Detected            │
├─────────────────────────────────────┤
│                                     │
│  "Song.mp3" is 76% similar to       │
│  "Song.flac" (uploaded 2 days ago)  │
│                                     │
│  This audio content already exists  │
│  in a different format.             │
│                                     │
│  [View Existing] [Keep Both]        │
│                                     │
└─────────────────────────────────────┘
```

---

## Testing

### Manual Testing

**Test 1: Exact Duplicate**
1. Upload `song.mp3`
2. Upload same `song.mp3` again
3. Expect: Instant error "Exact duplicate detected"

**Test 2: Similar Files**
1. Upload `song.flac`
2. Upload `song.mp3` (same audio, different format)
3. Expect: First upload succeeds
4. Second upload succeeds
5. Within 500ms, see warning: "76% similar"

**Test 3: Different Files**
1. Upload `song1.mp3`
2. Upload `song2.mp3`
3. Expect: Both succeed, no warnings

**Test 4: SSE Connection**
1. Open browser DevTools → Network
2. Upload file
3. Check for EventSource connection
4. Filter by "streaming" type
5. Should see persistent connection

---

## Troubleshooting

### "Upload failed: CORS error"
**Solution:**
1. Ensure backend has CORS enabled
2. Check `NEXT_PUBLIC_API_URL` is correct
3. Backend should allow origin `http://localhost:3000`

### "Warnings not appearing"
**Diagnosis:**
```javascript
// Open console
const es = new EventSource('http://localhost:5000/upload/<audioId>/subscribe');
es.onmessage = (e) => console.log(JSON.parse(e.data));
es.onerror = () => console.error('SSE error');
```

**Solutions:**
- Check network tab for EventSource connection
- Verify backend logs show subscriber connected
- Check audio file takes <500ms to fingerprint

### "Upload appears stuck at 0%"
**Solutions:**
- Check backend is running: `curl http://localhost:5000/health`
- Check file is not corrupted
- Check file size under 50MB
- Check browser console for errors

### "Cannot read 'audioId' of undefined"
**Cause:** Response structure mismatch

**Solution:** Verify backend response format:
```json
// Correct:
{ "duplicate": false, "audioId": "uuid" }

// Wrong:
{ "id": "uuid" }
```

---

## Performance Tips

### 1. Optimize Image/Icon Loading
- Use `next/image` for favicon/logo
- Lazy load warning history

### 2. Cache Warnings List
```typescript
const [warnings, setWarnings] = useState([]);
const cache = useRef({});

const fetchWarnings = useCallback(async (audioId) => {
  if (cache.current[audioId]) {
    setWarnings(cache.current[audioId]);
  } else {
    const w = await getWarnings(audioId);
    cache.current[audioId] = w;
    setWarnings(w);
  }
}, []);
```

### 3. Debounce File Input
```typescript
const [file, setFile] = useState(null);
const debouncedUpload = useMemo(
  () => debounce((f) => upload(f), 500),
  []
);
```

### 4. Cancel Previous Requests
```typescript
const controller = new AbortController();
fetch(url, { signal: controller.signal });
cleanup(() => controller.abort());
```

---

## Deployment

### Vercel (Recommended for Next.js)
```bash
# 1. Push to GitHub
git push origin main

# 2. Import in Vercel dashboard
# Select repository and deploy

# 3. Set environment variables
# NEXT_PUBLIC_API_URL=https://api.example.com
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables for Production
```bash
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_ANALYTICS_ID=ua-xxxxx
```

---

## Summary

This frontend provides a **user-friendly interface** for the audio deduplication system with:

✅ **Simple file upload** with drag-and-drop  
✅ **Real-time notifications** via SSE  
✅ **Instant duplicate detection** feedback  
✅ **Similarity warning display** with percentages  
✅ **Error handling** for network issues  
✅ **Responsive design** for mobile and desktop  

The system is designed to feel instant and responsive, with all feedback happening within 500ms of user action.
