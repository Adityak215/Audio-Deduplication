# Audio Upload Deduplication

Minimal full-stack demo for an audio upload pipeline that:
- rejects exact duplicates
- detects highly similar audio after async fingerprinting
- exposes warning history and realtime warnings

## Requirements Covered

1. Exact duplicate detection:
   Uses SHA-256 content hash of the uploaded file stream.  
   `audio_files.content_hash` is unique, and insert uses `ON CONFLICT DO NOTHING`, so duplicate uploads are rejected safely even under concurrency.

2. Similarity detection:
   After a unique upload is accepted, a BullMQ job is queued.  
   Worker runs `fpcalc` (Chromaprint) to create a perceptual fingerprint, then compares it against all stored fingerprints.

3. Similarity scoring:
   Fingerprints are decoded from base64 and compared bit-by-bit using Hamming distance.  
   Similarity formula:
   `similarityPercent = ((maxBits - distance) / maxBits) * 100`, where `maxBits = max(fingerprintA.length, fingerprintB.length) * 6`.  
   Warning threshold is `>= 70%`.

4. Warning output:
   Similar matches are saved in `similarity_warnings`, available via REST endpoints, and pushed live via SSE (`/upload/:audioId/subscribe`).

## Backend Processing  Flow

1. `POST /upload` receives file (Multer), validates MIME type.
2. SHA-256 is computed from local temp file.
3. File goes to Supabase `temp-uploads`.
4. DB insert into `audio_files`:
   If conflict on hash: mark upload attempt duplicate, delete temp object, return `409`.
5. If new file: move object to `audio-files` bucket on Supabase, queue fingerprint job.
6. Worker downloads file, runs `fpcalc`, stores `perceptual_hash` and duration.
7. Similarity check runs against existing fingerprints, writes warnings, emits SSE events.

## API Quick Reference

- `GET /health`
- `POST /upload` (`multipart/form-data`, field name: `audio`)
- `GET /upload/warnings` (latest global warnings)
- `GET /upload/:audioId/warnings` (warnings tied to one file)
- `GET /upload/:audioId/subscribe` (SSE stream for live warnings)

## Prerequisites

- Node.js 22+
- PostgreSQL
- Redis
- Supabase project with buckets:
  - `temp-uploads`
  - `audio-files`
- `backend/fpcalc.exe` available (already in repo)

## Environment

### Backend `.env` example

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=audio_dedup
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audio_dedup

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_SERVICE_ROLE=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
```

## Run Locally

### 1) Start Redis (if not already running)

From `backend/`:

```bash
docker compose up -d
```

### 2) Start backend

```bash
cd backend
npm install
npm run dev
```

The backend initializes DB/schema on startup and runs API + fingerprint worker in the same process.

### 3) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.
