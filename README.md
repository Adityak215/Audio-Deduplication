# Audio Upload Deduplication

Minimal demo for audio upload pipeline that:
- rejects exact duplicate files
- detects highly similar audio after async fingerprinting
- exposes warning history and realtime warning events

## Architecture Overview

- Frontend: Next.js app for upload, result state, warning tables, and SSE live updates.
- Backend API: Express service for upload handling, dedup checks, warning APIs, and SSE subscriptions.
- Database: PostgreSQL stores audio metadata, upload attempts, and similarity warnings.
- Queue + Worker: BullMQ with Redis processes fingerprint jobs asynchronously.
- Object Storage: Supabase buckets (`temp-uploads`, `audio-files`) store uploaded audio files.
- Fingerprinting: `fpcalc` (Chromaprint) produces perceptual audio fingerprints.

## Requirements Covered

1. Exact duplicate detection:
   SHA-256 is computed from file content and stored as `content_hash`.  
   `audio_files.content_hash` is unique, and insert uses `ON CONFLICT DO NOTHING`, so exact duplicates are rejected safely even under concurrent uploads.

2. Similarity detection:
   For accepted uploads, a BullMQ job is queued.  
   The worker runs `fpcalc` and compares the new perceptual fingerprint against existing processed files.

3. Similarity scoring:
   Fingerprints are base64-decoded and compared bit-by-bit with Hamming distance.  
   Formula:
   `similarityPercent = ((maxBits - distance) / maxBits) * 100`  
   with `maxBits = max(fingerprintA.length, fingerprintB.length) * 6`.  
   Warning threshold: `>= 70%`.

4. Warning output:
   Similar matches are saved in `similarity_warnings`, returned by REST endpoints, and pushed in realtime via SSE (`/upload/:audioId/subscribe`).

5. Further possible improvement: 
   Can add endpoint to delete a similar file based on it's ID from warnings or download any of the files uploaded but so far since the assignment was only focused on duplication detection this is the minimal functional version of the requirements.

6. Overall:
   - SHA-256 hashing for exact duplicate detection generates a deterministic, collision-resistant fingerprint of the file’s binary content, ensuring identical files (regardless of filename) are detected reliably and atomically enforced via a database UNIQUE constraint.

   - For content-level similarity across different encodings (e.g., FLAC vs MP3), using Chromaprint acoustic fingerprinting, which analyzes the audio’s frequency characteristics rather than metadata or raw bytes, allowing detection of perceptually identical audio even when file formats or compression differ.

## Backend Processing Flow

1. `POST /upload` receives file (Multer) and validates MIME type.
2. SHA-256 content hash is computed.
3. File is uploaded to Supabase `temp-uploads`.
4. Insert into `audio_files`:
   If hash conflict occurs, upload is marked duplicate and returns `409`.
5. If unique, file is moved to `audio-files` and fingerprint job is queued.
6. Worker downloads file, runs `fpcalc`, stores `perceptual_hash` and duration.
7. Similarity check runs, warnings are stored, SSE events are emitted.

## Assumptions and Trade-offs

- API and worker run in one Node process for simpler local setup.  
  Trade-off: convenient for assignment/demo; less scalable than separate deployable services.
- Similarity check returns after first match above threshold.  
  Trade-off: faster and simpler; does not list every possible similar file for one upload.
- SSE subscribers are tracked in-memory per server instance.  
  Trade-off: lightweight for single-instance demo; not shared across multiple backend instances.
- Upload validation is MIME-based.  
  Trade-off: minimal and fast; deeper binary/content validation is possible if needed.

## API Quick Reference

- `GET /health`
- `POST /upload` (`multipart/form-data`, field name: `audio`)
- `GET /upload/warnings`
- `GET /upload/:audioId/warnings`
- `GET /upload/:audioId/subscribe` (SSE)

## Prerequisites

- Node.js 22+
- PostgreSQL
- Redis
- Supabase project with buckets:
  - `temp-uploads`
  - `audio-files`
- `backend/fpcalc.exe` (already in repo)

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

### 1) Start Redis

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

Backend startup initializes database/schema and starts API + fingerprint worker.

### 3) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.
